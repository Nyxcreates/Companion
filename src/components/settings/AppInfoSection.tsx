"use client";

import React, { useState } from "react";
import {
  Download,
  Smartphone,
  Laptop,
  CheckCircle2,
  HardDrive,
  Info,
  ExternalLink,
  Sparkles,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { usePwa } from "@/context/PwaContext";

export function AppInfoSection() {
  const { isInstallable, isInstalled, installApp, swRegistered } = usePwa();
  const [installing, setInstalling] = useState(false);
  const [activeTab, setActiveTab] = useState<"android" | "laptop">("android");

  const handleInstallClick = async () => {
    setInstalling(true);
    try {
      await installApp();
    } finally {
      setInstalling(false);
    }
  };

  return (
    <Card id="app-info" className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between border-b border-white/10 pb-4">
        <div>
          <h2 className="font-display text-lg font-semibold text-ink-primary flex items-center gap-2">
            <Download className="h-5 w-5 text-cyan-400" />
            App &amp; Install Information
          </h2>
          <p className="text-xs text-ink-muted mt-0.5">
            Install Companion as an actual app on your Oppo A96 Android phone and Windows laptop.
          </p>
        </div>
        <div>
          {isInstalled ? (
            <span className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium bg-emerald-400/10 border border-emerald-400/20 px-3 py-1 rounded-full">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Installed App
            </span>
          ) : isInstallable ? (
            <span className="flex items-center gap-1.5 text-xs text-cyan-300 font-medium bg-cyan-400/10 border border-cyan-400/20 px-3 py-1 rounded-full">
              <Sparkles className="h-3.5 w-3.5" />
              Ready to Install
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-xs text-ink-muted bg-white/5 border border-white/10 px-3 py-1 rounded-full">
              Web Browser
            </span>
          )}
        </div>
      </div>

      {/* 1-Click Install Button if installable prompt is ready */}
      {isInstallable && !isInstalled && (
        <div className="rounded-xl border border-cyan-400/30 bg-gradient-to-r from-cyan-950/40 to-slate-900/60 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-cyan-400" />
              Install Companion Now
            </h3>
            <p className="text-xs text-ink-muted mt-0.5">
              Adds Companion directly to your home screen or desktop taskbar without browser borders.
            </p>
          </div>
          <Button
            size="sm"
            onClick={handleInstallClick}
            isLoading={installing}
            className="flex items-center gap-2 text-xs shrink-0"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Install App</span>
          </Button>
        </div>
      )}

      {/* Architecture & Offline State */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3.5 flex items-start gap-3">
          <div className="mt-0.5 rounded-lg bg-cyan-400/10 p-2 text-cyan-400">
            <HardDrive className="h-4 w-4" />
          </div>
          <div>
            <p className="font-semibold text-white">Offline Cache &amp; Fallback</p>
            <p className="text-ink-muted text-[11px] mt-0.5 leading-snug">
              {swRegistered
                ? "Service worker active. Static shell and offline page are cached safely without saving private data."
                : "Service worker initializing..."}
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3.5 flex items-start gap-3">
          <div className="mt-0.5 rounded-lg bg-purple-400/10 p-2 text-purple-400">
            <Info className="h-4 w-4" />
          </div>
          <div>
            <p className="font-semibold text-white">Unified Cloud Storage</p>
            <p className="text-ink-muted text-[11px] mt-0.5 leading-snug">
              The installed app shares the exact same Vercel URL, MongoDB database, and Firebase session.
            </p>
          </div>
        </div>
      </div>

      {/* Step-by-Step Installation Guides */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-ink-primary">
            Installation Guide by Device
          </h3>
          <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 p-1 text-xs">
            <button
              type="button"
              onClick={() => setActiveTab("android")}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-colors ${
                activeTab === "android"
                  ? "bg-cyan-500/20 text-cyan-300 font-medium"
                  : "text-ink-muted hover:text-white"
              }`}
            >
              <Smartphone className="h-3.5 w-3.5" />
              <span>Oppo A96 (Android)</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("laptop")}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-colors ${
                activeTab === "laptop"
                  ? "bg-cyan-500/20 text-cyan-300 font-medium"
                  : "text-ink-muted hover:text-white"
              }`}
            >
              <Laptop className="h-3.5 w-3.5" />
              <span>Laptop (Chrome / Edge)</span>
            </button>
          </div>
        </div>

        {activeTab === "android" ? (
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-xs space-y-3">
            <p className="font-medium text-white">How to install Companion on your Oppo A96:</p>
            <ol className="list-decimal list-inside space-y-2 text-ink-muted leading-relaxed">
              <li>
                Open <span className="text-cyan-300">Chrome</span> or your preferred browser on your Oppo A96 and navigate to your Companion website.
              </li>
              <li>
                Tap the <strong className="text-white">Three dots (⋮)</strong> menu in the top-right corner of Chrome.
              </li>
              <li>
                Tap <strong className="text-white">&ldquo;Install app&rdquo;</strong> (or &ldquo;Add to Home screen&rdquo;).
              </li>
              <li>
                Confirm the prompt: tap <strong className="text-white">Install</strong>.
              </li>
              <li>
                Companion will appear on your Oppo A96 home screen and app drawer with the Companion icon and launch full-screen like a native app.
              </li>
            </ol>
          </div>
        ) : (
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-xs space-y-3">
            <p className="font-medium text-white">How to install Companion on your Laptop:</p>
            <ol className="list-decimal list-inside space-y-2 text-ink-muted leading-relaxed">
              <li>
                Open this website in <span className="text-cyan-300">Google Chrome</span> or <span className="text-cyan-300">Microsoft Edge</span>.
              </li>
              <li>
                Look at the right side of the URL address bar: click the <strong className="text-white">Install icon (⊕ or computer display)</strong>.
              </li>
              <li>
                Or click the <strong className="text-white">Three dots (⋮)</strong> menu → <strong className="text-white">&ldquo;Install Companion&rdquo;</strong> (or &ldquo;Apps → Install Companion&rdquo;).
              </li>
              <li>
                Click <strong className="text-white">Install</strong> in the confirmation box.
              </li>
              <li>
                Companion opens in its own standalone window without browser tabs or address bar, and can be pinned to your Windows Taskbar and Start Menu.
              </li>
            </ol>
          </div>
        )}
      </div>
    </Card>
  );
}

