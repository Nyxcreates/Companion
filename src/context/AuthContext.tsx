"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { firebaseAuth, isFirebaseConfigured } from "@/lib/firebase/client";
import { signOutUser } from "@/lib/firebase/auth";
import { authFetch } from "@/lib/api/authFetch";

interface AuthContextValue {
  firebaseUser: User | null;
  loading: boolean;
  isFirebaseConfigured: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(isFirebaseConfigured);

  useEffect(() => {
    if (!isFirebaseConfigured || !firebaseAuth) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(firebaseAuth, (user) => {
      setFirebaseUser(user);
      setLoading(false);

      if (user) {
        // Ensures a bare MongoDB profile exists for this Firebase UID and syncs
        // the browser's IANA timezone if not yet saved.
        let browserTz: string | undefined;
        try {
          browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
        } catch {}
        authFetch("/api/auth/sync", {
          method: "POST",
          body: JSON.stringify({ timezone: browserTz }),
        }).catch(() => {});
      }
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ firebaseUser, loading, isFirebaseConfigured, signOut: signOutUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}