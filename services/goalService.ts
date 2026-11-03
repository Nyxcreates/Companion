import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import { GoalModel, type GoalDocument } from "@/models/Goal";
import { GoalPersistenceError, GoalCompletedError } from "@/lib/goals/errors";
import { runWithOptionalTransaction } from "@/lib/db/transaction";
import { detachTasksFromGoals } from "@/services/dataService";
import { computeProgressPercent } from "@/lib/goals/progress";
import type { GoalSummary, GoalStatus, GoalPriority, GoalCategory } from "@/types/goal";

function toSummary(doc: GoalDocument): GoalSummary {
  return {
    id: String(doc._id),
    title: doc.title,
    description: doc.description,
    category: doc.category,
    priority: doc.priority,
    status: doc.status,
    deadline: doc.deadline ? doc.deadline.toISOString() : null,
    targetLabel: doc.targetLabel,
    targetValue: doc.targetValue,
    progressValue: doc.progressValue,
    progressPercent: computeProgressPercent(doc.targetValue, doc.progressValue),
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
    completedAt: doc.completedAt ? doc.completedAt.toISOString() : null,
  };
}

interface CreateGoalParams {
  firebaseUid: string;
  title: string;
  description: string | null;
  category: GoalCategory | null;
  priority: GoalPriority;
  deadline: string | null;
  targetLabel: string | null;
  targetValue: number | null;
}

/** New goals always start ACTIVE. A measurable goal (targetValue set) starts at 0 progress; a qualitative goal's progressValue stays null. */
export async function createGoal(params: CreateGoalParams): Promise<GoalSummary> {
  try {
    await connectToDatabase();
    const doc = await GoalModel.create({
      firebaseUid: params.firebaseUid,
      title: params.title,
      description: params.description,
      category: params.category,
      priority: params.priority,
      status: "ACTIVE",
      deadline: params.deadline ? new Date(params.deadline) : null,
      targetLabel: params.targetLabel,
      targetValue: params.targetValue,
      progressValue: params.targetValue ? 0 : null,
    });
    return toSummary(doc);
  } catch (error) {
    throw new GoalPersistenceError("create goal", error);
  }
}

/** Newest first. Optionally filtered by status. Grouping into Active/Paused/Completed/Archived sections is a display concern handled client-side, matching how CapsuleBoard groups by capsule status. */
export async function listGoals(firebaseUid: string, statusFilter?: GoalStatus): Promise<GoalSummary[]> {
  try {
    await connectToDatabase();
    const query: Record<string, unknown> = { firebaseUid };
    if (statusFilter) query.status = statusFilter;
    const docs = await GoalModel.find(query).sort({ createdAt: -1 });
    return docs.map(toSummary);
  } catch (error) {
    throw new GoalPersistenceError("list goals", error);
  }
}

/** Returns null (never throws) when not found or not owned, so the route can return a clean 404. */
export async function getGoal(id: string, firebaseUid: string): Promise<GoalSummary | null> {
  try {
    await connectToDatabase();
    if (!mongoose.isValidObjectId(id)) return null;
    const doc = await GoalModel.findOne({ _id: id, firebaseUid });
    return doc ? toSummary(doc) : null;
  } catch (error) {
    throw new GoalPersistenceError("get goal", error);
  }
}

interface UpdateGoalParams {
  title?: string;
  description?: string | null;
  category?: GoalCategory | null;
  priority?: GoalPriority;
  deadline?: string | null;
  targetLabel?: string | null;
  targetValue?: number | null;
  progressValue?: number;
  status?: GoalStatus;
}

/**
 * Applies any combination of updates in one call. Progress is always
 * clamped against the goal's OWN currently-stored target (never a
 * client-asserted number in isolation) — if targetValue is also being
 * changed in the same call, the clamp uses the new value, since
 * target is applied first. Completing a goal sets completedAt and, if
 * measurable, snaps progress to 100%; moving a goal away from
 * COMPLETED clears completedAt. Returns null if not found/not owned.
 */
export async function updateGoal(
  id: string,
  firebaseUid: string,
  params: UpdateGoalParams
): Promise<GoalSummary | null> {
  try {
    await connectToDatabase();
    if (!mongoose.isValidObjectId(id)) return null;

    const doc = await GoalModel.findOne({ _id: id, firebaseUid });
    if (!doc) return null;

    if (params.title !== undefined) doc.title = params.title;
    if (params.description !== undefined) doc.description = params.description;
    if (params.category !== undefined) doc.category = params.category;
    if (params.priority !== undefined) doc.priority = params.priority;
    if (params.deadline !== undefined) doc.deadline = params.deadline ? new Date(params.deadline) : null;
    if (params.targetLabel !== undefined) doc.targetLabel = params.targetLabel;
    if (params.targetValue !== undefined) doc.targetValue = params.targetValue;

    if (params.progressValue !== undefined) {
      const target = doc.targetValue;
      doc.progressValue =
        target && target > 0 ? Math.max(0, Math.min(target, params.progressValue)) : Math.max(0, params.progressValue);
    }

    if (params.status !== undefined) {
      doc.status = params.status;
      if (params.status === "COMPLETED") {
        doc.completedAt = new Date();
        if (doc.targetValue && doc.targetValue > 0) doc.progressValue = doc.targetValue;
      } else if (doc.completedAt) {
        doc.completedAt = null;
      }
    }

    await doc.save();
    return toSummary(doc);
  } catch (error) {
    throw new GoalPersistenceError("update goal", error);
  }
}

/** Hard delete — never allowed once COMPLETED, which is treated as a permanent record. Returns null if not found/not owned. */
export async function deleteGoal(id: string, firebaseUid: string): Promise<boolean | null> {
  try {
    await connectToDatabase();
    if (!mongoose.isValidObjectId(id)) return null;

    const doc = await GoalModel.findOne({ _id: id, firebaseUid });
    if (!doc) return null;

    if (doc.status === "COMPLETED") {
      throw new GoalCompletedError();
    }

        // Tasks that belonged to this goal are KEPT and simply detached (goalId → null).
    await runWithOptionalTransaction(async (session) => {
      await detachTasksFromGoals(firebaseUid, [String(doc._id)], session);
      await GoalModel.deleteOne({ _id: doc._id, firebaseUid }, session ? { session } : {});
    });
    return true;
  } catch (error) {
    if (error instanceof GoalCompletedError) throw error;
    throw new GoalPersistenceError("delete goal", error);
  }
}

/** For the AI context builder — active goals only, the exact same shape the goals UI uses, no separate/leaner type needed. */
export async function listActiveGoalsForContext(firebaseUid: string): Promise<GoalSummary[]> {
  return listGoals(firebaseUid, "ACTIVE");
}