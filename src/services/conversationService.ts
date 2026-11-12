import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import { ConversationModel, type ConversationDocument } from "@/models/Conversation";
import { MessageModel, type MessageDocument, type MessageRole } from "@/models/Message";
import { ScheduleModel } from "@/models/Schedule";
import { getSchedulesByDates, getSchedulesByIds } from "@/services/scheduleService";
import { EmotionModel } from "@/models/Emotion";
import { ConversationPersistenceError, InvalidConversationIdError } from "@/lib/ai/errors";
import type { ChatTurn } from "@/lib/ai/types";
import type { EmotionLabel } from "@/lib/ai/emotion";
import type { ConversationSummary, ConversationMessage } from "@/types/conversation";
import type { ScheduleSummary } from "@/types/schedule";

const RECENT_HISTORY_LIMIT = 20;
const DEFAULT_CONVERSATION_LIST_LIMIT = 20;
const MAX_CONVERSATION_LIST_LIMIT = 50;
const DEFAULT_MESSAGE_LIMIT = 100;

/** Single source of truth for the DB-role ↔ app-role mapping — was previously duplicated inline in loadRecentHistory; now shared with getConversationWithMessages too. */
function toChatRole(role: MessageRole): ChatTurn["role"] {
  return role === "assistant" ? "nikki" : "user";
}

export interface GetOrCreateResult {
  conversation: ConversationDocument;
  /** True only when a brand-new conversation document was just created — the caller uses this to decide whether to derive and save a title from the first message. */
  isNew: boolean;
}

/**
 * Finds or creates the user's active conversation.
 *
 * - If `forceNew` is true (the user explicitly clicked
 *   "+ New conversation"), any supplied conversationId is ignored and
 *   a fresh conversation is always created — this is what makes
 *   "New conversation" actually start a new thread instead of
 *   silently reusing the most recent one.
 * - Otherwise, a supplied conversationId is honored ONLY if it
 *   actually belongs to this Firebase UID — never trusted blindly.
 * - Failing that, falls back to the user's most-recently-updated
 *   conversation (the "continue where I left off" default), or
 *   creates one if none exists yet.
 */
export async function getOrCreateActiveConversation(
  firebaseUid: string,
  conversationId?: string | null,
  forceNew: boolean = false
): Promise<GetOrCreateResult> {
  try {
    await connectToDatabase();

    if (forceNew) {
      const created = await ConversationModel.create({ firebaseUid });
      return { conversation: created, isNew: true };
    }

    if (conversationId && mongoose.isValidObjectId(conversationId)) {
      const existing = await ConversationModel.findOne({ _id: conversationId, firebaseUid });
      if (existing) return { conversation: existing, isNew: false };
    }

    const mostRecent = await ConversationModel.findOne({ firebaseUid }).sort({ updatedAt: -1 });
    if (mostRecent) return { conversation: mostRecent, isNew: false };

    const created = await ConversationModel.create({ firebaseUid });
    return { conversation: created, isNew: true };
  } catch (error) {
    throw new ConversationPersistenceError("get-or-create conversation", error);
  }
}

interface SaveMessageParams {
  conversationId: string;
  firebaseUid: string;
  role: MessageRole;
  content: string;
  scheduleId?: string | mongoose.Types.ObjectId | null;
  scheduleDate?: string | null;
  scheduleSnapshot?: unknown;
}

/**
 * Saves one message and bumps the parent conversation's updatedAt so
 * "most recently active" lookups and the history list reflect real
 * activity.
 *
 * Every caller ultimately funnels through this one function to
 * create a Message, so this is the single choke point that must
 * reject a missing/malformed conversationId before Mongoose ever
 * sees it. Without this guard, a bug anywhere upstream that lets
 * `conversationId` end up as JS `undefined` — e.g. `String(x._id)`
 * where `x._id` was itself undefined — silently becomes the literal
 * string `"undefined"`, which passes a naive "is it a non-empty
 * string" check and reaches `MessageModel.create()`, where Mongoose
 * throws an opaque `Cast to ObjectId failed for value "undefined"`
 * error deep inside schema validation. Catching it here instead
 * turns that into an immediate, clearly-labeled
 * `InvalidConversationIdError` pointing at the real problem.
 */
export async function saveMessage(params: SaveMessageParams): Promise<MessageDocument> {
  if (!params.conversationId) {
    throw new InvalidConversationIdError("missing");
  }
  if (!mongoose.isValidObjectId(params.conversationId)) {
    throw new InvalidConversationIdError("malformed", params.conversationId);
  }

  try {
    await connectToDatabase();
    const message = await MessageModel.create(params);
    await ConversationModel.findByIdAndUpdate(params.conversationId, { updatedAt: new Date() });
    return message;
  } catch (error) {
    throw new ConversationPersistenceError("save message", error);
  }
}

/**
 * Best-effort title update. Deliberately NOT wrapped for the caller
 * to treat as fatal — the API route catches and logs any failure
 * here without undoing an otherwise-successful chat turn, the same
 * pattern already used for emotion persistence.
 */
