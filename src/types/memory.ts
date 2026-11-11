/** Client-facing shape for a long-term memory — mirrors src/types/capsule.ts's pattern. */

import type { MemoryType } from "@/lib/memory/types";

export type MemorySource = "explicit_request" | "inferred";
export type { MemoryType };

export interface MemorySummary {
  id: string;
  type: MemoryType;
  content: string;
  source: MemorySource;
  confidence: number;
  createdAt: string;
  lastUsedAt: string | null;
}