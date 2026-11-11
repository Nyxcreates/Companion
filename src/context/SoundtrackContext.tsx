"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import {
  getSoundtrackEngine,
  type AudioTrackId,
  type AmbientSoundtrackEngine,
} from "@/lib/audio/soundtrack";
import { useWorldTheme } from "./WorldThemeContext";
import { usePathname } from "next/navigation";

interface SoundtrackContextValue {
  isMuted: boolean;
  volume: number;
  activeTrack: AudioTrackId | null;
  toggleMute: () => boolean;
  setMuted: (muted: boolean) => void;
  setVolume: (volume: number) => void;
  playTrack: (trackId: AudioTrackId) => void;
  stopTrack: () => void;
  engine: AmbientSoundtrackEngine;
}

const SoundtrackContext = createContext<SoundtrackContextValue | undefined>(undefined);

export function SoundtrackProvider({ children }: { children: ReactNode }) {
  const engine = getSoundtrackEngine();
  const [isMuted, setIsMutedState] = useState<boolean>(() => engine.getIsMuted());
  const [volume, setVolumeState] = useState<number>(() => engine.getVolume());
  const [activeTrack, setActiveTrack] = useState<AudioTrackId | null>(() => engine.getCurrentTrack());

  const { livingEnvironment } = useWorldTheme();
  const pathname = usePathname();

  const setMuted = useCallback(
    (muted: boolean) => {
      engine.setMuted(muted);
      setIsMutedState(muted);
      setActiveTrack(engine.getCurrentTrack());
    },
    [engine]
  );

  const toggleMute = useCallback(() => {
    const nextMuted = engine.toggleMute();
    setIsMutedState(nextMuted);
    setActiveTrack(engine.getCurrentTrack());
    return nextMuted;
  }, [engine]);

  const setVolume = useCallback(
    (vol: number) => {
      engine.setVolume(vol);
      setVolumeState(vol);
    },
    [engine]
  );

  const playTrack = useCallback(
    (trackId: AudioTrackId) => {
      engine.play(trackId);
      setActiveTrack(trackId);
      setIsMutedState(engine.getIsMuted());
    },
    [engine]
  );

  const stopTrack = useCallback(() => {
    engine.stop();
    setActiveTrack(null);
  }, [engine]);

  // When ambient music is active and user browses to dashboard/plan/focus/settings,
  // automatically align ambient track with the current living environment unless on intro page
  useEffect(() => {
    if (isMuted) return;

    // Do not override intro scene soundtrack when on landing/intro page
    if (pathname === "/" || pathname === "/onboarding") return;

    if (livingEnvironment) {
      engine.play(livingEnvironment as AudioTrackId);
      setActiveTrack(livingEnvironment as AudioTrackId);
    }
  }, [livingEnvironment, isMuted, pathname, engine]);

  return (
    <SoundtrackContext.Provider
      value={{
        isMuted,
        volume,
        activeTrack,
        toggleMute,
        setMuted,
        setVolume,
        playTrack,
        stopTrack,
        engine,
      }}
    >
      {children}
    </SoundtrackContext.Provider>
  );
}

export function useSoundtrack(): SoundtrackContextValue {
  const ctx = useContext(SoundtrackContext);
  if (!ctx) {
    throw new Error("useSoundtrack must be used within a SoundtrackProvider");
  }
  return ctx;
}

