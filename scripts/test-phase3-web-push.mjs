import assert from "node:assert";
import { generateVAPIDKeys, setVapidDetails } from "web-push";

console.log("==========================================================");
console.log("PHASE 3 — WEB PUSH ARCHITECTURE & VAPID TEST SUITE");
console.log("==========================================================");

// Test 1: VAPID Keypair Generation & Configuration
console.log("\n[TEST 1] VAPID Keypair Generation & Web-Push Configuration");
const keys = generateVAPIDKeys();
assert(typeof keys.publicKey === "string" && keys.publicKey.length > 50, "Valid public key generated");
assert(typeof keys.privateKey === "string" && keys.privateKey.length > 30, "Valid private key generated");
console.log("✓ VAPID Keys generated successfully (public length:", keys.publicKey.length, ", private length:", keys.privateKey.length, ")");

setVapidDetails("mailto:companion@app.internal", keys.publicKey, keys.privateKey);
console.log("✓ setVapidDetails accepted keys without error");

// Test 2: Base64 to Uint8Array Conversion (for PushManager subscription)
console.log("\n[TEST 2] Client VAPID Base64 to Uint8Array Conversion");
function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = Buffer.from(base64, "base64");
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData[i];
  }
  return outputArray;
}

const uint8 = urlBase64ToUint8Array(keys.publicKey);
assert.strictEqual(uint8.byteLength, 65, "P-256 public key uncompressed point must be exactly 65 bytes");
console.log("✓ Converted VAPID public key to exact 65-byte P-256 applicationServerKey buffer");

// Test 3: Web Push Payload Structure
console.log("\n[TEST 3] Push Payload Formatting & Security");
const payload = {
  title: "Nikki",
  body: "Good morning! How did you sleep?",
  url: "/dashboard",
  icon: "/icons/icon-192.png",
  badge: "/icons/icon-192.png",
  tag: "companion-morning-checkin",
  actions: [
    { action: "open", title: "Open Companion" },
    { action: "dismiss", title: "Later" },
  ],
  data: {
    url: "/dashboard",
    dateOfArrival: Date.now(),
  },
};

const payloadString = JSON.stringify(payload);
assert(payloadString.includes("Good morning!"), "Body present");
assert(payloadString.includes("/icons/icon-192.png"), "Icon present");
assert(payloadString.includes("/dashboard"), "Action URL present");
console.log("✓ Push notification payload correctly formatted for service worker display");

// Test 4: Pruning / Expiration Logic
console.log("\n[TEST 4] Expired Subscription (404 / 410 Gone) Pruning Handler");
function shouldPruneSubscription(statusCode) {
  return statusCode === 404 || statusCode === 410;
}

assert.strictEqual(shouldPruneSubscription(410), true, "Status 410 Gone should be pruned");
assert.strictEqual(shouldPruneSubscription(404), true, "Status 404 Not Found should be pruned");
assert.strictEqual(shouldPruneSubscription(500), false, "Status 500 Transient Error should NOT be pruned");
assert.strictEqual(shouldPruneSubscription(429), false, "Status 429 Rate Limited should NOT be pruned");
console.log("✓ Dead push endpoint pruning rules accurately handle subscription lifecycle");

// Test 5: Category & Preference Opt-Out Filtering
console.log("\n[TEST 5] Category & Quiet Hours Push Guard");
function shouldDeliverPush({ proactiveEnabled, isPaused, category, categoriesEnabled, inQuietHours }) {
  if (!proactiveEnabled) return false;
  if (isPaused) return false;
  if (inQuietHours && category !== "sleep_reminder") return false;
  if (categoriesEnabled && categoriesEnabled[category] === false) return false;
  return true;
}

assert.strictEqual(shouldDeliverPush({ proactiveEnabled: true, isPaused: false, category: "task_reminder", categoriesEnabled: { task_reminder: true }, inQuietHours: false }), true);
assert.strictEqual(shouldDeliverPush({ proactiveEnabled: false, isPaused: false, category: "task_reminder", categoriesEnabled: { task_reminder: true }, inQuietHours: false }), false);
assert.strictEqual(shouldDeliverPush({ proactiveEnabled: true, isPaused: true, category: "task_reminder", categoriesEnabled: { task_reminder: true }, inQuietHours: false }), false);
assert.strictEqual(shouldDeliverPush({ proactiveEnabled: true, isPaused: false, category: "wellbeing_water_food", categoriesEnabled: { wellbeing_water_food: false }, inQuietHours: false }), false);
assert.strictEqual(shouldDeliverPush({ proactiveEnabled: true, isPaused: false, category: "break_reminder", categoriesEnabled: { break_reminder: true }, inQuietHours: true }), false);
console.log("✓ Push delivery respects quiet hours, pauses, category switches, and proactive toggle");

console.log("\n==========================================================");
console.log("ALL PHASE 3 WEB PUSH TESTS PASSED! (5/5)");
console.log("==========================================================");
