import type { NikkiContextSnapshot, GoalContext, TaskContext } from "./context";

export type GoalTaskDetectionType =
  | "important_goal_no_progress"
  | "task_approaching_deadline"
  | "task_overdue"
  | "task_repeatedly_postponed"
  | "goal_good_progress"
  | "unrealistic_workload";

export type DetectionSeverity = "info" | "warning" | "celebration" | "urgent";

export interface GoalTaskDetection {
  type: GoalTaskDetectionType;
  severity: DetectionSeverity;
  targetId?: string;
  targetTitle?: string;
  summary: string;
  details: Record<string, unknown>;
  dedupKey: string;
  cooldownHours: number;
  detectedAt: Date;
}

export interface GoalTaskDetectionResult {
  detections: GoalTaskDetection[];
  importantGoalsNoProgress: GoalTaskDetection[];
  tasksApproachingDeadline: GoalTaskDetection[];
  overdueTasks: GoalTaskDetection[];
  tasksRepeatedlyPostponed: GoalTaskDetection[];
  goalsMakingGoodProgress: GoalTaskDetection[];
  unrealisticWorkloads: GoalTaskDetection[];
  hasDetections: boolean;
  totalCount: number;
}

export interface DetectionOptions {
  now?: Date;
  approachingHoursThreshold?: number; // default: 24h
  urgentApproachingHoursThreshold?: number; // default: 6h
  unrealisticWorkloadThreshold?: number; // default: 7 tasks
  highPriorityStaleDays?: number; // default: 2 days
  normalPriorityStaleDays?: number; // default: 3 days
  repeatedPostponeThreshold?: number; // default: 2 times
  goodProgressPercentThreshold?: number; // default: 50%
}

// ── 1. Important goals with no recent progress ────────────────────────────────
export function detectImportantGoalsNoProgress(
  context: NikkiContextSnapshot,
  options: DetectionOptions = {}
): GoalTaskDetection[] {
  const detections: GoalTaskDetection[] = [];
  const now = options.now ?? new Date();
  const highStaleDays = options.highPriorityStaleDays ?? 2;
  const normalStaleDays = options.normalPriorityStaleDays ?? 3;

  const candidateGoals = (context.activeGoals || []).filter(
    (g) => g.status === "ACTIVE" || !g.status // active or unassigned status
  );

  for (const goal of candidateGoals) {
    const isHighPriority = goal.priority === "HIGH";
    const staleThreshold = isHighPriority ? highStaleDays : normalStaleDays;
    const isStale = goal.daysSinceUpdated >= staleThreshold;

    // Check if progress is stalled (not completed, and no recent progress)
    const isComplete = goal.progressPercent !== null && goal.progressPercent >= 100;
    if (isComplete) continue;

    // Important goals: prioritize HIGH, allow MEDIUM if stale for longer
    if (isStale && (isHighPriority || goal.priority === "MEDIUM")) {
      const severity: DetectionSeverity = isHighPriority ? "urgent" : "warning";
      const progressDesc =
        goal.progressPercent !== null
          ? `stuck at ${goal.progressPercent}%`
          : "no recorded progress";

      detections.push({
        type: "important_goal_no_progress",
        severity,
        targetId: goal.id,
        targetTitle: goal.title,
        summary: `Goal '${goal.title}' (${goal.priority} priority) has had no updates for ${goal.daysSinceUpdated} days (${progressDesc}).`,
        details: {
          goalId: goal.id,
          title: goal.title,
          priority: goal.priority,
          daysSinceUpdated: goal.daysSinceUpdated,
          progressPercent: goal.progressPercent,
          targetValue: goal.targetValue,
          progressValue: goal.progressValue,
          avoidCount: goal.avoidCount,
        },
        dedupKey: `${context.firebaseUid}:detection:important_goal_no_progress:${goal.id}:${context.localDate}`,
        cooldownHours: 24,
        detectedAt: now,
      });
    }
  }

  // Sort by HIGH priority first, then by most days neglected
  return detections.sort((a, b) => {
    const pa = a.details.priority === "HIGH" ? 0 : 1;
    const pb = b.details.priority === "HIGH" ? 0 : 1;
    if (pa !== pb) return pa - pb;
    return (Number(b.details.daysSinceUpdated) || 0) - (Number(a.details.daysSinceUpdated) || 0);
  });
}

