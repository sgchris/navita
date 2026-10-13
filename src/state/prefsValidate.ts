import {
  COLUMN_MIN,
  DEFAULT_PREFS,
  SIDEBAR_MAX,
  SIDEBAR_MIN,
  type ColumnWidths,
  type Prefs,
  type SectionId,
  type ViewMode,
} from "./prefs";
import type { SortKey, SortSpec } from "../lib/sort";

const MAX_EXPANDED_PATHS = 500;
const MAX_COLUMN_WIDTH = 2000;
const VIEW_MODES: readonly ViewMode[] = ["icons", "list"];
const SORT_KEYS: readonly SortKey[] = ["name", "modified", "size", "kind"];
const SECTIONS: readonly SectionId[] = ["favorites", "locations", "folders"];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isAbsolutePath = (value: unknown): value is string =>
  typeof value === "string" && value.startsWith("/");

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.round(value)));
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

/** Builds valid preferences from untrusted stored values; anything invalid becomes its default. */
export function validatePrefs(raw: Partial<Record<keyof Prefs, unknown>>): Prefs {
  const defaults = DEFAULT_PREFS;

  const sortRaw = raw.sort;
  let sort: SortSpec = defaults.sort;
  if (isRecord(sortRaw) && SORT_KEYS.includes(sortRaw.key as SortKey)) {
    if (sortRaw.dir === "asc" || sortRaw.dir === "desc") {
      sort = { key: sortRaw.key as SortKey, dir: sortRaw.dir };
    }
  }

  const widthsRaw = isRecord(raw.columnWidths) ? raw.columnWidths : {};
  const columnWidths: ColumnWidths = {
    modified: clampNumber(
      widthsRaw.modified,
      COLUMN_MIN.modified,
      MAX_COLUMN_WIDTH,
      defaults.columnWidths.modified,
    ),
    size: clampNumber(
      widthsRaw.size,
      COLUMN_MIN.size,
      MAX_COLUMN_WIDTH,
      defaults.columnWidths.size,
    ),
    kind: clampNumber(
      widthsRaw.kind,
      COLUMN_MIN.kind,
      MAX_COLUMN_WIDTH,
      defaults.columnWidths.kind,
    ),
  };

  const collapsedSections = Array.isArray(raw.collapsedSections)
    ? SECTIONS.filter((s) => (raw.collapsedSections as unknown[]).includes(s))
    : defaults.collapsedSections;

  const expandedTreePaths = Array.isArray(raw.expandedTreePaths)
    ? [...new Set(raw.expandedTreePaths.filter(isAbsolutePath))].slice(0, MAX_EXPANDED_PATHS)
    : defaults.expandedTreePaths;

  return {
    viewMode: VIEW_MODES.includes(raw.viewMode as ViewMode)
      ? (raw.viewMode as ViewMode)
      : defaults.viewMode,
    sort,
    showHidden: bool(raw.showHidden, defaults.showHidden),
    sidebarWidth: clampNumber(raw.sidebarWidth, SIDEBAR_MIN, SIDEBAR_MAX, defaults.sidebarWidth),
    sidebarVisible: bool(raw.sidebarVisible, defaults.sidebarVisible),
    pathBarVisible: bool(raw.pathBarVisible, defaults.pathBarVisible),
    statusBarVisible: bool(raw.statusBarVisible, defaults.statusBarVisible),
    columnWidths,
    collapsedSections,
    lastPath: isAbsolutePath(raw.lastPath) ? raw.lastPath : defaults.lastPath,
    expandedTreePaths,
  };
}
