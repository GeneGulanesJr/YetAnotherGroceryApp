import { create } from "zustand";

export type SyncStatus = "idle" | "syncing" | "error";

/**
 * Transient interface state only. Application data (spending, products, prices)
 * is read from the shared DataSource / backend API and never stored here.
 */
export interface AppState {
  // Controls the slide-over navigation shown below the `md` breakpoint. The
  // desktop sidebar is always visible, so this only affects tablet/mobile.
  mobileNavOpen: boolean;
  toggleMobileNav: () => void;
  setMobileNavOpen: (open: boolean) => void;

  syncStatus: SyncStatus;
  lastSyncedAt: number | null;
  pendingChanges: number;
  setSyncStatus: (status: SyncStatus) => void;
  setLastSyncedAt: (timestamp: number | null) => void;
  setPendingChanges: (count: number) => void;
}

export const useAppStore = create<AppState>((set) => ({
  mobileNavOpen: false,
  toggleMobileNav: () => set((state) => ({ mobileNavOpen: !state.mobileNavOpen })),
  setMobileNavOpen: (mobileNavOpen) => set({ mobileNavOpen }),

  syncStatus: "idle",
  lastSyncedAt: null,
  pendingChanges: 0,
  setSyncStatus: (syncStatus) => set({ syncStatus }),
  setLastSyncedAt: (lastSyncedAt) => set({ lastSyncedAt }),
  setPendingChanges: (pendingChanges) => set({ pendingChanges }),
}));
