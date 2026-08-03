import { create } from "zustand";

export type SyncStatus = "idle" | "syncing" | "error";

/**
 * Transient interface state only. Application data (spending, products, prices)
 * is read from the shared DataSource / backend API and never stored here.
 */
export interface AppState {
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;

  syncStatus: SyncStatus;
  lastSyncedAt: number | null;
  pendingChanges: number;
  setSyncStatus: (status: SyncStatus) => void;
  setLastSyncedAt: (timestamp: number | null) => void;
  setPendingChanges: (count: number) => void;
}

export const useAppStore = create<AppState>((set) => ({
  sidebarOpen: true,
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),

  syncStatus: "idle",
  lastSyncedAt: null,
  pendingChanges: 0,
  setSyncStatus: (syncStatus) => set({ syncStatus }),
  setLastSyncedAt: (lastSyncedAt) => set({ lastSyncedAt }),
  setPendingChanges: (pendingChanges) => set({ pendingChanges }),
}));
