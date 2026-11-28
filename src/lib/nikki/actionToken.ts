import crypto from "crypto";

export type SignedNudgeAction = "done" | "acknowledge" | "snooze" | "dismiss";

export interface NudgeActionTokenPayload {
  uid: string;
  nudgeId?: string;
  trigger?: string;
  action: SignedNudgeAction;
  minutes?: number;
  exp: number;
}

function getSigningSecret(): string {
  return (
    process.env.CRON_SECRET ||
    process.env.FIREBASE_PRIVATE_KEY ||
    process.env.MONGODB_URI ||
    "companion-nudge-action-fallback-secret"
  );
}

export function signNudgeActionToken(
  payload: Omit<NudgeActionTokenPayload, "exp">,
  ttlSeconds = 7 * 24 * 3600
): string {
  const full: NudgeActionTokenPayload = {
    ...payload,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
  };
  const encoded = Buffer.from(JSON.stringify(full), "utf8").toString("base64url");
  const sig = crypto
    .createHmac("sha256", getSigningSecret())
    .update(encoded)
    .digest("base64url");
  return `${encoded}.${sig}`;
}

export function verifyNudgeActionToken(token: string): NudgeActionTokenPayload | null {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [encoded, sig] = parts;
  if (!encoded || !sig) return null;

  const expectedSig = crypto
    .createHmac("sha256", getSigningSecret())
    .update(encoded)
    .digest("base64url");

  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as NudgeActionTokenPayload;
    if (!parsed || typeof parsed.uid !== "string" || typeof parsed.exp !== "number") {
      return null;
    }
    if (parsed.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}
