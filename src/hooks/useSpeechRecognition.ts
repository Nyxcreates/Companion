"use client";

import { useRef, useState, useEffect } from "react";

interface SpeechRecognitionResultItem {
  transcript: string;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  [index: number]: SpeechRecognitionResultItem;
}

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: SpeechRecognitionResult;
  };
}

interface SpeechRecognitionErrorEventLike {
  error?: string;
}

interface SpeechRecognitionInstance {
  interimResults: boolean;
  continuous: boolean;
  lang: string;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

interface WindowWithSpeechRecognition extends Window {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
}

export interface SpeechRecognitionHookOptions {
  lang?: string;
  onInterimTranscript: (text: string) => void;
  onFinalTranscript: (text: string) => void;
  onError: (errorType: "not-allowed" | "no-speech" | "network" | "unknown", message: string) => void;
  onEnd?: () => void;
}

export interface SpeechRecognitionHook {
  isSupported: boolean;
  isListening: boolean;
  startListening: () => void;
  stopListening: () => void;
}

export function useSpeechRecognition(opts: SpeechRecognitionHookOptions): SpeechRecognitionHook {
  const isSupported =
    typeof window !== "undefined" &&
    ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const optsRef = useRef(opts);

  // Keep opts ref up-to-date without re-creating the recognition instance
  useEffect(() => {
    optsRef.current = opts;
  });

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore
        }
        recognitionRef.current = null;
      }
    };
  }, []);

  function startListening() {
    if (!isSupported) return;
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {
        // ignore
      }
    }

    const win = window as WindowWithSpeechRecognition;
    const SR = win.SpeechRecognition ?? win.webkitSpeechRecognition;
    if (!SR) return;

    const recognition = new SR();
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.lang = optsRef.current.lang ?? "en-IN";

    recognition.onresult = (e: SpeechRecognitionEventLike) => {
      let interim = "";
      let final = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const transcript = e.results[i][0].transcript;
        if (e.results[i].isFinal) {
          final += transcript;
        } else {
          interim += transcript;
        }
      }
      if (interim) {
        optsRef.current.onInterimTranscript(interim);
      }
      if (final) {
        optsRef.current.onFinalTranscript(final);
      }
    };

    recognition.onerror = (e: SpeechRecognitionErrorEventLike) => {
      let type: "not-allowed" | "no-speech" | "network" | "unknown" = "unknown";
      let message = "Voice input encountered an error.";
      switch (e.error) {
        case "not-allowed":
        case "service-not-allowed":
          type = "not-allowed";
          message = "Microphone access was denied. Please allow it in your browser settings.";
          break;
        case "no-speech":
          type = "no-speech";
          message = "No speech detected. Try speaking closer to the microphone.";
          break;
        case "network":
          type = "network";
          message = "Network error during voice recognition. Check your connection.";
          break;
        default:
          type = "unknown";
          message = `Voice input error: ${e.error ?? "unknown"}.`;
      }
      optsRef.current.onError(type, message);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
      optsRef.current.onEnd?.();
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }

  function stopListening() {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
    }
    setIsListening(false);
  }

  return { isSupported, isListening, startListening, stopListening };
}
