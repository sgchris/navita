/** Back/Forward history (decisions B9): pure functions over an immutable structure. */

export const MAX_HISTORY = 100;

export interface HistoryEntry {
  path: string;
  /** Selection, focus and scroll captured when leaving the folder. */
  selection: string[];
  focus: string | null;
  scrollTop: number;
  viewMode: "icons" | "list";
}

export interface History {
  entries: HistoryEntry[];
  index: number;
}

export const EMPTY_HISTORY: History = { entries: [], index: -1 };

export function newEntry(path: string, viewMode: HistoryEntry["viewMode"]): HistoryEntry {
  return { path, selection: [], focus: null, scrollTop: 0, viewMode };
}

export function currentEntry(history: History): HistoryEntry | undefined {
  return history.entries[history.index];
}

/**
 * Navigating to a new folder truncates the forward entries and keeps at most MAX_HISTORY entries.
 * Pushing the path that is already current is a no-op.
 */
export function push(history: History, entry: HistoryEntry): History {
  if (currentEntry(history)?.path === entry.path) return history;
  const entries = [...history.entries.slice(0, history.index + 1), entry].slice(-MAX_HISTORY);
  return { entries, index: entries.length - 1 };
}

export const canGoBack = (history: History): boolean => history.index > 0;

export const canGoForward = (history: History): boolean =>
  history.index >= 0 && history.index < history.entries.length - 1;

export function goBack(history: History): History {
  return canGoBack(history) ? { ...history, index: history.index - 1 } : history;
}

export function goForward(history: History): History {
  return canGoForward(history) ? { ...history, index: history.index + 1 } : history;
}

/** Moves to an absolute index (used after a successful load of that entry). */
export function goTo(history: History, index: number): History {
  return index >= 0 && index < history.entries.length ? { ...history, index } : history;
}

/** Stores selection/scroll in the current entry (called right before leaving a folder). */
export function updateCurrent(
  history: History,
  patch: Partial<Omit<HistoryEntry, "path">>,
): History {
  const current = currentEntry(history);
  if (!current) return history;
  const entries = [...history.entries];
  entries[history.index] = { ...current, ...patch };
  return { ...history, entries };
}
