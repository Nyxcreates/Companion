"use client";

import { isFirebaseConfigured, missingFirebaseEnvVars } from "@/lib/firebase/client";

/**
 * Dev-only diagnostic banner. Never renders in production, and never
 * renders once Firebase is fully configured. Shows the exact missing
 * variable NAMES only — never values — so there's no need to guess.
 */
export function FirebaseConfigNotice() {
  if (process.env.NODE_ENV === "production") return null;
  if (isFirebaseConfigured) return null;

  return (
    <div className="mb-4 rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 text-left text-sm">
      <p className="font-medium text-warning">Firebase client isn't configured</p>
      <p className="mt-1 text-ink-secondary">Missing or empty in .env.local:</p>
      <ul className="mt-1 list-inside list-disc text-ink-secondary">
        {missingFirebaseEnvVars.map((name) => (
          <li key={name} className="font-mono text-xs text-ink-primary">
            {name}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-ink-secondary">
        If you just added these values, fully stop and restart <code className="text-ink-primary">npm run dev</code>{" "}
        — Next.js only reads <code className="text-ink-primary">.env.local</code> at startup, not on save.
      </p>
    </div>
  );
}