import { TASK_STATUSES } from "@/lib/tasks/constants";
import type { TaskStatus } from "@/types/task";

const MAX_TITLE_LENGTH = 120;
const MAX_DESCRIPTION_LENGTH = 500;

function parseDueDate(value: unknown, errors: string[]): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") {
    errors.push("Due date must be a date string.");
    return null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    errors.push("Due date isn't a valid date.");
    return null;
  }
  // Deliberately no "must be in the future" check — same reasoning as
  // goal deadlines: a due date is information, never a hard
  // constraint the product treats as a failure state.
  return date.toISOString();
}

function parseGoalId(value: unknown, errors: string[]): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") {
    errors.push("goalId must be a string.");
    return null;
  }
  return value;
}

export interface CreateTaskValidationResult {
  valid: boolean;
  errors: string[];
  data: {
    title: string;
    description: string | null;
    dueDate: string | null;
    goalId: string | null;
  } | null;
}

/** The authoritative validator for creating a task — run server-side for every request, mirrors validateCreateGoalPayload's shape. Ownership of a supplied goalId is checked at the service layer, since it needs a database lookup this layer doesn't have. */
export function validateCreateTaskPayload(body: unknown): CreateTaskValidationResult {
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

  const dueDate = parseDueDate(b.dueDate, errors);
  const goalId = parseGoalId(b.goalId, errors);

  if (errors.length > 0) {
    return { valid: false, errors, data: null };
  }

  return { valid: true, errors: [], data: { title, description, dueDate, goalId } };
}

export interface UpdateTaskValidationResult {
  valid: boolean;
  errors: string[];
  data: {
    title?: string;
    description?: string | null;
    dueDate?: string | null;
    goalId?: string | null;
    status?: TaskStatus;
  } | null;
}

/** Every field optional (PATCH semantics), mirrors validateUpdateGoalPayload exactly. */
export function validateUpdateTaskPayload(body: unknown): UpdateTaskValidationResult {
  const errors: string[] = [];
  const data: NonNullable<UpdateTaskValidationResult["data"]> = {};

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

  if (b.dueDate !== undefined) {
    if (b.dueDate === null) {
      data.dueDate = null;
    } else {
      data.dueDate = parseDueDate(b.dueDate, errors);
    }
  }

  if (b.goalId !== undefined) {
    if (b.goalId === null) {
      data.goalId = null;
    } else {
      data.goalId = parseGoalId(b.goalId, errors);
    }
  }

  if (b.status !== undefined) {
    if (typeof b.status !== "string" || !TASK_STATUSES.includes(b.status as TaskStatus)) {
      errors.push("Invalid status.");
    } else {
      data.status = b.status as TaskStatus;
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors, data: null };
  }

  return { valid: true, errors: [], data };
}