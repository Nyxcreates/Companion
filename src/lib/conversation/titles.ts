/**
 * Deterministic, lightweight title generation from a user's first
 * message — no Gemini call per conversation, per this milestone's
 * explicit constraint. This is intentionally simple pattern-matching,
 * not real summarization: it strips a few common greeting/filler
 * openers and truncates at a word boundary. It won't produce titles
 * as clean as a human or an LLM would, but it's fast, free, and
 * predictable.
 */

const FILLER_PREFIXES = [
  /^hey\s+\w+,?\s*/i,
  /^hi\s+\w+,?\s*/i,
  /^hello\s+\w+,?\s*/i,
  /^hey,?\s*/i,
  /^hi,?\s*/i,
  /^hello,?\s*/i,
  /^i need help\s+/i,
  /^i need\s+/i,
  /^can you help me\s+/i,
  /^please help me\s+/i,
  /^could you help me\s+/i,
];

const MAX_TITLE_LENGTH = 48;

export function deriveTitleFromMessage(message: string): string {
  let text = message.trim().replace(/\s+/g, " ");

  for (const pattern of FILLER_PREFIXES) {
    text = text.replace(pattern, "");
  }
  text = text.trim();

  if (text.length === 0) return "New conversation";

  text = text.charAt(0).toUpperCase() + text.slice(1);

  if (text.length <= MAX_TITLE_LENGTH) {
    return text.replace(/[.?!]+$/, "");
  }

  const truncated = text.slice(0, MAX_TITLE_LENGTH);
  const lastSpace = truncated.lastIndexOf(" ");
  const clean = lastSpace > 20 ? truncated.slice(0, lastSpace) : truncated;
  return `${clean}…`;
}