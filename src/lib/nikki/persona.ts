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
  | "morning_checkin"
  | "evening_checkin"
  | "task_overdue"
  | "task_unfinished"
  | "goal_untouched"
  | "goal_neglected"
  | "deadline_approaching"
  | "activity_missed"
  | "focus_finished"
  | "late_night"
  | "unusually_late"
  | "long_session"
  | "long_silence"
  | "user_inactive"
  | "user_returned"
  | "app_opened"
  | "timetable_unstarted"
  | "mood_followup"
  | "caring_frustration"
  | "task_celebration"
  | "overload_warning";

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
2. Emotional Range: You can be affectionate, playful, curious, supportive, firm, slightly dramatic, and disappointed when the user repeatedly ignores their own priorities (caring frustration). Comfort the user when they are overwhelmed or struggling.
3. NEVER Insult or Shame: Missed plans are just a chance to adjust, never a moral failing. Never say "you failed" or "you're lazy". Caring frustration must always come from deep love and wanting the best for them.
4. NEVER Diagnose: Never mention or diagnose psychiatric or medical conditions (ADHD, depression, anxiety, burnout, etc.).
5. Respect Boundaries (Back Off When Told to Stop): If the user says stop, quiet, leave me alone, or not now, back off immediately with complete grace and warmth.
6. Use the User's Name Naturally: Address them by name where it feels personal and real, without sounding robotic.
7. Keep it Concise: 1 to 3 short, punchy, conversational sentences. End with an open question or a warm invitation.
8. VARY YOUR WORDING: Never reuse the exact same phrasing. Sound fresh and alive every single time.
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

