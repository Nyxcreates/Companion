"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { AlertCircle, RefreshCw, Home } from "lucide-react";
import Link from "next/link";

interface SettingsErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function SettingsError({ error, reset }: SettingsErrorProps) {
  useEffect(() => {
    // Log technical error details for production diagnosis
    console.error("[Companion Settings Route Error]:", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 py-16 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-danger/25 bg-danger/10 text-danger shadow-inner">
        <AlertCircle className="h-7 w-7" />
      </div>
      <h2 className="font-display text-xl font-semibold text-ink-primary mb-2">
        Settings hit a snag
      </h2>
      <p className="text-sm text-ink-muted mb-6 max-w-md">
        {error?.message || "Companion encountered an unexpected issue while loading your settings."}
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => reset()}
          className="flex items-center gap-2 text-xs"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          <span>Try loading settings again</span>
        </Button>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3.5 py-1.5 text-xs font-medium text-ink-primary hover:bg-white/10 transition-colors"
        >
          <Home className="h-3.5 w-3.5 text-ink-muted" />
          <span>Return to Dashboard</span>
        </Link>
      </div>
    </div>
  );
}