// ── 2. Tasks approaching deadlines ───────────────────────────────────────────
export function detectTasksApproachingDeadline(
  context: NikkiContextSnapshot,
  options: DetectionOptions = {}
): GoalTaskDetection[] {
  const detections: GoalTaskDetection[] = [];
  const now = options.now ?? new Date();
  const thresholdHours = options.approachingHoursThreshold ?? 24;
  const urgentThresholdHours = options.urgentApproachingHoursThreshold ?? 6;

  // Use pending tasks (never completed)
  const candidateTasks = (context.pendingTasks || context.incompleteTasks || []).filter(
    (t) => t.status !== "COMPLETED" && t.dueDate !== null
  );

  for (const task of candidateTasks) {
    if (!task.dueDate) continue;

    const dueTime = new Date(task.dueDate).getTime();
    if (isNaN(dueTime)) continue;

    const diffHours = (dueTime - now.getTime()) / (1000 * 60 * 60);

    // Approaching: due in the future and within threshold window
    if (diffHours > 0 && diffHours <= thresholdHours) {
      const roundedHours = Math.round(diffHours * 10) / 10;
      const severity: DetectionSeverity = roundedHours <= urgentThresholdHours ? "urgent" : "warning";

      detections.push({
        type: "task_approaching_deadline",
        severity,
        targetId: task.id,
        targetTitle: task.title,
        summary: `Task '${task.title}' is due in ~${roundedHours} hour(s) (${task.dueDate.toISOString().slice(0, 16).replace("T", " ")}).`,
        details: {
          taskId: task.id,
          title: task.title,
          dueDate: task.dueDate,
          hoursUntilDue: roundedHours,
          goalId: task.goalId,
          goalTitle: task.goalTitle,
          priority: task.priority,
        },
        dedupKey: `${context.firebaseUid}:detection:task_approaching_deadline:${task.id}:${context.localDate}`,
        cooldownHours: 6,
        detectedAt: now,
      });
    }
  }

  // Sort by earliest deadline first
  return detections.sort(
    (a, b) => (Number(a.details.hoursUntilDue) || 0) - (Number(b.details.hoursUntilDue) || 0)
  );
}

// ── 3. Overdue tasks ─────────────────────────────────────────────────────────
export function detectOverdueTasks(
  context: NikkiContextSnapshot,
  options: DetectionOptions = {}
): GoalTaskDetection[] {
  const detections: GoalTaskDetection[] = [];
  const now = options.now ?? new Date();

  // Tasks MUST be incomplete to be overdue (respects completion status)
  const candidateTasks = (context.pendingTasks || context.incompleteTasks || []).filter(
    (t) => t.status !== "COMPLETED" && t.dueDate !== null
  );

  for (const task of candidateTasks) {
    if (!task.dueDate) continue;

    const dueTime = new Date(task.dueDate).getTime();
    if (isNaN(dueTime)) continue;

    if (dueTime < now.getTime()) {
      const daysOverdue = Math.max(
        0,
        Math.floor((now.getTime() - dueTime) / (1000 * 60 * 60 * 24))
      );
      const hoursOverdue = Math.round(((now.getTime() - dueTime) / (1000 * 60 * 60)) * 10) / 10;

      const overdueLabel =
        daysOverdue >= 1 ? `${daysOverdue} day(s)` : `${hoursOverdue} hour(s)`;

      detections.push({
        type: "task_overdue",
        severity: "urgent",
        targetId: task.id,
        targetTitle: task.title,
        summary: `Task '${task.title}' is overdue by ${overdueLabel}.`,
        details: {
          taskId: task.id,
          title: task.title,
          dueDate: task.dueDate,
          daysOverdue,
          hoursOverdue,
          avoidCount: task.avoidCount,
          postponeCount: task.postponeCount ?? task.avoidCount,
          goalId: task.goalId,
          goalTitle: task.goalTitle,
        },
        dedupKey: `${context.firebaseUid}:detection:task_overdue:${task.id}:${context.localDate}`,
        cooldownHours: 12,
        detectedAt: now,
      });
    }
  }

  // Sort by most overdue first
  return detections.sort(
    (a, b) => (Number(b.details.hoursOverdue) || 0) - (Number(a.details.hoursOverdue) || 0)
  );
}

