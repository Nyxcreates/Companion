"use client";

import { firebaseAuth } from "@/lib/firebase/client";

export class AuthFetchError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = "AuthFetchError";
    this.status = status;
  }
}

/**
 * The one place in the app that attaches a Firebase ID token to an
 * outgoing API request. Every authenticated client call should go
 * through this instead of hand-building headers — reused by
 * AuthContext (profile sync) and ProfileContext (profile GET/PATCH).
 */
export async function authFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const user = firebaseAuth?.currentUser;
  if (!user) {
    throw new AuthFetchError("You need to be signed in to do that.");
  }

  let token: string;
  try {
    token = await user.getIdToken();
  } catch {
    throw new AuthFetchError("Your session expired. Please sign in again.");
  }

  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(input, { ...init, headers });

  if (response.status === 401) {
    throw new AuthFetchError("Your session expired. Please sign in again.", 401);
  }

  return response;
}