export async function updateConversationTitle(conversationId: string, title: string): Promise<void> {
  await connectToDatabase();
  await ConversationModel.findByIdAndUpdate(conversationId, { title });
}

/**
 * Loads the most recent bounded window of messages for a conversation,
 * oldest-first (the order Gemini expects), excluding one message ID —
 * used to exclude the just-saved current user message, since it's
 * passed to the agent separately rather than as part of "history".
 */
export async function loadRecentHistory(
  conversationId: string,
  excludeMessageId?: string,
  limit: number = RECENT_HISTORY_LIMIT
): Promise<ChatTurn[]> {
  try {
    await connectToDatabase();

    const query: Record<string, unknown> = { conversationId };
    if (excludeMessageId) {
      query._id = { $ne: excludeMessageId };
    }

    const docs = await MessageModel.find(query).sort({ createdAt: -1 }).limit(limit);

    return docs
      .reverse() // newest-first -> chronological order
      .map((doc) => ({
        role: toChatRole(doc.role),
        text: doc.content,
      }));
  } catch (error) {
    throw new ConversationPersistenceError("load recent history", error);
  }
}

interface ListConversationsOptions {
  limit?: number;
  /** ISO date string — only return conversations updated before this. Not yet used by any UI in this milestone, but wired through end-to-end so a future "load older" control doesn't need a schema/service rewrite. */
  before?: string | null;
}

/**
 * Returns a bounded, most-recent-first list of the user's
 * conversations with a lightweight preview of the latest message,
 * fetched in a single aggregation round trip rather than N+1 queries
 * (one query per conversation would violate this milestone's
 * performance rule).
 */
export async function listConversations(
  firebaseUid: string,
  options: ListConversationsOptions = {}
): Promise<ConversationSummary[]> {
  try {
    await connectToDatabase();

    const limit = Math.min(options.limit ?? DEFAULT_CONVERSATION_LIST_LIMIT, MAX_CONVERSATION_LIST_LIMIT);

    const match: Record<string, unknown> = { firebaseUid };
    if (options.before) {
      const beforeDate = new Date(options.before);
      if (!Number.isNaN(beforeDate.getTime())) {
        match.updatedAt = { $lt: beforeDate };
      }
    }

    const docs = await ConversationModel.aggregate([
      { $match: match },
      { $sort: { updatedAt: -1 } },
      { $limit: limit },
      {
        $lookup: {
          from: "messages",
          let: { convId: "$_id" },
          pipeline: [
            { $match: { $expr: { $eq: ["$conversationId", "$$convId"] } } },
            { $sort: { createdAt: -1 } },
            { $limit: 1 },
            { $project: { content: 1 } },
          ],
          as: "lastMessage",
        },
      },
      { $addFields: { lastMessage: { $arrayElemAt: ["$lastMessage", 0] } } },
    ]);

    return docs.map((doc) => ({
      id: String(doc._id),
      title: doc.title ?? null,
      updatedAt: (doc.updatedAt as Date).toISOString(),
      preview: doc.lastMessage?.content ? String(doc.lastMessage.content).slice(0, 120) : null,
    }));
  } catch (error) {
    throw new ConversationPersistenceError("list conversations", error);
  }
}

export async function updateMessageSchedule(
  messageId: string,
  scheduleData: {
    scheduleId?: string | mongoose.Types.ObjectId | null;
    scheduleDate?: string | null;
    scheduleSnapshot?: unknown;
  }
): Promise<void> {
  if (!mongoose.isValidObjectId(messageId)) return;
  await connectToDatabase();
  await MessageModel.findByIdAndUpdate(messageId, {
    $set: {
      scheduleId: scheduleData.scheduleId,
      scheduleDate: scheduleData.scheduleDate,
      scheduleSnapshot: scheduleData.scheduleSnapshot,
    },
  });
}

/**
 * Loads one conversation's metadata and a bounded, chronological
 * window of its messages — ONLY if it belongs to the authenticated
 * user. Returns null (never throws for this specific case) when the
 * conversation doesn't exist or isn't owned by this user, so the API
 * route can return a clean 404 without distinguishing "doesn't
 * exist" from "not yours" to the client.
 */
