import { buildAgentContext } from "./context";
import { buildSystemInstruction } from "./prompts";
import { generateAgentReply } from "./gemini";
import { InvalidAgentResponseError } from "./errors";
import { AGENT_INTENTS } from "./types";
import { EMOTION_LABELS, NEUTRAL_EMOTION } from "./emotion";
import { MEMORY_TYPES } from "@/lib/memory/types";
import type { AgentEmotion } from "./emotion";
import type { AgentResponse, ChatTurn, MemoryCandidate } from "./types";

const MAX_HISTORY_TURNS = 12;
const MAX_MESSAGE_LENGTH = 2000;

/** Below this confidence, we don't trust the specific label — fall back to neutral rather than acting on a guess. */
const MIN_TRUSTED_CONFIDENCE = 0.4;

/** A memory candidate longer than this is almost certainly the model rambling rather than stating a compact fact — dropped defensively. */
const MAX_MEMORY_CONTENT_LENGTH = 500;

/** Strips markdown code fences if the model wrapped its JSON despite instructions not to. */
function stripCodeFences(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  return fenced ? fenced[1] : trimmed;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

/**
 * Parses the "emotion" sub-object leniently. Unlike the rest of the
 * response contract, a malformed or missing emotion reading must
 * NEVER fail the whole request — emotion is a nice-to-have layered on
 * top of a working chat, not a hard requirement (see the memory
 * milestone's error-handling rules). Any issue just degrades to the
 * conservative neutral fallback.
 */
function parseEmotion(raw: unknown): AgentEmotion {
  if (typeof raw !== "object" || raw === null) return NEUTRAL_EMOTION;
  const obj = raw as Record<string, unknown>;

  const confidence =
    typeof obj.confidence === "number" && Number.isFinite(obj.confidence) ? clamp01(obj.confidence) : 0;

  // Low confidence is conservatively treated as neutral rather than
  // trusting an uncertain label — never invent certainty.
  if (confidence < MIN_TRUSTED_CONFIDENCE) {
    return { emotion: "neutral", intensity: 0, confidence };
  }

  const emotion =
    typeof obj.emotion === "string" && (EMOTION_LABELS as string[]).includes(obj.emotion)
      ? (obj.emotion as AgentEmotion["emotion"])
      : "neutral";

  const intensity =
    typeof obj.intensity === "number" && Number.isFinite(obj.intensity) ? clamp01(obj.intensity) : 0;

  const secondaryEmotion =
    typeof obj.secondaryEmotion === "string" && (EMOTION_LABELS as string[]).includes(obj.secondaryEmotion)
      ? (obj.secondaryEmotion as AgentEmotion["emotion"])
      : undefined;

  return { emotion, intensity, confidence, secondaryEmotion };
}

/**
 * Parses the "memoryCandidates" array leniently — same philosophy as
 * parseEmotion. A malformed array, or one bad entry inside it, must
 * NEVER fail the whole chat response (long-term-memory milestone
 * spec, section 16: "memory extraction failure must never prevent
 * Nikki from replying"). Invalid entries are silently dropped rather
 * than aborting the whole batch; the true confidence gate (only HIGH
 * confidence is actually saved) lives in services/memoryService.ts,
 * not here — this function only enforces that the shape is sane.
 */
function parseMemoryCandidates(raw: unknown): MemoryCandidate[] {
  if (!Array.isArray(raw)) return [];

  const candidates: MemoryCandidate[] = [];
  for (const entry of raw) {
    if (typeof entry !== "object" || entry === null) continue;
    const obj = entry as Record<string, unknown>;

    if (typeof obj.type !== "string" || !(MEMORY_TYPES as string[]).includes(obj.type)) continue;
    if (typeof obj.content !== "string" || obj.content.trim().length === 0) continue;
    if (typeof obj.confidence !== "number" || !Number.isFinite(obj.confidence)) continue;

    const content = obj.content.trim().slice(0, MAX_MEMORY_CONTENT_LENGTH);
    const reason = typeof obj.reason === "string" ? obj.reason.trim().slice(0, 200) : "";
    const supersedesId = typeof obj.supersedesId === "string" && obj.supersedesId.trim() ? obj.supersedesId.trim() : undefined;

    candidates.push({
      type: obj.type as MemoryCandidate["type"],
      content,
      confidence: clamp01(obj.confidence),
      reason,
      supersedesId,
    });
  }
  return candidates;
}

function parseAndValidate(rawText: string): AgentResponse {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripCodeFences(rawText));
  } catch (error) {
    throw new InvalidAgentResponseError(rawText, error);
  }

  if (typeof parsed !== "object" || parsed === null) {
    throw new InvalidAgentResponseError(rawText, new Error("Response is not an object."));
  }
  const obj = parsed as Record<string, unknown>;

  if (typeof obj.message !== "string" || obj.message.trim().length === 0) {
    throw new InvalidAgentResponseError(rawText, new Error("Missing or empty 'message'."));
  }
  if (typeof obj.intent !== "string" || !AGENT_INTENTS.includes(obj.intent as never)) {
    throw new InvalidAgentResponseError(rawText, new Error("Missing or invalid 'intent'."));
  }
  if (typeof obj.needsClarification !== "boolean") {
    throw new InvalidAgentResponseError(rawText, new Error("Missing or invalid 'needsClarification'."));
  }

  let actions: AgentResponse["actions"] = [];
  if (obj.actions !== undefined) {
    if (!Array.isArray(obj.actions)) {
      throw new InvalidAgentResponseError(rawText, new Error("'actions' must be an array."));
    }
    actions = obj.actions.filter(
      (a): a is AgentResponse["actions"][number] =>
        typeof a === "object" && a !== null && typeof (a as { type?: unknown }).type === "string"
    );
  }

  // Deliberately never throw for these two — see their doc comments.
  const emotion = parseEmotion(obj.emotion);
  const memoryCandidates = parseMemoryCandidates(obj.memoryCandidates);

  return {
    message: obj.message,
    intent: obj.intent as AgentResponse["intent"],
    actions,
    needsClarification: obj.needsClarification,
    emotion,
    memoryCandidates,
  };
}

/**
 * The orchestration layer: context → system instructions → Gemini →
 * validated structured output.
 */
export async function runAgent(
  firebaseUid: string,
  userMessage: string,
  history: ChatTurn[],
  clientTimezone?: string | null
): Promise<AgentResponse> {
  const trimmedMessage = userMessage.trim().slice(0, MAX_MESSAGE_LENGTH);
  const recentHistory = history.slice(-MAX_HISTORY_TURNS);

  const context = await buildAgentContext(firebaseUid, clientTimezone);
  const systemInstruction = buildSystemInstruction(context);
  const rawText = await generateAgentReply(systemInstruction, recentHistory, trimmedMessage);

  return parseAndValidate(rawText);
}