// ── 4. Tasks repeatedly postponed ────────────────────────────────────────────
export function detectTasksRepeatedlyPostponed(
  context: NikkiContextSnapshot,
  options: DetectionOptions = {}
): GoalTaskDetection[] {
  const detections: GoalTaskDetection[] = [];
  const now = options.now ?? new Date();
  const threshold = options.repeatedPostponeThreshold ?? 2;

  // Respect completion: only incomplete tasks can be flagged as repeatedly postponed
  const candidateTasks = (context.pendingTasks || context.incompleteTasks || []).filter(
    (t) => t.status !== "COMPLETED"
  );

  for (const task of candidateTasks) {
    const postponeCount = task.postponeCount ?? task.avoidCount ?? 0;
    const avoidCount = task.avoidCount ?? 0;
    const effectiveCount = Math.max(postponeCount, avoidCount);

    if (effectiveCount >= threshold) {
      detections.push({
        type: "task_repeatedly_postponed",
        severity: "warning",
        targetId: task.id,
        targetTitle: task.title,
        summary: `Task '${task.title}' has been repeatedly postponed or avoided (${effectiveCount} times).`,
        details: {
          taskId: task.id,
          title: task.title,
          postponeCount,
          avoidCount,
          effectiveCount,
          dueDate: task.dueDate,
          goalId: task.goalId,
          goalTitle: task.goalTitle,
        },
        dedupKey: `${context.firebaseUid}:detection:task_repeatedly_postponed:${task.id}:${context.localDate}`,
        cooldownHours: 12,
        detectedAt: now,
      });
    }
  }

  // Sort by highest postpone count first
  return detections.sort(
    (a, b) => (Number(b.details.effectiveCount) || 0) - (Number(a.details.effectiveCount) || 0)
  );
}

// ── 5. Goals making good progress ────────────────────────────────────────────
export function detectGoalsMakingGoodProgress(
  context: NikkiContextSnapshot,
  options: DetectionOptions = {}
): GoalTaskDetection[] {
  const detections: GoalTaskDetection[] = [];
  const now = options.now ?? new Date();
  const progressThreshold = options.goodProgressPercentThreshold ?? 50;

  const candidateGoals = [
    ...(context.activeGoals || []),
    ...(context.completedGoals || []),
  ];

  const seenIds = new Set<string>();

  for (const goal of candidateGoals) {
    if (seenIds.has(goal.id)) continue;
    seenIds.add(goal.id);

    const isCompleted = goal.status === "COMPLETED";
    const percent = goal.progressPercent;
    const hasHighPercent = percent !== null && percent >= progressThreshold;
    const isRecentlyActive = goal.daysSinceUpdated <= 1;

    // A goal qualifies if:
    // 1. It is completed
    // 2. Or it reached >= 50% progress
    // 3. Or it has positive progress and was updated today/yesterday
    if (isCompleted || hasHighPercent || (percent !== null && percent > 0 && isRecentlyActive)) {
      const summary = isCompleted
        ? `Goal '${goal.title}' is completed!`
        : `Goal '${goal.title}' is making great progress (${percent}% complete).`;

      detections.push({
        type: "goal_good_progress",
        severity: "celebration",
        targetId: goal.id,
        targetTitle: goal.title,
        summary,
        details: {
          goalId: goal.id,
          title: goal.title,
          status: goal.status,
          progressPercent: percent,
          targetValue: goal.targetValue,
          progressValue: goal.progressValue,
          daysSinceUpdated: goal.daysSinceUpdated,
          isCompleted,
        },
        dedupKey: `${context.firebaseUid}:detection:goal_good_progress:${goal.id}:${percent ?? "done"}:${context.localDate}`,
        cooldownHours: 24,
        detectedAt: now,
      });
    }
  }

  // Sort completed first, then highest percent
  return detections.sort((a, b) => {
    if (a.details.isCompleted && !b.details.isCompleted) return -1;
    if (!a.details.isCompleted && b.details.isCompleted) return 1;
    return (Number(b.details.progressPercent) || 0) - (Number(a.details.progressPercent) || 0);
  });
}

