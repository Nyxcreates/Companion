"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useProfile } from "@/context/ProfileContext";
import { normalizeLivingEnvironmentId } from "@/lib/world/worldThemes";
import type { AppTheme, LivingEnvironmentId } from "@/types/profile";

interface WorldThemeContextValue {
  theme: AppTheme;
  livingEnvironment: LivingEnvironmentId;
  setTheme: (theme: AppTheme) => Promise<void>;
  setLivingEnvironment: (environment: LivingEnvironmentId) => Promise<void>;
  updateWorldSettings: (settings: {
    theme?: AppTheme;
    livingEnvironment?: LivingEnvironmentId;
  }) => Promise<void>;
}

const THEME_STORAGE_KEY = "companion:theme";
const ENVIRONMENT_STORAGE_KEY = "companion:living-environment";

const WorldThemeContext = createContext<WorldThemeContextValue | undefined>(undefined);

export function WorldThemeContextProvider({ children }: { children: ReactNode }) {
  const { profile, updateProfile } = useProfile();

  const [theme, setThemeState] = useState<AppTheme>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(THEME_STORAGE_KEY);
      if (stored === "light" || stored === "dark") return stored;
    }
    return "dark";
  });

  const [livingEnvironment, setLivingEnvironmentState] = useState<LivingEnvironmentId>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(ENVIRONMENT_STORAGE_KEY);
      if (stored) return normalizeLivingEnvironmentId(stored);
    }
    return "cosmic-dream";
  });

  // Apply CSS class and attributes on document.documentElement whenever theme or environment changes
  useEffect(() => {
    if (typeof document === "undefined") return;

    const root = document.documentElement;
    if (theme === "light") {
      root.classList.remove("dark");
      root.classList.add("light");
      root.setAttribute("data-theme", "light");
    } else {
      root.classList.remove("light");
      root.classList.add("dark");
      root.setAttribute("data-theme", "dark");
    }

    root.setAttribute("data-environment", livingEnvironment);
  }, [theme, livingEnvironment]);

  // Synchronize with database profile when loaded
  useEffect(() => {
    if (profile?.theme && (profile.theme === "dark" || profile.theme === "light")) {
      setThemeState(profile.theme);
      if (typeof window !== "undefined") {
        localStorage.setItem(THEME_STORAGE_KEY, profile.theme);
      }
    }
    if (profile?.livingEnvironment) {
      const normalized = normalizeLivingEnvironmentId(profile.livingEnvironment);
      setLivingEnvironmentState(normalized);
      if (typeof window !== "undefined") {
        localStorage.setItem(ENVIRONMENT_STORAGE_KEY, normalized);
      }
    }
  }, [profile?.theme, profile?.livingEnvironment]);

  const updateWorldSettings = useCallback(
    async (settings: { theme?: AppTheme; livingEnvironment?: LivingEnvironmentId }) => {
      const nextTheme = settings.theme ?? theme;
      const nextEnv = settings.livingEnvironment ?? livingEnvironment;

      setThemeState(nextTheme);
      setLivingEnvironmentState(nextEnv);

      if (typeof window !== "undefined") {
        if (settings.theme) localStorage.setItem(THEME_STORAGE_KEY, settings.theme);
        if (settings.livingEnvironment) localStorage.setItem(ENVIRONMENT_STORAGE_KEY, settings.livingEnvironment);
      }

      // Persist to database profile if authenticated
      if (profile) {
        try {
          await updateProfile({
            theme: nextTheme,
            livingEnvironment: nextEnv,
          });
        } catch {
          // Non-blocking: local preference keeps UI responsive
        }
      }
    },
    [theme, livingEnvironment, profile, updateProfile]
  );

  const setTheme = useCallback(
    async (newTheme: AppTheme) => {
      await updateWorldSettings({ theme: newTheme });
    },
    [updateWorldSettings]
  );

  const setLivingEnvironment = useCallback(
    async (newEnv: LivingEnvironmentId) => {
      await updateWorldSettings({ livingEnvironment: newEnv });
    },
    [updateWorldSettings]
  );

  return (
    <WorldThemeContext.Provider
      value={{
        theme,
        livingEnvironment,
        setTheme,
        setLivingEnvironment,
        updateWorldSettings,
      }}
    >
      {children}
    </WorldThemeContext.Provider>
  );
}

export function useWorldTheme(): WorldThemeContextValue {
  const ctx = useContext(WorldThemeContext);
  if (!ctx) {
    throw new Error("useWorldTheme must be used within a WorldThemeContextProvider");
  }
  return ctx;
}
