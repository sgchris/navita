import { create } from "zustand";

export type Pane = "sidebar" | "content";

/** Registered by the active view so navigation code can read/restore scroll position. */
export interface ScrollApi {
  getScrollTop: () => number;
  setScrollTop: (top: number) => void;
  scrollToPath: (path: string) => void;
}

export const FLASH_DURATION_MS = 4000;

interface UiState {
  focusedPane: Pane;
  windowActive: boolean;
  flashMessage: string | null;
  renamingPath: string | null;
  /** Column count of the Icons view (kept here so the keyboard handler can navigate in 2D). */
  columns: number;
  scrollApi: ScrollApi | null;
  setFocusedPane: (pane: Pane) => void;
  setWindowActive: (active: boolean) => void;
  flash: (message: string, durationMs?: number) => void;
  setRenamingPath: (path: string | null) => void;
  setColumns: (columns: number) => void;
  registerScrollApi: (api: ScrollApi | null) => void;
}

let flashTimer: ReturnType<typeof setTimeout> | undefined;

export const useUi = create<UiState>()((set) => ({
  focusedPane: "content",
  windowActive: true,
  flashMessage: null,
  renamingPath: null,
  columns: 1,
  scrollApi: null,
  setFocusedPane: (focusedPane) => set({ focusedPane }),
  setWindowActive: (windowActive) => set({ windowActive }),
  flash: (message, durationMs = FLASH_DURATION_MS) => {
    clearTimeout(flashTimer);
    set({ flashMessage: message });
    flashTimer = setTimeout(() => set({ flashMessage: null }), durationMs);
  },
  setRenamingPath: (renamingPath) => set({ renamingPath }),
  setColumns: (columns) => set({ columns }),
  registerScrollApi: (scrollApi) => set({ scrollApi }),
}));
