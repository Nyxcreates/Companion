"use client";

export type AudioTrackId =
  | "intro"
  | "cosmic-dream"
  | "enchanted-garden"
  | "abyssal-dreams"
  | "midnight-academia"
  | "aurora-sanctuary"
  | "autumn-reverie"
  | "cloud-kingdom"
  | "moonlit-sakura";

export interface ThemeChordConfig {
  freqs: number[];
  filterCutoff: number;
  filterQ: number;
  lfoRate: number;
  lfoDepth: number;
}

const THEME_CHORDS: Record<AudioTrackId, ThemeChordConfig> = {
  intro: {
    freqs: [130.81, 196.0, 329.63], // C3, G3, E4
    filterCutoff: 380,
    filterQ: 1.2,
    lfoRate: 0.1,
    lfoDepth: 60,
  },
  "cosmic-dream": {
    freqs: [110.0, 164.81, 329.63, 659.25], // A2, E3, E4, E5 (open cosmic fifths)
    filterCutoff: 340,
    filterQ: 2.2,
    lfoRate: 0.08,
    lfoDepth: 90,
  },
  "enchanted-garden": {
    freqs: [174.61, 220.0, 261.63, 349.23], // F3, A3, C4, F4 (gentle meadow major)
    filterCutoff: 440,
    filterQ: 1.0,
    lfoRate: 0.12,
    lfoDepth: 70,
  },
  "abyssal-dreams": {
    freqs: [73.42, 110.0, 146.83, 220.0], // D2, A2, D3, A3 (deep submarine resonance)
    filterCutoff: 260,
    filterQ: 2.8,
    lfoRate: 0.05,
    lfoDepth: 100,
  },
  "midnight-academia": {
    freqs: [110.0, 164.81, 261.63, 329.63], // A2, E3, C4, E4 (warm scholarly minor)
    filterCutoff: 320,
    filterQ: 1.4,
    lfoRate: 0.09,
    lfoDepth: 50,
  },
  "aurora-sanctuary": {
    freqs: [164.81, 246.94, 369.99, 493.88], // E3, B3, F#4, B4 (crisp crystalline starlight)
    filterCutoff: 580,
    filterQ: 1.8,
    lfoRate: 0.07,
    lfoDepth: 120,
  },
  "autumn-reverie": {
    freqs: [98.0, 146.83, 196.0, 246.94], // G2, D3, G3, B3 (warm amber twilight)
    filterCutoff: 360,
    filterQ: 1.2,
    lfoRate: 0.11,
    lfoDepth: 60,
  },
  "cloud-kingdom": {
    freqs: [146.83, 220.0, 293.66, 369.99], // D3, A3, D4, F#4 (soaring celestial major)
    filterCutoff: 520,
    filterQ: 1.5,
    lfoRate: 0.14,
    lfoDepth: 80,
  },
  "moonlit-sakura": {
    freqs: [146.83, 196.0, 293.66, 392.0], // D3, G3, D4, G4 (tranquil pentatonic)
    filterCutoff: 400,
    filterQ: 1.3,
    lfoRate: 0.09,
    lfoDepth: 65,
  },
};

export class AmbientSoundtrackEngine {
  private audioCtx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private activeOscs: OscillatorNode[] = [];
  private activeFilter: BiquadFilterNode | null = null;
  private activeLfo: OscillatorNode | null = null;
  private audioElement: HTMLAudioElement | null = null;
  private currentTrackId: AudioTrackId | null = null;
  private volume: number = 0.5;
  private isMuted: boolean = true;
  private isUserInteracted: boolean = false;

  constructor() {
    if (typeof window !== "undefined") {
      try {
        const storedMute = localStorage.getItem("companion:audio_muted");
        if (storedMute !== null) this.isMuted = storedMute === "true";
        const storedVol = localStorage.getItem("companion:audio_volume");
        if (storedVol !== null) this.volume = Math.max(0, Math.min(1, parseFloat(storedVol)));
      } catch {
        // Safe localStorage fallback
      }
    }
  }

  public getVolume(): number {
    return this.volume;
  }

  public getIsMuted(): boolean {
    return this.isMuted;
  }

  public getCurrentTrack(): AudioTrackId | null {
    return this.currentTrackId;
  }

