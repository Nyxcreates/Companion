import mongoose, { type ClientSession } from "mongoose";

/**
 * Runs `work` inside a MongoDB transaction when the deployment
 * supports it (Atlas clusters, including the free M0 tier, are
 * replica sets and do). If the deployment is a standalone server that
 * rejects transactions, falls back to running `work` WITHOUT a
 * session — callers must therefore order their writes so that a
 * mid-way failure never leaves dangling references (clear references
 * first, delete the referenced documents last).
 */
export async function runWithOptionalTransaction<T>(
  work: (session: ClientSession | undefined) => Promise<T>
): Promise<{ result: T; usedTransaction: boolean }> {
  let session: ClientSession | undefined;
  try {
    session = await mongoose.startSession();
    let result!: T;
    await session.withTransaction(async () => {
      result = await work(session);
    });
    return { result, usedTransaction: true };
  } catch (error) {
    if (isTransactionUnsupported(error)) {
      const result = await work(undefined);
      return { result, usedTransaction: false };
    }
    throw error;
  } finally {
    if (session) await session.endSession();
  }
}

function isTransactionUnsupported(error: unknown): boolean {
  const err = error as { code?: number; message?: string } | null;
  if (!err) return false;
  if (err.code === 20) return true;
  const message = err.message ?? "";
  return /Transaction numbers are only allowed|replica set|does not support transactions/i.test(message);
}