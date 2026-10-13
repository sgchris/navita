import type { Entry } from "../api/bindings/Entry";

/** Name of the synthetic first row of the List view that goes to the parent folder. */
export const PARENT_NAME = "..";

/**
 * The synthetic ".." entry for the folder at `currentPath`. Its path is deliberately not a real
 * path (`<folder>/..`), so it can never be confused with, or acted on like, a real item.
 */
export function makeParentEntry(currentPath: string): Entry {
  return {
    name: PARENT_NAME,
    path: `${currentPath}/..`,
    kind: "directory",
    isHidden: false,
    isDirLike: true,
    size: null,
    modifiedMs: null,
    extension: null,
    symlinkTarget: null,
    isBrokenLink: false,
    isReadable: true,
  };
}

/** Real files cannot be named "..", so the name identifies the synthetic entry. */
export const isParentEntry = (entry: Pick<Entry, "name">): boolean => entry.name === PARENT_NAME;

export const isParentPath = (path: string): boolean => path.endsWith("/..");

/** Prepends the ".." row when `enabled` (List view) and the folder is not the root. */
export function withParentRow(
  entries: readonly Entry[],
  currentPath: string | null,
  enabled: boolean,
): Entry[] {
  if (!enabled || currentPath === null || currentPath === "/") return [...entries];
  return [makeParentEntry(currentPath), ...entries];
}

/** Number of selected paths that are real items (the ".." row never counts). */
export function countRealSelected(selected: ReadonlySet<string>): number {
  let count = 0;
  for (const path of selected) if (!isParentPath(path)) count++;
  return count;
}
