"use client";

import React, { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bell,
  CheckCheck,
  Trash2,
  Clock,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Coffee,
  Droplets,
  Moon,
  Heart,
  X,
  Settings,
  Calendar,
  ExternalLink,
} from "lucide-react";
import { useNotifications } from "@/context/NotificationContext";
import type { NotificationItem, NotificationCategory } from "@/types/notification";

function getCategoryIcon(category: NotificationCategory) {
  switch (category) {
    case "task_reminder":
      return <CheckCircle2 className="h-4 w-4 text-emerald-400" />;
    case "goal_deadline":
      return <AlertCircle className="h-4 w-4 text-amber-400" />;
    case "timetable_reminder":
    case "commitment_reminder":
      return <Calendar className="h-4 w-4 text-cyan-400" />;
    case "focus_reminder":
    case "break_reminder":
      return <Coffee className="h-4 w-4 text-teal-400" />;
    case "wellbeing_water_food":
      return <Droplets className="h-4 w-4 text-blue-400" />;
    case "mood_checkin":
      return <Heart className="h-4 w-4 text-pink-400" />;
    case "sleep_reminder":
      return <Moon className="h-4 w-4 text-indigo-400" />;
    case "nikki_supportive":
    default:
      return <Sparkles className="h-4 w-4 text-purple-400" />;
  }
}

function getCategoryLabel(category: NotificationCategory): string {
  switch (category) {
    case "task_reminder":
      return "Task";
    case "goal_deadline":
      return "Goal";
    case "timetable_reminder":
      return "Schedule";
    case "focus_reminder":
      return "Focus";
    case "break_reminder":
      return "Break";
    case "wellbeing_water_food":
      return "Wellbeing";
    case "mood_checkin":
      return "Mood";
    case "sleep_reminder":
      return "Rest";
    case "commitment_reminder":
      return "Commitment";
    case "nikki_supportive":
      return "Nikki";
    default:
      return "Reminder";
  }
}

function formatRelativeTime(isoString: string): string {
  try {
    const diffMs = Date.now() - new Date(isoString).getTime();
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 60) return "Just now";
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDay = Math.floor(diffHr / 24);
    return `${diffDay}d ago`;
  } catch {
    return "";
  }
}

