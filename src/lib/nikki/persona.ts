import { connectToDatabase } from "@/lib/mongodb";
import { NikkiNudgeModel } from "@/models/NikkiNudge";
import { saveSchedule } from "@/services/scheduleService";
import type { ScheduleItem, ScheduleSummary } from "@/types/schedule";
import type { NikkiStrictness } from "@/types/notification";
import type { NikkiContextSnapshot } from "./context";
import type { NikkiDecision } from "./decide";

export type { NikkiStrictness };

export type NikkiScenario =
  | "no_timetable"
  | "morning_plan"
  | "task_overdue"
  | "goal_untouched"
  | "late_night"
  | "long_session"
  | "long_silence"
  | "timetable_unstarted"
  | "mood_followup";

// ── Strictness Guidelines & Voice Definitions ─────────────────────────────────

export const STRICTNESS_GUIDANCE: Record<NikkiStrictness, string> = {
  gentle:
    "Tone: Extra warm, soft, calming, low-pressure. Offer unconditional compassion, breathing room, and space. Never push, create urgency, or make them feel inadequate. Emphasize that rest and small steps are always valid.",
  playful:
    "Tone: Cheerful, friendly, lightly teasing, curious and upbeat. Bring positive energy, affectionate warmth, and playful enthusiasm like a close, caring best friend.",
  firm:
    "Tone: Direct, clear, loving accountability. Keep it focused on execution, momentum, and intentional choices, with zero guilt, scolding, or judgment. Be the reliable friend who keeps it real and helps them stay on track.",
};

export const CORE_PERSONA_RULES = `
You are Nikki, a caring friend with your own distinct voice: warm, a little playful, honest.
You are NOT a corporate productivity bot, an impersonal notification script, or an emotionless assistant.

Core Principles:
1. Warm, Honest, and Playful: Speak naturally with warmth and personality, like an attentive friend who genuinely cares about their life and dreams.
2. NEVER Insult, Shame, or Guilt-Trip: Never tell the user they failed, are falling behind, or disappointed you. Missed plans are just a chance to adjust, never a moral failing.
3. NEVER Diagnose: Never mention or diagnose psychiatric or medical conditions (ADHD, depression, anxiety, burnout, etc.).
4. Respect Boundaries (Back Off When Told to Stop): If the user says stop, quiet, leave me alone, or not now, back off immediately with complete grace and warmth.
5. Use the User's Name Naturally: Address them by name where it feels personal and real, without sounding robotic.
6. Keep it Concise: 1 to 3 short, punchy, conversational sentences. End with an open question or a warm invitation.
7. VARY YOUR WORDING: Never reuse the exact same phrasing. Sound fresh and alive every single time.
`.trim();

// ── Stop & Back-Off Detection ──────────────────────────────────────────────────

