"use client";

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  signOut,
  sendPasswordResetEmail,
  type UserCredential,
} from "firebase/auth";
import { firebaseAuth, isFirebaseConfigured, missingFirebaseEnvVars } from "./client";

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

function requireAuth() {
  if (!isFirebaseConfigured || !firebaseAuth) {
    throw new Error("FIREBASE_NOT_CONFIGURED");
  }
  return firebaseAuth;
}

/** Returns true if the current environment is likely to block popups
 *  (mobile browsers, some Safari builds, embedded webviews). */
function isMobileOrPopupRestricted(): boolean {
  if (typeof window === "undefined") return false;
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod|Android/i.test(ua);
}

export async function signUpWithEmail(
  email: string,
  password: string
): Promise<UserCredential> {
  return createUserWithEmailAndPassword(requireAuth(), email, password);
}

export async function signInWithEmail(
  email: string,
  password: string
): Promise<UserCredential> {
  return signInWithEmailAndPassword(requireAuth(), email, password);
}

/**
 * Sign in with Google.
 * - Uses redirect on mobile (popup is often blocked).
 * - Uses popup on desktop with an automatic redirect fallback.
 */
export async function signInWithGoogle(): Promise<UserCredential | null> {
  const auth = requireAuth();

  if (isMobileOrPopupRestricted()) {
    // On mobile, redirect is more reliable. The result is handled on return
    // by calling handleGoogleRedirectResult() after the page reloads.
    await signInWithRedirect(auth, googleProvider);
    return null; // page will reload
  }

  try {
    return await signInWithPopup(auth, googleProvider);
  } catch (err) {
    const code = (err as { code?: string })?.code ?? "";
    // Fall back to redirect if popup was blocked or disallowed
    if (
      code === "auth/popup-blocked" ||
      code === "auth/popup-closed-by-user" ||
      code === "auth/cancelled-popup-request"
    ) {
      await signInWithRedirect(auth, googleProvider);
      return null; // page will reload
    }
    throw err;
  }
}

/**
 * Call this once on page load to pick up the result of a redirect sign-in.
 * Returns the UserCredential if a redirect just completed, otherwise null.
 */
export async function handleGoogleRedirectResult(): Promise<UserCredential | null> {
  if (!isFirebaseConfigured || !firebaseAuth) return null;
  try {
    const result = await getRedirectResult(firebaseAuth);
    return result;
  } catch (err) {
    throw err;
  }
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
    // ── Account / credential errors ──────────────────────────────────────────
    case "auth/email-already-in-use":
      return "That email is already registered. Try logging in instead.";
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "That email or password doesn't match our records.";
    case "auth/weak-password":
      return "Please choose a stronger password (at least 6 characters).";
    case "auth/invalid-email":
      return "Please enter a valid email address.";
    case "auth/user-disabled":
      return "This account has been disabled. Please contact support.";
    case "auth/too-many-requests":
      return "Too many attempts. Please wait a few minutes and try again.";

    // ── Popup / redirect errors ───────────────────────────────────────────────
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
      return "Sign-in was cancelled. Try again when you're ready.";
    case "auth/popup-blocked":
      return "Your browser blocked the sign-in popup. We'll try a redirect instead — please wait.";

    // ── Domain / configuration errors ─────────────────────────────────────────
    case "auth/unauthorized-domain":
      return (
        "This domain isn't authorised for Google sign-in. " +
        "In Firebase Console → Authentication → Settings → Authorised Domains, " +
        "add this site's domain, then try again."
      );
    case "auth/operation-not-allowed":
      return "Google sign-in isn't enabled for this project. Enable it in Firebase Console → Authentication → Sign-in method.";

    // ── API key / config errors ───────────────────────────────────────────────
    case "auth/invalid-api-key":
      return "The Firebase API key looks invalid. Double-check NEXT_PUBLIC_FIREBASE_API_KEY in .env.local, then restart the dev server.";
    case "auth/api-key-not-valid":
    case "auth/api-key-not-valid.-please-pass-a-valid-api-key.":
      return "Firebase rejected the API key. Re-copy it from Firebase Console → Project Settings → General → Your apps, then restart the dev server.";

    // ── Network errors ────────────────────────────────────────────────────────
    case "auth/network-request-failed":
      return "Network error. Check your connection and try again.";
    case "auth/internal-error":
      return "An internal error occurred with Firebase. Please try again in a moment.";

    // ── Password reset specific ───────────────────────────────────────────────
    case "auth/missing-email":
      return "Please enter your email address.";

    default:
      // Log the actual code in development so it can be caught and added above
      if (process.env.NODE_ENV === "development" && code) {
        console.warn("[Companion Auth] Unhandled Firebase error code:", code);
      }
      return "Something went wrong. Please try again.";
  }
}
