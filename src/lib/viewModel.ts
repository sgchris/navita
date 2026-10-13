import { useMemo } from "react";
import type { Entry } from "../api/bindings/Entry";
import { useListing } from "../state/listing";
import { usePrefs } from "../state/prefs";
import { withParentRow } from "./parentRow";
import { sortEntries, type SortSpec } from "./sort";
import { filterVisible } from "./visible";

let lastInput: { entries: Entry[]; sort: SortSpec; showHidden: boolean } | null = null;
let lastOutput: Entry[] = [];

/** Sorted and hidden-filtered entries, memoized on the last inputs (shared by hooks and handlers). */
export function deriveVisible(entries: Entry[], sort: SortSpec, showHidden: boolean): Entry[] {
  if (
    lastInput &&
    lastInput.entries === entries &&
    lastInput.sort === sort &&
    lastInput.showHidden === showHidden
  ) {
    return lastOutput;
  }
  lastOutput = sortEntries(filterVisible(entries, showHidden), sort);
  lastInput = { entries, sort, showHidden };
  return lastOutput;
}

/** Current visible entries read outside React (keyboard handlers, store actions). */
export function getVisibleEntries(): Entry[] {
  const { entries } = useListing.getState();
  const { sort, showHidden } = usePrefs.getState();
  return deriveVisible(entries, sort, showHidden);
}

/**
 * Rows of the current view: the real visible entries, preceded by the ".." row in List view (not
 * at the root). Used for rendering, keyboard navigation and range selection.
 */
export function getListEntries(): Entry[] {
  const { path, status } = useListing.getState();
  const { viewMode } = usePrefs.getState();
  return withParentRow(getVisibleEntries(), path, viewMode === "list" && status === "ready");
}

/** Paths of {@link getListEntries} (includes the ".." row in List view). */
export function getVisiblePaths(): string[] {
  return getListEntries().map((e) => e.path);
}

/** React hook form of {@link getListEntries}. */
export function useListEntries(): Entry[] {
  const visible = useVisibleEntries();
  const path = useListing((s) => s.path);
  const status = useListing((s) => s.status);
  const viewMode = usePrefs((s) => s.viewMode);
  return useMemo(
    () => withParentRow(visible, path, viewMode === "list" && status === "ready"),
    [visible, path, status, viewMode],
  );
}

/** React hook form of {@link getVisibleEntries}. */
export function useVisibleEntries(): Entry[] {
  const entries = useListing((s) => s.entries);
  const sort = usePrefs((s) => s.sort);
  const showHidden = usePrefs((s) => s.showHidden);
  return useMemo(() => deriveVisible(entries, sort, showHidden), [entries, sort, showHidden]);
}
