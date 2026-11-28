"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTimeOfDayGreeting = getTimeOfDayGreeting;
exports.getLocalHourInTimezone = getLocalHourInTimezone;
exports.normalizeGreetingForHour = normalizeGreetingForHour;
/**
 * Timezone-aware greeting helper.
 *
 * - "Good morning": strictly before 12:00 local time
 * - "Good afternoon": 12:00 to 16:59 local time
 * - "Good evening": 17:00 onward local time
 */
function getTimeOfDayGreeting(localHour) {
    const hour = Number.isFinite(localHour) ? ((Math.floor(localHour) % 24) + 24) % 24 : 12;
    if (hour < 12)
        return "Good morning";
    if (hour < 17)
        return "Good afternoon";
    return "Good evening";
}
/**
 * Resolve the current local hour (0–23) in the user's IANA timezone.
 */
function getLocalHourInTimezone(timezone, now = new Date()) {
    try {
        const parts = new Intl.DateTimeFormat("en-GB", {
            timeZone: timezone || "UTC",
            hour: "2-digit",
            hour12: false,
        }).formatToParts(now);
        const hourPart = parts.find((p) => p.type === "hour")?.value ?? "12";
        const parsed = parseInt(hourPart, 10);
        return Number.isFinite(parsed) ? parsed % 24 : 12;
    }
    catch {
        return now.getUTCHours();
    }
}
/**
 * Replace any morning-specific salutation in a message when it is no longer morning
 * in the user's local timezone.
 */
function normalizeGreetingForHour(message, localHour) {
    if (localHour < 12)
        return message;
    const greeting = getTimeOfDayGreeting(localHour);
    return message
        .replace(/\bGOOD MORNINGGG!\b/g, `${greeting}!`)
        .replace(/\bGood morninggg!\b/gi, `${greeting}!`)
        .replace(/\bGood morning\b/gi, greeting);
}
