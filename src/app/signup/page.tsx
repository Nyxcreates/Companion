"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { CharacterPlaceholder } from "@/components/character/CharacterPlaceholder";
import { FirebaseConfigNotice } from "@/components/dev/FirebaseConfigNotice";
import { useAuth } from "@/context/AuthContext";
import {
  signUpWithEmail,
  signInWithGoogle,
  handleGoogleRedirectResult,
  getAuthErrorMessage,
} from "@/lib/firebase/auth";

export default function SignupPage() {
  const router = useRouter();
  const { firebaseUser, loading: authLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // If user is already authenticated, route them forward
  useEffect(() => {
    if (!authLoading && firebaseUser) {
      router.replace("/onboarding");
    }
  }, [firebaseUser, authLoading, router]);

  // Handle Google redirect return silently if one completed — never show error on fresh mount
  useEffect(() => {
    handleGoogleRedirectResult()
      .then((result) => {
        if (result?.user) {
          router.replace("/onboarding");
        }
      })
      .catch((err) => {
        console.debug("[Companion Auth] No redirect session to resolve:", err);
      });
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setEmailLoading(true);
    try {
      await signUpWithEmail(email, password);
      router.push("/onboarding");
    } catch (err) {
      console.error("[Companion Auth] Signup failed:", err);
      setError(getAuthErrorMessage(err));
    } finally {
      setEmailLoading(false);
    }
  }

  async function handleGoogle() {
    setError(null);
    setGoogleLoading(true);
    try {
      const result = await signInWithGoogle();
      if (result?.user) {
        router.push("/onboarding");
      }
    } catch (err) {
      console.error("[Companion Auth] Google sign-up failed:", err);
      setError(getAuthErrorMessage(err));
    } finally {
      setGoogleLoading(false);
    }
  }

  const isAnyLoading = emailLoading || googleLoading;

  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-6 px-4">
      <CharacterPlaceholder size={64} />
      <Card className="w-full max-w-sm">
        <FirebaseConfigNotice />
        <h1 className="text-lg font-semibold text-ink-primary mb-1">
          Let&apos;s begin
        </h1>
        <p className="text-sm text-ink-muted mb-6">
          Your companion is excited to meet you.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            type="email"
            label="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            disabled={isAnyLoading}
          />

          {/* Password with visibility toggle */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-ink-secondary">Password</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="new-password"
                disabled={isAnyLoading}
                className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-2.5 pr-11 text-ink-primary placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-accent-secondary/50 focus:border-accent-secondary/50 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                tabIndex={-1}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink-primary transition-colors"
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
            <p className="text-sm text-ink-muted/80">At least 6 characters.</p>
          </div>

          {error && <p className="text-sm text-danger">{error}</p>}

          <Button
            type="submit"
            isLoading={emailLoading}
            disabled={isAnyLoading}
            className="w-full"
          >
            Create my companion
          </Button>
        </form>

        <div className="my-4 flex items-center gap-3 text-xs text-ink-muted">
          <span className="h-px flex-1 bg-white/10" />
          or
          <span className="h-px flex-1 bg-white/10" />
        </div>

        <Button
          variant="secondary"
          className="w-full"
          onClick={handleGoogle}
          isLoading={googleLoading}
          disabled={isAnyLoading}
        >
          {!googleLoading && (
            <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
          )}
          Continue with Google
        </Button>

        <p className="mt-6 text-center text-sm text-ink-muted">
          Already have a companion?{" "}
          <Link href="/login" className="text-accent-secondary hover:underline">
            Log in
          </Link>
        </p>
      </Card>
    </main>
  );
}