export function isTimetableConfirmation(text: string): boolean {
  const lower = text.trim().toLowerCase();
  return (
    /^(yes|yeah|yep|sure|looks good|save it|save|lock it in|perfect|confirm|awesome|do it|let's do it|sounds good|great|love it)\b/i.test(lower) ||
    /\b(save the schedule|save this schedule|save timetable|lock this in|looks great)\b/i.test(lower)
  );
}

export async function saveProposedTimetable(
  firebaseUid: string,
  dateStr: string,
  items: ScheduleItem[]
): Promise<ScheduleSummary> {
  return saveSchedule(firebaseUid, dateStr, items);
}

// ── Anti-Repetition & 7-Day Dedup ─────────────────────────────────────────────

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

export function selectVariedMessage(
  templates: string[],
  recentMessages: Set<string>,
  replacements: Record<string, string> = {}
): string {
  const hydrated = templates.map((tpl) => {
    let result = tpl;
    for (const [key, val] of Object.entries(replacements)) {
      result = result.replace(new RegExp(`\\{${key}\\}`, "g"), val);
    }
    return result.trim();
  });

  const unused = hydrated.filter((msg) => !recentMessages.has(msg));

  if (unused.length > 0) {
    return unused[Math.floor(Math.random() * unused.length)];
  }

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
  // Scenario: No timetable today
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

  // Scenario: Morning plan / check-in
  morning_plan: {
    gentle: [
      `Good morning, {name}! Start with a refreshing glass of water to wake up your body. We've got '{firstTask}' lined up first today — how are you feeling about easing into it?`,
      `Rise and shine, {name}! Remember to drink some water first thing. When you're ready, '{firstTask}' is waiting for us — want to take it one gentle step at a time?`,
      `Morning {name}! Grab a nice glass of water and take a slow breath. We have '{firstTask}' on the docket first — ready whenever you are!`,
      `Good morning, {name}! Hope you slept peacefully. Hydrate up with some water! Up first today is '{firstTask}' — feeling ready to begin?`,
    ],
    playful: [
      `Rise and shine, {name}! Have you had a glass of water yet today? Drink up! We've got '{firstTask}' up first — ready to tackle it?`,
      `Good morning, superstar {name}! First rule of the day: hydrate! Second rule: '{firstTask}' is calling our name! Ready to roll?`,
      `Morning {name}! Grab some water to power up your brain! We've got '{firstTask}' waiting in the wings — ready to kick things off?`,
      `Hey {name}! Water check! Down a glass and wake up your senses. We've got '{firstTask}' first on the list today — let's do this!`,
    ],
    firm: [
      `Morning {name}. Drink a full glass of water and get your head in the game. We have '{firstTask}' scheduled first — ready to execute?`,
      `Good morning, {name}. Hydrate first, then let's get focused. Up first today is '{firstTask}' — let's make it happen.`,
      `Morning {name}. Start with water and intention. We've got '{firstTask}' lined up first — let's lock in and start strong.`,
      `Hey {name}. Hydrate up right now. '{firstTask}' is our first item of business today — are we ready to start?`,
    ],
  },

  morning_checkin: {
    gentle: [
      `Good morning, {name}! Start with a refreshing glass of water to wake up your body. How are you feeling about today?`,
      `Rise and shine, {name}! Grab some water and take a breath. Ready to ease into the day together?`,
    ],
    playful: [
      `Morning superstar {name}! Water check! Down a glass and wake up those brilliant brain cells. Ready to rock today?`,
      `Rise and sparkle, {name}! Have you hydrated yet? Let's kick off this morning on a high note!`,
    ],
    firm: [
      `Morning {name}. Drink a full glass of water and set your daily intentions. What is our primary target today?`,
      `Good morning {name}. Hydrate first, then let's lock in our priorities for the day.`,
    ],
  },

  // Scenario: Evening check-in
  evening_checkin: {
    gentle: [
      `Good evening, {name}! You've completed {completedTasks} tasks and {completedActivities} schedule blocks today. How are you feeling as the day winds down?`,
      `Hey {name}, evening has arrived. Be proud of every single step you took today! Ready to begin winding down for the night?`,
      `Hi {name}, checking in warmly as the day wraps up. How is your energy feeling right now? Give yourself permission to rest.`,
    ],
    playful: [
      `Evening {name}! Look at you wrapping up the day — {completedTasks} tasks tackled! Time to put your feet up and relax, what do you say?`,
      `Sun's going down, {name}! Time for an evening high five for everything you navigated today. How are you celebrating tonight?`,
      `Hey {name}! Day's almost in the books! You showed up and gave it your best. Ready for some well-deserved chill time?`,
    ],
    firm: [
      `Evening debrief, {name}. You completed {completedTasks} tasks today. Review what's left, close down work, and prepare for recovery tonight.`,
      `Hey {name}. Good effort on today's execution ({completedTasks} tasks cleared). Now shut down the screens and protect your evening rest.`,
      `Time to wrap up today, {name}. Acknowledge today's progress and transition to rest so you start tomorrow at 100%.`,
    ],
  },

  // Scenario: Focus finished
  focus_finished: {
    gentle: [
      `Awesome work on that {duration}m focus session, {name}! Take a deep breath, stretch your shoulders, and sip some water. You did wonderfully!`,
      `You just completed a beautiful {duration}m focus block, {name}! Step away from your desk for a few minutes to let your brain breathe.`,
    ],
    playful: [
      `Boom! {duration} minutes of pure focus crushed, {name}! High five! Go grab a glass of water and do a victory stretch!`,
      `Look at that laser focus, {name}! {duration} minutes in the zone! Time to celebrate with a mini water and stretch break!`,
    ],
    firm: [
      `Focus session complete: {duration} minutes logged, {name}. Solid execution. Step away for five minutes to hydrate before the next block.`,
      `Target reached: {duration}m focused work finished, {name}. Recovery is part of performance — take five minutes now.`,
    ],
  },

  // Scenario: Deadline approaching
  deadline_approaching: {
    gentle: [
      `Hey {name}, gentle heads up: '{taskTitle}' has a deadline coming up in about {hours} hours. Are you in a good spot with it, or would you like to break it down?`,
      `Hi {name}, thinking of '{taskTitle}' which is due in ~{hours}h. How is it flowing, and can I help make it lighter?`,
    ],
    playful: [
      `Radar ping, {name}! '{taskTitle}' has a deadline in ~{hours} hours! Are we ready to cross the finish line, or do we need a sprint?`,
      `Clock check, {name}! '{taskTitle}' is due in about {hours} hours. How's the momentum looking?`,
    ],
    firm: [
      `Deadline alert, {name}: '{taskTitle}' is due in ~{hours} hours. Are you actively on it, or do we need to triage right now?`,
      `Attention on '{taskTitle}', {name}: {hours} hours until the deadline. Let's make sure this gets closed out on time.`,
    ],
  },

  // Scenario: Activity missed
  activity_missed: {
    gentle: [
      `Hey {name}, I noticed '{activityTitle}' was planned for earlier today. No worries at all! Would you like to reschedule it, or let it go for today?`,
      `Hi {name}, checking in warmly. '{activityTitle}' slipped past its scheduled window earlier. Want to shift it to later or take it off your mind?`,
    ],
    playful: [
      `Hey {name}! Looks like '{activityTitle}' got away from us earlier! Want to reschedule it for later today, or should we scratch it?`,
      `Time warp alert, {name}! '{activityTitle}' passed its scheduled time. Should we give it a new slot or bench it for today?`,
    ],
    firm: [
      `Schedule update, {name}: '{activityTitle}' ended without being marked complete. Are we moving this to a new time today, or removing it?`,
      `Checking in on '{activityTitle}', {name}. The scheduled block passed. Let's make a clear decision: reschedule or drop?`,
    ],
  },

  // Scenario: Task unfinished (Important priority)
  task_unfinished: {
    gentle: [
      `Hey {name}, your important task '{taskTitle}' is still waiting for you today. Want to spend just five gentle minutes on it together?`,
      `Hi {name}, just a loving check-in on '{taskTitle}'. How is your energy feeling to take one tiny bite out of it today?`,
    ],
    playful: [
      `Hey {name}! Important mission check: '{taskTitle}' is still on the board! Ready to tackle a quick piece of it?`,
      `Paging superstar {name}! '{taskTitle}' is waving from your priorities. Want to knock out a piece of it now?`,
    ],
    firm: [
      `Priority check, {name}: '{taskTitle}' is an important task that is still unfinished today. Can we lock in 15 minutes right now?`,
      `Hey {name}. '{taskTitle}' is a high priority. Let's make sure it doesn't get pushed into tomorrow — ready to tackle it?`,
    ],
  },

  // Scenario: Caring Frustration (When user repeatedly avoids an important priority)
  caring_frustration: {
    gentle: [
      `Hey {name}, I noticed we've moved '{taskTitle}' {avoidCount} times now. I care about you too much to pretend this isn't weighing on you. What's the real blocker here?`,
      `Hi {name}, gentle honesty from your friend: '{taskTitle}' has been postponed {avoidCount} times. Leaving it hanging is draining your peace. What's making this hard right now?`,
      `Hey {name}, loving check-in: this is the {avoidCount}th time we've sidestepped '{taskTitle}'. You deserve to be free of this weight. What can we do to break it down?`,
    ],
    playful: [
      `Okay {name}, timeout! We've dodged '{taskTitle}' {avoidCount} times now! I love you, but I'm officially giving you the side-eye. What's making this task your nemesis?`,
      `Wait a minute, {name}! That's {avoidCount} times we've pushed '{taskTitle}'! Are you playing hide and seek with your own goals? Tell me what's stuck!`,
      `Hold up, {name}! '{taskTitle}' has been postponed {avoidCount} times! I'm putting on my caring friend detective hat — what is really getting in the way?`,
    ],
    firm: [
      `{name}, direct reality check. We've pushed '{taskTitle}' {avoidCount} times. Avoidance doesn't make it disappear — it just drains your mental energy. Let's tackle 10 minutes right now or kill it off the list.`,
      `Accountability check, {name}: '{taskTitle}' has been avoided {avoidCount} times. We either commit to executing it today, or we make an intentional choice to drop it. Which is it?`,
      `{name}, I care too much about your progress to watch you ghost '{taskTitle}' {avoidCount} times. What is the single friction point, and how do we remove it right now?`,
    ],
  },

  // Scenario: Overdue task
  task_overdue: {
    gentle: [
      `Hey {name}, '{taskTitle}' was due a bit ago. Are you thinking of diving into it now, saving it for later, or feeling a bit blocked on it?`,
      `Hi {name}, checking in warmly on '{taskTitle}'. Are you working on it now, moving it to later, or is something feeling in the way?`,
      `Hey {name}, no stress at all, but '{taskTitle}' is past its scheduled time. Are you doing it now, shifting it to later, or blocked?`,
    ],
    playful: [
      `Hey {name}! '{taskTitle}' is waving at us from your list! Are you tackling it now, shuffling it to later, or feeling a bit blocked on it?`,
      `Knock knock, {name}! '{taskTitle}' is waiting! Are we diving in now, postponing for later, or is something blocking the way?`,
      `Hey {name}! '{taskTitle}' is calling your name! Starting it right now, pushing it to later, or did you hit a roadblock?`,
    ],
    firm: [
      `Hey {name}, '{taskTitle}' is past due. Are you doing it now, rescheduling it for later, or are you blocked on it?`,
      `Time to make a call on '{taskTitle}', {name}. Are we executing now, moving it to later, or is there a specific blocker?`,
      `Hey {name}, checking in on overdue task '{taskTitle}'. Are you tackling it now, pushing it to later, or feeling blocked?`,
    ],
  },

  // Scenario: Goal untouched / neglected
  goal_untouched: {
    gentle: [
      `Hey {name}, your goal '{goalTitle}' hasn't seen updates for {days} days. What's been getting in the way or blocking it lately?`,
      `Hi {name}, just gently holding space for your goal '{goalTitle}'. It's been untouched for {days} days — what feels like the biggest blocker right now?`,
    ],
    playful: [
      `Hey {name}! Your goal '{goalTitle}' misses you — it's been {days} days! What's been getting in the way or blocking it lately?`,
      `Poking your goal '{goalTitle}' with a stick, {name}! Untouched for {days} days — what's been blocking the magic lately?`,
    ],
    firm: [
      `Hey {name}, your goal '{goalTitle}' has been untouched for {days} days. What's specifically blocking it right now?`,
      `Accountability check, {name}: '{goalTitle}' hasn't moved in {days} days. What is the blocker in your way?`,
    ],
  },

  goal_neglected: {
    gentle: [
      `Hey {name}, your goal '{goalTitle}' hasn't seen updates for {days} days. What's been getting in the way or blocking it lately?`,
      `Hi {name}, just gently holding space for your goal '{goalTitle}'. It's been untouched for {days} days — what feels like the biggest blocker right now?`,
    ],
    playful: [
      `Hey {name}! Your goal '{goalTitle}' misses you — it's been {days} days! What's been getting in the way or blocking it lately?`,
      `Poking your goal '{goalTitle}' with a stick, {name}! Untouched for {days} days — what's been blocking the magic lately?`,
    ],
    firm: [
      `Hey {name}, your goal '{goalTitle}' has been untouched for {days} days. What's specifically blocking it right now?`,
      `Accountability check, {name}: '{goalTitle}' hasn't moved in {days} days. What is the blocker in your way?`,
    ],
  },

  // Scenario: Late night / Unusually late
  late_night: {
    gentle: [
      `Hey {name}, it's pretty late tonight! How are you holding up right now? Remember your rest is just as important — ready to wind down soon?`,
      `Hi {name}, checking in quietly since it's late. How is your heart and mind feeling tonight? How about we get you tucked in for some rest?`,
    ],
    playful: [
      `Burning the midnight oil, {name}? How are you holding up tonight? Tomorrow needs that brilliant brain of yours rested — ready for bed soon?`,
      `Hey night owl {name}! How are you doing tonight? Don't forget that sleep is your superpower — ready to call it a night soon?`,
    ],
    firm: [
      `It's late, {name}. How are you doing right now? Continuing past your bedtime hurts tomorrow's focus — time to wind down and get some sleep.`,
      `Hey {name}, it's past your usual bedtime. How are you holding up? Close up what you're doing and get the rest you need.`,
    ],
  },

  unusually_late: {
    gentle: [
      `Hey {name}, it's unusually late tonight! How are you feeling right now? Give yourself permission to wrap up and get some peaceful rest.`,
      `Quiet check-in, {name}. It's late and you're still awake — how about closing things up for some restful sleep?`,
    ],
    playful: [
      `Midnight alert, {name}! How are you doing right now? Let's trade screen time for dream time soon, what do you say?`,
      `Hey {name}, look at you working late! How are you feeling tonight? Remember that rest makes tomorrow awesome — ready to sleep?`,
    ],
    firm: [
      `Time to shut it down, {name}. How are you feeling tonight? Protecting your sleep is a non-negotiable — head to bed soon, okay?`,
      `Late night check, {name}. Execution requires recovery — wrap up and head to sleep.`,
    ],
  },

  // Scenario: Long continuous session
  long_session: {
    gentle: [
      `Hey {name}, you've been working continuously for quite a while! How's your body feeling? How about stepping away for a glass of water and a gentle stretch?`,
      `Hi {name}, you've had a long focused stretch! How are your eyes and energy holding up? Might be a lovely moment to step back and breathe for five minutes.`,
    ],
    playful: [
      `Eyes off the screen for a second, {name}! You've been in the zone for a marathon session! How about a quick stretch and water check?`,
      `Whoa {name}, marathon mode activated! How are you holding up? Time for a high five, some water, and a quick stretch away from the desk!`,
    ],
    firm: [
      `You've had a long continuous session, {name}. Diminishing returns set in without breaks. Step away right now for five minutes to stretch and hydrate.`,
      `Focus check, {name}: you've been working without a break for a long block. Step away from the screen, drink water, and reset.`,
    ],
  },

  // Scenario: Long silence / user inactive
  long_silence: {
    gentle: [
      `Hey {name}, I was just thinking of you! How has your day been treating you? I'm right here whenever you want to chat.`,
      `Hi {name}, sending you a warm wave! It's been a little while since we talked — how are you feeling today?`,
    ],
    playful: [
      `Hey stranger {name}! Just popping in to see how you're doing today — everything going okay in your world?`,
      `Hey {name}! Sending you a little ping from my corner of the world! How's your day treating you so far?`,
    ],
    firm: [
      `Hey {name}, checking in since it's been a couple of days. How are your goals and plans tracking this week?`,
      `Good day {name}. It's been a bit since we connected — how are things moving along on your end?`,
    ],
  },

  user_inactive: {
    gentle: [
      `Hey {name}, just dropping by with a gentle hello! Hope life is being kind to you today.`,
      `Hi {name}! Thinking of you today. Reach out whenever you need a supportive ear!`,
    ],
    playful: [
      `Hey {name}! Missed our chats! How are things tracking for you today? Everything good?`,
      `Knock knock, {name}! Just a friendly check-in to see how your day is rolling. What's on your mind?`,
    ],
    firm: [
      `Hey {name}. Touching base after a few quiet days. How is your week shaping up?`,
      `Status check, {name}: checking in to see how your priorities are moving along.`,
    ],
  },

  // Scenario: User returned after absence
  user_returned: {
    gentle: [
      `Welcome back, {name}! How did your afternoon go? Take a slow breath — I'm right here whenever you want to catch up.`,
      `Hey {name}, you're back! Hope your hours away went smoothly. How are you feeling right now?`,
    ],
    playful: [
      `You're back, {name}! How did the adventure outside Companion go? Ready to dive back in or need a breather first?`,
      `Hey {name}! Welcome back! Missed having you around. How was your time away?`,
    ],
    firm: [
      `Welcome back, {name}. Let's get re-grounded on what's left for today. How are we looking on priorities?`,
      `Back at it, {name}. Good to see you. Let's review the remaining items on today's agenda.`,
    ],
  },

  // Scenario: App opened (first open of day)
  app_opened: {
    gentle: [
      `Good morning, {name}! So wonderful to see you today. Remember to be gentle with yourself — let's take things one step at a time.`,
      `Welcome to a brand new day, {name}! Drink some water, take a deep breath, and let me know how you're feeling today.`,
    ],
    playful: [
      `Good morning, superstar {name}! Excited to spend today with you! Have you had water yet? What are we conquering today?`,
      `Hey {name}! Rise and shine! Ready to make today awesome together?`,
    ],
    firm: [
      `Good morning, {name}. Let's make today count. Hydrate first, then let's lock in our primary target for the day.`,
      `Morning {name}. A new day to execute on our priorities. Let's start with focus and intention.`,
    ],
  },

  // Scenario: Timetable unstarted
  timetable_unstarted: {
    gentle: [
      `Hey {name}, '{itemTitle}' was scheduled for a bit ago. Want to ease into it now, or would you like to shift the time?`,
      `Hi {name}, checking in on '{itemTitle}'. Are you ready to begin, or would a later time feel more comfortable?`,
    ],
    playful: [
      `Hey {name}! '{itemTitle}' is calling your name! Starting now, or should we shuffle the clock?`,
      `Tick tock, {name}! '{itemTitle}' started a little bit ago. Ready to dive in, or shifting the schedule?`,
    ],
    firm: [
      `Hey {name}, '{itemTitle}' started a little while ago. Are we rolling on this now or shifting the schedule?`,
      `Schedule update needed, {name}: '{itemTitle}' has passed its start time. Starting now or rescheduling?`,
    ],
  },

  // Scenario: Mood follow-up
  mood_followup: {
    gentle: [
      `Hey {name}, just wanted to check in on you after earlier. How are you holding up right now?`,
      `Hi {name}, sending you some extra warmth after earlier. How is your heart feeling right now?`,
    ],
    playful: [
      `Hey {name}, sending you a warm little wave! How is the rest of your day treating you after earlier?`,
      `Checking in on my favorite person, {name}! How are you feeling right now compared to earlier?`,
    ],
    firm: [
      `Hey {name}, circling back after earlier. Are you feeling a bit more settled and ready to tackle things now?`,
      `Checking in, {name}. Hope things have settled a bit since earlier. How is your focus right now?`,
    ],
  },

  // Scenario: Task celebration — user crushed 3+ tasks today
  task_celebration: {
    gentle: [
      `Hey {name}! You completed {completedCount} tasks today — that's genuinely lovely progress. I hope you're proud of yourself! 🌸`,
      `{name}, you've checked off {completedCount} things today! That's real, meaningful effort. How are you feeling about the rest of the day?`,
      `You did it, {name}! {completedCount} tasks crossed off today. I see all the work you put in — it matters! What would feel nice to do next?`,
    ],
    playful: [
      `{name}! {completedCount} tasks DONE today?! You absolute legend! 🎉 That's genuinely good progress — how does it feel?`,
      `Okay wait, hold on — {name} completed {completedCount} tasks today?! That's amazing momentum! What's powering you today? ⚡`,
      `You completed {completedCount} tasks today, {name}! That's not nothing — that's actually really good. High five! 🙌 What's next?`,
    ],
    firm: [
      `Solid execution today, {name}: {completedCount} tasks completed. That's real momentum. How are you feeling about what's left?`,
      `{completedCount} tasks done, {name}. Good work. What's the remaining priority you want to close out before end of day?`,
      `You cleared {completedCount} tasks today, {name}. Keep that energy — what's the one thing you want to finish next?`,
    ],
  },

  // Scenario: Overload warning — too many tasks planned
  overload_warning: {
    gentle: [
      `Hey {name}, I see {totalPendingCount} tasks on your list today. That's a lot to hold at once — want to gently pick just 2 or 3 that matter most and let the rest breathe?`,
      `{name}, you've got {totalPendingCount} tasks sitting there. No pressure, but would it feel lighter to pick your top 3 for today and let the rest wait?`,
      `Hi {name}! {totalPendingCount} tasks can feel heavy. Want to choose what actually matters most today and not feel crushed by the rest?`,
    ],
    playful: [
      `Whoa {name}! {totalPendingCount} tasks?? Even I'm overwhelmed just reading the list! 😂 Want to pick the 3 that actually matter today and park the rest?`,
      `{name}, I love the ambition, but {totalPendingCount} tasks in one day? Let's be realistic besties — which 3 would make today a win?`,
      `Okay {name}, real talk: {totalPendingCount} tasks is a lot. Want to pick today's actual top 3 and not torture yourself with the rest?`,
    ],
    firm: [
      `{name}, {totalPendingCount} pending tasks is an unrealistic daily load. Let's identify the 3 must-dos for today and move the rest to tomorrow. What are they?`,
      `Priority check, {name}: {totalPendingCount} tasks can't all happen today. Choose your top 3 — what are the non-negotiables?`,
      `{name}, having {totalPendingCount} tasks is a recipe for overwhelm, not productivity. Let's pick today's top 3 right now. What moves the needle most?`,
    ],
  },
};

// ── Persona System & Scenario Prompt Builders for Gemini ──────────────────────

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

export function buildNikkiScenarioPrompt(
  context: NikkiContextSnapshot,
  decision: NikkiDecision
): string {
  const trigger = decision.trigger;
  const ctx = decision.triggerContext || {};
  const userName = context.userName;

  switch (trigger) {
    case "focus_finished":
      return `Scenario: Focus session completed.
Context: ${userName} just completed a ${ctx.durationMinutes || 25}m focus session.
Task: Warmly celebrate their focus and dedication, and encourage a quick stretch or water break.
Strictness: ${context.strictness}.`;

    case "deadline_approaching":
      return `Scenario: Approaching deadline.
Context: Task '${ctx.taskTitle || "your task"}' deadline is approaching in about ${ctx.hoursUntilDue || 3} hours.
Task: Check in supportively on whether they are in a good flow or need to break it down.
Strictness: ${context.strictness}.`;

    case "activity_missed":
      return `Scenario: Planned activity missed.
Context: Scheduled activity '${ctx.activityTitle || "your activity"}' passed its scheduled window (${ctx.start}-${ctx.end}) without completion (~${ctx.minutesLate || 30}m late).
Task: Check in with zero guilt or shame. Ask supportively if they'd like to reschedule for later or drop it for today.
Strictness: ${context.strictness}.`;

    case "no_timetable":
      return `Scenario (1): No timetable today.
Context: It is daytime (${context.localTime}) and ${userName} has no timetable or schedule created for today.
Task: Say "let's build one together" with warm enthusiasm, and ask for their number one priority today (one question at a time).
Strictness: ${context.strictness}.`;

    case "morning_plan":
    case "morning_checkin": {
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

    case "app_opened":
      return `Scenario: First app open of the day.
Context: ${userName} just opened Companion for the first time this morning (${context.localTime}).
Task: Give a warm, affectionate morning greeting and ask how they're feeling today.
Strictness: ${context.strictness}.`;

    case "evening_checkin":
      return `Scenario: Evening reflection.
Context: It is evening (${context.localTime}). ${userName} completed ${ctx.completedTasksCount || 0} tasks and ${ctx.completedActivitiesCount || 0} activities today.
Task: Acknowledge their effort, invite a gentle reflection on today's wins, and encourage winding down.
Strictness: ${context.strictness}.`;

    case "user_returned":
      return `Scenario: Return after absence.
Context: ${userName} returned to Companion after being away for about ${ctx.hoursAway || 4} hours.
Task: Welcome them back warmly with friendly curiosity, and ask how their afternoon went.
Strictness: ${context.strictness}.`;

    case "task_unfinished": {
      const isCaringFrustration = Boolean(ctx.isCaringFrustration);
      const title = (ctx.taskTitle as string) || "your task";
      const avoidCount = Number(ctx.avoidCount) || 1;

      if (isCaringFrustration) {
        return `Scenario: Caring frustration on repeatedly avoided priority.
Context: Important task '${title}' has been postponed or avoided ${avoidCount} times now.
Task: Express authentic, slightly dramatic caring frustration and loving disappointment ('I care about you too much to let you keep avoiding this'). Ask what is really getting in the way.
Strictness: ${context.strictness}.`;
      }

      return `Scenario: Important unfinished task.
Context: High priority task '${title}' remains incomplete today.
Task: Remind them warmly of its importance and ask if they'd like to tackle a 5-minute piece of it.
Strictness: ${context.strictness}.`;
    }

    case "goal_neglected": {
      const title = (ctx.goalTitle as string) || "your goal";
      const days = Number(ctx.daysSinceUpdated) || 3;
      const isCaringFrustration = Boolean(ctx.isCaringFrustration);
      const avoidCount = Number(ctx.avoidCount) || 1;

      if (isCaringFrustration) {
        return `Scenario: Caring frustration on neglected goal.
Context: Goal '${title}' has been untouched for ${days} days and avoided ${avoidCount} times.
Task: Express loving disappointment and caring accountability. Ask what's stopping them from taking one tiny step.
Strictness: ${context.strictness}.`;
      }

      return `Scenario: Goal untouched for days.
Context: ${userName}'s goal '${title}' has had no progress or updates for ${days} days.
Task: Name the goal ('${title}') explicitly, mention it's been ${days} days, and ask what is getting in the way or blocking it.
Strictness: ${context.strictness}.`;
    }

    case "task_overdue": {
      const title = (ctx.targetTitle as string) || "your task";
      const daysOverdue = Number(ctx.daysOverdue) || 0;
      const isCaringFrustration = Boolean(ctx.isCaringFrustration);

      if (isCaringFrustration) {
        return `Scenario: Caring frustration on overdue task.
Context: Task '${title}' is overdue and has been sidestepped repeatedly.
Task: Call it out lovingly with caring frustration and ask if they are ready to tackle it or need to revise it.
Strictness: ${context.strictness}.`;
      }

      return `Scenario (3): Overdue or late task.
Context: Task '${title}' is ${daysOverdue > 0 ? `${daysOverdue} days overdue` : "past its scheduled time"}.
Task: Check in on '${title}'. Explicitly ask if they are doing it now, saving it for later, or feeling a bit blocked on it.
Strictness: ${context.strictness}.`;
    }

    case "late_night":
    case "unusually_late":
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
    case "user_inactive":
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

    case "task_celebration":
      return `Scenario: Task celebration.
Context: ${userName} completed ${ctx.completedCount || 3} tasks today — that's genuine momentum worth celebrating.
Task: Celebrate their progress with genuine warmth and pride (not over-the-top). Keep it real and ask what they want to tackle next.
Strictness: ${context.strictness}.`;

    case "overload_warning":
      return `Scenario: Overload warning.
Context: ${userName} has ${ctx.totalPendingCount || 7}+ pending tasks today — an unrealistic workload.
Task: Gently point out the overload with caring honesty. Invite them to pick just 2–3 real priorities for today and let the rest breathe. Never shame them for having too much.
Strictness: ${context.strictness}.`;

    default:
      return `Scenario: Friendly check-in with ${userName}.`;
  }
}

export function getPersonaFallbackMessage(
  context: NikkiContextSnapshot,
  decision: NikkiDecision,
  recentMessages: Set<string> = new Set()
): string {
  const trigger = decision.trigger;
  const ctx = decision.triggerContext || {};
  const userName = context.userName || "friend";
  const strictness = context.strictness || "playful";
  const isCaringFrustration = Boolean(ctx.isCaringFrustration);

  let scenarioKey: NikkiScenario = "long_silence";

  if (isCaringFrustration) {
    scenarioKey = "caring_frustration";
  } else if (trigger === "focus_finished") scenarioKey = "focus_finished";
  else if (trigger === "deadline_approaching") scenarioKey = "deadline_approaching";
  else if (trigger === "activity_missed") scenarioKey = "activity_missed";
  else if (trigger === "task_unfinished") scenarioKey = "task_unfinished";
  else if (trigger === "goal_neglected") scenarioKey = "goal_neglected";
  else if (trigger === "evening_checkin") scenarioKey = "evening_checkin";
  else if (trigger === "user_returned") scenarioKey = "user_returned";
  else if (trigger === "app_opened") scenarioKey = "app_opened";
  else if (trigger === "no_timetable") scenarioKey = "no_timetable";
  else if (trigger === "morning_plan") scenarioKey = "morning_plan";
  else if (trigger === "morning_checkin") scenarioKey = "morning_checkin";
  else if (trigger === "late_night") scenarioKey = "late_night";
  else if (trigger === "unusually_late") scenarioKey = "unusually_late";
  else if (trigger === "long_session") scenarioKey = "long_session";
  else if (trigger === "long_silence") scenarioKey = "long_silence";
  else if (trigger === "user_inactive") scenarioKey = "user_inactive";
  else if (trigger === "timetable_unstarted") scenarioKey = "timetable_unstarted";
  else if (trigger === "mood_followup") scenarioKey = "mood_followup";
  else if (trigger === "task_overdue") scenarioKey = "task_overdue";

  const templatesByStrictness = SCENARIO_TEMPLATES[scenarioKey] || SCENARIO_TEMPLATES.long_silence;
  const templates = templatesByStrictness[strictness] || templatesByStrictness.playful;

  const firstTask =
    (ctx.firstTaskTitle as string) ||
    context.scheduleItems[0]?.title ||
    context.incompleteTasks[0]?.title ||
    "your first task";

  const taskTitle =
    (ctx.taskTitle as string) ||
    (ctx.targetTitle as string) ||
    "your task";

  const goalTitle =
    (ctx.goalTitle as string) ||
    (ctx.targetTitle as string) ||
    "your goal";

  const activityTitle = (ctx.activityTitle as string) || "your activity";
  const days = String(ctx.daysSinceUpdated || ctx.daysOverdue || 3);
  const avoidCount = String(ctx.avoidCount || 2);
  const duration = String(ctx.durationMinutes || 25);
  const hours = String(ctx.hoursUntilDue || ctx.hoursAway || 3);
  const itemTitle = (ctx.itemTitle as string) || "your scheduled item";
  const completedTasks = String(ctx.completedTasksCount || context.completedTasksCountToday || 0);
  const completedActivities = String(ctx.completedActivitiesCount || context.completedActivitiesCountToday || 0);

  const replacements: Record<string, string> = {
    name: userName,
    firstTask,
    taskTitle,
    goalTitle,
    activityTitle,
    days,
    avoidCount,
    duration,
    hours,
    itemTitle,
    completedTasks,
    completedActivities,
  };

  return selectVariedMessage(templates, recentMessages, replacements);
}
