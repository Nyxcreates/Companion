import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { verifyCronBearerToken } from "../src/lib/api/verifyCronAuth.ts";
import {
  claimNotificationIdempotency,
  NotificationIdempotencyModel,
} from "../src/models/NotificationIdempotency.ts";

test("vercel.json does not contain incompatible Hobby cron schedules", () => {
  const raw = fs.readFileSync(path.join(process.cwd(), "vercel.json"), "utf8");
  const parsed = JSON.parse(raw);
  assert.equal("crons" in parsed, false, "vercel.json must not define crons");
});

test("verifyCronBearerToken rejects missing, empty, or malformed secrets", () => {
  assert.equal(verifyCronBearerToken(null, "super-secret"), false);
  assert.equal(verifyCronBearerToken(undefined, "super-secret"), false);
  assert.equal(verifyCronBearerToken("", "super-secret"), false);
  assert.equal(verifyCronBearerToken("Basic super-secret", "super-secret"), false);
  assert.equal(verifyCronBearerToken("Bearer wrong-secret", "super-secret"), false);
  assert.equal(verifyCronBearerToken("Bearer super-secret", ""), false);
  assert.equal(verifyCronBearerToken("Bearer super-secret", undefined), false);
});

test("verifyCronBearerToken accepts exact Bearer CRON_SECRET match", () => {
  assert.equal(verifyCronBearerToken("Bearer super-secret-123", "super-secret-123"), true);
  assert.equal(verifyCronBearerToken("bearer super-secret-123", "super-secret-123"), true);
});

test("claimNotificationIdempotency allows first claim and blocks concurrent/duplicate claims", async () => {
  const seenKeys = new Set();
  const originalCreate = NotificationIdempotencyModel.create;

  NotificationIdempotencyModel.create = async (doc) => {
    if (seenKeys.has(doc.key)) {
      const err = new Error("E11000 duplicate key error");
      err.code = 11000;
      throw err;
    }
    seenKeys.add(doc.key);
    return doc;
  };

  try {
    const [first, second, third] = await Promise.all([
      claimNotificationIdempotency("uid1:morning_overview:2026-11-27", "uid1", "proactive", 60_000),
      claimNotificationIdempotency("uid1:morning_overview:2026-11-27", "uid1", "proactive", 60_000),
      claimNotificationIdempotency("uid1:morning_overview:2026-11-27", "uid1", "proactive", 60_000),
    ]);

    assert.equal(first, true);
    assert.equal(second, false);
    assert.equal(third, false);

    const otherKey = await claimNotificationIdempotency(
      "uid1:evening_reflection:2026-11-27",
      "uid1",
      "proactive",
      60_000
    );
    assert.equal(otherKey, true);
  } finally {
    NotificationIdempotencyModel.create = originalCreate;
  }
});
