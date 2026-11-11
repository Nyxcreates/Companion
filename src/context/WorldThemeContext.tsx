"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useProfile } from "@/context/ProfileContext";
import { normalizeLivingEnvironmentId } from "@/lib/world/worldThemes";
import { getWorldPersonality } from "@/lib/worlds/personality";
import type { GuidePose, GuideGaze } from "@/components/character/LivingCompanionGuide";
import type { CompanionPose } from "@/components/character/CompanionCharacter";
import type { AppTheme, LivingEnvironmentId } from "@/types/profile";

export interface CompanionThemeReaction {
  line: string;
  pose: GuidePose;
  gaze: GuideGaze;
  companionPose: CompanionPose;
  envId: LivingEnvironmentId;
}

interface WorldThemeContextValue {
  theme: AppTheme;
  livingEnvironment: LivingEnvironmentId;
  activeReaction: CompanionThemeReaction | null;
  clearReaction: () => void;
  triggerReaction: (envId: LivingEnvironmentId) => void;
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
      try {
        const stored = localStorage.getItem(THEME_STORAGE_KEY);
        if (stored === "light" || stored === "dark") return stored;
      } catch {
        // Fallback if localStorage access is restricted
      }
    }
    return "dark";
  });

  const [livingEnvironment, setLivingEnvironmentState] = useState<LivingEnvironmentId>(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem(ENVIRONMENT_STORAGE_KEY);
        if (stored) return normalizeLivingEnvironmentId(stored);
      } catch {
        // Fallback if localStorage access is restricted
      }
    }
    return "cosmic-dream";
  });

  const [activeReaction, setActiveReaction] = useState<CompanionThemeReaction | null>(null);
  const reactionTimerRef = useRef<NodeJS.Timeout | null>(null);

  const clearReaction = useCallback(() => {
    if (reactionTimerRef.current) clearTimeout(reactionTimerRef.current);
    setActiveReaction(null);
  }, []);

  const triggerReaction = useCallback((envId: LivingEnvironmentId) => {
    const personality = getWorldPersonality(envId);
    if (reactionTimerRef.current) clearTimeout(reactionTimerRef.current);
    setActiveReaction({
      ...personality.themeChangeReaction,
      envId,
    });
    reactionTimerRef.current = setTimeout(() => {
      setActiveReaction(null);
    }, 6500);
  }, []);

  useEffect(() => {
    return () => {
      if (reactionTimerRef.current) clearTimeout(reactionTimerRef.current);
    };
  }, []);

  // Apply CSS class and attributes on document.documentElement whenever theme or environment changes
  useEffect(() => {
    if (typeof document === "undefined") return;

    try {
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

      const personality = getWorldPersonality(livingEnvironment);
      root.style.setProperty("--accent-primary", personality.companionLook.accentPrimary);
      root.style.setProperty("--accent-secondary", personality.companionLook.accentSecondary);
      root.style.setProperty("--world-glow", personality.companionLook.glowColor);
      root.style.setProperty("--world-halo", personality.companionLook.haloColor);
    } catch {
      // Safe fallback
    }
  }, [theme, livingEnvironment]);

  // Synchronize with database profile when loaded
  useEffect(() => {
    if (profile?.theme && (profile.theme === "dark" || profile.theme === "light")) {
      setThemeState(profile.theme);
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem(THEME_STORAGE_KEY, profile.theme);
        } catch {
          // Safe fallback
        }
      }
    }
    if (profile?.livingEnvironment) {
      const normalized = normalizeLivingEnvironmentId(profile.livingEnvironment);
      setLivingEnvironmentState(normalized);
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem(ENVIRONMENT_STORAGE_KEY, normalized);
        } catch {
          // Safe fallback
        }
      }
    }
  }, [profile?.theme, profile?.livingEnvironment]);

  const updateWorldSettings = useCallback(
    async (settings: { theme?: AppTheme; livingEnvironment?: LivingEnvironmentId }) => {
      const nextTheme = settings.theme ?? theme;
      const nextEnv = settings.livingEnvironment ?? livingEnvironment;

      if (settings.livingEnvironment && settings.livingEnvironment !== livingEnvironment) {
        triggerReaction(settings.livingEnvironment);
      }

      setThemeState(nextTheme);
      setLivingEnvironmentState(nextEnv);

      if (typeof window !== "undefined") {
        try {
          if (settings.theme) localStorage.setItem(THEME_STORAGE_KEY, settings.theme);
          if (settings.livingEnvironment) localStorage.setItem(ENVIRONMENT_STORAGE_KEY, settings.livingEnvironment);
        } catch {
          // Safe fallback
        }
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
        activeReaction,
        clearReaction,
        triggerReaction,
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
