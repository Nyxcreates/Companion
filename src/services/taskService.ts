import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import { TaskModel, type TaskDocument } from "@/models/Task";
import { GoalModel } from "@/models/Goal";
import { runWithOptionalTransaction } from "@/lib/db/transaction";
import { detachScheduleFromTask, endLiveFocusSessions } from "@/services/dataService";
import { TaskPersistenceError, InvalidGoalReferenceError } from "@/lib/tasks/errors";
import type { TaskSummary, TaskStatus } from "@/types/task";

/** Batches goal-title lookups for a set of tasks into a single query, so listing N tasks never costs N extra round-trips. */
async function buildGoalTitleMap(docs: TaskDocument[]): Promise<Map<string, string>> {
  const ids = Array.from(new Set(docs.filter((d) => d.goalId).map((d) => String(d.goalId))));
  if (ids.length === 0) return new Map();

  const goals = await GoalModel.find({ _id: { $in: ids } }).select("_id title");
  return new Map(goals.map((g) => [String(g._id), g.title]));
}

function toSummary(doc: TaskDocument, goalTitleMap: Map<string, string>): TaskSummary {
  const goalId = doc.goalId ? String(doc.goalId) : null;
  return {
    id: String(doc._id),
    title: doc.title,
    description: doc.description,
    status: doc.status,
    dueDate: doc.dueDate ? doc.dueDate.toISOString() : null,
    goalId,
    goalTitle: goalId ? (goalTitleMap.get(goalId) ?? null) : null,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
    completedAt: doc.completedAt ? doc.completedAt.toISOString() : null,
  };
}

/**
 * Verifies a goalId, if provided, actually references a Goal owned by
 * this user — never trust a client-supplied goal reference at face
 * value. Returns the validated ObjectId, or null if no goalId was
 * given. Throws InvalidGoalReferenceError if the id is malformed,
 * doesn't exist, or belongs to a different user.
 */
async function resolveOwnedGoalId(
  goalId: string | null | undefined,
  firebaseUid: string
): Promise<mongoose.Types.ObjectId | null> {
  if (!goalId) return null;
  if (!mongoose.isValidObjectId(goalId)) throw new InvalidGoalReferenceError();

  const goal = await GoalModel.findOne({ _id: goalId, firebaseUid }).select("_id");
  if (!goal) throw new InvalidGoalReferenceError();

  return goal._id as mongoose.Types.ObjectId;
}

interface CreateTaskParams {
  firebaseUid: string;
  title: string;
  description: string | null;
  dueDate: string | null;
  goalId: string | null;
}

/** New tasks always start PENDING. If goalId is provided, it must reference a Goal owned by the same user (InvalidGoalReferenceError otherwise — this deliberately runs BEFORE the try/catch below, so it surfaces as itself rather than being wrapped as a generic persistence failure). */
export async function createTask(params: CreateTaskParams): Promise<TaskSummary> {
  await connectToDatabase();
  const resolvedGoalId = await resolveOwnedGoalId(params.goalId, params.firebaseUid);

  try {
    const doc = await TaskModel.create({
      firebaseUid: params.firebaseUid,
      title: params.title,
      description: params.description,
      status: "PENDING",
      dueDate: params.dueDate ? new Date(params.dueDate) : null,
      goalId: resolvedGoalId,
    });
    const goalTitleMap = await buildGoalTitleMap([doc]);
    return toSummary(doc, goalTitleMap);
  } catch (error) {
    throw new TaskPersistenceError("create task", error);
  }
}

/** Newest first. Optionally filtered by status and/or goal. Grouping into Pending/In progress/Completed sections is a display concern handled client-side, matching GoalBoard's pattern. An invalid goalId filter simply returns no results rather than erroring. */
export async function listTasks(
  firebaseUid: string,
  filters: { status?: TaskStatus; goalId?: string } = {}
): Promise<TaskSummary[]> {
  try {
    await connectToDatabase();

    const query: Record<string, unknown> = { firebaseUid };
    if (filters.status) query.status = filters.status;
    if (filters.goalId) {
      if (!mongoose.isValidObjectId(filters.goalId)) return [];
      query.goalId = filters.goalId;
    }

    const docs = await TaskModel.find(query).sort({ createdAt: -1 });
    const goalTitleMap = await buildGoalTitleMap(docs);
    return docs.map((doc) => toSummary(doc, goalTitleMap));
  } catch (error) {
    throw new TaskPersistenceError("list tasks", error);
  }
}

