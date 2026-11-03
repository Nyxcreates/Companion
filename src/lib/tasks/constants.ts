import type { TaskStatus } from "@/types/task";

export const TASK_STATUSES: TaskStatus[] = ["PENDING", "IN_PROGRESS", "COMPLETED"];

export const TASK_STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: "PENDING", label: "Pending" },
  { value: "IN_PROGRESS", label: "In progress" },
  { value: "COMPLETED", label: "Completed" },
];