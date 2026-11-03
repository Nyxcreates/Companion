import { GOAL_OPTIONS } from "@/lib/onboarding/options";
import { GOAL_STATUSES, GOAL_PRIORITIES } from "@/lib/goals/constants";
import type { GoalCategory, GoalPriority, GoalStatus } from "@/types/goal";

const GOAL_CATEGORY_VALUES = new Set<string>(GOAL_OPTIONS.map((o) => o.id));

const MAX_TITLE_LENGTH = 80;
const MAX_DESCRIPTION_LENGTH = 500;
const MAX_TARGET_LABEL_LENGTH = 40;
const MAX_TARGET_VALUE = 1_000_000;

function parseDeadline(value: unknown, errors: string[]): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") {
    errors.push("Deadline must be a date string.");
    return null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    errors.push("Deadline isn't a valid date.");
    return null;
  }
  // Deliberately no "must be in the future" check — a deadline is
  // information, not a hard constraint; the product never treats a
  // passed deadline as a failure state.
  return date.toISOString();
}

function parseTargetValue(value: unknown, errors: string[]): number | null {
  if (value === undefined || value === null || value === "") return null;
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num) || num < 0 || num > MAX_TARGET_VALUE) {
    errors.push("Target must be a positive number.");
    return null;
  }
  return num;
}

export interface CreateGoalValidationResult {
  valid: boolean;
  errors: string[];
  data: {
    title: string;
    description: string | null;
    category: GoalCategory | null;
    priority: GoalPriority;
    deadline: string | null;
    targetLabel: string | null;
    targetValue: number | null;
  } | null;
}

/** The authoritative validator for creating a goal — run server-side for every request, mirrors validation/capsule.ts's pattern. */
export function validateCreateGoalPayload(body: unknown): CreateGoalValidationResult {
  const errors: string[] = [];

  if (typeof body !== "object" || body === null) {
    return { valid: false, errors: ["Invalid request body."], data: null };
  }
  const b = body as Record<string, unknown>;

  const title = typeof b.title === "string" ? b.title.trim() : "";
  if (title.length === 0 || title.length > MAX_TITLE_LENGTH) {
    errors.push(`Title must be between 1 and ${MAX_TITLE_LENGTH} characters.`);
  }

  let description: string | null = null;
  if (b.description !== undefined && b.description !== null && b.description !== "") {
    const d = typeof b.description === "string" ? b.description.trim() : "";
    if (d.length > MAX_DESCRIPTION_LENGTH) {
      errors.push(`Description must be ${MAX_DESCRIPTION_LENGTH} characters or fewer.`);
    } else {
      description = d;
    }
  }

  let category: GoalCategory | null = null;
  if (b.category !== undefined && b.category !== null && b.category !== "") {
    if (typeof b.category !== "string" || !GOAL_CATEGORY_VALUES.has(b.category)) {
      errors.push("Invalid category.");
    } else {
      category = b.category as GoalCategory;
    }
  }

  let priority: GoalPriority = "MEDIUM";
  if (b.priority !== undefined) {
    if (typeof b.priority !== "string" || !GOAL_PRIORITIES.includes(b.priority as GoalPriority)) {
      errors.push("Invalid priority.");
    } else {
      priority = b.priority as GoalPriority;
    }
  }

  const deadline = parseDeadline(b.deadline, errors);

  let targetLabel: string | null = null;
  if (b.targetLabel !== undefined && b.targetLabel !== null && b.targetLabel !== "") {
    const label = typeof b.targetLabel === "string" ? b.targetLabel.trim() : "";
    if (label.length > MAX_TARGET_LABEL_LENGTH) {
      errors.push(`Target unit must be ${MAX_TARGET_LABEL_LENGTH} characters or fewer.`);
    } else {
      targetLabel = label;
    }
  }

  const targetValue = parseTargetValue(b.targetValue, errors);

  if (errors.length > 0) {
    return { valid: false, errors, data: null };
  }

  return {
    valid: true,
    errors: [],
    data: { title, description, category, priority, deadline, targetLabel, targetValue },
  };
}