interface NotificationPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function NotificationPanel({ isOpen, onClose }: NotificationPanelProps) {
  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    dismissNotification,
    snoozeNotification,
    clearHistory,
  } = useNotifications();

  const [filter, setFilter] = useState<"all" | "unread">("all");

  const displayedNotifications = notifications.filter((n) => {
    if (filter === "unread") return !n.read;
    return true;
  });

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop on mobile */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-xs md:hidden"
          />

          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.96 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="fixed md:absolute right-2 md:right-0 top-16 md:top-12 z-50 w-[calc(100vw-1rem)] md:w-96 max-h-[80vh] flex flex-col rounded-2xl border border-white/15 bg-slate-900/95 shadow-2xl backdrop-blur-xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 bg-white/[0.02]">
              <div className="flex items-center gap-2">
                <span className="font-display font-semibold text-white text-sm">Notifications</span>
                {unreadCount > 0 && (
                  <span className="rounded-full bg-cyan-500/20 border border-cyan-400/40 px-2 py-0.2 text-[11px] font-semibold text-cyan-300">
                    {unreadCount} new
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1">
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={() => markAllAsRead()}
                    className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-ink-muted hover:bg-white/10 hover:text-white transition-colors"
                    title="Mark all as read"
                  >
                    <CheckCheck className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Mark read</span>
                  </button>
                )}

                {notifications.length > 0 && (
                  <button
                    type="button"
                    onClick={() => clearHistory()}
                    className="rounded-md p-1.5 text-ink-muted hover:bg-white/10 hover:text-white transition-colors"
                    title="Clear notification history"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}

                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-md p-1.5 text-ink-muted hover:bg-white/10 hover:text-white transition-colors"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-2 border-b border-white/5 px-4 py-2 text-xs">
              <button
                type="button"
                onClick={() => setFilter("all")}
                className={`rounded-full px-2.5 py-0.5 transition-colors ${
                  filter === "all"
                    ? "bg-white/15 text-white font-medium"
                    : "text-ink-muted hover:text-white"
                }`}
              >
                All ({notifications.length})
              </button>
              <button
                type="button"
                onClick={() => setFilter("unread")}
                className={`rounded-full px-2.5 py-0.5 transition-colors ${
                  filter === "unread"
                    ? "bg-cyan-500/20 text-cyan-300 font-medium"
                    : "text-ink-muted hover:text-white"
                }`}
              >
                Unread ({unreadCount})
              </button>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto divide-y divide-white/5 p-2 space-y-1">
              {displayedNotifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                  <div className="h-10 w-10 rounded-full bg-white/5 flex items-center justify-center mb-2 text-ink-muted">
                    <Bell className="h-5 w-5" />
                  </div>
                  <p className="text-sm font-medium text-white">All caught up!</p>
                  <p className="text-xs text-ink-muted mt-1 max-w-xs">
                    Nikki will let you know when upcoming tasks, breaks, or routine check-ins need your attention.
                  </p>
                </div>
              ) : (
                displayedNotifications.map((n) => (
                  <div
                    key={n.id}
                    className={`group relative rounded-xl p-3 transition-colors ${
                      n.read ? "bg-transparent hover:bg-white/[0.04]" : "bg-cyan-500/[0.07] hover:bg-cyan-500/[0.12]"
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <div className="mt-0.5 shrink-0 rounded-lg bg-white/10 p-1.5">
                        {getCategoryIcon(n.category)}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] font-medium tracking-wide uppercase text-ink-muted">
                            {getCategoryLabel(n.category)}
                          </span>
                          <span className="text-[10px] text-ink-muted shrink-0">
                            {formatRelativeTime(n.createdAt)}
                          </span>
                        </div>

                        <p className={`text-xs mt-0.5 font-medium ${n.read ? "text-slate-200" : "text-white font-semibold"}`}>
                          {n.title}
                        </p>

                        <p className="text-xs text-ink-secondary mt-1 leading-relaxed">
                          {n.body}
                        </p>

                        {/* Action buttons */}
                        <div className="mt-2.5 flex flex-wrap items-center gap-2">
                          {n.actionUrl && (
                            <Link
                              href={n.actionUrl}
                              onClick={() => {
                                markAsRead(n.id);
                                onClose();
                              }}
                              className="inline-flex items-center gap-1 rounded-md bg-white/10 hover:bg-white/20 px-2 py-1 text-[11px] font-medium text-white transition-colors"
                            >
                              <span>{n.actionLabel || "Open"}</span>
                              <ExternalLink className="h-2.5 w-2.5" />
                            </Link>
                          )}

                          <button
                            type="button"
                            onClick={() => snoozeNotification(n.id, 30)}
                            className="inline-flex items-center gap-1 rounded-md bg-white/5 hover:bg-white/10 px-2 py-1 text-[11px] text-ink-muted hover:text-white transition-colors"
                          >
                            <Clock className="h-2.5 w-2.5" />
                            <span>Snooze 30m</span>
                          </button>

                          {!n.read && (
                            <button
                              type="button"
                              onClick={() => markAsRead(n.id)}
                              className="rounded-md px-2 py-1 text-[11px] text-ink-muted hover:text-white transition-colors"
                            >
                              Mark read
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Dismiss X button */}
                      <button
                        type="button"
                        onClick={() => dismissNotification(n.id)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-ink-muted hover:text-white rounded"
                        title="Dismiss"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-white/10 px-4 py-2.5 bg-white/[0.02] flex items-center justify-between text-xs text-ink-muted">
              <span>Smart contextual alerts</span>
              <Link
                href="/settings#notifications"
                onClick={onClose}
                className="flex items-center gap-1 text-cyan-300 hover:text-cyan-200 transition-colors"
              >
                <Settings className="h-3 w-3" />
                <span>Settings</span>
              </Link>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

