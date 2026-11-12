import { connectToDatabase } from "@/lib/mongodb";
import { UserModel } from "@/models/User";
import { listActiveGoalsForContext } from "@/services/goalService";
import { listTasks } from "@/services/taskService";
import { loadRelevantMemories } from "@/services/memoryService";
import { getSchedule } from "@/services/scheduleService";
import { resolveUserTimezone, getCurrentTimeInfo, getTodayDateStr, getTomorrowDateStr } from "@/lib/time/currentTime";
import { AgentContextError } from "./errors";
import type { AgentContext } from "./types";

/**
 * Builds Nikki's context from real data only.
 * Always resolves runtime clock and user timezone so Nikki is never unaware of the current time.
 */
export async function buildAgentContext(
  firebaseUid: string,
  clientTimezone?: string | null
): Promise<AgentContext> {
  try {
    await connectToDatabase();

    const userDoc = await UserModel.findOne({ firebaseUid });
    const tz = resolveUserTimezone(clientTimezone, userDoc?.timezone);
    const currentTimeInfo = getCurrentTimeInfo(tz);
    const todayDateStr = getTodayDateStr(tz);
    const tomorrowDateStr = getTomorrowDateStr(tz);

    const [activeGoals, pendingTasks, inProgressTasks, relevantMemories, todaySchedule, tomorrowSchedule] =
      await Promise.all([
        listActiveGoalsForContext(firebaseUid),
        listTasks(firebaseUid, { status: "PENDING" }),
        listTasks(firebaseUid, { status: "IN_PROGRESS" }),
        loadRelevantMemories(firebaseUid),
        getSchedule(firebaseUid, todayDateStr).catch(() => null),
        getSchedule(firebaseUid, tomorrowDateStr).catch(() => null),
      ]);

    return {
      displayName: userDoc?.displayName ?? null,
      companionName: userDoc?.companionName ?? null,
      goals: userDoc?.goals ?? [],
      customGoal: userDoc?.customGoal ?? null,
      dailyRhythm: {
        wakeTime: userDoc?.dailyRhythm?.wakeTime ?? null,
        sleepTime: userDoc?.dailyRhythm?.sleepTime ?? null,
        focusPeriods: userDoc?.dailyRhythm?.focusPeriods ?? [],
        commitments: userDoc?.dailyRhythm?.commitments ?? null,
      },
      helpPreferences: userDoc?.helpPreferences ?? [],
      activeGoals,
      activeTasks: [...inProgressTasks, ...pendingTasks],
      relevantMemories,
      currentTimeInfo,
      todaySchedule,
      tomorrowSchedule,
      livingEnvironment: userDoc?.livingEnvironment ?? null,
    };
  } catch (error) {
    throw new AgentContextError(error);
  }
}