export async function getConversationWithMessages(
  conversationId: string,
  firebaseUid: string,
  limit: number = DEFAULT_MESSAGE_LIMIT
): Promise<{ id: string; title: string | null; messages: ConversationMessage[] } | null> {
  try {
    await connectToDatabase();

    if (!mongoose.isValidObjectId(conversationId)) return null;

    const conversation = await ConversationModel.findOne({ _id: conversationId, firebaseUid });
    if (!conversation) return null;

    // Most recent `limit` messages, then re-ordered chronologically —
    // same "sort desc, limit, reverse" pattern as loadRecentHistory,
    // so a long conversation returns its most RECENT messages, not
    // its oldest ones.
    const docs = await MessageModel.find({ conversationId }).sort({ createdAt: -1 }).limit(limit);
    const chronological = docs.reverse();

    // Batch load any live schedules associated with timetable messages
    const scheduleDates: string[] = [];
    const scheduleIds: string[] = [];

    for (const d of chronological) {
      if (d.scheduleDate && typeof d.scheduleDate === "string") {
        scheduleDates.push(d.scheduleDate);
      }
      if (d.scheduleId) {
        scheduleIds.push(String(d.scheduleId));
      }
    }

    // Hydrate schedules from schedule service (owner-scoped by firebaseUid)
    const [dateScheduleMap, idScheduleMap] = await Promise.all([
      getSchedulesByDates(firebaseUid, Array.from(new Set(scheduleDates))),
      getSchedulesByIds(firebaseUid, Array.from(new Set(scheduleIds))),
    ]);

    return {
      id: String(conversation._id),
      title: conversation.title,
      messages: chronological.map((doc) => {
        const hasRef = Boolean(doc.scheduleDate || doc.scheduleId);
        let schedule: ScheduleSummary | null = null;
        let scheduleDeleted = false;

        if (hasRef) {
          if (doc.scheduleDate && dateScheduleMap.has(doc.scheduleDate)) {
            schedule = dateScheduleMap.get(doc.scheduleDate)!;
          } else if (doc.scheduleId && idScheduleMap.has(String(doc.scheduleId))) {
            schedule = idScheduleMap.get(String(doc.scheduleId))!;
          } else {
            // Reference was stored, but the schedule was later deleted from the database
            scheduleDeleted = true;
          }
        }

        return {
          id: String(doc._id),
          role: toChatRole(doc.role),
          text: doc.content,
          createdAt: doc.createdAt.toISOString(),
          scheduleDate: doc.scheduleDate ?? null,
          scheduleId: doc.scheduleId ? String(doc.scheduleId) : null,
          schedule,
          scheduleDeleted,
        };
      }),
    };
  } catch (error) {
    throw new ConversationPersistenceError("load conversation messages", error);
  }
}

interface SaveEmotionParams {
  firebaseUid: string;
  conversationId: string;
  sourceMessageId: string;
  emotion: EmotionLabel;
  intensity: number;
  confidence: number;
  secondaryEmotion?: EmotionLabel;
}

/**
 * Persists one emotion observation. Deliberately NOT wrapped in
 * ConversationPersistenceError — per the memory-foundation milestone
 * spec, emotion storage is best-effort and must never break an
 * otherwise-successful chat turn. The caller (the API route) is
 * responsible for catching and logging any failure here.
 */
export async function saveEmotionObservation(params: SaveEmotionParams) {
  await connectToDatabase();
  return EmotionModel.create({
    firebaseUid: params.firebaseUid,
    conversationId: params.conversationId,
    sourceMessageId: params.sourceMessageId,
    emotion: params.emotion,
    intensity: params.intensity,
    confidence: params.confidence,
    secondaryEmotion: params.secondaryEmotion ?? null,
  });
}

/**
 * Loads the bounded chronological window of messages strictly before a given date.
 * Used when regenerating the assistant reply after an earlier message was edited.
 */
export async function loadHistoryBeforeDate(
  conversationId: string,
  beforeDate: Date,
  limit: number = RECENT_HISTORY_LIMIT
): Promise<ChatTurn[]> {
  try {
    await connectToDatabase();
    const docs = await MessageModel.find({
      conversationId,
      createdAt: { $lt: beforeDate },
    })
      .sort({ createdAt: -1 })
      .limit(limit);

    return docs.reverse().map((doc) => ({
      role: toChatRole(doc.role),
      text: doc.content,
    }));
  } catch (error) {
    throw new ConversationPersistenceError("load history before date", error);
  }
}

/**
 * Updates a user-sent message in place, enforcing user ownership and role.
 */
export async function updateUserMessage(
  messageId: string,
  firebaseUid: string,
  newContent: string
): Promise<MessageDocument | null> {
  try {
    await connectToDatabase();
    if (!mongoose.isValidObjectId(messageId)) return null;

    const message = await MessageModel.findOne({
      _id: messageId,
      firebaseUid,
      role: "user",
    });

    if (!message) return null;

    message.content = newContent;
    await message.save();

    await ConversationModel.findByIdAndUpdate(message.conversationId, { updatedAt: new Date() });
    return message;
  } catch (error) {
    throw new ConversationPersistenceError("update user message", error);
  }
}

/**
 * Finds the immediate assistant reply following a specific message.
 */
export async function findSubsequentAssistantMessage(
  conversationId: string,
  afterDate: Date
): Promise<MessageDocument | null> {
  try {
    await connectToDatabase();
    return MessageModel.findOne({
      conversationId,
      role: "assistant",
      createdAt: { $gt: afterDate },
    }).sort({ createdAt: 1 });
  } catch (error) {
    throw new ConversationPersistenceError("find subsequent assistant message", error);
  }
}
