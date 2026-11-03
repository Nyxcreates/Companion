"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { CharacterPlaceholder } from "@/components/character/CharacterPlaceholder";
import { FirebaseConfigNotice } from "@/components/dev/FirebaseConfigNotice";
import { signUpWithEmail, signInWithGoogle, getAuthErrorMessage } from "@/lib/firebase/auth";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      await signUpWithEmail(email, password);
      router.push("/onboarding");
    } catch (err) {
      setError(getAuthErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }

  async function handleGoogle() {
    setError(null);
    setIsLoading(true);
    try {
      await signInWithGoogle();
      router.push("/onboarding");
    } catch (err) {
      setError(getAuthErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-6 px-4">
      <CharacterPlaceholder size={64} />
      <Card className="w-full max-w-sm">
        <FirebaseConfigNotice />
        <h1 className="text-lg font-semibold text-ink-primary mb-1">Let's begin</h1>
        <p className="text-sm text-ink-muted mb-6">Your companion is excited to meet you.</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            type="email"
            label="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
          <Input
            type="password"
            label="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="new-password"
            helperText="At least 6 characters."
          />
          {error && <p className="text-sm text-danger">{error}</p>}
          <Button type="submit" isLoading={isLoading}>
            Create my companion
          </Button>
        </form>

        <div className="my-4 flex items-center gap-3 text-xs text-ink-muted">
          <span className="h-px flex-1 bg-white/10" />
          or
          <span className="h-px flex-1 bg-white/10" />
        </div>

        <Button variant="secondary" className="w-full" onClick={handleGoogle} isLoading={isLoading}>
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