import * as BackgroundTask from "expo-background-task";
import * as TaskManager from "expo-task-manager";

import { maybeSync } from "./client";

export const BACKGROUND_SYNC_TASK = "yaga-background-sync";

/**
 * Best-effort periodic sync (tech.mobile.md "Background Tasks"). The OS
 * decides when this runs; foreground triggers remain the primary reliable
 * path. Uses expo-background-task (the spec-forbidden expo-background-fetch
 * is not used). Effective in development/custom builds; registration is a
 * harmless no-op rejection elsewhere (e.g. Expo Go).
 */
TaskManager.defineTask(BACKGROUND_SYNC_TASK, async () => {
  try {
    const result = await maybeSync();
    return result === null || result.status === "ok" || result.status === "unconfigured"
      ? BackgroundTask.BackgroundTaskResult.Success
      : BackgroundTask.BackgroundTaskResult.Failed;
  } catch {
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

/** Registers the background task once; ignores environments that reject it. */
export async function ensureBackgroundSync(): Promise<void> {
  try {
    if (await TaskManager.isTaskRegisteredAsync(BACKGROUND_SYNC_TASK)) {
      return;
    }
    // 15 minutes is the minimum Android JobScheduler interval.
    await BackgroundTask.registerTaskAsync(BACKGROUND_SYNC_TASK, {
      minimumInterval: 900,
    });
  } catch {
    // Expo Go and some devices do not support background tasks; foreground
    // triggers already cover the spec's reliability requirements.
  }
}
