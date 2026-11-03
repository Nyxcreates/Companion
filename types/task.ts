export type TaskStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED";

export interface TaskSummary {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  dueDate: string | null;
  /** Optional — a task never requires a Goal. */
  goalId: string | null;
  /** Denormalized for display only (looked up server-side); null if goalId is null. Never trust this for authorization — ownership is re-checked server-side on every write. */
  goalTitle: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}