"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Shield, KeyRound, LogOut, Trash2, AlertTriangle, Mail } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { resetPassword } from "@/lib/firebase/auth";
import { authFetch } from "@/lib/api/authFetch";

const CONFIRM_DELETE_PHRASE = "DELETE MY ACCOUNT";

export function AccountSecuritySection() {
  const router = useRouter();
  const { firebaseUser, signOut } = useAuth();
  const { showToast } = useToast();

  const [isResetSending, setIsResetSending] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  // Logout modal state
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Delete account modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteInput, setDeleteInput] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const email = firebaseUser?.email ?? "Signed in";
  const isGoogle = firebaseUser?.providerData?.some(
    (p) => p.providerId === "google.com"
  );

  async function handleSendReset() {
    if (!firebaseUser?.email) return;
    setIsResetSending(true);
    try {
      await resetPassword(firebaseUser.email);
      setResetSent(true);
      showToast("Password reset email sent to your inbox!", "success");
    } catch {
      showToast("Could not send password reset email.", "danger");
    } finally {
      setIsResetSending(false);
    }
  }

  async function handleConfirmLogout() {
    setIsLoggingOut(true);
    try {
      await signOut();
      router.push("/login");
    } catch {
      showToast("Could not log out. Please try again.", "danger");
      setIsLoggingOut(false);
    }
  }

  async function handleConfirmDelete() {
    if (deleteInput.trim() !== CONFIRM_DELETE_PHRASE) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      const res = await authFetch("/api/user/profile", {
        method: "DELETE",
        body: JSON.stringify({ confirmText: CONFIRM_DELETE_PHRASE }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json?.error?.message ?? "Failed to delete account.");
      }

      // Try deleting the firebase user account as well if supported
      try {
        await firebaseUser?.delete();
      } catch {
        // If re-authentication is required by Firebase, signing out is the fallback
        await signOut();
      }

      showToast("Your account and all data were deleted.", "success");
      router.push("/login");
    } catch (err) {
      setDeleteError(
        err instanceof Error ? err.message : "Failed to delete account."
      );
      setIsDeleting(false);
    }
  }

  return (
    <Card id="account" className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between border-b border-white/10 pb-4">
        <div>
          <h2 className="font-display text-lg font-semibold text-ink-primary flex items-center gap-2">
            <Shield className="h-5 w-5 text-indigo-400" />
            Account &amp; Security
          </h2>
          <p className="text-xs text-ink-muted mt-0.5">
            Manage your credentials, login sessions, and permanent account status.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-5">
        {/* Email & Auth Provider */}
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <p className="text-xs text-ink-muted uppercase tracking-wider font-mono">
              Signed in as
            </p>
            <p className="text-sm font-semibold text-ink-primary mt-0.5">{email}</p>
            <p className="text-xs text-ink-muted mt-0.5">
              Provider: {isGoogle ? "Google Account" : "Email & Password"}
            </p>
          </div>

          {!isGoogle && (
            <div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSendReset}
                isLoading={isResetSending}
                disabled={resetSent}
                className="flex items-center gap-1.5 text-xs"
              >
                <KeyRound className="h-3.5 w-3.5" />
                <span>{resetSent ? "Reset Email Sent" : "Reset Password"}</span>
              </Button>
            </div>
          )}
        </div>

        {/* Session Management */}
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-ink-primary">Sign Out</p>
            <p className="text-xs text-ink-muted mt-0.5">
              Securely end your active session on this device.
            </p>
          </div>
          <div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowLogoutModal(true)}
              className="flex items-center gap-1.5 text-xs"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Log out</span>
            </Button>
          </div>
        </div>

        {/* Danger Zone: Account Deletion */}
        <div className="rounded-xl border border-danger/30 bg-danger/[0.03] p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-danger flex items-center gap-1.5">
              <AlertTriangle className="h-4 w-4" />
              Delete Account
            </p>
            <p className="text-xs text-ink-muted mt-0.5 max-w-md">
              Permanently delete your profile, Nikki conversations, memory capsules, timetable, and all associated personal data.
            </p>
          </div>
          <div>
            <Button
              variant="danger"
              size="sm"
              onClick={() => {
                setShowDeleteModal(true);
                setDeleteInput("");
                setDeleteError(null);
              }}
              className="flex items-center gap-1.5 text-xs"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Delete Account</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Logout Confirmation Modal */}
      <Modal
        isOpen={showLogoutModal}
        onClose={() => !isLoggingOut && setShowLogoutModal(false)}
        title="Sign out of Companion?"
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-ink-secondary">
            Are you sure you want to log out? Your conversations, timetable, and settings will remain safe until you return.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowLogoutModal(false)}
              disabled={isLoggingOut}
            >
              Stay Logged In
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleConfirmLogout}
              isLoading={isLoggingOut}
            >
              Yes, Log Out
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Account Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => !isDeleting && setShowDeleteModal(false)}
        title="Permanently Delete Your Account?"
      >
        <div className="flex flex-col gap-4">
          <div className="rounded-xl border border-danger/40 bg-danger/10 p-3 text-xs text-danger leading-relaxed">
            ⚠️ This action is permanent and cannot be undone. All your chat history with Nikki, memory garden items, saved goals, tasks, and daily timetable will be completely erased.
          </div>

          <p className="text-sm text-ink-secondary">
            To proceed, type <span className="font-mono font-bold text-danger">{CONFIRM_DELETE_PHRASE}</span> below:
          </p>

          <Input
            value={deleteInput}
            onChange={(e) => setDeleteInput(e.target.value)}
            placeholder={CONFIRM_DELETE_PHRASE}
            disabled={isDeleting}
            autoFocus
          />

          {deleteError && <p className="text-xs text-danger">{deleteError}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowDeleteModal(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={handleConfirmDelete}
              isLoading={isDeleting}
              disabled={deleteInput.trim() !== CONFIRM_DELETE_PHRASE}
            >
              Permanently Delete
            </Button>
          </div>
        </div>
      </Modal>
    </Card>
  );
}

