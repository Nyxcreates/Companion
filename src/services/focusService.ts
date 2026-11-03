import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import { FocusSessionModel, type FocusSessionDocument } from "@/models/FocusSession";
import { TaskModel } from "@/models/Task";
import { GoalModel } from "@/models/Goal";
import {
  FocusPersistenceError,
  InvalidTaskReferenceError,
  SessionAlreadyActiveError,
  SessionNotActionableError,
} from "@/lib/focus/errors";
import { computeEffectiveElapsedMs, computeRemainingMs, msToSeconds, type TimerState } from "@/lib/focus/timer";
import type { FocusSessionSummary, FocusSessionStatus } from "@/types/focus";

const LIVE_STATUSES: FocusSessionStatus[] = ["ACTIVE", "PAUSED"];

/**
 * Batches task-title and (through the task) goal-title lookups for a
 * set of sessions into two queries total, mirroring
 * taskService.buildGoalTitleMap's batching pattern — a history list
 * of N sessions never costs N extra round-trips.
 */
async function buildContextMaps(
  docs: FocusSessionDocument[]
): Promise<{ taskTitleMap: Map<string, string>; goalByTaskId: Map<string, { id: string; title: string }> }> {
  const taskIds = Array.from(new Set(docs.map((d) => String(d.taskId))));
  const tasks = taskIds.length > 0 ? await TaskModel.find({ _id: { $in: taskIds } }).select("_id title goalId") : [];

  const taskTitleMap = new Map(tasks.map((t) => [String(t._id), t.title]));

  const goalIds = Array.from(new Set(tasks.filter((t) => t.goalId).map((t) => String(t.goalId))));
  const goals = goalIds.length > 0 ? await GoalModel.find({ _id: { $in: goalIds } }).select("_id title") : [];
  const goalTitleById = new Map(goals.map((g) => [String(g._id), g.title]));

  const goalByTaskId = new Map<string, { id: string; title: string }>();
  for (const task of tasks) {
    if (task.goalId) {
      const goalId = String(task.goalId);
      const title = goalTitleById.get(goalId);
      if (title) goalByTaskId.set(String(task._id), { id: goalId, title });
    }
  }

  return { taskTitleMap, goalByTaskId };
}

function toSummary(
  doc: FocusSessionDocument,
  now: Date,
  taskTitleMap: Map<string, string>,
  goalByTaskId: Map<string, { id: string; title: string }>
): FocusSessionSummary {
  const taskId = String(doc.taskId);
  const isLive = doc.status === "ACTIVE" || doc.status === "PAUSED";

  const timerState: TimerState = {
    startedAt: doc.startedAt,
    pausedAt: doc.pausedAt,
    accumulatedPausedMs: doc.accumulatedPausedMs,
  };

  const elapsedMs = isLive ? computeEffectiveElapsedMs(timerState, now) : (doc.actualDurationSeconds ?? 0) * 1000;
  const remainingMs = isLive ? computeRemainingMs(timerState, doc.plannedDurationSeconds, now) : 0;

  const goal = goalByTaskId.get(taskId) ?? null;

  return {
    id: String(doc._id),
    taskId,
    taskTitle: taskTitleMap.get(taskId) ?? "Untitled task",
    goalId: goal?.id ?? null,
    goalTitle: goal?.title ?? null,
    status: doc.status,
    plannedDurationSeconds: doc.plannedDurationSeconds,
    startedAt: doc.startedAt.toISOString(),
    pausedAt: doc.pausedAt ? doc.pausedAt.toISOString() : null,
    accumulatedPausedMs: doc.accumulatedPausedMs,
    elapsedSeconds: msToSeconds(elapsedMs),
    remainingSeconds: msToSeconds(remainingMs),
    completedAt: doc.completedAt ? doc.completedAt.toISOString() : null,
    cancelledAt: doc.cancelledAt ? doc.cancelledAt.toISOString() : null,
    actualDurationSeconds: doc.actualDurationSeconds,
    createdAt: doc.createdAt.toISOString(),
  };
}

