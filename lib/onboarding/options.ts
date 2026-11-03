export const GOAL_OPTIONS = [
  { id: "study", label: "Study" },
  { id: "career", label: "Career" },
  { id: "health", label: "Health" },
  { id: "fitness", label: "Fitness" },
  { id: "creativity", label: "Creativity" },
  { id: "relationships", label: "Relationships" },
  { id: "personal-growth", label: "Personal growth" },
  { id: "something-else", label: "Something else" },
] as const;

export const FOCUS_PERIOD_OPTIONS = [
  { id: "early-morning", label: "Early morning" },
  { id: "morning", label: "Morning" },
  { id: "afternoon", label: "Afternoon" },
  { id: "evening", label: "Evening" },
  { id: "late-night", label: "Late night" },
] as const;

export const HELP_OPTIONS = [
  { id: "stay-organized", label: "Keep me organized" },
  { id: "help-focus", label: "Help me focus" },
  { id: "build-routines", label: "Help me build routines" },
  { id: "understand-mood", label: "Help me understand my mood" },
  { id: "gentle-accountability", label: "Keep me accountable, gently" },
  { id: "make-time-for-goals", label: "Help me make time for my goals" },
  { id: "just-be-there", label: "Just be there when I need it" },
] as const;