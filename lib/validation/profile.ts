import { GOAL_OPTIONS, FOCUS_PERIOD_OPTIONS, HELP_OPTIONS } from "@/lib/onboarding/options";
import { isValidTimezone } from "@/lib/time/currentTime";
import { normalizeLivingEnvironmentId } from "@/lib/world/worldThemes";
import type { DailyRhythm, ProfileUpdatePayload } from "@/types/profile";

const GOAL_IDS = new Set<string>(GOAL_OPTIONS.map((g) => g.id));
const FOCUS_IDS = new Set<string>(FOCUS_PERIOD_OPTIONS.map((f) => f.id));
const HELP_IDS = new Set<string>(HELP_OPTIONS.map((h) => h.id));

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  data: ProfileUpdatePayload;
}

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((item) => typeof item === "string");
}

/**
 * The authoritative validator — run on the server for every profile
 * write. A lighter, non-authoritative version of these same rules
 * also runs client-side per onboarding step for immediate feedback,
 * but this is the version that actually gates what reaches MongoDB.
 */
export function validateProfilePayload(body: unknown): ValidationResult {
  const errors: string[] = [];
  const data: ProfileUpdatePayload = {};

  if (typeof body !== "object" || body === null) {
    return { valid: false, errors: ["Invalid request body."], data };
  }
  const b = body as Record<string, unknown>;

  if (b.displayName !== undefined) {
    const v = typeof b.displayName === "string" ? b.displayName.trim() : "";
    if (v.length === 0 || v.length > 60) {
      errors.push("Name must be between 1 and 60 characters.");
    } else {
      data.displayName = v;
    }
  }

  if (b.companionName !== undefined) {
    const v = typeof b.companionName === "string" ? b.companionName.trim() : "";
    if (v.length === 0 || v.length > 40) {
      errors.push("Companion name must be between 1 and 40 characters.");
    } else {
      data.companionName = v;
    }
  }

  if (b.timezone !== undefined) {
    if (typeof b.timezone !== "string" || !isValidTimezone(b.timezone)) {
      errors.push("Invalid timezone.");
    } else {
      data.timezone = b.timezone.trim();
    }
  }

  if (b.goals !== undefined) {
    if (!isStringArray(b.goals) || b.goals.some((g) => !GOAL_IDS.has(g))) {
      errors.push("Goals contain an invalid selection.");
    } else if (b.goals.length > GOAL_OPTIONS.length) {
      errors.push("Too many goals selected.");
    } else {
      data.goals = b.goals;
    }
  }

  if (b.customGoal !== undefined) {
    const v = typeof b.customGoal === "string" ? b.customGoal.trim() : "";
    if (v.length > 140) {
      errors.push("Custom goal must be 140 characters or fewer.");
    } else {
      data.customGoal = v;
    }
  }

  if (b.dailyRhythm !== undefined) {
    if (typeof b.dailyRhythm !== "object" || b.dailyRhythm === null) {
      errors.push("Invalid daily rhythm data.");
    } else {
      const r = b.dailyRhythm as Record<string, unknown>;
      const rhythm: Partial<DailyRhythm> = {};

      if (r.wakeTime !== undefined) {
        if (typeof r.wakeTime !== "string" || r.wakeTime.length > 10) {
          errors.push("Invalid wake time.");
        } else {
          rhythm.wakeTime = r.wakeTime;
        }
      }
      if (r.sleepTime !== undefined) {
        if (typeof r.sleepTime !== "string" || r.sleepTime.length > 10) {
          errors.push("Invalid sleep time.");
        } else {
          rhythm.sleepTime = r.sleepTime;
        }
      }
      if (r.focusPeriods !== undefined) {
        if (!isStringArray(r.focusPeriods) || r.focusPeriods.some((f) => !FOCUS_IDS.has(f))) {
          errors.push("Focus periods contain an invalid selection.");
        } else {
          rhythm.focusPeriods = r.focusPeriods;
        }
      }
      if (r.commitments !== undefined) {
        const v = typeof r.commitments === "string" ? r.commitments.trim() : "";
        if (v.length > 280) {
          errors.push("Commitments must be 280 characters or fewer.");
        } else {
          rhythm.commitments = v;
        }
      }

      data.dailyRhythm = rhythm;
    }
  }

  if (b.helpPreferences !== undefined) {
    if (!isStringArray(b.helpPreferences) || b.helpPreferences.some((h) => !HELP_IDS.has(h))) {
      errors.push("Help preferences contain an invalid selection.");
    } else if (b.helpPreferences.length > HELP_OPTIONS.length) {
      errors.push("Too many help preferences selected.");
    } else {
      data.helpPreferences = b.helpPreferences;
    }
  }

  if (b.onboardingCompleted !== undefined) {
    if (typeof b.onboardingCompleted !== "boolean") {
      errors.push("Invalid onboarding status.");
    } else {
      data.onboardingCompleted = b.onboardingCompleted;
    }
  }

  if (b.introCompleted !== undefined) {
    if (typeof b.introCompleted !== "boolean") {
      errors.push("Invalid intro completed status.");
    } else {
      data.introCompleted = b.introCompleted;
    }
  }

  if (b.theme !== undefined) {
    if (b.theme !== "dark" && b.theme !== "light") {
      errors.push("Theme must be 'dark' or 'light'.");
    } else {
      data.theme = b.theme;
    }
  }

  if (b.livingEnvironment !== undefined) {
    const validEnvs = new Set([
      "cosmic-dream",
      "enchanted-garden",
      "abyssal-dreams",
      "midnight-academia",
      "moonlit-sakura",
      "aurora-sanctuary",
      "autumn-reverie",
      "cloud-kingdom",
      "space",
      "garden",
      "ocean",
    ]);
    if (typeof b.livingEnvironment !== "string" || !validEnvs.has(b.livingEnvironment)) {
      errors.push("Invalid living environment selection.");
    } else {
      data.livingEnvironment = normalizeLivingEnvironmentId(b.livingEnvironment);
    }
  }

  return { valid: errors.length === 0, errors, data };
}
