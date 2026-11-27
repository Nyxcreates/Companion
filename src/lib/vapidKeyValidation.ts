import crypto from "crypto";

export interface VapidDiagnostics {
  hasPublicKey: boolean;
  hasPrivateKey: boolean;
  hasSubject: boolean;
  keysMatch: boolean;
  isConfigured: boolean;
  error?: string;
}

export function cleanEnvValue(raw: string | undefined): string {
  if (!raw) return "";
  return raw.trim().replace(/^['"]|['"]$/g, "").trim();
}

export function normalizeVapidSubject(raw: string | undefined): string {
  const cleaned = cleanEnvValue(raw);
  if (!cleaned) return "mailto:companion@app.internal";
  if (/^(mailto:|https?:\/\/)/i.test(cleaned)) return cleaned;
  if (cleaned.includes("@")) return `mailto:${cleaned}`;
  return cleaned;
}

export function getVapidPublicKey(): string {
  return (
    cleanEnvValue(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) ||
    cleanEnvValue(process.env.VAPID_PUBLIC_KEY)
  );
}

/**
 * Validates whether the given public and private keys are valid P-256 keys
 * and belong to the exact same cryptographic keypair.
 */
export function validateVapidKeyPair(
  publicKey: string,
  privateKey: string
): { valid: boolean; error?: string } {
  try {
    const pad = (s: string) => s + "=".repeat((4 - (s.length % 4)) % 4);
    const pubBuf = Buffer.from(
      pad(publicKey.trim()).replace(/-/g, "+").replace(/_/g, "/"),
      "base64"
    );
    const privBuf = Buffer.from(
      pad(privateKey.trim()).replace(/-/g, "+").replace(/_/g, "/"),
      "base64"
    );

    if (pubBuf.length !== 65) {
      return {
        valid: false,
        error: `Invalid public key length (${pubBuf.length} bytes, expected 65 bytes).`,
      };
    }
    if (privBuf.length !== 32) {
      return {
        valid: false,
        error: `Invalid private key length (${privBuf.length} bytes, expected 32 bytes).`,
      };
    }

    const ecdh = crypto.createECDH("prime256v1");
    ecdh.setPrivateKey(privBuf);
    const derivedPub = ecdh.getPublicKey();

    if (Buffer.compare(derivedPub, pubBuf) === 0) {
      return { valid: true };
    }
    return {
      valid: false,
      error: "Public key and private key do not belong to the same keypair.",
    };
  } catch (err) {
    return {
      valid: false,
      error: err instanceof Error ? err.message : "Key validation failed.",
    };
  }
}

/**
 * Safely inspects runtime VAPID configuration without exposing secret key values.
 */
export function getVapidDiagnostics(isConfigured = false): VapidDiagnostics {
  const publicKey = getVapidPublicKey();
  const privateKey = cleanEnvValue(process.env.VAPID_PRIVATE_KEY);
  const rawSubject = cleanEnvValue(process.env.VAPID_SUBJECT);

  const hasPublicKey = Boolean(publicKey);
  const hasPrivateKey = Boolean(privateKey);
  const hasSubject = Boolean(rawSubject);

  if (!hasPublicKey || !hasPrivateKey) {
    return {
      hasPublicKey,
      hasPrivateKey,
      hasSubject,
      keysMatch: false,
      isConfigured: false,
      error:
        !hasPublicKey && !hasPrivateKey
          ? "Missing NEXT_PUBLIC_VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY in server runtime."
          : !hasPublicKey
          ? "Missing NEXT_PUBLIC_VAPID_PUBLIC_KEY in server runtime."
          : "Missing VAPID_PRIVATE_KEY in server runtime.",
    };
  }

  const keyCheck = validateVapidKeyPair(publicKey, privateKey);
  if (!keyCheck.valid) {
    return {
      hasPublicKey,
      hasPrivateKey,
      hasSubject,
      keysMatch: false,
      isConfigured: false,
      error: keyCheck.error,
    };
  }

  return {
    hasPublicKey: true,
    hasPrivateKey: true,
    hasSubject,
    keysMatch: true,
    isConfigured,
  };
}