async function loadOwnedSession(id: string, firebaseUid: string): Promise<FocusSessionDocument | null> {
  if (!mongoose.isValidObjectId(id)) return null;
  return FocusSessionModel.findOne({ _id: id, firebaseUid });
}

interface StartSessionParams {
  firebaseUid: string;
  taskId: string;
  plannedDurationSeconds: number;
}

/**
 * Starts a new session. Mirrors taskService.createTask's shape: the
 * pre-checks (already-active, task-ownership) run unwrapped so their
 * specific errors surface as themselves; only the actual `.create()`
 * call is wrapped as a generic persistence failure. At most one
 * ACTIVE/PAUSED session is ever allowed per user — this is what makes
 * refresh recovery (GET /api/focus/active) unambiguous.
 */
export async function startFocusSession(params: StartSessionParams): Promise<FocusSessionSummary> {
  await connectToDatabase();

  const existing = await FocusSessionModel.findOne({
    firebaseUid: params.firebaseUid,
    status: { $in: LIVE_STATUSES },
  });
  if (existing) throw new SessionAlreadyActiveError();

  if (!mongoose.isValidObjectId(params.taskId)) throw new InvalidTaskReferenceError();
  const task = await TaskModel.findOne({ _id: params.taskId, firebaseUid: params.firebaseUid }).select("_id");
  if (!task) throw new InvalidTaskReferenceError();

  try {
    const doc = await FocusSessionModel.create({
      firebaseUid: params.firebaseUid,
      taskId: task._id,
      status: "ACTIVE",
      plannedDurationSeconds: params.plannedDurationSeconds,
      startedAt: new Date(),
      pausedAt: null,
      accumulatedPausedMs: 0,
    });
    const { taskTitleMap, goalByTaskId } = await buildContextMaps([doc]);
    return toSummary(doc, new Date(), taskTitleMap, goalByTaskId);
  } catch (error) {
    throw new FocusPersistenceError("start session", error);
  }
}

/** The user's one live (ACTIVE/PAUSED) session, if any — used to recover state after a refresh or reopened tab. Null (never throws) when there isn't one. */
export async function getActiveFocusSession(firebaseUid: string): Promise<FocusSessionSummary | null> {
  try {
    await connectToDatabase();
    const doc = await FocusSessionModel.findOne({ firebaseUid, status: { $in: LIVE_STATUSES } });
    if (!doc) return null;
    const { taskTitleMap, goalByTaskId } = await buildContextMaps([doc]);
    return toSummary(doc, new Date(), taskTitleMap, goalByTaskId);
  } catch (error) {
    throw new FocusPersistenceError("get active session", error);
  }
}

/** Only valid from ACTIVE. Records the moment paused; resumeFocusSession folds the elapsed pause duration into accumulatedPausedMs. Returns null if not found/not owned. */
export async function pauseFocusSession(id: string, firebaseUid: string): Promise<FocusSessionSummary | null> {
  await connectToDatabase();
  const doc = await loadOwnedSession(id, firebaseUid);
  if (!doc) return null;
  if (doc.status !== "ACTIVE") throw new SessionNotActionableError("pause", doc.status);

  try {
    doc.status = "PAUSED";
    doc.pausedAt = new Date();
    await doc.save();
    const { taskTitleMap, goalByTaskId } = await buildContextMaps([doc]);
    return toSummary(doc, new Date(), taskTitleMap, goalByTaskId);
  } catch (error) {
    throw new FocusPersistenceError("pause session", error);
  }
}

/** Only valid from PAUSED. Folds the just-finished pause interval into accumulatedPausedMs so it's never counted as focused time, then resumes counting from `now`. */
export async function resumeFocusSession(id: string, firebaseUid: string): Promise<FocusSessionSummary | null> {
  await connectToDatabase();
  const doc = await loadOwnedSession(id, firebaseUid);
  if (!doc) return null;
  if (doc.status !== "PAUSED") throw new SessionNotActionableError("resume", doc.status);

  try {
    const now = new Date();
    if (doc.pausedAt) {
      doc.accumulatedPausedMs += now.getTime() - doc.pausedAt.getTime();
    }
    doc.pausedAt = null;
    doc.status = "ACTIVE";
    await doc.save();
    const { taskTitleMap, goalByTaskId } = await buildContextMaps([doc]);
    return toSummary(doc, now, taskTitleMap, goalByTaskId);
  } catch (error) {
    throw new FocusPersistenceError("resume session", error);
  }
}

