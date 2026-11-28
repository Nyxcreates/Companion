"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.signNudgeActionToken = signNudgeActionToken;
exports.verifyNudgeActionToken = verifyNudgeActionToken;
const crypto_1 = __importDefault(require("crypto"));
function getSigningSecret() {
    return (process.env.CRON_SECRET ||
        process.env.FIREBASE_PRIVATE_KEY ||
        process.env.MONGODB_URI ||
        "companion-nudge-action-fallback-secret");
}
function signNudgeActionToken(payload, ttlSeconds = 7 * 24 * 3600) {
    const full = {
        ...payload,
        exp: Math.floor(Date.now() / 1000) + ttlSeconds,
    };
    const encoded = Buffer.from(JSON.stringify(full), "utf8").toString("base64url");
    const sig = crypto_1.default
        .createHmac("sha256", getSigningSecret())
        .update(encoded)
        .digest("base64url");
    return `${encoded}.${sig}`;
}
function verifyNudgeActionToken(token) {
    if (!token || typeof token !== "string")
        return null;
    const parts = token.split(".");
    if (parts.length !== 2)
        return null;
    const [encoded, sig] = parts;
    if (!encoded || !sig)
        return null;
    const expectedSig = crypto_1.default
        .createHmac("sha256", getSigningSecret())
        .update(encoded)
        .digest("base64url");
    const sigBuf = Buffer.from(sig);
    const expectedBuf = Buffer.from(expectedSig);
    if (sigBuf.length !== expectedBuf.length || !crypto_1.default.timingSafeEqual(sigBuf, expectedBuf)) {
        return null;
    }
    try {
        const parsed = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
        if (!parsed || typeof parsed.uid !== "string" || typeof parsed.exp !== "number") {
            return null;
        }
        if (parsed.exp < Math.floor(Date.now() / 1000)) {
            return null;
        }
        return parsed;
    }
    catch {
        return null;
    }
}
