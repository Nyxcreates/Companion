"use client";

/**
 * Floating Nikki Desktop Overlay Route (/desktop/floating)
 *
 * Rendered inside Electron's transparent, frameless, always-on-top BrowserWindow.
 * Reuses the existing CompanionCharacter artwork, animations, and proactive
 * nudge data — never creates a second personality or chat engine.
 */

import React, { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, Minimize2, Maximize2, X, Move, Send } from "lucide-react";
import { CompanionCharacter, type CompanionPose } from "@/components/character/CompanionCharacter";
import { authFetch } from "@/lib/api/authFetch";
import type { FloatingNudgePayload, FloatingOverlayState } from "@/types/desktop";

const AUTO_COLLAPSE_MS = 45_000;
const NUDGE_POLL_MS = 60_000;

function mapPose(raw?: string): CompanionPose {
  const valid: CompanionPose[] = [
    "idle",
    "walk",
    "turn",
    "wave",
    "lookAhead",
    "sit",
    "think",
    "celebrate",
    "sleepy",
    "concerned",
    "happy",
    "curious",
  ];
  if (raw && valid.includes(raw as CompanionPose)) {
    return raw as CompanionPose;
  }
  return "idle";
}

export default function FloatingNikkiPage() {
  const [nudge, setNudge] = useState<FloatingNudgePayload | null>(null);
  const [overlayState, setOverlayState] = useState<FloatingOverlayState>({
    visible: true,
    paused: false,
    dnd: false,
    minimized: false,
    allowOverFullscreen: false,
    suppressedByFullscreen: false,
    authenticated: true,
  });
  const [isHovered, setIsHovered] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [isSendingReply, setIsSendingReply] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);

  const isDraggingRef = useRef(false);
  const dragMovedRef = useRef(false);
  const lastPointerRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const collapseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSeenNudgeIdRef = useRef<string | null>(null);

  // Force transparent background on html & body so Electron's transparent window works cleanly
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const prevHtmlBg = html.style.background;
    const prevBodyBg = body.style.background;
    html.style.background = "transparent";
    body.style.background = "transparent";
    body.style.overflow = "hidden";
    return () => {
      html.style.background = prevHtmlBg;
      body.style.background = prevBodyBg;
    };
  }, []);

  // Auto-collapse speech bubble after inactivity so Nikki never obstructs work
  const resetCollapseTimer = useCallback(() => {
    if (collapseTimerRef.current) {
      clearTimeout(collapseTimerRef.current);
      collapseTimerRef.current = null;
    }
    collapseTimerRef.current = setTimeout(() => {
      setNudge(null);
    }, AUTO_COLLAPSE_MS);
  }, []);

  useEffect(() => {
    if (nudge && !replyText && !isSendingReply) {
      resetCollapseTimer();
    } else if (collapseTimerRef.current && (replyText || isSendingReply)) {
      clearTimeout(collapseTimerRef.current);
      collapseTimerRef.current = null;
    }
    return () => {
      if (collapseTimerRef.current) clearTimeout(collapseTimerRef.current);
    };
  }, [nudge, replyText, isSendingReply, resetCollapseTimer]);

  // Listen to Electron main-process state & nudges
  useEffect(() => {
    const desktop = window.companionDesktop;
    if (!desktop) return;

    const unsubNudge = desktop.onFloatingNudge((incoming) => {
      if (incoming?.id) {
        lastSeenNudgeIdRef.current = incoming.id;
      }
      setReplyError(null);
      setNudge(incoming);
    });

    const unsubState = desktop.onFloatingState((state) => {
      setOverlayState(state);
      if (state.paused || state.dnd || !state.visible) {
        setNudge(null);
      }
    });

    return () => {
      unsubNudge();
      unsubState();
    };
  }, []);

  // Poll /api/nikki/nudge directly so Nikki still initiates when main window is hidden
  useEffect(() => {
    if (
      !overlayState.authenticated ||
      overlayState.paused ||
      overlayState.dnd ||
      !overlayState.visible ||
      overlayState.suppressedByFullscreen
    ) {
      return;
    }

    let cancelled = false;
    const pollPendingNudge = async () => {
      try {
        const res = await authFetch("/api/nikki/nudge");
        if (!res.ok || cancelled) return;
        const json = await res.json();
        const data = json?.data;
        if (data?.id && data.id !== lastSeenNudgeIdRef.current) {
          lastSeenNudgeIdRef.current = data.id;
          setReplyError(null);
          setNudge({
            id: data.id,
            trigger: data.trigger,
            message: data.message,
            pose: data.pose,
            strictness: data.strictness,
          });
        }
      } catch {
        // Ignore transient network errors while offline
      }
    };

    const timer = setInterval(pollPendingNudge, NUDGE_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [
    overlayState.authenticated,
    overlayState.paused,
    overlayState.dnd,
    overlayState.visible,
    overlayState.suppressedByFullscreen,
  ]);

  // Dynamic click-through: transparent areas pass clicks to VS Code / Chrome / Desktop
  const handleMouseEnterInteractive = useCallback(() => {
    setIsHovered(true);
    window.companionDesktop?.setFloatingIgnoreMouse(false);
  }, []);

  const handleMouseLeaveInteractive = useCallback(() => {
    if (isDraggingRef.current) return;
    setIsHovered(false);
    window.companionDesktop?.setFloatingIgnoreMouse(true);
  }, []);

  // Drag-to-reposition using screen coordinates -> Electron main process moveBy
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;
    isDraggingRef.current = true;
    dragMovedRef.current = false;
    lastPointerRef.current = { x: e.screenX, y: e.screenY };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDraggingRef.current) return;
    const dx = e.screenX - lastPointerRef.current.x;
    const dy = e.screenY - lastPointerRef.current.y;
    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
      dragMovedRef.current = true;
    }
    if (dx !== 0 || dy !== 0) {
      lastPointerRef.current = { x: e.screenX, y: e.screenY };
      window.companionDesktop?.moveFloatingWindow(dx, dy);
    }
  }, []);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
  }, []);

  const handleOpenConversation = useCallback(() => {
    if (dragMovedRef.current) return;
    window.companionDesktop?.openMainConversation(nudge?.id);
  }, [nudge?.id]);

  const handleAvatarClick = useCallback(() => {
    if (dragMovedRef.current) return;
    if (overlayState.minimized) {
      setOverlayState((prev) => ({ ...prev, minimized: false }));
      window.companionDesktop?.setFloatingMinimized(false);
      return;
    }
    if (!nudge) {
      setReplyError(null);
      setNudge({
        id: "",
        trigger: "user_initiated",
        message: "Heyyy, what's up? What are you working on right now?",
        pose: "wave",
      });
    }
  }, [nudge, overlayState.minimized]);

  const handleSendInlineReply = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const trimmed = replyText.trim();
      if (!trimmed || isSendingReply) return;

      setIsSendingReply(true);
      setReplyError(null);
      try {
        const res = await authFetch("/api/nikki/nudge/reply", {
          method: "POST",
          body: JSON.stringify({
            message: trimmed,
            nudgeId: nudge?.id || undefined,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
          }),
        });
        const json = await res.json();
        if (!res.ok || !json?.data?.reply) {
          throw new Error(json?.error?.message || "Couldn't reach Nikki right now.");
        }
        setReplyText("");
        setNudge((prev) => ({
          id: prev?.id || "",
          trigger: prev?.trigger || "reply",
          message: json.data.reply,
          pose: json.data.pose || "happy",
        }));
      } catch (err) {
        setReplyError(err instanceof Error ? err.message : "Reply failed.");
      } finally {
        setIsSendingReply(false);
      }
    },
    [replyText, isSendingReply, nudge?.id]
  );

  const handleDismissNudge = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      const id = nudge?.id;
      setNudge(null);
      if (id) {
        try {
          await authFetch("/api/nikki/nudge/dismiss", {
            method: "POST",
            body: JSON.stringify({ nudgeId: id }),
          });
        } catch {
          // best-effort
        }
      }
    },
    [nudge?.id]
  );

  const handleToggleMinimize = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      const next = !overlayState.minimized;
      setOverlayState((prev) => ({ ...prev, minimized: next }));
      window.companionDesktop?.setFloatingMinimized(next);
      if (next) setNudge(null);
    },
    [overlayState.minimized]
  );

  const handleHide = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setNudge(null);
    window.companionDesktop?.hideFloatingNikki();
  }, []);

  const currentPose: CompanionPose = nudge
    ? mapPose(nudge.pose)
    : isHovered
    ? "wave"
    : "idle";

  return (
    <div className="flex h-screen w-screen flex-col items-end justify-end bg-transparent p-3 select-none">
      {/* Contextual Speech Bubble */}
      <AnimatePresence>
        {nudge && !overlayState.minimized && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.94 }}
            onMouseEnter={handleMouseEnterInteractive}
            onMouseLeave={handleMouseLeaveInteractive}
            className="mb-2 w-[300px] rounded-2xl border border-white/15 bg-[#14132a]/95 p-3.5 text-sm text-white shadow-2xl backdrop-blur-md"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="leading-snug text-white/95">{nudge.message}</p>
              <button
                type="button"
                aria-label="Dismiss message"
                onClick={handleDismissNudge}
                className="shrink-0 rounded-full p-1 text-white/50 hover:bg-white/10 hover:text-white"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Inline reply without leaving current desktop window */}
            <form onSubmit={handleSendInlineReply} className="mt-2.5 flex items-center gap-1.5">
              <input
                type="text"
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                placeholder="Reply to Nikki..."
                disabled={isSendingReply}
                className="min-w-0 flex-1 rounded-xl border border-white/15 bg-white/10 px-2.5 py-1.5 text-xs text-white placeholder-white/40 focus:border-violet-400 focus:outline-none"
              />
              <button
                type="submit"
                disabled={isSendingReply || !replyText.trim()}
                aria-label="Send reply"
                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-violet-500 text-white transition hover:bg-violet-400 disabled:opacity-40"
              >
                <Send className="h-3.5 w-3.5" />
              </button>
            </form>
            {replyError && (
              <p className="mt-1 text-[11px] text-rose-300">{replyError}</p>
            )}

            <div className="mt-2 flex items-center justify-between gap-2">
              <span className="text-[11px] text-cyan-300/75">
                {isSendingReply ? "Nikki is thinking..." : "Reply here or expand"}
              </span>
              <button
                type="button"
                onClick={handleOpenConversation}
                className="inline-flex items-center gap-1 rounded-lg bg-white/10 px-2 py-0.5 text-[11px] font-medium text-violet-100 hover:bg-violet-500/30"
              >
                <MessageCircle className="h-3 w-3" />
                Full Chat
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Nikki Avatar + Hover Controls */}
      <div
        onMouseEnter={handleMouseEnterInteractive}
        onMouseLeave={handleMouseLeaveInteractive}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onClick={handleAvatarClick}
        className="group relative flex cursor-grab flex-col items-center active:cursor-grabbing"
      >
        {/* Subtle hover control bar */}
        <div
          className={`mb-1 flex items-center gap-1 rounded-full border border-white/15 bg-[#14132a]/90 px-2 py-0.5 shadow-lg backdrop-blur-md transition-opacity duration-150 ${
            isHovered ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
        >
          <span className="px-1 text-white/50" title="Drag to move Nikki">
            <Move className="h-3 w-3" />
          </span>
          <button
            type="button"
            onClick={handleToggleMinimize}
            title={overlayState.minimized ? "Expand Nikki" : "Minimize Nikki"}
            className="rounded-full p-1 text-white/70 hover:bg-white/10 hover:text-white"
          >
            {overlayState.minimized ? (
              <Maximize2 className="h-3 w-3" />
            ) : (
              <Minimize2 className="h-3 w-3" />
            )}
          </button>
          <button
            type="button"
            onClick={handleHide}
            title="Hide Nikki to tray"
            className="rounded-full p-1 text-white/70 hover:bg-white/10 hover:text-rose-300"
          >
            <X className="h-3 w-3" />
          </button>
        </div>

        {/* Minimized pill vs Full animated CompanionCharacter */}
        {overlayState.minimized ? (
          <div className="flex h-12 w-12 items-center justify-center rounded-full border border-violet-400/40 bg-[#161533]/90 shadow-lg backdrop-blur-md">
            <CompanionCharacter pose="idle" className="h-10 w-10" />
          </div>
        ) : (
          <div className="relative drop-shadow-[0_8px_20px_rgba(124,92,255,0.35)]">
            <CompanionCharacter pose={currentPose} className="h-28 w-28" />
          </div>
        )}
      </div>
    </div>
  );
}
