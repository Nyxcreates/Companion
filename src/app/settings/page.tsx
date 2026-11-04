"use client";

import React, { Component, useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { LoadingState } from "@/components/ui/LoadingState";
import { ProfileSettingsSection } from "@/components/settings/ProfileSettingsSection";
import { AppearanceWorldSection } from "@/components/settings/AppearanceWorldSection";
import { NotificationSettingsSection } from "@/components/settings/NotificationSettingsSection";
import { DataPrivacySection } from "@/components/settings/DataPrivacySection";
import { AccountSecuritySection } from "@/components/settings/AccountSecuritySection";
import { useAuth } from "@/context/AuthContext";
import { User, Palette, Bell, Shield, Database, AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallbackTitle?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class SettingsErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[Companion Settings Section Error]:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-2xl border border-danger/30 bg-danger/[0.04] p-6 text-center">
          <div className="flex h-12 w-12 mx-auto items-center justify-center rounded-full bg-danger/10 text-danger mb-3">
            <AlertCircle className="h-6 w-6" />
          </div>
          <h3 className="font-display text-base font-semibold text-ink-primary mb-1">
            {this.props.fallbackTitle || "Couldn't load this section"}
          </h3>
          <p className="text-xs text-ink-muted mb-4 max-w-sm mx-auto">
            {this.state.error?.message || "An unexpected error occurred while loading your settings."}
          </p>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => this.setState({ hasError: false, error: null })}
            className="flex items-center gap-1.5 mx-auto text-xs"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Try loading section again</span>
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}

const SETTINGS_SECTIONS = [
  { id: "profile", label: "Profile", icon: <User className="h-3.5 w-3.5" /> },
  { id: "appearance", label: "Appearance", icon: <Palette className="h-3.5 w-3.5" /> },
  { id: "notifications", label: "Nikki Presence", icon: <Bell className="h-3.5 w-3.5" /> },
  { id: "privacy", label: "Data & Privacy", icon: <Database className="h-3.5 w-3.5" /> },
  { id: "account", label: "Account", icon: <Shield className="h-3.5 w-3.5" /> },
];

export default function SettingsPage() {
  const router = useRouter();
  const { firebaseUser, loading: authLoading } = useAuth();

  useEffect(() => {
    if (!authLoading && !firebaseUser) {
      router.replace("/login");
    }
  }, [authLoading, firebaseUser, router]);

  if (authLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-surface-primary">
        <LoadingState message="Loading your preferences..." />
      </main>
    );
  }

  if (!firebaseUser) {
    return null;
  }

  return (
    <AppShell>
      <div className="mx-auto flex max-w-2xl flex-col gap-8">
        <div className="flex flex-col gap-2">
          <h1 className="font-display text-2xl font-semibold text-ink-primary">Settings</h1>
          <p className="text-xs text-ink-muted">
            Manage your companion, appearance, smart notifications, and privacy preferences.
          </p>

          {/* Quick Section Anchor Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-2 no-scrollbar">
            {SETTINGS_SECTIONS.map((sec) => (
              <a
                key={sec.id}
                href={`#${sec.id}`}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-ink-muted hover:border-cyan-400/40 hover:bg-white/10 hover:text-white transition-colors"
              >
                {sec.icon}
                <span>{sec.label}</span>
              </a>
            ))}
          </div>
        </div>

        {/* 1. Profile & Companion */}
        <SettingsErrorBoundary fallbackTitle="Profile & Companion Settings">
          <ProfileSettingsSection />
        </SettingsErrorBoundary>

        {/* 2. Appearance & Worlds */}
        <div id="appearance">
          <SettingsErrorBoundary fallbackTitle="Appearance & Living Worlds">
            <AppearanceWorldSection />
          </SettingsErrorBoundary>
        </div>

        {/* 3. Nikki's Presence & Notifications */}
        <SettingsErrorBoundary fallbackTitle="Nikki's Presence & Notifications">
          <NotificationSettingsSection />
        </SettingsErrorBoundary>

        {/* 4. Data & Privacy */}
        <div id="privacy">
          <SettingsErrorBoundary fallbackTitle="Data & Privacy">
            <DataPrivacySection />
          </SettingsErrorBoundary>
        </div>

        {/* 5. Account & Security */}
        <SettingsErrorBoundary fallbackTitle="Account & Security">
          <AccountSecuritySection />
        </SettingsErrorBoundary>
      </div>
    </AppShell>
  );
}
