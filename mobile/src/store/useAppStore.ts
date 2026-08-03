import { create } from "zustand";

export type SyncStatus = "idle" | "syncing" | "error";

export interface AppState {
  colorScheme: "light" | "dark";
  setColorScheme: (scheme: "light" | "dark") => void;

  syncStatus: SyncStatus;
  lastSyncedAt: number | null;
  pendingChanges: number;
  setSyncStatus: (status: SyncStatus) => void;
  setLastSyncedAt: (timestamp: number | null) => void;
  setPendingChanges: (count: number) => void;
}

export const useAppStore = create<AppState>((set) => ({
  colorScheme: "light",
  setColorScheme: (colorScheme) => set({ colorScheme }),

  syncStatus: "idle",
  lastSyncedAt: null,
  pendingChanges: 0,
  setSyncStatus: (syncStatus) => set({ syncStatus }),
  setLastSyncedAt: (lastSyncedAt) => set({ lastSyncedAt }),
  setPendingChanges: (pendingChanges) => set({ pendingChanges }),
}));