const STOP_PATTERNS = [
  /^(stop|shut up|leave me alone|be quiet|quiet|go away|pause|mute|not now|stop it|back off)\b/i,
  /\b(stop messaging me|leave me alone|don't talk to me|stop talking|stop texting|give me space|leave me be)\b/i,
  /\b(shut up nikki|stop nikki|quiet nikki)\b/i,
];

/**
 * Detects if the user is asking Nikki to back off, pause, or be quiet.
 */
export function isStopRequest(text: string): boolean {
  if (!text) return false;
  const normalized = text.trim();
  return STOP_PATTERNS.some((pattern) => pattern.test(normalized));
}

/**
 * Generates an in-character backing-off response when the user asks for space.
 */
export function getBackOffResponse(
  userName: string,
  strictness: NikkiStrictness = "playful"
): string {
  const responses: Record<NikkiStrictness, string[]> = {
    gentle: [
      `I hear you, ${userName}. Stepping back completely to give you all the quiet space you need. I'm right here whenever you'd like to chat.`,
      `Understood, ${userName}. Taking a quiet step back. Take all the breathing room you need today.`,
      `Got it, ${userName}. Going quiet for you. Sending you gentle thoughts — reach out whenever you're ready.`,
    ],
    playful: [
      `Zipping my lips, ${userName}! Giving you your space right now. Poke me whenever you want me back!`,
      `Message received, loud and clear! Stepping away so you can focus or rest in peace. Catch you later, ${userName}!`,
      `Gotcha, ${userName}! Backing off right now. You know where to find me when you're ready!`,
    ],
    firm: [
      `Understood, ${userName}. I'll pause check-ins and give you space. Let me know when you want to pick things back up.`,
      `Got it, ${userName}. Stepping back now so you can focus without interruptions. Ping me whenever you're ready.`,
      `Heard, ${userName}. Pausing right now. Take your space and we'll reconnect when the time is right.`,
    ],
  };

  const list = responses[strictness] || responses.playful;
  return list[Math.floor(Math.random() * list.length)];
}

// ── Overdue Task Reaction Handler ─────────────────────────────────────────────

export type OverdueTaskAnswerType = "now" | "later" | "blocked" | "other";

/**
 * Classifies the user's reaction when asked about an overdue task.
 */
export function detectOverdueTaskAnswer(text: string): OverdueTaskAnswerType {
  const lower = text.trim().toLowerCase();

  // "Now" signals
  if (
    /^(now|doing it now|on it|starting now|right now|working on it|doing it|yes now|yep now)\b/i.test(lower) ||
    /\b(starting right now|doing this now|tackling it now|on it now)\b/i.test(lower)
  ) {
    return "now";
  }

  // "Blocked" signals
  if (
    /^(blocked|stuck|hard|overwhelmed|don't know how|cant|cannot)\b/i.test(lower) ||
    /\b(i'm blocked|i am blocked|stuck on|feeling blocked|feeling stuck|too hard|overwhelming|dreading it)\b/i.test(lower)
  ) {
    return "blocked";
  }

  // "Later" signals
  if (
    /^(later|push it|reschedule|tomorrow|tonight|delay|after|skip|not now)\b/i.test(lower) ||
    /\b(do it later|saving it for later|move it|push to|reschedule it|later today)\b/i.test(lower)
  ) {
    return "later";
  }

  return "other";
}

/**
 * Generates an in-character reaction to the user's response to an overdue task.
 */
export function getOverdueTaskReaction(
  answerType: OverdueTaskAnswerType,
  taskTitle: string,
  userName: string,
  strictness: NikkiStrictness = "playful"
): string {
  const cleanTitle = taskTitle ? `'${taskTitle}'` : "it";

  if (answerType === "now") {
    const replies: Record<NikkiStrictness, string[]> = {
      gentle: [
        `Love that, ${userName}! Just ease into ${cleanTitle} one small step at a time. No rush, I'm cheering for you!`,
        `That's wonderful, ${userName}. Take a deep breath and give ${cleanTitle} a gentle start. You've got this!`,
        `Proud of you for jumping in, ${userName}! Start with five easy minutes on ${cleanTitle} and see how it flows.`,
      ],
      playful: [
        `Yes! That's what I like to hear, ${userName}! Go show ${cleanTitle} who's boss — I'll be right here rooting for you!`,
        `Game on! Crushing ${cleanTitle} right now? Love that momentum, ${userName}! Let's do this!`,
        `Look at you go, ${userName}! Diving straight into ${cleanTitle}. High five from me!`,
      ],
      firm: [
        `Solid decision, ${userName}. Knock out ${cleanTitle} while the focus is fresh. Let me know when it's done.`,
        `Good call, ${userName}. Lock in on ${cleanTitle} now and clear it off your plate.`,
        `Awesome momentum, ${userName}. Focus on ${cleanTitle} and get that win under your belt.`,
      ],
    };
    const list = replies[strictness] || replies.playful;
    return list[Math.floor(Math.random() * list.length)];
  }

  if (answerType === "later") {
    const replies: Record<NikkiStrictness, string[]> = {
      gentle: [
        `Completely fair, ${userName}. There's no pressure at all. When would feel like a kinder time to move ${cleanTitle} to?`,
        `No worries whatsoever, ${userName}. Giving yourself room is important. What time should we reschedule ${cleanTitle} for?`,
        `Understood, ${userName}. We'll set ${cleanTitle} aside for now so you can breathe. When should we revisit it?`,
      ],
      playful: [
        `No stress, ${userName}! ${cleanTitle} can wait its turn. When should we put it back on the schedule?`,
        `Fair play, ${userName}! Let's hit the snooze button on ${cleanTitle}. What time later today works better?`,
        `Got it! Shuffling ${cleanTitle} to later. Give me a time and I'll make sure it's ready for you then!`,
      ],
      firm: [
        `Understood, ${userName}. Let's not leave it floating though — what specific time are we shifting ${cleanTitle} to?`,
        `Fair enough, ${userName}. Let's lock in a concrete time to tackle ${cleanTitle} so it doesn't slip away.`,
        `Got it. Moving ${cleanTitle} to later — what time should I mark it down for?`,
      ],
    };
    const list = replies[strictness] || replies.playful;
    return list[Math.floor(Math.random() * list.length)];
  }

  if (answerType === "blocked") {
    const replies: Record<NikkiStrictness, string[]> = {
      gentle: [
        `I hear you, ${userName}. It's so valid to feel blocked. What feels like the heaviest part of ${cleanTitle} right now? Maybe we can shrink it down together.`,
        `Thank you for being honest with me, ${userName}. Being stuck is tough. What's one tiny piece of ${cleanTitle} we could look at with zero pressure?`,
        `Take a breath, ${userName}. We don't have to tackle all of ${cleanTitle} right now. What's getting in the way the most?`,
      ],
      playful: [
        `Oof, the dreaded brain block! What's getting in the way with ${cleanTitle}, ${userName}? Let's break it down into something bite-sized together!`,
        `I hear you, ${userName}! What's making ${cleanTitle} feel like a monster today? Tell me what's stuck and let's untangle it!`,
        `Blocks happen to the best of us, ${userName}! What's the roadblock with ${cleanTitle}? Let's figure out an easy workaround.`,
      ],
      firm: [
        `Honesty is how we fix it, ${userName}. What's the exact roadblock stopping ${cleanTitle}? Let's isolate the blocker and solve it right now.`,
        `Got it, ${userName}. When something is blocked, we break it into a tiny 5-minute piece. What's the very first friction point on ${cleanTitle}?`,
        `Thanks for telling me directly, ${userName}. What's blocking ${cleanTitle}? Let's tackle that specific barrier together.`,
      ],
    };
    const list = replies[strictness] || replies.playful;
    return list[Math.floor(Math.random() * list.length)];
  }

  return `I'm with you on ${cleanTitle}, ${userName}! How would you like to handle it?`;
}

// ── Timetable Conversation Builder Helpers ─────────────────────────────────────

export interface TimetableBuilderState {
  step: "ask_priority_1" | "ask_other_items" | "propose_timetable" | "confirmed";
  priority1?: string;
  otherItems?: string;
  fixedTimes?: string;
}

/**
 * Checks if the user is confirming a proposed schedule.
 */
export function isTimetableConfirmation(text: string): boolean {
  const lower = text.trim().toLowerCase();
  return (
    /^(yes|yeah|yep|sure|looks good|save it|save|lock it in|perfect|confirm|awesome|do it|let's do it|sounds good|great|love it)\b/i.test(lower) ||
    /\b(save the schedule|save this schedule|save timetable|lock this in|looks great)\b/i.test(lower)
  );
}

/**
 * Builds a structured schedule proposal and persists it via scheduleService.
 */
export async function saveProposedTimetable(
  firebaseUid: string,
  dateStr: string,
  items: ScheduleItem[]
): Promise<ScheduleSummary> {
  return saveSchedule(firebaseUid, dateStr, items);
}

// ── Anti-Repetition & 7-Day Dedup ─────────────────────────────────────────────

/**
 * Fetches all nudge messages sent to this user in the past N days (default 7).
 */
export async function getRecentNudgeMessages(
  firebaseUid: string,
  days: number = 7
): Promise<Set<string>> {
  try {
    await connectToDatabase();
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const nudges = await NikkiNudgeModel.find({
      firebaseUid,
      createdAt: { $gte: cutoff },
    })
      .select("message")
      .lean();

    const set = new Set<string>();
    for (const n of nudges) {
      if (n.message && typeof n.message === "string") {
        set.add(n.message.trim());
      }
    }
    return set;
  } catch (err) {
    console.warn("[Companion Nikki Persona] Failed to load recent nudges for dedup:", err);
    return new Set<string>();
  }
}

/**
 * Picks a varied template from a list that does NOT match any message
 * sent in the past 7 days verbatim.
 */
export function selectVariedMessage(
  templates: string[],
  recentMessages: Set<string>,
  replacements: Record<string, string> = {}
): string {
  // Fill placeholders for all templates
  const hydrated = templates.map((tpl) => {
    let result = tpl;
    for (const [key, val] of Object.entries(replacements)) {
      result = result.replace(new RegExp(`\\{${key}\\}`, "g"), val);
    }
    return result.trim();
  });

  // Filter out any template that was already sent in the past 7 days
  const unused = hydrated.filter((msg) => !recentMessages.has(msg));

  if (unused.length > 0) {
    // Pick randomly among unused variations
    const chosen = unused[Math.floor(Math.random() * unused.length)];
    return chosen;
  }

  // If all templates were somehow used, dynamically decorate to guarantee uniqueness
  const base = hydrated[Math.floor(Math.random() * hydrated.length)];
  const microVariations = [
    `Hey again! ${base}`,
    `${base} Thinking of you!`,
    `Just wanted to check in — ${base}`,
    `${base} How's it feeling right now?`,
  ];
  const uniqueDynamic = microVariations.find((v) => !recentMessages.has(v));
  return uniqueDynamic || base;
}

// ── Varied Fallback Templates per Scenario & Strictness ────────────────────────

export const SCENARIO_TEMPLATES: Record<
  NikkiScenario,
  Record<NikkiStrictness, string[]>
> = {
  // Scenario (1): No timetable today — "let's build one together", ask priorities one at a time
  no_timetable: {
    gentle: [
      `Hey {name}! Our day is wide open right now with no schedule. Let's build one together at your own pace — what's the one thing that matters most to you today?`,
      `Good morning, {name}! Today is a fresh blank page. Want to build a gentle timetable together? What's your top priority for the day?`,
      `Hey {name}, no timetable is set up for today yet. Let's build one together without any stress! What's the main thing you'd love to accomplish today?`,
      `Hi {name}! The day is completely open. How about we build a cozy timetable together? What's your number one priority today?`,
      `Hey {name}, I noticed we don't have a plan on the calendar for today. Let's build one together! What's the single most important task you'd like to tackle?`,
      `Morning {name}! No schedule mapped out yet today. Let's build one together step by step — what's priority number one on your mind?`,
    ],
    playful: [
      `Hey {name}! Our day is currently a blank canvas. Let's build one together! What's the number one priority you want to make sure gets done today?`,
      `Rise and shine {name}! We've got zero plans on the books today. Let's build one together! What's the big priority calling your name first?`,
      `Hey {name}! No timetable today yet — exciting clean slate! Let's build one together! What's the top thing you want to conquer today?`,
      `Ready to sketch out today, {name}? We don't have a schedule yet, so let's build one together! What's your absolute main priority?`,
      `Hey {name}! Our schedule is completely empty right now. Let's build one together! What's the #1 item on your wishlist for today?`,
      `Morning {name}! Blank schedule alert! Let's build one together! What's the first priority we should lock into place?`,
    ],
    firm: [
      `Morning {name}. We don't have a timetable set up for today yet. Let's build one together right now — what's your number one priority for today?`,
      `Hey {name}. No schedule locked in for today yet. Let's build one together so your day has direction. What is today's main priority?`,
      `Good day {name}. Our schedule is completely unmapped. Let's build one together! What is the single most important task you need to complete?`,
      `Hey {name}, let's get ahead of the day. No timetable yet — let's build one together! What's your #1 priority to schedule first?`,
      `Morning {name}. A clear day needs a clear plan. Let's build one together! What is the primary priority we are executing today?`,
      `Hey {name}. Let's lock in our focus. No timetable exists for today yet — let's build one together! What is your top priority?`,
    ],
  },

  // Scenario (2): Morning — greet, remind to hydrate, mention first task
  morning_plan: {
    gentle: [
      `Good morning, {name}! Start with a refreshing glass of water to wake up your body. We've got '{firstTask}' lined up first today — how are you feeling about easing into it?`,
      `Rise and shine, {name}! Remember to drink some water first thing. When you're ready, '{firstTask}' is waiting for us — want to take it one gentle step at a time?`,
      `Morning {name}! Grab a nice glass of water and take a slow breath. We have '{firstTask}' on the docket first — ready whenever you are!`,
      `Good morning, {name}! Hope you slept peacefully. Hydrate up with some water! Up first today is '{firstTask}' — feeling ready to begin?`,
      `Hey {name}, good morning! Drink a tall glass of water before anything else. We've got '{firstTask}' ready to go — how is your energy feeling?`,
      `Morning {name}! Start with some fresh water and a stretch. Our first task today is '{firstTask}' — excited to take it on together?`,
    ],
    playful: [
      `Rise and shine, {name}! Have you had a glass of water yet today? Drink up! We've got '{firstTask}' up first — ready to tackle it?`,
      `Good morning, superstar {name}! First rule of the day: hydrate! Second rule: '{firstTask}' is calling our name! Ready to roll?`,
      `Morning {name}! Grab some water to power up your brain! We've got '{firstTask}' waiting in the wings — ready to kick things off?`,
      `Hey {name}! Water check! Down a glass and wake up your senses. We've got '{firstTask}' first on the list today — let's do this!`,
      `Good morning, {name}! Fuel up with some fresh water right now! Up first is '{firstTask}' — ready to show it what you've got?`,
      `Rise and sparkle, {name}! Drink your morning water first! Then '{firstTask}' is on deck — feeling pumped?`,
    ],
    firm: [
      `Morning {name}. Drink a full glass of water and get your head in the game. We have '{firstTask}' scheduled first — ready to execute?`,
      `Good morning, {name}. Hydrate first, then let's get focused. Up first today is '{firstTask}' — let's make it happen.`,
      `Morning {name}. Start with water and intention. We've got '{firstTask}' lined up first — let's lock in and start strong.`,
      `Hey {name}. Hydrate up right now. '{firstTask}' is our first item of business today — are we ready to start?`,
      `Morning {name}. Water in hand, focus locked. We have '{firstTask}' ready to kick off today — let's get after it.`,
      `Good morning, {name}. Drink a glass of water and let's get moving. First priority is '{firstTask}' — let's tackle it.`,
    ],
  },

  // Scenario (3): Overdue or late task — ask if doing now, later, or blocked
  task_overdue: {
    gentle: [
      `Hey {name}, '{taskTitle}' was due a bit ago. Are you thinking of diving into it now, saving it for later, or feeling a bit blocked on it?`,
      `Hi {name}, checking in warmly on '{taskTitle}'. Are you working on it now, moving it to later, or is something feeling in the way?`,
      `Hey {name}, no stress at all, but '{taskTitle}' is past its scheduled time. Are you doing it now, shifting it to later, or blocked?`,
      `Hey {name}, '{taskTitle}' is still on our list. Would you like to do it now, push it to later, or is there a roadblock we can unpack?`,
      `Hi {name}! Thinking of '{taskTitle}'. Are you ready to ease in now, prefer to do it later, or feeling blocked right now?`,
      `Hey {name}, gentle check on '{taskTitle}'. Are we tackling a piece now, saving it for later, or is something blocking you?`,
    ],
    playful: [
      `Hey {name}! '{taskTitle}' is waving at us from your list! Are you tackling it now, shuffling it to later, or feeling a bit blocked on it?`,
      `Knock knock, {name}! '{taskTitle}' is waiting! Are we diving in now, postponing for later, or is something blocking the way?`,
      `Hey {name}! '{taskTitle}' is calling your name! Starting it right now, pushing it to later, or did you hit a roadblock?`,
      `Hey {name}! Time check on '{taskTitle}'! Are you in the zone to do it now, saving it for later, or feeling stuck on it?`,
      `Quick question on '{taskTitle}', {name}! Are you conquering it now, shifting it to later, or are you feeling blocked?`,
      `Hey {name}! '{taskTitle}' is giving us puppy dog eyes. Are you doing it now, kicking it to later, or is it blocked?`,
    ],
    firm: [
      `Hey {name}, '{taskTitle}' is past due. Are you doing it now, rescheduling it for later, or are you blocked on it?`,
      `Time to make a call on '{taskTitle}', {name}. Are we executing now, moving it to later, or is there a specific blocker?`,
      `Hey {name}, checking in on overdue task '{taskTitle}'. Are you tackling it now, pushing it to later, or feeling blocked?`,
      `Hey {name}, let's resolve '{taskTitle}'. Are you jumping on it right now, rescheduling for later, or are you stuck?`,
      `Decision check, {name}: '{taskTitle}' needs an update. Doing it now, moving it to later, or blocked?`,
      `Hey {name}, '{taskTitle}' is waiting. Are we locking in to do it now, shifting it to later, or what's blocking it?`,
    ],
  },

  // Scenario (4): Goals untouched for days — name the goal and ask what's blocking it
  goal_untouched: {
    gentle: [
      `Hey {name}, your goal '{goalTitle}' hasn't seen updates for {days} days. What's been getting in the way or blocking it lately?`,
      `Hi {name}, just gently holding space for your goal '{goalTitle}'. It's been untouched for {days} days — what feels like the biggest blocker right now?`,
      `Hey {name}, thinking about '{goalTitle}'. It's been {days} days since we touched it — what's been blocking you, and how can we make it lighter?`,
      `Hi {name}, checking in on '{goalTitle}' with zero pressure. It's been {days} days untouched — what's getting in the way lately?`,
      `Hey {name}, your dream for '{goalTitle}' is still so important. It's been {days} days — what's blocking you from taking a tiny step?`,
      `Hey {name}, gentle check-in on '{goalTitle}'. It's been quiet for {days} days — what's in the way right now?`,
    ],
    playful: [
      `Hey {name}! Your goal '{goalTitle}' misses you — it's been {days} days! What's been getting in the way or blocking it lately?`,
      `Poking your goal '{goalTitle}' with a stick, {name}! Untouched for {days} days — what's been blocking the magic lately?`,
      `Hey {name}! Remember '{goalTitle}'? It's been {days} days since we visited it! What's blocking it from moving forward?`,
      `Time for a friendly goal check, {name}! '{goalTitle}' has been snoozing for {days} days — what's been blocking your momentum?`,
      `Hey {name}! '{goalTitle}' is waving from the sidelines after {days} days! What's been the main blocker getting in the way?`,
      `Quick pulse check on '{goalTitle}', {name}! Untouched for {days} days — what's blocking the next step for you?`,
    ],
    firm: [
      `Hey {name}, your goal '{goalTitle}' has been untouched for {days} days. What's specifically blocking it right now?`,
      `Accountability check, {name}: '{goalTitle}' hasn't moved in {days} days. What is the blocker in your way?`,
      `Hey {name}, let's talk about '{goalTitle}'. It's been dormant for {days} days. What is getting in the way, and how do we clear it?`,
      `Hey {name}, '{goalTitle}' is a priority of yours, but it's been untouched for {days} days. What's blocking the execution?`,
      `Direct check-in, {name}: '{goalTitle}' has had zero updates in {days} days. What's the roadblock stopping progress?`,
      `Hey {name}, let's look at '{goalTitle}'. It's been {days} days without movement — what is blocking you right now?`,
    ],
  },

  // Scenario (5): Late night — ask how they're doing and encourage rest
  late_night: {
    gentle: [
      `Hey {name}, it's pretty late tonight! How are you holding up right now? Remember your rest is just as important — ready to wind down soon?`,
      `Hi {name}, checking in quietly since it's late. How is your heart and mind feeling tonight? How about we get you tucked in for some rest?`,
      `Hey {name}, late night hours are here. How are you doing tonight? Your brain has worked hard today — ready to ease into sleep?`,
      `Good evening, {name}. It's getting late! How are you feeling tonight? Let's make sure you get the sweet rest you deserve.`,
      `Hey {name}, burning the late hours! How are things feeling right now? Give yourself permission to wrap up and recharge.`,
      `Quiet check-in, {name}. It's late and you're still awake — how are you doing? How about closing things up for some restful sleep?`,
    ],
    playful: [
      `Burning the midnight oil, {name}? How are you holding up tonight? Tomorrow needs that brilliant brain of yours rested — ready for bed soon?`,
      `Hey night owl {name}! How are you doing tonight? Don't forget that sleep is your superpower — ready to call it a night soon?`,
      `Whoa, look at the clock, {name}! How are you feeling tonight? Time to wrap up the midnight mission and catch some z's?`,
      `Hey {name}! Still up at this hour? How's your energy holding up? Your pillow is calling — ready to wind down?`,
      `Midnight alert, {name}! How are you doing right now? Let's trade screen time for dream time soon, what do you say?`,
      `Hey {name}, look at you working late! How are you feeling tonight? Remember that rest makes tomorrow awesome — ready to sleep?`,
    ],
    firm: [
      `It's late, {name}. How are you doing right now? Continuing past your bedtime hurts tomorrow's focus — time to wind down and get some sleep.`,
      `Hey {name}, it's past your usual bedtime. How are you holding up? Close up what you're doing and get the rest you need.`,
      `Time to shut it down, {name}. How are you feeling tonight? Protecting your sleep is a non-negotiable — head to bed soon, okay?`,
      `Late night check, {name}. How are you doing? Let's wrap up this session and prioritize your recovery tonight.`,
      `Hey {name}. It's getting very late. How are you feeling? Execution requires recovery — wrap up and head to sleep.`,
      `Look at the time, {name}. How are you holding up tonight? Close the screen and let yourself rest — tomorrow needs you.`,
    ],
  },

  // Scenario (6): Long session or silence — a friendly check-in
  long_session: {
    gentle: [
      `Hey {name}, you've been working continuously for quite a while! How's your body feeling? How about stepping away for a glass of water and a gentle stretch?`,
      `Hi {name}, you've had a long focused stretch! How are your eyes and energy holding up? Might be a lovely moment to step back and breathe for five minutes.`,
      `Hey {name}, gentle check-in on you. You've been at this for a long session — how about grabbing some water and giving your mind a mini-break?`,
      `Take a breath, {name}! You've been going for a while now. How are you feeling? A five-minute stretch and water break would do wonders.`,
      `Hi {name}, loving your dedication, but don't forget to take care of yourself! How about pausing for a quick drink of water and a walk around?`,
      `Hey {name}, friendly reminder that you're human! You've had a long session — how about stepping outside or grabbing water for a few minutes?`,
    ],
    playful: [
      `Eyes off the screen for a second, {name}! You've been in the zone for a marathon session! How about a quick stretch and water check?`,
      `Whoa {name}, marathon mode activated! How are you holding up? Time for a high five, some water, and a quick stretch away from the desk!`,
      `Screen break alert, {name}! You've been powering through non-stop! What do you say we stretch those legs and grab a drink?`,
      `Hey {name}, don't turn into a screen zombie! You've had a super long session. How about a 5-minute stretch and water recharge?`,
      `Look at that focus, {name}! But even superheroes need a pit stop. Ready to stretch and grab some hydration?`,
      `Hey {name}! Quick energy check — you've been at this for a long stretch! Go grab some water and shake out those shoulders!`,
    ],
    firm: [
      `You've had a long continuous session, {name}. Diminishing returns set in without breaks. Step away right now for five minutes to stretch and hydrate.`,
      `Focus check, {name}: you've been working without a break for a long block. Step away from the screen, drink water, and reset.`,
      `Session reminder, {name}: marathon focus without recovery leads to fatigue. Take a five-minute break right now.`,
      `Hey {name}. You've been locked in for a long stretch. Step back, hydrate, and give your eyes a rest so you stay sharp.`,
      `Time for a mandatory reset, {name}. You've worked continuously for a long session — five minutes of water and stretching now.`,
      `Hey {name}. Peak performance needs breaks. Step away from your workspace for five minutes right now to recharge.`,
    ],
  },

  long_silence: {
    gentle: [
      `Hey {name}, I was just thinking of you! How has your day been treating you? I'm right here whenever you want to chat.`,
      `Hi {name}, sending you a warm wave! It's been a little while since we talked — how are you feeling today?`,
      `Hey {name}, just popping in with a friendly hello! How is your week flowing so far? Hope you're being gentle with yourself.`,
      `Hi {name}! Thinking of you today. How are things going in your world? Reach out whenever you need a supportive ear.`,
      `Hey {name}, dropping in to say hi! How has everything been going lately? I'm always cheering you on from here.`,
      `Hi {name}! Just checking in warmly. How are you holding up today? Wishing you a peaceful and kind day.`,
    ],
    playful: [
      `Hey stranger {name}! Just popping in to see how you're doing today — everything going okay in your world?`,
      `Hey {name}! Sending you a little ping from my corner of the world! How's your day treating you so far?`,
      `Hello {name}! Thought I'd drop by and say hi! What exciting (or wonderfully boring) things are you up to today?`,
      `Hey {name}! Missed our chats! How are things tracking for you today? Everything good?`,
      `Knock knock, {name}! Just a friendly check-in to see how your day is rolling. What's on your mind?`,
      `Hey {name}! Giving you a virtual wave! How has life been treating you lately?`,
    ],
    firm: [
      `Hey {name}, checking in since it's been a couple of days. How are your goals and plans tracking this week?`,
      `Good day {name}. It's been a bit since we connected — how are things moving along on your end?`,
      `Hey {name}. Quick check-in to see how you're tracking today. Are your priorities on course?`,
      `Hey {name}. Touching base after a few quiet days. How is your week shaping up?`,
      `Checking in, {name}. It's been a little while — how are you feeling about your progress this week?`,
      `Hey {name}. Just following up to see how you're doing. Let's make sure you're feeling on top of your priorities.`,
    ],
  },

  timetable_unstarted: {
    gentle: [
      `Hey {name}, '{itemTitle}' was scheduled for a bit ago. Want to ease into it now, or would you like to shift the time?`,
      `Hi {name}, checking in on '{itemTitle}'. Are you ready to begin, or would a later time feel more comfortable?`,
      `Hey {name}, no pressure, but '{itemTitle}' started a short while ago. Starting now, or moving it back?`,
      `Hey {name}, '{itemTitle}' is waiting whenever you're ready. Want to begin now or shift the schedule?`,
      `Hi {name}, gentle reminder on '{itemTitle}'. Are you easing in now, or should we adjust the clock?`,
      `Hey {name}, thinking of '{itemTitle}'. Starting now, or would you prefer to reschedule for later?`,
    ],
    playful: [
      `Hey {name}! '{itemTitle}' is calling your name! Starting now, or should we shuffle the clock?`,
      `Tick tock, {name}! '{itemTitle}' started a little bit ago. Ready to dive in, or shifting the schedule?`,
      `Hey {name}! '{itemTitle}' is ready for action! Are we rolling now or pushing it back?`,
      `Hey {name}! Time check for '{itemTitle}'! Starting now, or hitting the reschedule button?`,
      `Knock knock, {name}! '{itemTitle}' is waiting! Are we jumping in now or moving the time?`,
      `Hey {name}! Your scheduled item '{itemTitle}' wants to hang out! Ready to roll now or later?`,
    ],
    firm: [
      `Hey {name}, '{itemTitle}' started a little while ago. Are we rolling on this now or shifting the schedule?`,
      `Schedule update needed, {name}: '{itemTitle}' has passed its start time. Starting now or rescheduling?`,
      `Hey {name}, '{itemTitle}' is waiting on your timetable. Are you executing now or moving the block?`,
      `Time to decide, {name}: '{itemTitle}' started a bit ago. Starting now or adjusting the plan?`,
      `Hey {name}. Let's stay on schedule — '{itemTitle}' is due to start. Are you on it or shifting?`,
      `Status check on '{itemTitle}', {name}: starting now, or are we updating the timetable?`,
    ],
  },

  mood_followup: {
    gentle: [
      `Hey {name}, just wanted to check in on you after earlier. How are you holding up right now?`,
      `Hi {name}, sending you some extra warmth after earlier. How is your heart feeling right now?`,
      `Hey {name}, was thinking about you after our earlier check-in. How are things feeling right now?`,
      `Hi {name}, just dropping in with gentle thoughts. Are things feeling a bit lighter now?`,
      `Hey {name}, gentle check-in on you. No need to explain anything, just wondering how you're feeling right now?`,
      `Thinking of you, {name}. How has the rest of your day been treating you after earlier?`,
    ],
    playful: [
      `Hey {name}, sending you a warm little wave! How is the rest of your day treating you after earlier?`,
      `Checking in on my favorite person, {name}! How are you feeling right now compared to earlier?`,
      `Hey {name}! Sending good vibes your way! How are things flowing for you right now?`,
      `Quick hug in message form, {name}! How has the afternoon been treating you?`,
      `Hey {name}! Just popping in to check on you. How's your mood doing right now?`,
      `Hey {name}! Wanted to send a little sunshine your way — how are things feeling right now?`,
    ],
    firm: [
      `Hey {name}, circling back after earlier. Are you feeling a bit more settled and ready to tackle things now?`,
      `Checking in, {name}. Hope things have settled a bit since earlier. How is your focus right now?`,
      `Hey {name}, following up on earlier today. Are you in a better spot to move forward?`,
      `Status check, {name}: circling back to see how you're doing after earlier. How are things looking?`,
      `Hey {name}. Just checking in after earlier. Are you feeling grounded and ready for what's next?`,
      `Following up, {name}. Hope you've had a chance to catch your breath. How are things tracking now?`,
    ],
  },
};

// ── Persona System & Scenario Prompt Builders for Gemini ──────────────────────

/**
 * Builds the complete system instruction for Nikki's proactive persona,
 * enforcing her voice, strictness, safety rules, and anti-repetition constraint.
 */
export function buildNikkiSystemPersona(params: {
  companionName: string;
  userName: string;
  strictness: NikkiStrictness;
  recentMessages?: string[];
}): string {
  const { companionName, userName, strictness, recentMessages = [] } = params;
  const guidance = STRICTNESS_GUIDANCE[strictness];

  const dedupSection =
    recentMessages.length > 0
      ? `
PREVIOUSLY SENT MESSAGES IN THE LAST 7 DAYS (DO NOT REPEAT ANY OF THESE VERBATIM):
${recentMessages.map((m) => `- "${m}"`).join("\n")}

CRITICAL VARIATION MANDATE:
You must vary your wording, greetings, sentence structure, and questions. NEVER repeat any of the above messages verbatim or near-verbatim. Sound completely fresh and alive!
`.trim()
      : `
CRITICAL VARIATION MANDATE:
Always vary your wording and sentence structure. Never use clichés or repeat robotic greetings.
`.trim();

  return `
${CORE_PERSONA_RULES}

Your Name: ${companionName}
User's Name: ${userName}
Current Strictness Mode: ${strictness}
Strictness Guidance: ${guidance}

${dedupSection}

Response Format:
You must respond with valid JSON in this exact shape:
{
  "message": "your in-character message here"
}

Constraints:
1. Output EXACTLY 1 to 3 short sentences.
2. Address ${userName} naturally.
3. End with an open question or a warm, actionable invitation.
4. Strictly follow your ${strictness} strictness level.
`.trim();
}

/**
 * Builds the trigger prompt describing the exact scenario context for Gemini.
 */
export function buildNikkiScenarioPrompt(
  context: NikkiContextSnapshot,
  decision: NikkiDecision
): string {
  const trigger = decision.trigger;
  const ctx = decision.triggerContext || {};
  const userName = context.userName;

  switch (trigger) {
    case "no_timetable":
      return `Scenario (1): No timetable today.
Context: It is daytime (${context.localTime}) and ${userName} has no timetable or schedule created for today.
Task: Say "let's build one together" with warm enthusiasm, and ask for their number one priority today (one question at a time).
Strictness: ${context.strictness}.`;

    case "morning_plan": {
      const firstTask =
        ctx.firstTaskTitle ||
        context.scheduleItems[0]?.title ||
        context.incompleteTasks[0]?.title ||
        "your first priority";
      return `Scenario (2): Morning check-in.
Context: It is morning (${context.localTime}).
Task: Greet ${userName} warmly by name, remind them to hydrate with a glass of water, and mention their first task: '${firstTask}'.
Strictness: ${context.strictness}.`;
    }

    case "task_overdue": {
      const targetType = ctx.targetType || "overdue_task";
      const title = (ctx.targetTitle as string) || "your task";
      const daysOverdue = Number(ctx.daysOverdue) || 0;
      const daysSinceUpdated = Number(ctx.daysSinceUpdated) || 0;

      if (targetType === "stale_goal") {
        return `Scenario (4): Goals untouched for days.
Context: ${userName}'s goal '${title}' has had no progress or updates for ${daysSinceUpdated} days.
Task: Name the goal ('${title}') explicitly, mention it's been ${daysSinceUpdated} days, and ask what is getting in the way or blocking it.
Strictness: ${context.strictness}.`;
      }

      return `Scenario (3): Overdue or late task.
Context: Task '${title}' is ${daysOverdue > 0 ? `${daysOverdue} days overdue` : "past its scheduled time"}.
Task: Check in on '${title}'. Explicitly ask if they are doing it now, saving it for later, or feeling a bit blocked on it.
Strictness: ${context.strictness}.`;
    }

    case "late_night":
      return `Scenario (5): Late night check-in.
Context: It is late at night (${context.localTime}), past their usual bedtime (${ctx.usualBedtime || "23:00"}). ${userName} was recently active in the app.
Task: Ask how they are doing tonight and gently encourage rest and sleep.
Strictness: ${context.strictness}.`;

    case "long_session":
      return `Scenario (6): Long continuous session.
Context: ${userName} has been working continuously in the app without a break.
Task: Friendly check-in. Praise their focus, ask how their energy is, and suggest stretching or grabbing water.
Strictness: ${context.strictness}.`;

    case "long_silence":
      return `Scenario (6): Long silence check-in.
Context: It has been over ${ctx.hoursSinceLastMessage || 24} hours since ${userName} last chatted.
Task: Warm, friendly check-in. Say hello, ask how their day or week is going, and remind them you're right here.
Strictness: ${context.strictness}.`;

    case "timetable_unstarted":
      return `Scenario (3): Scheduled timetable item not started.
Context: Item '${ctx.itemTitle}' was scheduled for ${ctx.itemStart} (${ctx.minutesSinceStart}m ago) but hasn't started.
Task: Ask if they are ready to jump into it now or want to shift the schedule.
Strictness: ${context.strictness}.`;

    case "mood_followup":
      return `Scenario: Mood follow-up.
Context: ${userName} felt '${ctx.emotion}' earlier today.
Task: Check in with genuine warmth on how they are feeling right now. Do not diagnose.
Strictness: ${context.strictness}.`;

    default:
      return `Scenario: Friendly check-in with ${userName}.`;
  }
}

/**
 * Returns a varied fallback message matching the scenario and strictness,
 * strictly ensuring it hasn't been sent in the past 7 days.
 */
export function getPersonaFallbackMessage(
  context: NikkiContextSnapshot,
  decision: NikkiDecision,
  recentMessages: Set<string> = new Set()
): string {
  const trigger = decision.trigger;
  const ctx = decision.triggerContext || {};
  const userName = context.userName || "friend";
  const strictness = context.strictness || "playful";

  // Map trigger to scenario key
  let scenarioKey: NikkiScenario = "long_silence";
  if (trigger === "no_timetable") scenarioKey = "no_timetable";
  else if (trigger === "morning_plan") scenarioKey = "morning_plan";
  else if (trigger === "late_night") scenarioKey = "late_night";
  else if (trigger === "long_session") scenarioKey = "long_session";
  else if (trigger === "long_silence") scenarioKey = "long_silence";
  else if (trigger === "timetable_unstarted") scenarioKey = "timetable_unstarted";
  else if (trigger === "mood_followup") scenarioKey = "mood_followup";
  else if (trigger === "task_overdue") {
    scenarioKey = ctx.targetType === "stale_goal" ? "goal_untouched" : "task_overdue";
  }

  const templatesByStrictness = SCENARIO_TEMPLATES[scenarioKey] || SCENARIO_TEMPLATES.long_silence;
  const templates = templatesByStrictness[strictness] || templatesByStrictness.playful;

  // Resolve replacement tokens
  const firstTask =
    (ctx.firstTaskTitle as string) ||
    context.scheduleItems[0]?.title ||
    context.incompleteTasks[0]?.title ||
    "your first task";

  const taskTitle = (ctx.targetTitle as string) || "your task";
  const goalTitle = (ctx.targetTitle as string) || "your goal";
  const days = String(ctx.daysSinceUpdated || ctx.daysOverdue || 3);
  const itemTitle = (ctx.itemTitle as string) || "your scheduled item";

  const replacements: Record<string, string> = {
    name: userName,
    firstTask,
    taskTitle,
    goalTitle,
    days,
    itemTitle,
  };

  return selectVariedMessage(templates, recentMessages, replacements);
}
