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
 * Attempts popup authentication across all devices.
 * If the browser or embedded webview explicitly blocks the popup, falls back to redirect.
 * If the user deliberately closes the popup, cancels cleanly without redirecting.
 */
export async function signInWithGoogle(): Promise<UserCredential | null> {
  const auth = requireAuth();

  try {
    return await signInWithPopup(auth, googleProvider);
  } catch (err) {
    const code = (err as { code?: string })?.code ?? "";

    // If popup is explicitly blocked, fall back to redirect
    if (code === "auth/popup-blocked") {
      await signInWithRedirect(auth, googleProvider);
      return null;
    }

    // If user cancelled the popup, do not redirect
    if (
      code === "auth/popup-closed-by-user" ||
      code === "auth/cancelled-popup-request"
    ) {
      throw err;
    }

    throw err;
  }
}

/**
 * Checks for any pending redirect auth result upon page load.
 * Returns null if no redirect sign-in was in flight.
 */
export async function handleGoogleRedirectResult(): Promise<UserCredential | null> {
  if (!isFirebaseConfigured || !firebaseAuth) return null;
  try {
    return await getRedirectResult(firebaseAuth);
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
      return `Firebase is not configured yet. Missing from environment: ${missingFirebaseEnvVars.join(
        ", "
      )}. Please add these variables to your Vercel project settings.`;
    }
    return "Firebase is not connected yet. Please add your credentials in Project Settings.";
  }

  switch (code) {
    // ── Account / credential errors ──────────────────────────────────────────
    case "auth/email-already-in-use":
      return "That email is already registered. Try logging in instead.";
    case "auth/account-exists-with-different-credential":
      return "An account already exists with this email address. Please log in with your email and password.";
    case "auth/credential-already-in-use":
      return "This credential is already linked to another account.";
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "That email or password does not match our records.";
    case "auth/weak-password":
      return "Please choose a stronger password (at least 6 characters).";
    case "auth/invalid-email":
      return "Please enter a valid email address.";
    case "auth/user-disabled":
      return "This account has been disabled. Please contact support.";
    case "auth/too-many-requests":
      return "Too many sign-in attempts. Please wait a few minutes and try again.";

    // ── Popup / redirect errors ───────────────────────────────────────────────
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
      return "Sign-in was cancelled.";
    case "auth/popup-blocked":
      return "Your browser blocked the Google sign-in popup. Please allow popups for this site, or try again.";

    // ── Domain / configuration errors ─────────────────────────────────────────
    case "auth/unauthorized-domain": {
      const currentHost = typeof window !== "undefined" ? window.location.hostname : "your current domain";
      return (
        `This domain is not authorized (${currentHost}). ` +
        `In Firebase Console → Authentication → Settings → Authorized domains, add "${currentHost}" and try again.`
      );
    }
    case "auth/operation-not-allowed":
      return "Google sign-in is not enabled for this Firebase project. Enable it in Firebase Console → Authentication → Sign-in method.";

    // ── API key / config errors ───────────────────────────────────────────────
    case "auth/invalid-api-key":
      return "The Firebase API key looks invalid. Double-check NEXT_PUBLIC_FIREBASE_API_KEY in Vercel settings.";
    case "auth/api-key-not-valid":
    case "auth/api-key-not-valid.-please-pass-a-valid-api-key.":
      return "Firebase rejected the API key. Re-copy it from Firebase Console → Project Settings → General.";

    // ── Network / storage errors ──────────────────────────────────────────────
    case "auth/network-request-failed":
      return "Network error. Please check your internet connection and try again.";
    case "auth/web-storage-unsupported":
      return "Third-party cookies or storage access are disabled in your browser settings. Please enable them to sign in.";
    case "auth/internal-error":
      return "A temporary Firebase service error occurred. Please try again in a moment.";

    // ── Password reset specific ───────────────────────────────────────────────
    case "auth/missing-email":
      return "Please enter your registered email address.";

    default:
      // Always include the real code if available so debugging is transparent
      if (code) {
        return `Sign-in failed (${code}). Please try again or check your settings.`;
      }
      return message || "Something went wrong during sign-in. Please try again.";
  }
}
