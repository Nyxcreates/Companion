import mongoose, { type ClientSession } from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import { runWithOptionalTransaction } from "@/lib/db/transaction";
import { DataPersistenceError, InvalidDeleteRequestError } from "@/lib/data/errors";
import { DATA_SCOPES, isDataScope, type DataCounts, type DataScope, type DeleteResult, type DeleteScope } from "@/lib/data/scopes";
import { cancelFocusSession } from "@/services/focusService";
import { CapsuleModel } from "@/models/Capsule";
import { ConversationModel } from "@/models/Conversation";
import { EmotionModel } from "@/models/Emotion";
import { FocusSessionModel } from "@/models/FocusSession";
import { GoalModel } from "@/models/Goal";
import { JournalEntryModel } from "@/models/JournalEntry";
import { MemoryModel } from "@/models/Memory";
import { MessageModel } from "@/models/Message";
import { ScheduleModel } from "@/models/Schedule";
import { TaskModel } from "@/models/Task";

/**
 * Data & Privacy: ownership-scoped, real (hard) deletion for the
 * bulk and single-conversation cases the per-feature services don't
 * cover. Every query below filters by the verified firebaseUid.
 *
 * Reference rules (no dangling references are ever left behind):
 *  - Goal  → Task.goalId:            tasks are KEPT, goalId set to null
 *  - Task  → Schedule item taskId:   item kept, taskId set to null
 *  - Task  → FocusSession:           history KEPT (UI shows "Untitled task"); a live session is cancelled first
 *  - Conversation → Message/Emotion: deleted together with the conversation
 *  - Conversation → Memory source:   memory KEPT, source pointers set to null
 *
 * Ordering is always "clear references first, delete referenced
 * documents last".
 */

type Opts = { session?: ClientSession };

function opts(session: ClientSession | undefined): Opts {
  return session ? { session } : {};
}

/** Counts per scope, for the Data & Privacy section. Memory counts only active (non-soft-deleted) rows. */
export async function getDataCounts(firebaseUid: string): Promise<DataCounts> {
  try {
    await connectToDatabase();
    const [conversations, memories, capsules, journal, goals, tasks, schedule, focus] = await Promise.all([
      ConversationModel.countDocuments({ firebaseUid }),
      MemoryModel.countDocuments({ firebaseUid, status: "active" }),
      CapsuleModel.countDocuments({ firebaseUid }),
      JournalEntryModel.countDocuments({ firebaseUid }),
      GoalModel.countDocuments({ firebaseUid }),
      TaskModel.countDocuments({ firebaseUid }),
      ScheduleModel.countDocuments({ firebaseUid }),
      FocusSessionModel.countDocuments({ firebaseUid }),
    ]);
    return { conversations, memories, capsules, journal, goals, tasks, schedule, focus };
  } catch (error) {
    throw new DataPersistenceError("count data", error);
  }
}

/** Ends any ACTIVE/PAUSED focus session on the given tasks (or all of the user's tasks when taskIds is null), preserving the real focused time. */
export async function endLiveFocusSessions(firebaseUid: string, taskIds: string[] | null): Promise<void> {
  const filter: Record<string, unknown> = { firebaseUid, status: { $in: ["ACTIVE", "PAUSED"] } };
  if (taskIds) filter.taskId = { $in: taskIds };
  const live = await FocusSessionModel.find(filter).select("_id");
  for (const s of live) {
    await cancelFocusSession(String(s._id), firebaseUid);
  }
}

/** Clears Task references from a user's schedule items. taskIds = null means "every task reference". */
async function detachScheduleTasks(firebaseUid: string, taskIds: string[] | null, session?: ClientSession) {
  const match = taskIds ? { $in: taskIds.map((id) => new mongoose.Types.ObjectId(id)) } : { $ne: null };
  await ScheduleModel.updateMany(
    { firebaseUid, "items.taskId": match },
    { $set: { "items.$[el].taskId": null } },
    { arrayFilters: [{ "el.taskId": match }], ...opts(session) }
  );
}

/** Sets goalId = null on the user's tasks that point at the given goals (null = every goal). */
export async function detachTasksFromGoals(firebaseUid: string, goalIds: string[] | null, session?: ClientSession) {
  const match = goalIds ? { $in: goalIds.map((id) => new mongoose.Types.ObjectId(id)) } : { $ne: null };
  await TaskModel.updateMany({ firebaseUid, goalId: match }, { $set: { goalId: null } }, opts(session));
}

/** Removes Task pointers from schedule items for one task — used by the single-task delete in taskService. */
export async function detachScheduleFromTask(firebaseUid: string, taskId: string, session?: ClientSession) {
  await detachScheduleTasks(firebaseUid, [taskId], session);
}

