"use client";

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  sendPasswordResetEmail,
  type UserCredential,
} from "firebase/auth";
import { firebaseAuth, isFirebaseConfigured, missingFirebaseEnvVars } from "./client";

const googleProvider = new GoogleAuthProvider();

function requireAuth() {
  if (!isFirebaseConfigured || !firebaseAuth) {
    throw new Error("FIREBASE_NOT_CONFIGURED");
  }
  return firebaseAuth;
}

export async function signUpWithEmail(email: string, password: string): Promise<UserCredential> {
  return createUserWithEmailAndPassword(requireAuth(), email, password);
}

export async function signInWithEmail(email: string, password: string): Promise<UserCredential> {
  return signInWithEmailAndPassword(requireAuth(), email, password);
}

export async function signInWithGoogle(): Promise<UserCredential> {
  return signInWithPopup(requireAuth(), googleProvider);
}

export async function signOutUser(): Promise<void> {
  if (!isFirebaseConfigured || !firebaseAuth) return;
  return signOut(firebaseAuth);
}

export async function resetPassword(email: string): Promise<void> {
  return sendPasswordResetEmail(requireAuth(), email);
}

export function getAuthErrorMessage(error: unknown): string {
  const code = (error as { code?: string })?.code ?? "";
  const message = (error as { message?: string })?.message ?? "";

  if (message === "FIREBASE_NOT_CONFIGURED") {
    if (missingFirebaseEnvVars.length > 0) {
      return `Firebase isn't configured yet. Missing from .env.local: ${missingFirebaseEnvVars.join(
        ", "
      )}. Add these values, then fully restart the dev server.`;
    }
    return "Firebase isn't connected yet — add your keys to .env.local to enable sign-in.";
  }

  switch (code) {
    case "auth/email-already-in-use":
      return "That email is already registered.";
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "That email or password doesn't match our records.";
    case "auth/weak-password":
      return "Please choose a stronger password (6+ characters).";
    case "auth/popup-closed-by-user":
      return "Sign-in was cancelled.";
    case "auth/operation-not-allowed":
      return "Email/Password sign-in isn't enabled for this Firebase project yet. In the Firebase console, go to Authentication → Sign-in method, and enable the Email/Password provider.";
    case "auth/invalid-api-key":
      return "That Firebase API key looks invalid. Double-check NEXT_PUBLIC_FIREBASE_API_KEY in .env.local against the Firebase console, then restart the dev server.";
    case "auth/api-key-not-valid":
    case "auth/api-key-not-valid.-please-pass-a-valid-api-key.":
      return "That Firebase API key was rejected by Firebase. Re-copy it from Project Settings → General → Web app, then restart the dev server.";
    default:
      return "Something went wrong. Let's try that again.";
  }
}