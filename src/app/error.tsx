"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertCircle, RefreshCw, Home } from "lucide-react";
import { Button } from "@/components/ui/Button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error("[Companion Application Error]:", error);
  }, [error]);

  const displayMessage =
    error?.message && !error.message.includes("MONGODB") && !error.message.includes("PRIVATE")
      ? error.message
      : "Companion hit an unexpected snag while loading this page.";

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-surface-primary text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-danger/10 text-danger mb-4">
        <AlertCircle className="h-8 w-8" />
      </div>

      <h1 className="font-display text-xl font-semibold text-ink-primary mb-2">
        Something went wrong
      </h1>

      <p className="max-w-md text-sm text-ink-muted mb-6 leading-relaxed">
        {displayMessage}
      </p>

      <div className="flex items-center gap-3">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => reset()}
          className="flex items-center gap-1.5"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          <span>Try again</span>
        </Button>

        <Link href="/dashboard">
          <Button variant="ghost" size="sm" className="flex items-center gap-1.5">
            <Home className="h-3.5 w-3.5" />
            <span>Return Home</span>
          </Button>
        </Link>
      </div>
    </div>
  );
}
