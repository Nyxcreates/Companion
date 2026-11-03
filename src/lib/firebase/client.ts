"use client";

import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Only these four are strictly required to initialize Firebase Auth.
// storageBucket / messagingSenderId are optional unless you use Storage / FCM.
const REQUIRED_KEYS = ["apiKey", "authDomain", "projectId", "appId"] as const;

const ENV_VAR_NAMES: Record<(typeof REQUIRED_KEYS)[number], string> = {
  apiKey: "NEXT_PUBLIC_FIREBASE_API_KEY",
  authDomain: "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  projectId: "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  appId: "NEXT_PUBLIC_FIREBASE_APP_ID",
};

/**
 * Names only — never values — of any required env vars that are
 * currently missing or blank. This replaces a previous all-or-nothing
 * boolean check that gave no way to tell *which* variable was the
 * problem when Firebase reported as "not configured."
 */
export const missingFirebaseEnvVars: string[] = REQUIRED_KEYS.filter((key) => {
  const value = firebaseConfig[key];
  return !value || value.trim() === "";
}).map((key) => ENV_VAR_NAMES[key]);

export const isFirebaseConfigured = missingFirebaseEnvVars.length === 0;

if (typeof window !== "undefined" && !isFirebaseConfigured) {
  // Dev diagnostic only. Never logs the values themselves.
  // eslint-disable-next-line no-console
  console.warn(
    "[Companion] Firebase client is not fully configured.\n" +
      `Missing or empty in .env.local: ${missingFirebaseEnvVars.join(", ")}\n` +
      "If you just added these, fully restart `npm run dev` — Next.js only reads .env.local at server startup, not on save."
  );
}

function getFirebaseApp(): FirebaseApp | null {
  if (!isFirebaseConfigured) return null;
  if (!getApps().length) {
    return initializeApp(firebaseConfig);
  }
  return getApp();
}

export const firebaseApp = getFirebaseApp();

// getAuth() throws immediately on an invalid config, so only call it
// once we know every required value is present.
export const firebaseAuth: Auth | null = firebaseApp ? getAuth(firebaseApp) : null;