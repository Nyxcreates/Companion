import { GoogleGenerativeAI } from "@google/generative-ai";
import { GeminiNotConfiguredError, GeminiRequestError } from "./errors";
import type { ChatTurn } from "./types";

const GEMINI_MODEL = "gemini-3.6-flash";
const GEMINI_FALLBACK_MODEL = "gemini-3.5-flash-lite"; // separate quota pool

export const isGeminiConfigured = Boolean(process.env.GEMINI_API_KEY);

let client: GoogleGenerativeAI | null = null;

function getClient(): GoogleGenerativeAI {
  if (!isGeminiConfigured) {
    throw new GeminiNotConfiguredError();
  }
  if (!client) {
    client = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);
  }
  return client;
}

function toGeminiRole(role: ChatTurn["role"]): "user" | "model" {
  return role === "nikki" ? "model" : "user";
}

function isRetryable503(error: unknown): boolean {
  const err = error as { status?: unknown; message?: string };
  return err?.status === 503 || /503|Service Unavailable|high demand/i.test(err?.message ?? "");
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function callModel(
  modelName: string,
  systemInstruction: string,
  history: ChatTurn[],
  userMessage: string
): Promise<string> {
  const genAI = getClient();

  const model = genAI.getGenerativeModel({
    model: modelName,
    systemInstruction,
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.7,
    },
  });

  const contents = [
    ...history.map((turn) => ({
      role: toGeminiRole(turn.role),
      parts: [{ text: turn.text }],
    })),
    { role: "user" as const, parts: [{ text: userMessage }] },
  ];

  const result = await model.generateContent({ contents });

  const text = result.response.text();
  if (!text) {
    throw new Error("Gemini returned an empty response.");
  }
  return text;
}

/**
 * Sends the system instruction, prior turns, and the new user message
 * to Gemini. On a 503 (transient capacity), retries the primary model
 * twice with backoff, then falls back to a separate-quota model
 * before giving up. Every terminal failure is wrapped as
 * GeminiRequestError exactly as before.
 */
export async function generateAgentReply(
  systemInstruction: string,
  history: ChatTurn[],
  userMessage: string
): Promise<string> {
  const attempts: { model: string; delayMs: number }[] = [
    { model: GEMINI_MODEL, delayMs: 0 },
    { model: GEMINI_MODEL, delayMs: 900 },
    { model: GEMINI_MODEL, delayMs: 1800 },
    { model: GEMINI_FALLBACK_MODEL, delayMs: 0 },
  ];

  let lastError: unknown;

  for (const attempt of attempts) {
    if (attempt.delayMs > 0) await sleep(attempt.delayMs);
    try {
      return await callModel(attempt.model, systemInstruction, history, userMessage);
    } catch (error) {
      lastError = error;
      if (error instanceof GeminiNotConfiguredError) throw error;
      if (!isRetryable503(error)) break; // non-503 failures fail fast, no point retrying
    }
  }

  const err = lastError as {
    name?: string;
    message?: string;
    status?: unknown;
    statusText?: unknown;
    errorDetails?: unknown;
  };
  // eslint-disable-next-line no-console
  console.error(
    [
      "[Companion] Gemini request failed after retries/fallback",
      `Primary model: ${GEMINI_MODEL}`,
      `Fallback model: ${GEMINI_FALLBACK_MODEL}`,
      `Error name: ${err?.name ?? "unknown"}`,
      `Error message: ${err?.message ?? String(lastError)}`,
      `Provider status: ${err?.status !== undefined ? String(err.status) : "none"}`,
      `Provider statusText: ${err?.statusText !== undefined ? String(err.statusText) : "none"}`,
      `Provider errorDetails: ${err?.errorDetails !== undefined ? JSON.stringify(err.errorDetails) : "none"}`,
    ].join("\n")
  );

  throw new GeminiRequestError(lastError);
}