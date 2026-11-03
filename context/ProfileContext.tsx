"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { authFetch, AuthFetchError } from "@/lib/api/authFetch";
import type { ProfileUpdatePayload, UserProfile } from "@/types/profile";

interface ProfileContextValue {
  profile: UserProfile | null;
  /** True while auth is resolving OR the profile fetch is in flight. */
  loading: boolean;
  refetch: () => Promise<void>;
  updateProfile: (payload: ProfileUpdatePayload) => Promise<UserProfile>;
}

const ProfileContext = createContext<ProfileContextValue | undefined>(undefined);

/**
 * Loads the authenticated user's MongoDB profile (never localStorage)
 * and exposes it app-wide. `loading` here already factors in auth's
 * own loading state, so consumers only need to check one flag.
 */
export function ProfileProvider({ children }: { children: ReactNode }) {
  const { firebaseUser, loading: authLoading } = useAuth();
  const { showToast } = useToast();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [fetching, setFetching] = useState(false);

  const fetchProfile = useCallback(async () => {
    if (!firebaseUser) {
      setProfile(null);
      return;
    }
    setFetching(true);
    try {
      const res = await authFetch("/api/user/profile", { method: "GET" });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error?.message ?? "Could not load your profile.");
      }
      setProfile(json.data ?? null);
    } catch (err) {
      if (!(err instanceof AuthFetchError)) {
        showToast("Companion couldn't reach your profile just now.", "danger");
      }
      setProfile(null);
    } finally {
      setFetching(false);
    }
  }, [firebaseUser, showToast]);

  useEffect(() => {
    if (authLoading) return;
    fetchProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firebaseUser, authLoading]);

  const updateProfile = useCallback(async (payload: ProfileUpdatePayload): Promise<UserProfile> => {
    const res = await authFetch("/api/user/profile", {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok) {
      throw new Error(json?.error?.message ?? "Could not save that.");
    }
    setProfile(json.data);
    return json.data as UserProfile;
  }, []);

  return (
    <ProfileContext.Provider
      value={{ profile, loading: authLoading || fetching, refetch: fetchProfile, updateProfile }}
    >
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile(): ProfileContextValue {
  const ctx = useContext(ProfileContext);
  if (!ctx) {
    throw new Error("useProfile must be used within a ProfileProvider");
  }
  return ctx;
}