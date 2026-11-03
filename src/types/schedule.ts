export type ScheduleItemType = "task" | "break" | "commitment" | "free";

export interface ScheduleItem {
  start: string; // "HH:MM", 24h
  end: string;
  title: string;
  type: ScheduleItemType;
  taskId: string | null;
}

export interface ScheduleSummary {
  id: string;
  date: string; // "YYYY-MM-DD"
  items: ScheduleItem[];
  createdAt: string;
  updatedAt: string;
}