import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import { MemoryModel, type MemoryDocument } from "@/models/Memory";
import { MemoryPersistenceError } from "@/lib/memory/errors";
import { HIGH_CONFIDENCE_THRESHOLD, type MemoryType } from "@/lib/memory/types";
import type { MemorySummary } from "@/types/memory";
import type { AgentMemoryItem, MemoryCandidate } from "@/lib/ai/types";

/** Total memories injected into one chat turn's context — keeps the prompt bounded. */
const RELEVANCE_WINDOW = 12;

/** These types are small in practice and high-value every single turn, so they're never crowded out by recency. */
const ALWAYS_INCLUDE_TYPES: MemoryType[] = [
  "explicit_remember_request",
  "important_context",
  "planning_preference",
  "preference",
];

function toSummary(doc: MemoryDocument): MemorySummary {
  return {
    id: String(doc._id),
    type: doc.type,
    content: doc.content,
    source: doc.source,
    confidence: doc.confidence,
    createdAt: doc.createdAt.toISOString(),
    lastUsedAt: doc.lastUsedAt ? doc.lastUsedAt.toISOString() : null,
  };
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** For the Memory settings/memories page — every active memory, newest first. */
export async function listActiveMemories(firebaseUid: string): Promise<MemorySummary[]> {
  try {
    await connectToDatabase();
    const docs = await MemoryModel.find({ firebaseUid, status: "active" }).sort({ createdAt: -1 });
    return docs.map(toSummary);
  } catch (error) {
    throw new MemoryPersistenceError("list memories", error);
  }
}

/**
 * Loads a bounded, relevance-conscious set of active memories for one chat turn.
 * Always includes high-value types, then fills remaining slots with newest / recently used memories.
 * Newly created memories are never buried because lastUsedAt defaults to createdAt when null.
 */
export async function loadRelevantMemories(firebaseUid: string): Promise<AgentMemoryItem[]> {
  try {
    await connectToDatabase();

    const alwaysInclude = await MemoryModel.find({
      firebaseUid,
      status: "active",
      type: { $in: ALWAYS_INCLUDE_TYPES },
    })
      .sort({ createdAt: -1 })
      .limit(RELEVANCE_WINDOW);

    const remainingBudget = Math.max(0, RELEVANCE_WINDOW - alwaysInclude.length);
    const excludeIds = alwaysInclude.map((doc) => doc._id);

    const fill =
      remainingBudget > 0
        ? await MemoryModel.find({
            firebaseUid,
            status: "active",
            _id: { $nin: excludeIds },
          })
            .sort({ createdAt: -1 })
            .limit(remainingBudget)
        : [];

    const selected = [...alwaysInclude, ...fill];

    if (selected.length > 0) {
      MemoryModel.updateMany(
        { _id: { $in: selected.map((doc) => doc._id) } },
        { $set: { lastUsedAt: new Date() } }
      ).catch((err) => {
        // eslint-disable-next-line no-console
        console.error("[Companion] Failed to bump memory lastUsedAt (non-fatal):", err);
      });
    }

    return selected.map((doc) => ({ id: String(doc._id), type: doc.type, content: doc.content }));
  } catch (error) {
    throw new MemoryPersistenceError("load relevant memories", error);
  }
}

interface ProcessCandidatesParams {
  firebaseUid: string;
  conversationId: string;
  sourceMessageId: string;
  candidates: MemoryCandidate[];
}

/**
 * Validates and persists memory candidates extracted alongside a chat reply.
 * - Saves high-confidence candidates (>= 0.75).
 * - Deduplicates: If an identical or near-identical active memory exists, updates it in place
 *   rather than inserting a duplicate row.
 * - Supersedes: If a candidate replaces an older memory (supersedesId), updates that memory in place.
 */
export async function processMemoryCandidates(params: ProcessCandidatesParams): Promise<void> {
  await connectToDatabase();

  for (const candidate of params.candidates) {
    if (candidate.confidence < HIGH_CONFIDENCE_THRESHOLD) {
      // eslint-disable-next-line no-console
      console.log(
        `[Companion] Discarded a ${candidate.confidence < 0.4 ? "low" : "medium"}-confidence memory candidate (${candidate.confidence.toFixed(2)}), type: ${candidate.type}`
      );
      continue;
    }

    const trimmedContent = candidate.content.trim();
    if (!trimmedContent) continue;

    try {
      // 1. Explicit supersedesId
      if (candidate.supersedesId && mongoose.isValidObjectId(candidate.supersedesId)) {
        const existing = await MemoryModel.findOne({
          _id: candidate.supersedesId,
          firebaseUid: params.firebaseUid,
          status: "active",
        });
        if (existing) {
          existing.content = trimmedContent;
          existing.confidence = candidate.confidence;
          existing.type = candidate.type;
          existing.lastUsedAt = new Date();
          await existing.save();
          continue;
        }
      }

      // 2. Deduplication check: does an active memory with exact same text exist?
      const duplicate = await MemoryModel.findOne({
        firebaseUid: params.firebaseUid,
        status: "active",
        content: { $regex: new RegExp(`^${escapeRegex(trimmedContent)}$`, "i") },
      });

      if (duplicate) {
        duplicate.confidence = Math.max(duplicate.confidence, candidate.confidence);
        duplicate.lastUsedAt = new Date();
        await duplicate.save();
        continue;
      }

      // 3. Insert new memory
      await MemoryModel.create({
        firebaseUid: params.firebaseUid,
        type: candidate.type,
        content: trimmedContent,
        source: candidate.type === "explicit_remember_request" ? "explicit_request" : "inferred",
        confidence: candidate.confidence,
        status: "active",
        sourceMessageId: params.sourceMessageId,
        sourceConversationId: params.conversationId,
        lastUsedAt: new Date(),
      });
    } catch (candidateError) {
      // eslint-disable-next-line no-console
      console.error("[Companion] Failed to save one memory candidate (non-fatal):", candidateError);
    }
  }
}

/**
 * Soft-deletes a memory: flips status to "deleted" so it's
 * immediately excluded from both retrieval and the Memory settings
 * list, without destroying the row.
 */
export async function softDeleteMemory(id: string, firebaseUid: string): Promise<boolean | null> {
  try {
    await connectToDatabase();
    if (!mongoose.isValidObjectId(id)) return null;

    const result = await MemoryModel.findOneAndUpdate(
      { _id: id, firebaseUid, status: "active" },
      { $set: { status: "deleted" } }
    );
    return result ? true : null;
  } catch (error) {
    throw new MemoryPersistenceError("delete memory", error);
  }
}
