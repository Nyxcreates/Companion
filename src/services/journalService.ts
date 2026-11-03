import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import { JournalEntryModel, type JournalEntryDocument } from "@/models/JournalEntry";
import { JournalPersistenceError } from "@/lib/journal/errors";
import type { JournalEntry, CreateJournalEntryInput, UpdateJournalEntryInput } from "@/types/journal";

/**
 * JOURNAL <-> LONG-TERM MEMORY SEPARATION (spec section 3):
 *
 * Nothing in this file ever imports MemoryModel or calls into
 * memoryService.ts. Creating, editing, or deleting a journal entry
 * NEVER creates, updates, or deletes a Memory — there is no implicit
 * extraction, no "AI reads this entry and saves a fact," no path at
 * all between the two collections. The only way a Memory is ever
 * created today is the existing explicit/inferred pipeline in
 * memoryService.ts#processMemoryCandidates, driven from a chat turn —
 * this file does not touch it, and a journal entry is never fed into
 * a Gemini call from here either.
 *
 * (A user-triggered "Remember this" bridge from a journal entry to
 * Long-Term Memory was considered per spec section 16, and explicitly
 * NOT built this milestone — see the final report's "Journal <->
 * Memory separation" section for why.)
 */

function toClientEntry(doc: JournalEntryDocument): JournalEntry {
  return {
    id: String(doc._id),
    title: doc.title,
    content: doc.content,
    mood: doc.mood,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

/** Creates a new journal entry for the authenticated user. */
export async function createJournalEntry(firebaseUid: string, input: CreateJournalEntryInput): Promise<JournalEntry> {
  try {
    await connectToDatabase();
    const doc = await JournalEntryModel.create({
      firebaseUid,
      title: input.title ?? null,
      content: input.content,
      mood: input.mood ?? null,
    });
    return toClientEntry(doc);
  } catch (error) {
    throw new JournalPersistenceError("create entry", error);
  }
}

/**
 * Returns all of the user's entries, most recent first. Grouping into
 * date-based sections ("September 29", "September 27", ...) is a
 * display concern handled client-side, in the user's own local time
 * zone — same pattern as capsuleService.ts/goalService.ts's list
 * functions, and the only way to group by the date the user actually
 * experienced rather than a server-side UTC day boundary (spec
 * section 12).
 */
export async function listJournalEntries(firebaseUid: string): Promise<JournalEntry[]> {
  try {
    await connectToDatabase();
    const docs = await JournalEntryModel.find({ firebaseUid }).sort({ createdAt: -1 });
    return docs.map(toClientEntry);
  } catch (error) {
    throw new JournalPersistenceError("list entries", error);
  }
}

/** Returns null (never throws) when the entry doesn't exist or isn't owned by this user, so the route can return a clean 404 without distinguishing the two cases to the client. */
export async function getJournalEntry(id: string, firebaseUid: string): Promise<JournalEntry | null> {
  try {
    await connectToDatabase();
    if (!mongoose.isValidObjectId(id)) return null;

    const doc = await JournalEntryModel.findOne({ _id: id, firebaseUid });
    return doc ? toClientEntry(doc) : null;
  } catch (error) {
    throw new JournalPersistenceError("get entry", error);
  }
}

/** Partial update. `createdAt` is never touched; Mongoose's `timestamps: true` bumps `updatedAt` automatically on save. */
export async function updateJournalEntry(
  id: string,
  firebaseUid: string,
  updates: UpdateJournalEntryInput
): Promise<JournalEntry | null> {
  try {
    await connectToDatabase();
    if (!mongoose.isValidObjectId(id)) return null;

    const doc = await JournalEntryModel.findOne({ _id: id, firebaseUid });
    if (!doc) return null;

    if (updates.title !== undefined) doc.title = updates.title;
    if (updates.content !== undefined) doc.content = updates.content;
    if (updates.mood !== undefined) doc.mood = updates.mood;

    await doc.save();
    return toClientEntry(doc);
  } catch (error) {
    throw new JournalPersistenceError("update entry", error);
  }
}

/**
 * Hard-deletes a journal entry. Mirrors taskService's plain hard
 * delete (Task has no "unlock" lifecycle to protect, same as
 * Journal) rather than Memory's soft-delete (which exists there
 * specifically so a deleted memory still can't be resurrected into
 * chat context by accident) or Capsule's delete-only-while-SEALED
 * rule (which doesn't apply — a journal entry has no unlock state).
 * Returns null (never throws) if not found/not owned.
 */
export async function deleteJournalEntry(id: string, firebaseUid: string): Promise<boolean | null> {
  try {
    await connectToDatabase();
    if (!mongoose.isValidObjectId(id)) return null;

    const result = await JournalEntryModel.findOneAndDelete({ _id: id, firebaseUid });
    return result ? true : null;
  } catch (error) {
    throw new JournalPersistenceError("delete entry", error);
  }
}