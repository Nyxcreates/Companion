import { connectToDatabase } from "@/lib/mongodb";
import { UserModel } from "@/models/User";
import { listActiveGoalsForContext } from "@/services/goalService";
import { listTasks } from "@/services/taskService";
import { loadRelevantMemories } from "@/services/memoryService";
import { resolveUserTimezone, getCurrentTimeInfo } from "@/lib/time/currentTime";
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

    const [doc, activeGoals, pendingTasks, inProgressTasks, relevantMemories] = await Promise.all([
      UserModel.findOne({ firebaseUid }),
      listActiveGoalsForContext(firebaseUid),
      listTasks(firebaseUid, { status: "PENDING" }),
      listTasks(firebaseUid, { status: "IN_PROGRESS" }),
      loadRelevantMemories(firebaseUid),
    ]);

    const tz = resolveUserTimezone(clientTimezone, doc?.timezone);
    const currentTimeInfo = getCurrentTimeInfo(tz);

    return {
      displayName: doc?.displayName ?? null,
      companionName: doc?.companionName ?? null,
      goals: doc?.goals ?? [],
      customGoal: doc?.customGoal ?? null,
      dailyRhythm: {
        wakeTime: doc?.dailyRhythm?.wakeTime ?? null,
        sleepTime: doc?.dailyRhythm?.sleepTime ?? null,
        focusPeriods: doc?.dailyRhythm?.focusPeriods ?? [],
        commitments: doc?.dailyRhythm?.commitments ?? null,
      },
      helpPreferences: doc?.helpPreferences ?? [],
      activeGoals,
      activeTasks: [...inProgressTasks, ...pendingTasks],
      relevantMemories,
      currentTimeInfo,
      livingEnvironment: doc?.livingEnvironment ?? null,
    };
  } catch (error) {
    throw new AgentContextError(error);
  }
}