/** Shared terminal-transition logic for complete and cancel: closes any still-open pause interval first (so paused time is never double-counted or lost), then freezes actualDurationSeconds from the server's own clock — never a client-supplied number. */
async function finalizeSession(
  doc: FocusSessionDocument,
  outcome: "COMPLETED" | "CANCELLED",
  now: Date
): Promise<FocusSessionDocument> {
  if (doc.status === "PAUSED" && doc.pausedAt) {
    doc.accumulatedPausedMs += now.getTime() - doc.pausedAt.getTime();
    doc.pausedAt = null;
  }

  const elapsedMs = computeEffectiveElapsedMs(
    { startedAt: doc.startedAt, pausedAt: null, accumulatedPausedMs: doc.accumulatedPausedMs },
    now
  );

  doc.status = outcome;
  if (outcome === "COMPLETED") doc.completedAt = now;
  else doc.cancelledAt = now;
  doc.actualDurationSeconds = msToSeconds(elapsedMs);

  await doc.save();
  return doc;
}

/** Only valid from ACTIVE or PAUSED. Never touches the associated Task — a completed focus session means "I worked on this," not "I finished this" (spec section 13). */
export async function completeFocusSession(id: string, firebaseUid: string): Promise<FocusSessionSummary | null> {
  await connectToDatabase();
  const doc = await loadOwnedSession(id, firebaseUid);
  if (!doc) return null;
  if (!LIVE_STATUSES.includes(doc.status)) throw new SessionNotActionableError("complete", doc.status);

  try {
    const now = new Date();
    const finalized = await finalizeSession(doc, "COMPLETED", now);
    const { taskTitleMap, goalByTaskId } = await buildContextMaps([finalized]);
    return toSummary(finalized, now, taskTitleMap, goalByTaskId);
  } catch (error) {
    throw new FocusPersistenceError("complete session", error);
  }
}

/** Only valid from ACTIVE or PAUSED. An early exit is never treated as a failure — the actual focused time is preserved, not discarded (spec section 14). */
export async function cancelFocusSession(id: string, firebaseUid: string): Promise<FocusSessionSummary | null> {
  await connectToDatabase();
  const doc = await loadOwnedSession(id, firebaseUid);
  if (!doc) return null;
  if (!LIVE_STATUSES.includes(doc.status)) throw new SessionNotActionableError("cancel", doc.status);

  try {
    const now = new Date();
    const finalized = await finalizeSession(doc, "CANCELLED", now);
    const { taskTitleMap, goalByTaskId } = await buildContextMaps([finalized]);
    return toSummary(finalized, now, taskTitleMap, goalByTaskId);
  } catch (error) {
    throw new FocusPersistenceError("cancel session", error);
  }
}

/** History, newest first — optionally filtered by status and/or taskId, mirroring listTasks/listGoals. */
export async function listFocusSessions(
  firebaseUid: string,
  filters: { status?: FocusSessionStatus; taskId?: string } = {}
): Promise<FocusSessionSummary[]> {
  try {
    await connectToDatabase();
    const query: Record<string, unknown> = { firebaseUid };
    if (filters.status) query.status = filters.status;
    if (filters.taskId) {
      if (!mongoose.isValidObjectId(filters.taskId)) return [];
      query.taskId = filters.taskId;
    }

    const docs = await FocusSessionModel.find(query).sort({ createdAt: -1 });
    const { taskTitleMap, goalByTaskId } = await buildContextMaps(docs);
    const now = new Date();
    return docs.map((doc) => toSummary(doc, now, taskTitleMap, goalByTaskId));
  } catch (error) {
    throw new FocusPersistenceError("list sessions", error);
  }
}