async function detachMemorySources(firebaseUid: string, conversationIds: mongoose.Types.ObjectId[] | null, session?: ClientSession) {
  if (conversationIds && conversationIds.length === 0) return;
  const convFilter = conversationIds ? { $in: conversationIds } : { $ne: null };
  const messageIds = conversationIds
    ? (await MessageModel.find({ firebaseUid, conversationId: { $in: conversationIds } }, "_id", opts(session))).map((m) => m._id)
    : null;
  const match = messageIds
    ? { $or: [{ sourceConversationId: convFilter }, { sourceMessageId: { $in: messageIds } }] }
    : { $or: [{ sourceConversationId: { $ne: null } }, { sourceMessageId: { $ne: null } }] };
  await MemoryModel.updateMany(
    { firebaseUid, ...match },
    { $set: { sourceConversationId: null, sourceMessageId: null } },
    opts(session)
  );
}

/** Deletes ONE conversation with its messages and emotion notes. Returns null if not found / not owned. */
export async function deleteConversation(id: string, firebaseUid: string): Promise<boolean | null> {
  try {
    await connectToDatabase();
    if (!mongoose.isValidObjectId(id)) return null;
    const convo = await ConversationModel.findOne({ _id: id, firebaseUid }).select("_id");
    if (!convo) return null;

    await runWithOptionalTransaction(async (session) => {
      await detachMemorySources(firebaseUid, [convo._id], session);
      await EmotionModel.deleteMany({ firebaseUid, conversationId: convo._id }, opts(session));
      await MessageModel.deleteMany({ firebaseUid, conversationId: convo._id }, opts(session));
      await ConversationModel.deleteOne({ _id: convo._id, firebaseUid }, opts(session));
    });
    return true;
  } catch (error) {
    throw new DataPersistenceError("delete conversation", error);
  }
}

async function deleteScopeInSession(firebaseUid: string, scope: DataScope, session: ClientSession | undefined): Promise<number> {
  switch (scope) {
    case "conversations": {
      await detachMemorySources(firebaseUid, null, session);
      await EmotionModel.deleteMany({ firebaseUid }, opts(session));
      await MessageModel.deleteMany({ firebaseUid }, opts(session));
      return (await ConversationModel.deleteMany({ firebaseUid }, opts(session))).deletedCount ?? 0;
    }
    case "memories":
      // Hard delete — including rows previously soft-deleted — so "delete my memories" really removes them.
      return (await MemoryModel.deleteMany({ firebaseUid }, opts(session))).deletedCount ?? 0;
    case "capsules":
      return (await CapsuleModel.deleteMany({ firebaseUid }, opts(session))).deletedCount ?? 0;
    case "journal":
      return (await JournalEntryModel.deleteMany({ firebaseUid }, opts(session))).deletedCount ?? 0;
    case "goals": {
      await detachTasksFromGoals(firebaseUid, null, session);
      return (await GoalModel.deleteMany({ firebaseUid }, opts(session))).deletedCount ?? 0;
    }
    case "tasks": {
      await detachScheduleTasks(firebaseUid, null, session);
      return (await TaskModel.deleteMany({ firebaseUid }, opts(session))).deletedCount ?? 0;
    }
    case "schedule":
      return (await ScheduleModel.deleteMany({ firebaseUid }, opts(session))).deletedCount ?? 0;
    case "focus":
      return (await FocusSessionModel.deleteMany({ firebaseUid }, opts(session))).deletedCount ?? 0;
  }
}

/** Dependency-safe order for "delete everything": leaf data first, parents last. */
const ALL_ORDER: DataScope[] = ["focus", "schedule", "tasks", "goals", "journal", "capsules", "memories", "conversations"];

/**
 * Bulk delete of one scope, or "all". The user's account/profile
 * (name, companion name, onboarding) is intentionally NOT touched.
 */
export async function deleteData(firebaseUid: string, scope: DeleteScope): Promise<DeleteResult> {
  if (scope !== "all" && !isDataScope(scope)) throw new InvalidDeleteRequestError("Unknown data type.");
  try {
    await connectToDatabase();

    // A running focus session on a task about to disappear is ended properly first (keeps its real time).
    if (scope === "tasks") await endLiveFocusSessions(firebaseUid, null);

    const scopes: DataScope[] = scope === "all" ? ALL_ORDER : [scope];
    const { result, usedTransaction } = await runWithOptionalTransaction(async (session) => {
      const counts: Partial<Record<DataScope, number>> = {};
      for (const s of scopes) {
        counts[s] = await deleteScopeInSession(firebaseUid, s, session);
      }
      return counts;
    });
    return { ...result, usedTransaction };
  } catch (error) {
    if (error instanceof InvalidDeleteRequestError) throw error;
    throw new DataPersistenceError(`delete ${scope}`, error);
  }
}

export { DATA_SCOPES };