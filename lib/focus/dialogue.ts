/**
 * Nikki's Focus Mode presence, per 11_DIALOGUE_GUIDE.md's tone —
 * short, warm, never a motivational speech. Deliberately a small
 * static pool, not a Gemini call: Focus Mode must work with zero AI
 * dependency (spec section 21), and repeatedly calling an LLM for a
 * "let's focus" line would be the opposite of "minimal interaction."
 */

const BEFORE_LINES = [
  "Alright. Let's give this one our attention.",
  "Okay — let's focus on this together.",
  "Ready when you are.",
];

const COMPLETED_LINES = (durationLabel: string, taskTitle: string) => [
  `${durationLabel} on "${taskTitle}". Nice work.`,
  `That's ${durationLabel} of real focus on "${taskTitle}".`,
  `${durationLabel} down. I was right here with you.`,
];

const CANCELLED_LINES = [
  "That's okay — every bit of focused time still counts.",
  "No worries. We can pick this back up whenever you're ready.",
  "Stopping when you need to is fine too.",
];

function pickRandom<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

export function pickBeforeFocusLine(): string {
  return pickRandom(BEFORE_LINES);
}

export function pickCompletedLine(durationLabel: string, taskTitle: string): string {
  return pickRandom(COMPLETED_LINES(durationLabel, taskTitle));
}

export function pickCancelledLine(): string {
  return pickRandom(CANCELLED_LINES);
}