/** Returns null (never throws) when not found or not owned, so the route can return a clean 404. */
export async function getTask(id: string, firebaseUid: string): Promise<TaskSummary | null> {
  try {
    await connectToDatabase();
    if (!mongoose.isValidObjectId(id)) return null;

    const doc = await TaskModel.findOne({ _id: id, firebaseUid });
    if (!doc) return null;

    const goalTitleMap = await buildGoalTitleMap([doc]);
    return toSummary(doc, goalTitleMap);
  } catch (error) {
    throw new TaskPersistenceError("get task", error);
  }
}

interface UpdateTaskParams {
  title?: string;
  description?: string | null;
  dueDate?: string | null;
  goalId?: string | null;
  status?: TaskStatus;
}

/**
 * Applies any combination of updates in one call, mirroring
 * updateGoal's shape. Completing a task sets completedAt; moving a
 * task away from COMPLETED (including reopening it) clears it.
 *
 * Deliberately does NOT touch the associated Goal in any way —
 * completing or reopening a task never changes a Goal's status or
 * progress. That kind of rollup is a real feature decision the Goal
 * system hasn't asked for; inventing it here would be scope creep on
 * a system this milestone was told not to modify.
 *
 * Returns null if not found/not owned. Throws InvalidGoalReferenceError
 * if a new goalId doesn't resolve to a Goal owned by this user.
 */
export async function updateTask(
  id: string,
  firebaseUid: string,
  params: UpdateTaskParams
): Promise<TaskSummary | null> {
  await connectToDatabase();

  let resolvedGoalId: mongoose.Types.ObjectId | null | undefined;
  if (params.goalId !== undefined) {
    resolvedGoalId = await resolveOwnedGoalId(params.goalId, firebaseUid);
  }

  try {
    if (!mongoose.isValidObjectId(id)) return null;
    const doc = await TaskModel.findOne({ _id: id, firebaseUid });
    if (!doc) return null;

    if (params.title !== undefined) doc.title = params.title;
    if (params.description !== undefined) doc.description = params.description;
    if (params.dueDate !== undefined) doc.dueDate = params.dueDate ? new Date(params.dueDate) : null;
    if (resolvedGoalId !== undefined) doc.goalId = resolvedGoalId;

    if (params.status !== undefined) {
      doc.status = params.status;
      doc.completedAt = params.status === "COMPLETED" ? new Date() : null;
    }

    await doc.save();
    const goalTitleMap = await buildGoalTitleMap([doc]);
    return toSummary(doc, goalTitleMap);
  } catch (error) {
    throw new TaskPersistenceError("update task", error);
  }
}

/**
 * Hard delete, regardless of status. Unlike Goals — where a COMPLETED
 * goal is kept as a permanent record of progress and can't be deleted
 * (see GoalCompletedError) — a completed Task carries no equivalent
 * "meaningful milestone" weight. Tasks are lightweight, concrete
 * actions; there's nothing in the task-system spec asking for a
 * delete-protection rule here, so this deliberately does not invent
 * one by copying Goal's behavior. Returns null if not found/not owned.
 */
export async function deleteTask(id: string, firebaseUid: string): Promise<boolean | null> {
  try {
    await connectToDatabase();
    if (!mongoose.isValidObjectId(id)) return null;

    const doc = await TaskModel.findOne({ _id: id, firebaseUid });
    if (!doc) return null;

        // A running focus session on this task is ended first (its real focused time is kept).
    await endLiveFocusSessions(firebaseUid, [String(doc._id)]);

    await runWithOptionalTransaction(async (session) => {
      await detachScheduleFromTask(firebaseUid, String(doc._id), session);
      await TaskModel.deleteOne({ _id: doc._id, firebaseUid }, session ? { session } : {});
    });
    return true;
  } catch (error) {
    throw new TaskPersistenceError("delete task", error);
  }
}