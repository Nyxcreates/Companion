"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { LoadingState } from "@/components/ui/LoadingState";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/context/ToastContext";

const swatches = [
  { label: "Surface Primary", className: "bg-surface-primary" },
  { label: "Surface Secondary", className: "bg-surface-secondary" },
  { label: "Surface Elevated", className: "bg-surface-elevated" },
  { label: "Accent Primary", className: "bg-accent-primary" },
  { label: "Accent Secondary", className: "bg-accent-secondary" },
  { label: "Accent Emerald", className: "bg-accent-emerald" },
  { label: "Accent Sunset", className: "bg-accent-sunset" },
  { label: "Accent Rose", className: "bg-accent-rose" },
  { label: "Accent Gold", className: "bg-accent-gold" },
  { label: "Success", className: "bg-success" },
  { label: "Warning", className: "bg-warning" },
  { label: "Danger", className: "bg-danger" },
  { label: "Mood Joy", className: "bg-mood-joy" },
  { label: "Mood Calm", className: "bg-mood-calm" },
  { label: "Mood Proud", className: "bg-mood-proud" },
  { label: "Mood Tender", className: "bg-mood-tender" },
  { label: "Mood Low", className: "bg-mood-low" },
  { label: "Mood Stressed", className: "bg-mood-stressed" },
];

export default function StyleGuidePage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const { showToast } = useToast();

  return (
    <main className="mx-auto max-w-4xl px-4 py-12 md:py-16">
      <header className="mb-12">
        <p className="text-sm text-accent-secondary">Dev only — not linked in navigation</p>
        <h1 className="mt-1 text-3xl font-semibold">Companion Design System</h1>
        <p className="mt-2 text-ink-secondary">
          A living reference for the visual language: colors, type, spacing, components and motion.
        </p>
      </header>

      <section className="mb-14">
        <h2 className="mb-4 text-xl font-semibold">Color System</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {swatches.map((s) => (
            <div key={s.label} className="glass-panel rounded-xl p-3">
              <div className={`h-14 w-full rounded-lg ${s.className}`} />
              <p className="mt-2 text-xs text-ink-muted">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-14">
        <h2 className="mb-4 text-xl font-semibold">Typography</h2>
        <div className="glass-card space-y-3 p-6">
          <p className="text-4xl font-semibold">Aa — Display 4xl</p>
          <p className="text-2xl font-semibold">Aa — Display 2xl</p>
          <p className="text-lg">Aa — Body lg</p>
          <p className="text-base text-ink-secondary">Aa — Body base, secondary</p>
          <p className="text-sm text-ink-muted">Aa — Body sm, muted</p>
        </div>
      </section>

      <section className="mb-14">
        <h2 className="mb-4 text-xl font-semibold">Buttons</h2>
        <div className="flex flex-wrap gap-3">
          <Button variant="primary">Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Danger</Button>
          <Button variant="primary" disabled>
            Disabled
          </Button>
          <Button variant="primary" isLoading>
            Loading
          </Button>
        </div>
      </section>

      <section className="mb-14">
        <h2 className="mb-4 text-xl font-semibold">Inputs</h2>
        <div className="grid max-w-xl gap-4 sm:grid-cols-2">
          <Input
            label="Default"
            placeholder="Type something…"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
          />
          <Input label="With helper text" placeholder="you@example.com" helperText="We'll never share this." />
          <Input label="With error" placeholder="Password" error="That password is too short." />
          <Input label="Disabled" placeholder="Can't touch this" disabled />
        </div>
      </section>

      <section className="mb-14">
        <h2 className="mb-4 text-xl font-semibold">Cards</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <h3 className="font-semibold">Default card</h3>
            <p className="mt-1 text-sm text-ink-secondary">Glass surface, soft shadow.</p>
          </Card>
          <Card variant="elevated" hoverable>
            <h3 className="font-semibold">Elevated + hoverable</h3>
            <p className="mt-1 text-sm text-ink-secondary">Lifts gently on hover.</p>
          </Card>
        </div>
      </section>

      <section className="mb-14">
        <h2 className="mb-4 text-xl font-semibold">Dialog</h2>
        <Button variant="secondary" onClick={() => setModalOpen(true)}>
          Open modal
        </Button>
        <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="A gentle dialog">
          <p className="text-sm text-ink-secondary">Modals fade and scale in softly — nothing snaps or jumps.</p>
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={() => setModalOpen(false)}>
              Confirm
            </Button>
          </div>
        </Modal>
      </section>

      <section className="mb-14">
        <h2 className="mb-4 text-xl font-semibold">Toasts</h2>
        <div className="flex flex-wrap gap-3">
          <Button size="sm" variant="secondary" onClick={() => showToast("Saved quietly in the background.", "info")}>
            Info toast
          </Button>
          <Button size="sm" variant="secondary" onClick={() => showToast("Nice work — mission complete.", "success")}>
            Success toast
          </Button>
          <Button size="sm" variant="secondary" onClick={() => showToast("We're running a little behind.", "warning")}>
            Warning toast
          </Button>
          <Button size="sm" variant="secondary" onClick={() => showToast("Something didn't save.", "danger")}>
            Danger toast
          </Button>
        </div>
      </section>

      <section className="mb-14">
        <h2 className="mb-4 text-xl font-semibold">Loading, Empty &amp; Error States</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <LoadingState message="Getting things ready…" />
          </Card>
          <Card>
            <EmptyState title="Nothing here yet" message="Looks peaceful today." />
          </Card>
          <Card>
            <ErrorState onRetry={() => showToast("Retried.", "info")} />
          </Card>
        </div>
      </section>

      <section className="mb-14">
        <h2 className="mb-4 text-xl font-semibold">Skeleton</h2>
        <Card className="space-y-3">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </Card>
      </section>
    </main>
  );
}