export interface UpdateGoalValidationResult {
  valid: boolean;
  errors: string[];
  data: {
    title?: string;
    description?: string | null;
    category?: GoalCategory | null;
    priority?: GoalPriority;
    deadline?: string | null;
    targetLabel?: string | null;
    targetValue?: number | null;
    progressValue?: number;
    status?: GoalStatus;
  } | null;
}

/** Every field optional (PATCH semantics), mirrors validation/profile.ts's pattern exactly. Progress-vs-target sanity clamping happens in the service layer, since it needs the goal's current stored target — this layer only checks the shape. */
export function validateUpdateGoalPayload(body: unknown): UpdateGoalValidationResult {
  const errors: string[] = [];
  const data: NonNullable<UpdateGoalValidationResult["data"]> = {};

  if (typeof body !== "object" || body === null) {
    return { valid: false, errors: ["Invalid request body."], data: null };
  }
  const b = body as Record<string, unknown>;

  if (b.title !== undefined) {
    const title = typeof b.title === "string" ? b.title.trim() : "";
    if (title.length === 0 || title.length > MAX_TITLE_LENGTH) {
      errors.push(`Title must be between 1 and ${MAX_TITLE_LENGTH} characters.`);
    } else {
      data.title = title;
    }
  }

  if (b.description !== undefined) {
    if (b.description === null) {
      data.description = null;
    } else {
      const d = typeof b.description === "string" ? b.description.trim() : "";
      if (d.length > MAX_DESCRIPTION_LENGTH) {
        errors.push(`Description must be ${MAX_DESCRIPTION_LENGTH} characters or fewer.`);
      } else {
        data.description = d || null;
      }
    }
  }

  if (b.category !== undefined) {
    if (b.category === null) {
      data.category = null;
    } else if (typeof b.category !== "string" || !GOAL_CATEGORY_VALUES.has(b.category)) {
      errors.push("Invalid category.");
    } else {
      data.category = b.category as GoalCategory;
    }
  }

  if (b.priority !== undefined) {
    if (typeof b.priority !== "string" || !GOAL_PRIORITIES.includes(b.priority as GoalPriority)) {
      errors.push("Invalid priority.");
    } else {
      data.priority = b.priority as GoalPriority;
    }
  }

  if (b.deadline !== undefined) {
    if (b.deadline === null) {
      data.deadline = null;
    } else {
      data.deadline = parseDeadline(b.deadline, errors);
    }
  }

  if (b.targetLabel !== undefined) {
    if (b.targetLabel === null) {
      data.targetLabel = null;
    } else {
      const label = typeof b.targetLabel === "string" ? b.targetLabel.trim() : "";
      if (label.length > MAX_TARGET_LABEL_LENGTH) {
        errors.push(`Target unit must be ${MAX_TARGET_LABEL_LENGTH} characters or fewer.`);
      } else {
        data.targetLabel = label || null;
      }
    }
  }

  if (b.targetValue !== undefined) {
    if (b.targetValue === null) {
      data.targetValue = null;
    } else {
      data.targetValue = parseTargetValue(b.targetValue, errors);
    }
  }

  if (b.progressValue !== undefined) {
    const num = typeof b.progressValue === "number" ? b.progressValue : Number(b.progressValue);
    if (!Number.isFinite(num) || num < 0) {
      errors.push("Progress must be zero or a positive number.");
    } else {
      data.progressValue = num;
    }
  }

  if (b.status !== undefined) {
    if (typeof b.status !== "string" || !GOAL_STATUSES.includes(b.status as GoalStatus)) {
      errors.push("Invalid status.");
    } else {
      data.status = b.status as GoalStatus;
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors, data: null };
  }

  return { valid: true, errors: [], data };
}