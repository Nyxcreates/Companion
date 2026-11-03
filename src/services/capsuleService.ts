import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import { CapsuleModel, type CapsuleDocument } from "@/models/Capsule";
import { CapsulePersistenceError, CapsuleNotReadyError, CapsuleNotSealedError } from "@/lib/capsules/errors";
import { computeCapsuleStatus, resolveRelativeUnlockDate, RELATIVE_DURATION_OPTIONS } from "@/lib/capsules/unlock";
import type { CapsuleSummary, CapsuleDetail, RelativeDurationOption } from "@/types/capsule";

function toSummary(doc: CapsuleDocument): CapsuleSummary {
  return {
    id: String(doc._id),
    title: doc.title,
    status: computeCapsuleStatus(doc.unlockAt, doc.openedAt),
    unlockAt: doc.unlockAt.toISOString(),
    createdAt: doc.createdAt.toISOString(),
    openedAt: doc.openedAt ? doc.openedAt.toISOString() : null,
  };
}

function toDetail(doc: CapsuleDocument): CapsuleDetail {
  const summary = toSummary(doc);
  return {
    ...summary,
    message: summary.status === "SEALED" ? null : doc.message,
  };
}

interface CreateCapsuleParams {
  firebaseUid: string;
  title: string | null;
  message: string;
  unlockAt?: string;
  relativeDuration?: RelativeDurationOption;
}

export async function createCapsule(params: CreateCapsuleParams): Promise<CapsuleSummary> {
  try {
    await connectToDatabase();

    const unlockAt = params.relativeDuration
      ? resolveRelativeUnlockDate(params.relativeDuration)
      : new Date(params.unlockAt!);

    const relativeDurationLabel = params.relativeDuration
      ? (RELATIVE_DURATION_OPTIONS.find((o) => o.value === params.relativeDuration)?.label ?? null)
      : null;

    const doc = await CapsuleModel.create({
      firebaseUid: params.firebaseUid,
      title: params.title,
      message: params.message,
      unlockAt,
      relativeDurationLabel,
    });

    return toSummary(doc);
  } catch (error) {
    throw new CapsulePersistenceError("create capsule", error);
  }
}

/** Soonest-unlock-first. Grouping into SEALED / UNLOCKED / OPENED sections is a display concern handled client-side — the API doesn't need to pre-partition. */
export async function listCapsules(firebaseUid: string): Promise<CapsuleSummary[]> {
  try {
    await connectToDatabase();
    const docs = await CapsuleModel.find({ firebaseUid }).sort({ unlockAt: 1 });
    return docs.map(toSummary);
  } catch (error) {
    throw new CapsulePersistenceError("list capsules", error);
  }
}

/** Returns null (never throws) when the capsule doesn't exist or isn't owned by this user, so the route can return a clean 404 without distinguishing the two cases to the client. */
export async function getCapsuleDetail(id: string, firebaseUid: string): Promise<CapsuleDetail | null> {
  try {
    await connectToDatabase();
    if (!mongoose.isValidObjectId(id)) return null;

    const doc = await CapsuleModel.findOne({ _id: id, firebaseUid });
    return doc ? toDetail(doc) : null;
  } catch (error) {
    throw new CapsulePersistenceError("get capsule", error);
  }
}

/**
 * Marks a capsule OPENED, but only if the server's own clock agrees
 * the unlock condition has been met — a client-side countdown is
 * never trusted as authorization. Idempotent: opening an
 * already-opened capsule just returns the same detail again rather
 * than erroring, since re-reading something you've already opened is
 * a completely normal thing to do.
 */
export async function openCapsule(id: string, firebaseUid: string): Promise<CapsuleDetail | null> {
  try {
    await connectToDatabase();
    if (!mongoose.isValidObjectId(id)) return null;

    const doc = await CapsuleModel.findOne({ _id: id, firebaseUid });
    if (!doc) return null;

    if (doc.openedAt) return toDetail(doc);

    if (doc.unlockAt.getTime() > Date.now()) {
      throw new CapsuleNotReadyError();
    }

    doc.openedAt = new Date();
    await doc.save();

    return toDetail(doc);
  } catch (error) {
    if (error instanceof CapsuleNotReadyError) throw error;
    throw new CapsulePersistenceError("open capsule", error);
  }
}

/** Only a still-SEALED capsule can be removed — once its condition is met it's treated as a real memory, not a draft. Returns null if not found/not owned. */
export async function deleteSealedCapsule(id: string, firebaseUid: string): Promise<boolean | null> {
  try {
    await connectToDatabase();
    if (!mongoose.isValidObjectId(id)) return null;

    const doc = await CapsuleModel.findOne({ _id: id, firebaseUid });
    if (!doc) return null;

    if (computeCapsuleStatus(doc.unlockAt, doc.openedAt) !== "SEALED") {
      throw new CapsuleNotSealedError();
    }

    await doc.deleteOne();
    return true;
  } catch (error) {
    if (error instanceof CapsuleNotSealedError) throw error;
    throw new CapsulePersistenceError("delete capsule", error);
  }
}