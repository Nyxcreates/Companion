"use client";

import { useEffect, useLayoutEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Pencil,
  Copy,
  Check,
  RotateCcw,
  Maximize2,
  Minimize2,
  History,
  Target,
  ListTodo,
  CalendarClock,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { Card } from "@/components/ui/Card";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { CompanionCharacter } from "@/components/character/CompanionCharacter";
import { ScheduleTimeline } from "@/components/schedule/ScheduleTimeline";
import { authFetch, AuthFetchError } from "@/lib/api/authFetch";
import { parseApiResponse } from "@/lib/api/parseApiResponse";
import { fadeIn } from "@/lib/motion";
import { useProfile } from "@/context/ProfileContext";
import type { ChatTurn } from "@/lib/ai/types";
import type { ConversationDetail } from "@/types/conversation";
import type { ScheduleSummary } from "@/types/schedule";

interface DisplayTurn extends ChatTurn {
  id: string;
  /** Present only on a nikki turn that triggered successful schedule generation. */
  schedule?: ScheduleSummary;
  scheduleDate?: string | null;
  scheduleId?: string | null;
  scheduleDeleted?: boolean;
}

interface ChatResponseData {
  message: string;
  intent: string;
  actions: unknown[];
  needsClarification: boolean;
  conversationId: string;
  userMessageId?: string;
  assistantMessageId?: string;
  schedule: ScheduleSummary | null;
  scheduleDeleted?: string | null;
  companionSignal?: { state: string; pose: string } | null;
}

interface EditMessageResponseData {
  message: { id: string; role: "user"; text: string; createdAt: string };
  assistantMessage?: {
    id: string;
    role: "nikki";
    text: string;
    schedule?: ScheduleSummary;
    scheduleDate?: string | null;
    scheduleId?: string | null;
  };
}

interface CompanionChatPanelProps {
  conversationId: string | null;
  isNewConversationPending: boolean;
  onConversationResolved: (conversationId: string) => void;
  onOpenHistory?: () => void;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
}

function getBrowserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

function getSpeechLanguage(profileLang?: string | null): string {
  if (profileLang?.trim()) return profileLang.trim();
  return "en-IN";
}

function stripMarkdownAndEmoji(text: string): string {
  return text
    .replace(/[*_~`#>]+/g, "")
    .replace(/[\u{1F300}-\u{1FAFF}\u{1F000}-\u{1F02F}\u{2600}-\u{27BF}]/gu, "")
    .trim();
}

export function CompanionChatPanel({
  conversationId,
  isNewConversationPending,
  onConversationResolved,
  onOpenHistory,
  isExpanded,
  onToggleExpand,
}: CompanionChatPanelProps) {
  const { profile } = useProfile();
  const companionName = profile?.companionName || "Companion";

  const [internalExpanded, setInternalExpanded] = useState(false);
  const expanded = isExpanded !== undefined ? isExpanded : internalExpanded;
  const toggleExpand = useCallback(() => {
    if (onToggleExpand) {
      onToggleExpand();
    } else {
      setInternalExpanded((prev) => !prev);
    }
  }, [onToggleExpand]);

  useEffect(() => {
    if (!expanded) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        toggleExpand();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [expanded, toggleExpand]);

  const [turns, setTurns] = useState<DisplayTurn[]>([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFailedMessage, setLastFailedMessage] = useState<string | null>(null);

  // Message editing state
  const [editingTurnId, setEditingTurnId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Copy feedback state
  const [copiedTurnId, setCopiedTurnId] = useState<string | null>(null);

  // Voice input state
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [autoSendOnStop, setAutoSendOnStop] = useState(false);
  const [speakReplies, setSpeakReplies] = useState(false);

  const loadedConversationIdRef = useRef<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const sendingRef = useRef(false);
  const composingRef = useRef(false);
  const [enterInsertsNewline, setEnterInsertsNewline] = useState(false);

  useEffect(() => {
    setEnterInsertsNewline(window.matchMedia("(pointer: coarse)").matches);
  }, []);

  const speechLang = getSpeechLanguage();
  const { isSupported: speechSupported, isListening, startListening, stopListening } = useSpeechRecognition({
    lang: speechLang,
    onInterimTranscript: (text) => {
      setInput(text);
    },
    onFinalTranscript: (text) => {
      const trimmed = text.trim();
      if (autoSendOnStop && trimmed) {
        setInput("");
        handleSend(trimmed);
      } else {
        setInput(text);
      }
    },
    onError: (_type, message) => {
      setVoiceError(message);
    },
    onEnd: () => {
      // listening stopped naturally
    },
  });

  // Auto-grow up to max-height, then scroll internally.
  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const nextHeight = Math.min(el.scrollHeight, 220);
    el.style.height = `${Math.max(44, nextHeight)}px`;
  }, [input]);

  useEffect(() => {
    let cancelled = false;

    async function loadMessages() {
      if (!conversationId) {
        setTurns([]);
        loadedConversationIdRef.current = null;
        return;
      }
      if (loadedConversationIdRef.current === conversationId) return;

      setIsLoadingHistory(true);
      setError(null);
      try {
        const res = await authFetch(`/api/conversations/${conversationId}`, { method: "GET" });
        const envelope = await parseApiResponse<ConversationDetail>(res);
        if (!res.ok || envelope.error || !envelope.data) {
          throw new Error(envelope.error?.message ?? "Couldn't load that conversation.");
        }
        if (cancelled) return;
        setTurns(
          envelope.data.messages.map((m) => ({
            id: m.id,
            role: m.role,
            text: m.text,
            schedule: m.schedule ?? undefined,
            scheduleDate: m.scheduleDate ?? null,
            scheduleId: m.scheduleId ?? null,
            scheduleDeleted: m.scheduleDeleted ?? false,
          }))
        );
        loadedConversationIdRef.current = conversationId;
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Couldn't load that conversation.");
      } finally {
        if (!cancelled) setIsLoadingHistory(false);
      }
    }

    loadMessages();
    return () => {
      cancelled = true;
    };
  }, [conversationId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [turns, isSending]);

  async function handleSend(overrideText?: string) {
    const message = (overrideText ?? input).trim();
    if (!message || isSending || sendingRef.current) return;
    sendingRef.current = true;

    // Stop any ongoing speech synthesis when sending
    if (typeof window !== "undefined") {
      window.speechSynthesis?.cancel();
    }

    setError(null);
    setLastFailedMessage(null);
    if (!overrideText) {
      setInput("");
    }

    const tempUserId = crypto.randomUUID();
    const userTurn: DisplayTurn = { id: tempUserId, role: "user", text: message };
    setTurns((prev) => [...prev, userTurn]);
    setIsSending(true);

    try {
      localStorage.setItem("companion:last-chat-message-time", Date.now().toString());
    } catch {
      // safe fallback
    }

    try {
      const timezone = getBrowserTimezone();
      const res = await authFetch("/api/agent/chat", {
        method: "POST",
        body: JSON.stringify({
          message,
          conversationId,
          newConversation: isNewConversationPending,
          timezone,
        }),
      });

      const envelope = await parseApiResponse<ChatResponseData>(res);

      if (!res.ok || envelope.error || !envelope.data) {
        throw new Error(envelope.error?.message ?? "Your companion couldn't respond just now.");
      }

      const agentResponse = envelope.data;

      loadedConversationIdRef.current = agentResponse.conversationId;
      onConversationResolved(agentResponse.conversationId);

      setTurns((prev) => {
        let updated = prev.map((t) =>
          t.id === tempUserId && agentResponse.userMessageId
            ? { ...t, id: agentResponse.userMessageId }
            : t
        );
        // If a schedule was deleted, remove any rendered schedule for that date
        if (agentResponse.scheduleDeleted) {
          updated = updated.map((t) =>
            t.schedule?.date === agentResponse.scheduleDeleted || t.scheduleDate === agentResponse.scheduleDeleted
              ? { ...t, schedule: undefined, scheduleDeleted: true }
              : t
          );
        }
        return [
          ...updated,
          {
            id: agentResponse.assistantMessageId ?? crypto.randomUUID(),
            role: "nikki",
            text: agentResponse.message,
            schedule: agentResponse.schedule ?? undefined,
            scheduleDate: agentResponse.schedule?.date ?? null,
            scheduleId: agentResponse.schedule?.id ?? null,
            scheduleDeleted: false,
          },
        ];
      });

      if (agentResponse.schedule || agentResponse.scheduleDeleted) {
        try {
          window.dispatchEvent(new CustomEvent("companion:schedule-change"));
        } catch {
          // safe fallback
        }
      }

      // Update companion state for goodbye, return, or break signals
      if (agentResponse.companionSignal) {
        try {
          if (agentResponse.companionSignal.state === "returned") {
            localStorage.removeItem("companion:user-state");
          } else {
            localStorage.setItem(
              "companion:user-state",
              JSON.stringify({
                ...agentResponse.companionSignal,
                timestamp: Date.now(),
              })
            );
          }
          window.dispatchEvent(
            new CustomEvent("companion:state-change", { detail: agentResponse.companionSignal })
          );
        } catch {
          // safe fallback
        }
      }

      // Speak Nikki's reply if the toggle is on
      if (speakReplies && agentResponse.message) {
        const clean = stripMarkdownAndEmoji(agentResponse.message);
        if (clean && typeof window !== "undefined" && window.speechSynthesis) {
          const utt = new SpeechSynthesisUtterance(clean);
          window.speechSynthesis.cancel();
          window.speechSynthesis.speak(utt);
        }
      }
    } catch (err) {
      const msg =
        err instanceof AuthFetchError || err instanceof Error
          ? err.message
          : "Your companion couldn't respond just now.";
      setError(msg);
      setLastFailedMessage(message);
    } finally {
      sendingRef.current = false;
      setIsSending(false);
      textareaRef.current?.focus();
    }
  }

  function handleStartEdit(turn: DisplayTurn) {
    setEditingTurnId(turn.id);
    setEditText(turn.text);
    setEditError(null);
  }

  function handleCancelEdit() {
    setEditingTurnId(null);
    setEditText("");
    setEditError(null);
  }

  async function handleSaveEdit(turnId: string) {
    const trimmed = editText.trim();
    if (!trimmed || isSavingEdit) return;

    setIsSavingEdit(true);
    setEditError(null);

    try {
      const timezone = getBrowserTimezone();
      const res = await authFetch(`/api/messages/${turnId}`, {
        method: "PATCH",
        body: JSON.stringify({
          message: trimmed,
          regenerate: true,
          timezone,
        }),
      });

      const envelope = await parseApiResponse<EditMessageResponseData>(res);
      if (!res.ok || envelope.error || !envelope.data) {
        throw new Error(envelope.error?.message ?? "Failed to save edited message.");
      }

      const { message: savedMsg, assistantMessage } = envelope.data;

      setTurns((prev) => {
        const turnIndex = prev.findIndex((t) => t.id === turnId);
        if (turnIndex === -1) return prev;

        const nextTurns = [...prev];
        // Update the edited user message
        nextTurns[turnIndex] = {
          ...nextTurns[turnIndex],
          id: savedMsg.id || nextTurns[turnIndex].id,
          text: savedMsg.text,
        };

        // If an assistant message was regenerated, replace the subsequent assistant turn
        if (assistantMessage) {
          if (turnIndex + 1 < nextTurns.length && nextTurns[turnIndex + 1].role === "nikki") {
            nextTurns[turnIndex + 1] = {
              ...nextTurns[turnIndex + 1],
              id: assistantMessage.id,
              text: assistantMessage.text,
              schedule: assistantMessage.schedule ?? nextTurns[turnIndex + 1].schedule,
              scheduleDate: assistantMessage.scheduleDate ?? nextTurns[turnIndex + 1].scheduleDate,
              scheduleId: assistantMessage.scheduleId ?? nextTurns[turnIndex + 1].scheduleId,
              scheduleDeleted: false,
            };
          } else {
            nextTurns.splice(turnIndex + 1, 0, {
              id: assistantMessage.id,
              role: "nikki",
              text: assistantMessage.text,
              schedule: assistantMessage.schedule ?? undefined,
              scheduleDate: assistantMessage.scheduleDate ?? null,
              scheduleId: assistantMessage.scheduleId ?? null,
              scheduleDeleted: false,
            });
          }
        }

        return nextTurns;
      });

      setEditingTurnId(null);
      setEditText("");
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Couldn't save edit.");
    } finally {
      setIsSavingEdit(false);
    }
  }

  async function handleCopyText(turnId: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedTurnId(turnId);
      setTimeout(() => {
        setCopiedTurnId((prev) => (prev === turnId ? null : prev));
      }, 2000);
    } catch {
      // Ignore clipboard write failures gracefully
    }
  }

  const emptyStateText = isNewConversationPending
    ? "Starting something new — say hello."
    : "Nothing here yet — try saying hello.";

  const subtitleText = isNewConversationPending
    ? "Say hi — let's start fresh."
    : "Your conversation continues where you left off.";

  const chatContent = (
    <div className={`flex flex-col h-full w-full overflow-hidden ${expanded ? "bg-slate-950/95" : ""}`}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 px-5 py-3.5">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-9 w-9 shrink-0">
            <CompanionCharacter pose="idle" className="h-full w-full" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-display text-sm font-semibold text-ink-primary truncate">{companionName}</p>
              {expanded && (
                <span className="hidden sm:inline-flex items-center rounded-full border border-cyan-400/30 bg-cyan-500/10 px-2 py-0.5 text-[11px] font-medium text-cyan-300">
                  Expanded
                </span>
              )}
            </div>
            <p className="text-xs text-ink-muted truncate">{subtitleText}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {expanded && onOpenHistory && (
            <Button
              variant="secondary"
              size="sm"
              onClick={onOpenHistory}
              className="hidden sm:inline-flex items-center gap-1.5 text-xs py-1 px-2.5"
            >
              <History className="h-3.5 w-3.5" />
              <span>History</span>
            </Button>
          )}

          <button
            type="button"
            onClick={toggleExpand}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-ink-muted transition-colors hover:border-white/20 hover:bg-white/10 hover:text-ink-primary"
            title={expanded ? "Minimize chat (Esc)" : "Expand chat"}
            aria-label={expanded ? "Minimize chat" : "Expand chat"}
          >
            {expanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div
        ref={scrollRef}
        className={`flex-1 space-y-4 overflow-y-auto px-5 py-4 ${expanded ? "max-w-4xl w-full mx-auto" : ""}`}
      >
        {isLoadingHistory && (
          <div className="space-y-3">
            <Skeleton className="h-9 w-2/3" />
            <Skeleton className="ml-auto h-9 w-1/2" />
            <Skeleton className="h-9 w-3/5" />
          </div>
        )}

        {!isLoadingHistory && turns.length === 0 && (
          <div className="my-auto flex flex-col items-center justify-center gap-4 py-8 text-center">
            <div className="relative h-20 w-20">
              <CompanionCharacter
                pose={new Date().getHours() >= 23 || new Date().getHours() < 5 ? "sleepy" : "wave"}
                className="h-full w-full"
              />
            </div>
            <div className="max-w-md space-y-1.5 px-4">
              <h3 className="font-display text-base font-semibold text-white">
                {new Date().getHours() < 12
                  ? "GOOD MORNINGGG! ☀️ Ready to make today a good one?"
                  : new Date().getHours() < 17
                    ? `Heyyy! How is your afternoon going, moon?`
                    : new Date().getHours() < 22
                      ? "Good eveninggg! How did today turn out?"
                      : "Still awake? Hehe. How did today go? 🌙"}
              </h3>
              <p className="text-xs text-ink-muted leading-relaxed">
                I&apos;m right here with you. Tell me what&apos;s on your mind, plan your timetable, or ask me anything!
              </p>
            </div>

            {/* Quick interactive conversation starters */}
            <div className="flex flex-wrap items-center justify-center gap-2 pt-2 max-w-lg">
              <button
                type="button"
                onClick={() => handleSend("Plan my timetable for today")}
                className="rounded-full border border-cyan-400/30 bg-cyan-500/10 px-3 py-1.5 text-xs text-cyan-300 transition-all hover:bg-cyan-500/20 hover:border-cyan-400"
              >
                📅 Plan my timetable for today
              </button>
              <button
                type="button"
                onClick={() => handleSend("What do I have next on my schedule?")}
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-ink-primary transition-all hover:bg-white/10"
              >
                ⏰ What&apos;s next on my schedule?
              </button>
              <button
                type="button"
                onClick={() => handleSend("Bye Nikki, going to college!")}
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-ink-primary transition-all hover:bg-white/10"
              >
                🎒 Going to college
              </button>
              <button
                type="button"
                onClick={() => handleSend("I'm back from college!")}
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-ink-primary transition-all hover:bg-white/10"
              >
                ✨ I&apos;m back!
              </button>
              <button
                type="button"
                onClick={() => handleSend("Goodnight Nikki 🌙")}
                className="rounded-full border border-indigo-400/30 bg-indigo-500/10 px-3 py-1.5 text-xs text-indigo-300 transition-all hover:bg-indigo-500/20"
              >
                🌙 Goodnight Nikki
              </button>
            </div>
          </div>
        )}

        {!isLoadingHistory && (
          <AnimatePresence initial={false}>
            {turns.map((turn) => {
              const isUser = turn.role === "user";
              const isEditing = editingTurnId === turn.id;

              return (
                <motion.div
                  key={turn.id}
                  variants={fadeIn}
                  initial="hidden"
                  animate="visible"
                  className={isUser ? "group flex flex-col items-end" : "group flex flex-col items-start"}
                >
                  {isEditing ? (
                    <div className="flex w-full max-w-[85%] flex-col gap-2 rounded-2xl border border-accent-primary/40 bg-white/[0.08] p-3">
                      <textarea
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Escape") {
                            e.preventDefault();
                            e.stopPropagation();
                            if (!isSavingEdit) {
                              handleCancelEdit();
                            }
                            return;
                          }
                          if (e.key === "Enter" && !e.shiftKey) {
                            if (e.nativeEvent.isComposing || e.keyCode === 229) return;
                            e.preventDefault();
                            handleSaveEdit(turn.id);
                          }
                        }}
                        disabled={isSavingEdit}
                        className="w-full resize-y rounded-xl border border-white/15 bg-white/5 p-2.5 text-sm text-ink-primary placeholder:text-ink-muted focus:border-accent-secondary focus:outline-none"
                        rows={3}
                        autoFocus
                      />
                      {editError && (
                        <div className="flex items-center justify-between gap-2 rounded-lg border border-danger/20 bg-danger/10 px-2.5 py-1.5 text-xs text-danger">
                          <span>{editError}</span>
                          <button
                            type="button"
                            onClick={() => handleSaveEdit(turn.id)}
                            disabled={isSavingEdit || !editText.trim()}
                            className="flex shrink-0 items-center gap-1 font-medium underline hover:text-danger/80 disabled:opacity-50"
                          >
                            <RotateCcw className="h-3 w-3" /> Retry
                          </button>
                        </div>
                      )}
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleCancelEdit}
                          disabled={isSavingEdit}
                        >
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleSaveEdit(turn.id)}
                          isLoading={isSavingEdit}
                          disabled={!editText.trim() || isSavingEdit}
                        >
                          Save
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="relative flex max-w-[85%] flex-col items-end">
                      <div
                        className={
                          isUser
                            ? "whitespace-pre-wrap break-words rounded-2xl bg-accent-primary/20 px-4 py-2.5 text-sm text-ink-primary"
                            : "whitespace-pre-wrap break-words rounded-2xl bg-white/[0.06] px-4 py-2.5 text-sm text-ink-primary"
                        }
                      >
                        {turn.text}
                      </div>

                      {/* Action buttons (Edit for user, Copy for Nikki) */}
                      <div className="mt-1 flex items-center gap-1.5 opacity-0 transition-opacity duration-150 group-hover:opacity-100 focus-within:opacity-100">
                        {isUser && !isSending && (
                          <button
                            type="button"
                            onClick={() => handleStartEdit(turn)}
                            className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs text-ink-muted hover:bg-white/10 hover:text-ink-primary"
                            title="Edit message"
                            aria-label="Edit message"
                          >
                            <Pencil className="h-3 w-3" />
                            <span>Edit</span>
                          </button>
                        )}
                        {!isUser && (
                          <button
                            type="button"
                            onClick={() => handleCopyText(turn.id, turn.text)}
                            className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs text-ink-muted hover:bg-white/10 hover:text-ink-primary"
                            title="Copy response"
                            aria-label="Copy response"
                          >
                            {copiedTurnId === turn.id ? (
                              <>
                                <Check className="h-3 w-3 text-success" />
                                <span className="text-success">Copied</span>
                              </>
                            ) : (
                              <>
                                <Copy className="h-3 w-3" />
                                <span>Copy</span>
                              </>
                            )}
                          </button>
                        )}
                      </div>

                      {turn.schedule && turn.schedule.items ? (
                        <div className="mt-2 w-full max-w-[100%]">
                          <ScheduleTimeline schedule={turn.schedule} />
                        </div>
                      ) : (turn.scheduleDeleted || (turn.scheduleDate && !turn.schedule) || (turn.scheduleId && !turn.schedule)) ? (
                        <div className="mt-2 flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-ink-muted">
                          <CalendarClock className="h-3.5 w-3.5 text-ink-muted/70" />
                          <span>Timetable was removed</span>
                        </div>
                      ) : null}
                    </div>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}

        {isSending && (
          <div className="flex justify-start">
            <div className="rounded-2xl bg-white/[0.06] px-4 py-2 text-sm text-ink-muted">Thinking...</div>
          </div>
        )}
      </div>

      {/* Error & Retry bar */}
      {error && (
        <div className="flex items-center justify-between border-t border-danger/20 bg-danger/10 px-4 py-2 text-xs text-danger">
          <span>{error}</span>
          {lastFailedMessage && (
            <button
              type="button"
              onClick={() => handleSend(lastFailedMessage)}
              className="flex items-center gap-1 font-medium underline hover:text-danger/80"
            >
              <RotateCcw className="h-3 w-3" /> Retry
            </button>
          )}
        </div>
      )}

      {/* Voice error bar */}
      {voiceError && (
        <div className="flex items-center justify-between border-t border-warning/20 bg-warning/10 px-4 py-1.5 text-xs text-warning">
          <span>{voiceError}</span>
          <button type="button" onClick={() => setVoiceError(null)} className="ml-2 underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Voice privacy notice + toggles */}
      {speechSupported && (
        <div className="border-t border-white/5 px-4 py-1.5 flex flex-wrap items-center justify-between gap-2 text-[11px] text-ink-muted">
          <span>Your browser&apos;s speech service may process audio. Companion doesn&apos;t store recordings.</span>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-1 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={autoSendOnStop}
                onChange={(e) => setAutoSendOnStop(e.target.checked)}
                className="accent-cyan-400"
              />
              Auto-send when I stop talking
            </label>
            <button
              type="button"
              aria-label={speakReplies ? "Mute replies" : "Speak replies"}
              aria-pressed={speakReplies}
              onClick={() => {
                setSpeakReplies((v) => {
                  if (v && typeof window !== "undefined") window.speechSynthesis?.cancel();
                  return !v;
                });
              }}
              className="flex items-center gap-1 hover:text-white"
            >
              {speakReplies ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
              {speakReplies ? "Speak replies: On" : "Speak replies"}
            </button>
          </div>
        </div>
      )}

      {/* Chat Composer */}
      <div className={`flex items-end gap-2 border-t border-white/10 px-4 py-3 ${expanded ? "max-w-4xl w-full mx-auto" : ""}`}>
        <div className="min-w-0 flex-1">
          <Textarea
            ref={textareaRef}
            value={input}
            rows={1}
            onChange={(e) => setInput(e.target.value)}
            onCompositionStart={() => {
              composingRef.current = true;
            }}
            onCompositionEnd={() => {
              composingRef.current = false;
            }}
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              if (e.shiftKey || enterInsertsNewline) return;
              if (composingRef.current || e.nativeEvent.isComposing || e.keyCode === 229) return;
              e.preventDefault();
              handleSend();
            }}
            enterKeyHint={enterInsertsNewline ? "enter" : "send"}
            placeholder={`Message ${companionName}...`}
            className="max-h-56 min-h-[2.75rem] w-full resize-y overflow-y-auto leading-6"
            aria-label="Message"
            aria-describedby="chat-input-hint"
          />
        </div>
        <span id="chat-input-hint" className="sr-only">
          {enterInsertsNewline ? "Use the Send button to send." : "Press Enter to send, Shift and Enter for a new line."}
        </span>

        {/* Mic button */}
        {speechSupported ? (
          <button
            type="button"
            aria-label={isListening ? "Stop voice input" : "Start voice input"}
            aria-pressed={isListening}
            disabled={isSending}
            onClick={() => {
              setVoiceError(null);
              if (isListening) {
                stopListening();
              } else {
                if (typeof window !== "undefined") {
                  window.speechSynthesis?.cancel();
                }
                startListening();
              }
            }}
            className={`shrink-0 rounded-full p-2 transition-colors ${
              isListening
                ? "bg-rose-500/20 text-rose-400 ring-1 ring-rose-400/50 animate-pulse"
                : "text-ink-muted hover:text-cyan-300 hover:bg-white/10"
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {isListening ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
          </button>
        ) : (
          <span
            className="text-[11px] text-ink-muted px-1 shrink-0"
            title="Voice input not supported in this browser"
          >
            Voice unsupported
          </span>
        )}

        <Button onClick={() => handleSend()} disabled={!input.trim() || isSending} isLoading={isSending} className="shrink-0">
          Send
        </Button>
      </div>
    </div>
  );

  if (expanded) {
    return (
      <>
        {/* Placeholder keeping space in normal page flow */}
        <div className="h-[32rem] w-full" aria-hidden="true" />

        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={toggleExpand}
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md"
        />

        {/* Expanded Window */}
        <motion.div
          layout
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ type: "spring", damping: 26, stiffness: 280 }}
          className="fixed inset-0 md:inset-6 z-50 flex flex-col md:rounded-3xl border border-white/20 bg-slate-950/95 shadow-2xl backdrop-blur-2xl overflow-hidden"
        >
          {chatContent}
        </motion.div>
      </>
    );
  }

  return (
    <Card className="flex h-[32rem] w-full flex-col overflow-hidden p-0 relative">
      {chatContent}
    </Card>
  );
}