// ── 6. Unrealistic workloads ─────────────────────────────────────────────────
export function detectUnrealisticWorkloads(
  context: NikkiContextSnapshot,
  options: DetectionOptions = {}
): GoalTaskDetection[] {
  const detections: GoalTaskDetection[] = [];
  const now = options.now ?? new Date();
  const threshold = options.unrealisticWorkloadThreshold ?? 7;

  const pendingCount =
    typeof context.totalPendingTasksCount === "number" && context.totalPendingTasksCount > 0
      ? context.totalPendingTasksCount
      : (context.pendingTasks || context.incompleteTasks || []).length;

  // Count pending tasks due today or without due date
  const candidateTasks = context.pendingTasks || context.incompleteTasks || [];
  const tasksDueToday = candidateTasks.filter((t) => {
    if (!t.dueDate) return false;
    try {
      const dStr = new Date(t.dueDate).toISOString().slice(0, 10);
      return dStr === context.localDate;
    } catch {
      return false;
    }
  });

  // Flag unrealistic workload if total pending >= threshold OR tasks due today >= 5
  if (pendingCount >= threshold || tasksDueToday.length >= 5) {
    const titlesPreview = candidateTasks.slice(0, 3).map((t) => `'${t.title}'`).join(", ");
    const summary = `Unrealistic workload: ${pendingCount} pending task(s) active (${tasksDueToday.length} due today).`;

    detections.push({
      type: "unrealistic_workload",
      severity: "warning",
      summary,
      details: {
        totalPendingCount: pendingCount,
        tasksDueTodayCount: tasksDueToday.length,
        threshold,
        preview: titlesPreview,
      },
      dedupKey: `${context.firebaseUid}:detection:unrealistic_workload:${context.localDate}`,
      cooldownHours: 12,
      detectedAt: now,
    });
  }

  return detections;
}

// ── Master Detector: Runs all 6 detection rules ──────────────────────────────
export function detectAllGoalTaskInsights(
  context: NikkiContextSnapshot,
  options: DetectionOptions = {}
): GoalTaskDetectionResult {
  const importantGoalsNoProgress = detectImportantGoalsNoProgress(context, options);
  const tasksApproachingDeadline = detectTasksApproachingDeadline(context, options);
  const overdueTasks = detectOverdueTasks(context, options);
  const tasksRepeatedlyPostponed = detectTasksRepeatedlyPostponed(context, options);
  const goalsMakingGoodProgress = detectGoalsMakingGoodProgress(context, options);
  const unrealisticWorkloads = detectUnrealisticWorkloads(context, options);

  // Aggregate and sort by severity: urgent > warning > celebration > info
  const severityRank: Record<DetectionSeverity, number> = {
    urgent: 0,
    warning: 1,
    celebration: 2,
    info: 3,
  };

  const allDetections: GoalTaskDetection[] = [
    ...tasksApproachingDeadline,
    ...overdueTasks,
    ...importantGoalsNoProgress,
    ...tasksRepeatedlyPostponed,
    ...unrealisticWorkloads,
    ...goalsMakingGoodProgress,
  ].sort((a, b) => severityRank[a.severity] - severityRank[b.severity]);

  return {
    detections: allDetections,
    importantGoalsNoProgress,
    tasksApproachingDeadline,
    overdueTasks,
    tasksRepeatedlyPostponed,
    goalsMakingGoodProgress,
    unrealisticWorkloads,
    hasDetections: allDetections.length > 0,
    totalCount: allDetections.length,
  };
}

// ── Cooldown & Deduplication Filter ───────────────────────────────────────────
/**
 * Filters out detections that have been nudged or alerted recently within their cooldown period.
 */
export function filterDetectionsByCooldown(
  detections: GoalTaskDetection[],
  recentAlerts: Array<{ idempotencyKey?: string; dedupKey?: string; createdAt: Date | string }>,
  now: Date = new Date()
): GoalTaskDetection[] {
  return detections.filter((detection) => {
    const matchingAlert = recentAlerts.find(
      (a) => a.dedupKey === detection.dedupKey || a.idempotencyKey === detection.dedupKey
    );
    if (!matchingAlert) return true;

    const alertTime = new Date(matchingAlert.createdAt).getTime();
    if (isNaN(alertTime)) return true;

    const elapsedHours = (now.getTime() - alertTime) / (1000 * 60 * 60);
    return elapsedHours >= detection.cooldownHours;
  });
}
