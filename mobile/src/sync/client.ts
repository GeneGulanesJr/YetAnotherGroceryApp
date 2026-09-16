import { AppState } from "react-native";

import { getDatabase } from "../db/database";
import { getPendingMutationCount } from "../db/repositories/meta";
import { useAppStore } from "../store/useAppStore";
import { runSync, type SyncRunResult } from "./engine";
import { createTransport, getApiBaseUrl } from "./transport";

/**
 * App-facing sync facade: the engine behind the store indicators and the
 * Settings "Sync now" action, plus foreground triggers (spec: startup and
 * resume are the reliable sync moments; background tasks come later).
 */

let running = false;
let lastResult: SyncRunResult | null = null;

export function syncConfigured(): boolean {
  return getApiBaseUrl() !== null;
}

export async function syncNow(): Promise<SyncRunResult> {
  if (running) {
    return lastResult ?? { status: "error", pushed: 0, pushFailed: 0, pulled: 0, conflicts: 0, error: "sync already running" };
  }
  running = true;
  const store = useAppStore.getState();
  store.setSyncStatus("syncing");
  try {
    const result = await runSync(getDatabase(), createTransport());
    lastResult = result;
    const state = useAppStore.getState();
    state.setSyncStatus(result.status === "ok" ? "idle" : "error");
    if (result.status === "ok" || result.status === "partial") {
      state.setLastSyncedAt(Date.now());
    }
    state.setPendingChanges(getPendingMutationCount(getDatabase()));
    return result;
  } finally {
    running = false;
  }
}

/** Runs a pass only when a backend is configured; no-ops otherwise. */
export async function maybeSync(): Promise<SyncRunResult | null> {
  if (!syncConfigured()) {
    useAppStore.getState().setPendingChanges(getPendingMutationCount(getDatabase()));
    return null;
  }
  return syncNow();
}

let listenerConfigured = false;

/** Foreground-resume trigger; attach once from App. */
export function attachForegroundSync(): () => void {
  if (listenerConfigured) {
    return () => undefined;
  }
  listenerConfigured = true;
  const subscription = AppState.addEventListener("change", (state) => {
    if (state === "active") {
      void maybeSync();
    }
  });
  return () => {
    listenerConfigured = false;
    subscription.remove();
  };
}

export function getLastSyncResult(): SyncRunResult | null {
  return lastResult;
}
