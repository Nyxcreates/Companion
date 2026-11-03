"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { CharacterPlaceholder } from "@/components/character/CharacterPlaceholder";
import { FirebaseConfigNotice } from "@/components/dev/FirebaseConfigNotice";
import { signInWithEmail, signInWithGoogle, getAuthErrorMessage } from "@/lib/firebase/auth";

export default function LoginPage() {
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
      await signInWithEmail(email, password);
      router.push("/dashboard");
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
      router.push("/dashboard");
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
        <h1 className="text-lg font-semibold text-ink-primary mb-1">Welcome back</h1>
        <p className="text-sm text-ink-muted mb-6">Your companion has been waiting.</p>

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
            autoComplete="current-password"
          />
          {error && <p className="text-sm text-danger">{error}</p>}
          <Button type="submit" isLoading={isLoading}>
            Continue
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
          New here?{" "}
          <Link href="/signup" className="text-accent-secondary hover:underline">
            Create your companion
          </Link>
        </p>
      </Card>
    </main>
  );
}