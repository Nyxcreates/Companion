/** Client-facing shape for a long-term memory — mirrors src/types/capsule.ts's pattern. */

import type { MemoryType } from "@/lib/memory/types";
import type { MemorySource } from "@/models/Memory";

export type { MemoryType, MemorySource };

export interface MemorySummary {
  id: string;
  type: MemoryType;
  content: string;
  source: MemorySource;
  confidence: number;
  createdAt: string;
  lastUsedAt: string | null;
}