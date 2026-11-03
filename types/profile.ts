export interface DailyRhythm {
  wakeTime: string | null;
  sleepTime: string | null;
  focusPeriods: string[];
  commitments: string | null;
}

export type AppTheme = "dark" | "light";
export type LivingEnvironmentId =
  | "cosmic-dream"
  | "enchanted-garden"
  | "abyssal-dreams"
  | "midnight-academia"
  | "moonlit-sakura"
  | "aurora-sanctuary"
  | "autumn-reverie"
  | "cloud-kingdom"
  | "space"
  | "garden"
  | "ocean";

/** The shape returned by GET/PATCH /api/user/profile — always derived server-side from the verified Firebase UID, never trusted from the client. */
export interface UserProfile {
  firebaseUid: string;
  email: string | null;
  displayName: string | null;
  companionName: string | null;
  timezone: string | null;
  onboardingCompleted: boolean;
  introCompleted: boolean;
  theme: AppTheme;
  livingEnvironment: LivingEnvironmentId;
  goals: string[];
  customGoal: string | null;
  dailyRhythm: DailyRhythm;
  helpPreferences: string[];
  createdAt: string;
  updatedAt: string;
}

/** Partial update payload — only the fields being changed need to be present. */
export interface ProfileUpdatePayload {
  displayName?: string;
  companionName?: string;
  timezone?: string;
  goals?: string[];
  customGoal?: string;
  dailyRhythm?: Partial<DailyRhythm>;
  helpPreferences?: string[];
  onboardingCompleted?: boolean;
  introCompleted?: boolean;
  theme?: AppTheme;
  livingEnvironment?: LivingEnvironmentId;
}
