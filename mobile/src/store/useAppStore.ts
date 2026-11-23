import { create } from "zustand";

import type { ThemePreference } from "../theme/tokens";

export type SyncStatus = "idle" | "syncing" | "error";

export interface AppState {
  /** Loaded from sync_meta by ThemeRoot; Settings changes it. */
  theme: ThemePreference;
  setTheme: (theme: ThemePreference) => void;

  syncStatus: SyncStatus;
  lastSyncedAt: number | null;
  pendingChanges: number;
  setSyncStatus: (status: SyncStatus) => void;
  setLastSyncedAt: (timestamp: number | null) => void;
  setPendingChanges: (count: number) => void;
}

export const useAppStore = create<AppState>((set) => ({
  theme: "auto",
  setTheme: (theme) => set({ theme }),

  syncStatus: "idle",
  lastSyncedAt: null,
  pendingChanges: 0,
  setSyncStatus: (syncStatus) => set({ syncStatus }),
  setLastSyncedAt: (lastSyncedAt) => set({ lastSyncedAt }),
  setPendingChanges: (pendingChanges) => set({ pendingChanges }),
}));
