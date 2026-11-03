/**
 * Server-authoritative current time and timezone resolution.
 * Nikki and the scheduling engine must never guess the time from LLM weights
 * or assume UTC when the user lives in a specific local timezone.
 */

export interface CurrentTimeInfo {
  dateStr: string; // YYYY-MM-DD in local timezone
  timeStr: string; // HH:mm (24-hour) in local timezone
  timeStr12: string; // e.g. "5:00 PM"
  dayOfWeek: string; // e.g. "Saturday"
  formatted: string; // e.g. "Saturday, October 24, 2026, 17:00 (5:00 PM)"
  timezone: string;
  now: Date;
}

const DEFAULT_TIMEZONE = "UTC";

export function isValidTimezone(tz: unknown): tz is string {
  if (typeof tz !== "string" || tz.trim().length === 0) return false;
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz.trim() });
    return true;
  } catch {
    return false;
  }
}

/**
 * Resolves the user's timezone:
 * 1. Client-supplied timezone if valid (e.g. from Intl.DateTimeFormat in browser)
 * 2. User profile stored timezone if valid
 * 3. System host timezone if valid
 * 4. Fallback to "UTC"
 */
export function resolveUserTimezone(clientTimezone?: string | null, profileTimezone?: string | null): string {
  if (clientTimezone && isValidTimezone(clientTimezone)) {
    return clientTimezone.trim();
  }
  if (profileTimezone && isValidTimezone(profileTimezone)) {
    return profileTimezone.trim();
  }
  try {
    const hostTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (isValidTimezone(hostTz)) return hostTz;
  } catch {
    // Ignore host detection failure
  }
  return DEFAULT_TIMEZONE;
}

/**
 * Formats a given Date in a specific timezone into YYYY-MM-DD.
 */
export function formatDateInTimezone(date: Date, timezone: string): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(date); // produces "YYYY-MM-DD"
}

/**
 * Formats a given Date in a specific timezone into HH:mm (24-hour).
 */
export function formatTimeInTimezone(date: Date, timezone: string): string {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return formatter.format(date);
}

/**
 * Returns complete authoritative time information for the runtime clock right now.
 */
export function getCurrentTimeInfo(timezone: string = DEFAULT_TIMEZONE): CurrentTimeInfo {
  const validTz = isValidTimezone(timezone) ? timezone : DEFAULT_TIMEZONE;
  const now = new Date();

  const dateStr = formatDateInTimezone(now, validTz);
  const timeStr = formatTimeInTimezone(now, validTz);

  const dayOfWeek = new Intl.DateTimeFormat("en-US", {
    timeZone: validTz,
    weekday: "long",
  }).format(now);

  const timeStr12 = new Intl.DateTimeFormat("en-US", {
    timeZone: validTz,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(now);

  const fullDateFormatted = new Intl.DateTimeFormat("en-US", {
    timeZone: validTz,
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(now);

  const formatted = `${fullDateFormatted}, ${timeStr} (${timeStr12}) [${validTz}]`;

  return {
    dateStr,
    timeStr,
    timeStr12,
    dayOfWeek,
    formatted,
    timezone: validTz,
    now,
  };
}

/**
 * Returns today's YYYY-MM-DD string in the target timezone.
 */
export function getTodayDateStr(timezone: string): string {
  return formatDateInTimezone(new Date(), timezone);
}

/**
 * Returns tomorrow's YYYY-MM-DD string in the target timezone.
 */
export function getTomorrowDateStr(timezone: string): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return formatDateInTimezone(d, timezone);
}

/**
 * Checks whether a YYYY-MM-DD date string is "today" in the target timezone.
 */
export function isDateToday(dateStr: string, timezone: string): boolean {
  return dateStr === getTodayDateStr(timezone);
}

/**
 * Converts "HH:MM" to total minutes from midnight.
 */
export function timeStringToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/**
 * Converts total minutes from midnight back to "HH:MM".
 */
export function minutesToTimeString(totalMinutes: number): string {
  const normalized = Math.max(0, Math.min(23 * 60 + 59, totalMinutes));
  const h = Math.floor(normalized / 60);
  const m = normalized % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