  public setVolume(vol: number): void {
    this.volume = Math.max(0, Math.min(1, vol));
    try {
      localStorage.setItem("companion:audio_volume", this.volume.toString());
    } catch {}

    if (this.masterGain && this.audioCtx && !this.isMuted) {
      const targetGain = this.volume * 0.12;
      this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, this.audioCtx.currentTime);
      this.masterGain.gain.linearRampToValueAtTime(targetGain, this.audioCtx.currentTime + 0.1);
    }
    if (this.audioElement && !this.isMuted) {
      this.audioElement.volume = this.volume;
    }
  }

  public setMuted(muted: boolean): void {
    this.isMuted = muted;
    try {
      localStorage.setItem("companion:audio_muted", this.isMuted.toString());
    } catch {}

    if (this.isMuted) {
      this.fadeToSilence();
    } else {
      this.isUserInteracted = true;
      if (this.currentTrackId) {
        this.play(this.currentTrackId);
      }
    }
  }

  public toggleMute(): boolean {
    this.setMuted(!this.isMuted);
    return this.isMuted;
  }

  private initAudioContext(): AudioContext | null {
    if (this.audioCtx) return this.audioCtx;
    if (typeof window === "undefined") return null;

    try {
      const AudioCtxClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtxClass) return null;

      const ctx = new AudioCtxClass();
      const master = ctx.createGain();
      master.gain.setValueAtTime(0.0001, ctx.currentTime);
      master.connect(ctx.destination);

      this.audioCtx = ctx;
      this.masterGain = master;
      return ctx;
    } catch {
      return null;
    }
  }

  public async play(trackId: AudioTrackId): Promise<void> {
    this.currentTrackId = trackId;
    if (this.isMuted) return;

    this.isUserInteracted = true;
    const ctx = this.initAudioContext();
    if (!ctx || !this.masterGain) return;

    if (ctx.state === "suspended") {
      try {
        await ctx.resume();
      } catch {
        // Autoplay policy prevented immediate resume
        return;
      }
    }

    // First attempt to stream real audio file from /audio/<trackId>.mp3
    const realAudioLoaded = await this.tryPlayAudioFile(trackId);
    if (realAudioLoaded) return;

    // Fallback: Soft procedural ambient synthesizer
    this.playSynthesizedPad(trackId);
  }

  private async tryPlayAudioFile(trackId: AudioTrackId): Promise<boolean> {
    if (typeof window === "undefined") return false;
    const src = `/audio/${trackId}.mp3`;

    return new Promise((resolve) => {
      try {
        const audio = new Audio();
        audio.src = src;
        audio.loop = true;
        audio.volume = this.volume;

        audio.addEventListener(
          "canplaythrough",
          async () => {
            try {
              this.stopSynthesis();
              if (this.audioElement) {
                this.audioElement.pause();
                this.audioElement = null;
              }
              await audio.play();
              this.audioElement = audio;
              resolve(true);
            } catch {
              resolve(false);
            }
          },
          { once: true }
        );

        audio.addEventListener(
          "error",
          () => {
            resolve(false);
          },
          { once: true }
        );

        audio.load();
      } catch {
        resolve(false);
      }
    });
  }

  private playSynthesizedPad(trackId: AudioTrackId): void {
    const ctx = this.audioCtx;
    const master = this.masterGain;
    if (!ctx || !master) return;

    this.stopSynthesis();

    const config = THEME_CHORDS[trackId] ?? THEME_CHORDS["cosmic-dream"];

    // Main resonant filter
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(config.filterCutoff, ctx.currentTime);
    filter.Q.setValueAtTime(config.filterQ, ctx.currentTime);

    // Slow atmospheric LFO for breathing filter modulation
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.type = "sine";
    lfo.frequency.setValueAtTime(config.lfoRate, ctx.currentTime);
    lfoGain.gain.setValueAtTime(config.lfoDepth, ctx.currentTime);
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);
    lfo.start();

    // Harmonics
    const oscs: OscillatorNode[] = [];
    config.freqs.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const oscGain = ctx.createGain();
      // Use sine for warm sub/mid tones, triangle for gentle top shine
      osc.type = idx === config.freqs.length - 1 ? "triangle" : "sine";
      osc.frequency.setValueAtTime(freq, ctx.currentTime);

      const amp = idx === 0 ? 0.35 : idx === 1 ? 0.28 : 0.18;
      oscGain.gain.setValueAtTime(amp, ctx.currentTime);

      osc.connect(oscGain);
      oscGain.connect(filter);
      osc.start();
      oscs.push(osc);
    });

    filter.connect(master);

    // Fade master gain smoothly into target volume
    const targetGain = this.volume * 0.12;
    master.gain.setValueAtTime(master.gain.value, ctx.currentTime);
    master.gain.linearRampToValueAtTime(targetGain, ctx.currentTime + 1.2);

    this.activeOscs = oscs;
    this.activeFilter = filter;
    this.activeLfo = lfo;
  }

  private fadeToSilence(): void {
    if (this.masterGain && this.audioCtx) {
      const ctx = this.audioCtx;
      this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, ctx.currentTime);
      this.masterGain.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + 0.8);
      setTimeout(() => {
        this.stopSynthesis();
      }, 850);
    }
    if (this.audioElement) {
      this.audioElement.pause();
    }
  }

  private stopSynthesis(): void {
    this.activeOscs.forEach((osc) => {
      try {
        osc.stop();
        osc.disconnect();
      } catch {}
    });
    this.activeOscs = [];

    if (this.activeLfo) {
      try {
        this.activeLfo.stop();
        this.activeLfo.disconnect();
      } catch {}
      this.activeLfo = null;
    }
    if (this.activeFilter) {
      try {
        this.activeFilter.disconnect();
      } catch {}
      this.activeFilter = null;
    }
  }

  public stop(): void {
    this.fadeToSilence();
    this.currentTrackId = null;
  }
}

let singletonEngine: AmbientSoundtrackEngine | null = null;

export function getSoundtrackEngine(): AmbientSoundtrackEngine {
  if (!singletonEngine) {
    singletonEngine = new AmbientSoundtrackEngine();
  }
  return singletonEngine;
}

