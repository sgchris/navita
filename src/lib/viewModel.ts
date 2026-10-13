import { useMemo } from "react";
import type { Entry } from "../api/bindings/Entry";
import { useListing } from "../state/listing";
import { usePrefs } from "../state/prefs";
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

export function getVisiblePaths(): string[] {
  return getVisibleEntries().map((e) => e.path);
}

/** React hook form of {@link getVisibleEntries}. */
export function useVisibleEntries(): Entry[] {
  const entries = useListing((s) => s.entries);
  const sort = usePrefs((s) => s.sort);
  const showHidden = usePrefs((s) => s.showHidden);
  return useMemo(() => deriveVisible(entries, sort, showHidden), [entries, sort, showHidden]);
}
