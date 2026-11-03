"use client";

import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { LoadingState } from "@/components/ui/LoadingState";
import { ErrorState } from "@/components/ui/ErrorState";
import { useToast } from "@/context/ToastContext";
import { authFetch, AuthFetchError } from "@/lib/api/authFetch";
import { parseApiResponse } from "@/lib/api/parseApiResponse";
import {
  CONFIRM_ALL_PHRASE,
  DATA_SCOPES,
  DATA_SCOPE_INFO,
  type DataCounts,
  type DataScope,
  type DeleteScope,
} from "@/lib/data/scopes";

function plural(n: number): string {
  return n === 1 ? "1 item" : `${n} items`;
}

/**
 * Settings → Data & Privacy. Lists what's stored per type, and offers
 * bulk delete per type plus "delete everything". Confirmation tiers:
 * a single item asks inline where it lives; a whole type asks in a
 * dialog that says exactly what goes (and what stays); everything
 * requires typing a phrase. The server re-enforces all of it.
 */
export function DataPrivacySection() {
  const { showToast } = useToast();
  const [counts, setCounts] = useState<DataCounts | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<DeleteScope | null>(null);
  const [typed, setTyped] = useState("");
  const [working, setWorking] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await authFetch("/api/data", { method: "GET" });
      const envelope = await parseApiResponse<DataCounts>(res);
      if (!res.ok || envelope.error || !envelope.data) {
        throw new Error(envelope.error?.message ?? "Couldn't load your data summary.");
      }
      setCounts(envelope.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load your data summary.");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function open(scope: DeleteScope) {
    setPending(scope);
    setTyped("");
    setDialogError(null);
  }

  function close() {
    if (working) return;
    setPending(null);
  }

  async function confirmDelete() {
    if (!pending) return;
    setWorking(true);
    setDialogError(null);
    try {
      const body =
        pending === "all"
          ? { scope: "all", confirmText: typed.trim() }
          : { scope: pending, confirmed: true };
      const res = await authFetch("/api/data", { method: "DELETE", body: JSON.stringify(body) });
      const envelope = await parseApiResponse<unknown>(res);
      if (!res.ok || envelope.error) {
        throw new Error(envelope.error?.message ?? "Couldn't delete that just now.");
      }
      showToast(pending === "all" ? "Everything was deleted." : `${DATA_SCOPE_INFO[pending].label} deleted.`, "success");
      setPending(null);
      await load();
    } catch (err) {
      setDialogError(err instanceof AuthFetchError || err instanceof Error ? err.message : "Couldn't delete that just now.");
    } finally {
      setWorking(false);
    }
  }

  const total = counts ? DATA_SCOPES.reduce((sum, s) => sum + counts[s], 0) : 0;
  const isAll = pending === "all";
  const canConfirm = !working && (!isAll || typed.trim() === CONFIRM_ALL_PHRASE);

  return (
    <section aria-labelledby="data-privacy-heading" className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 id="data-privacy-heading" className="font-display text-xl font-semibold text-ink-primary">
          Data &amp; Privacy
        </h2>
        <p className="text-sm text-ink-muted">
          Everything here is yours. Remove any part of it whenever you like — deletion is permanent.
        </p>
      </div>

      {error && <ErrorState message={error} onRetry={load} />}
      {!error && counts === null && <LoadingState message="Checking what's stored..." />}

      {counts && (
        <>
          <div className="flex flex-col gap-2">
            {DATA_SCOPES.map((scope: DataScope) => (
              <Card key={scope} className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm text-ink-primary">{DATA_SCOPE_INFO[scope].label}</p>
                  <p className="text-xs text-ink-muted">{plural(counts[scope])}</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={counts[scope] === 0}
                  onClick={() => open(scope)}
                  aria-label={`Delete all ${DATA_SCOPE_INFO[scope].label.toLowerCase()}`}
                >
                  Delete all
                </Button>
              </Card>
            ))}
          </div>

          <Card className="flex flex-col gap-3 border border-danger/30">
            <div>
              <p className="text-sm font-medium text-ink-primary">Delete all Companion data</p>
              <p className="text-xs text-ink-muted">
                Removes everything listed above in one go. Your account and your companion's name stay.
              </p>
            </div>
            <div>
              <Button variant="danger" size="sm" disabled={total === 0} onClick={() => open("all")}>
                Delete everything
              </Button>
            </div>
          </Card>
        </>
      )}

      <Modal
        isOpen={pending !== null}
        onClose={close}
        title={isAll ? "Delete all your Companion data?" : pending ? `Delete all ${DATA_SCOPE_INFO[pending].label.toLowerCase()}?` : undefined}
      >
        {pending && (
          <div className="flex flex-col gap-4">
            {isAll ? (
              <>
                <p className="text-sm text-ink-secondary">This will permanently remove:</p>
                <ul className="list-disc space-y-1 pl-5 text-sm text-ink-secondary">
                  {DATA_SCOPES.map((s) => (
                    <li key={s}>
                      {DATA_SCOPE_INFO[s].label}
                      {counts ? ` (${counts[s]})` : ""}
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-ink-muted">
                  Your account and your companion's name stay. This can't be undone.
                </p>
                <Input
                  label={`Type ${CONFIRM_ALL_PHRASE} to confirm`}
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  autoComplete="off"
                  autoFocus
                />
              </>
            ) : (
              <>
                <p className="text-sm text-ink-secondary">
                  {DATA_SCOPE_INFO[pending].removes}
                  {counts ? ` (${plural(counts[pending])})` : ""}
                </p>
                {DATA_SCOPE_INFO[pending].sideEffect && (
                  <p className="text-xs text-ink-muted">{DATA_SCOPE_INFO[pending].sideEffect}</p>
                )}
                <p className="text-xs text-ink-muted">This can't be undone.</p>
              </>
            )}

            {dialogError && <p className="text-sm text-danger">{dialogError}</p>}

            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={close} disabled={working}>
                Keep it
              </Button>
              <Button variant="danger" onClick={confirmDelete} isLoading={working} disabled={!canConfirm}>
                {isAll ? "Delete everything" : "Delete"}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </section>
  );
}