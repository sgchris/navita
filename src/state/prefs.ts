import { create } from "zustand";
import type { SortSpec } from "../lib/sort";

export type ViewMode = "icons" | "list";
export type SectionId = "favorites" | "locations" | "folders";

export interface ColumnWidths {
  modified: number;
  size: number;
  kind: number;
}

export interface Prefs {
  viewMode: ViewMode;
  sort: SortSpec;
  showHidden: boolean;
  sidebarWidth: number;
  sidebarVisible: boolean;
  pathBarVisible: boolean;
  statusBarVisible: boolean;
  columnWidths: ColumnWidths;
  collapsedSections: SectionId[];
  lastPath: string | null;
  expandedTreePaths: string[];
}

/** Defaults (decisions B11). */
export const DEFAULT_PREFS: Prefs = {
  viewMode: "icons",
  sort: { key: "name", dir: "asc" },
  showHidden: false,
  sidebarWidth: 240,
  sidebarVisible: true,
  pathBarVisible: true,
  statusBarVisible: true,
  columnWidths: { modified: 180, size: 80, kind: 140 },
  collapsedSections: [],
  lastPath: null,
  expandedTreePaths: [],
};

export const SIDEBAR_MIN = 180;
export const SIDEBAR_MAX = 400;
export const COLUMN_MIN = { name: 200, modified: 120, size: 60, kind: 80 } as const;

interface PrefsActions {
  setViewMode: (mode: ViewMode) => void;
  setSort: (sort: SortSpec) => void;
  setShowHidden: (value: boolean) => void;
  toggleShowHidden: () => void;
  setSidebarWidth: (width: number) => void;
  setSidebarVisible: (value: boolean) => void;
  setPathBarVisible: (value: boolean) => void;
  setStatusBarVisible: (value: boolean) => void;
  setColumnWidth: (column: keyof ColumnWidths, width: number) => void;
  toggleSection: (section: SectionId) => void;
  setLastPath: (path: string) => void;
  setExpandedTreePaths: (paths: string[]) => void;
}

export const usePrefs = create<Prefs & PrefsActions>()((set) => ({
  ...DEFAULT_PREFS,
  setViewMode: (viewMode) => set({ viewMode }),
  setSort: (sort) => set({ sort }),
  setShowHidden: (showHidden) => set({ showHidden }),
  toggleShowHidden: () => set((s) => ({ showHidden: !s.showHidden })),
  setSidebarWidth: (width) =>
    set({ sidebarWidth: Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, Math.round(width))) }),
  setSidebarVisible: (sidebarVisible) => set({ sidebarVisible }),
  setPathBarVisible: (pathBarVisible) => set({ pathBarVisible }),
  setStatusBarVisible: (statusBarVisible) => set({ statusBarVisible }),
  setColumnWidth: (column, width) =>
    set((s) => ({
      columnWidths: {
        ...s.columnWidths,
        [column]: Math.max(COLUMN_MIN[column], Math.round(width)),
      },
    })),
  toggleSection: (section) =>
    set((s) => ({
      collapsedSections: s.collapsedSections.includes(section)
        ? s.collapsedSections.filter((x) => x !== section)
        : [...s.collapsedSections, section],
    })),
  setLastPath: (lastPath) => set({ lastPath }),
  setExpandedTreePaths: (expandedTreePaths) => set({ expandedTreePaths }),
}));
