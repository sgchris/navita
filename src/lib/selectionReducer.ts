/** Pure selection reducers (decisions B18). Selection is path-based (decisions A8). */

export interface SelectionState {
  selected: ReadonlySet<string>;
  anchor: string | null;
  focus: string | null;
}

export const EMPTY_SELECTION: SelectionState = { selected: new Set(), anchor: null, focus: null };

export interface ClickModifiers {
  meta: boolean;
  shift: boolean;
}

function range(paths: readonly string[], from: number, to: number): Set<string> {
  const [start, end] = from <= to ? [from, to] : [to, from];
  return new Set(paths.slice(start, end + 1));
}

/** Plain click replaces, ⌘-click toggles, ⇧-click (also ⌘⇧) selects the range from the anchor. */
export function click(
  state: SelectionState,
  paths: readonly string[],
  path: string,
  mods: ClickModifiers,
): SelectionState {
  const index = paths.indexOf(path);
  if (index < 0) return state;

  if (mods.shift) {
    const anchor = state.anchor !== null && paths.includes(state.anchor) ? state.anchor : path;
    return {
      selected: range(paths, paths.indexOf(anchor), index),
      anchor,
      focus: path,
    };
  }
  if (mods.meta) {
    const selected = new Set(state.selected);
    if (selected.has(path)) selected.delete(path);
    else selected.add(path);
    return { selected, anchor: path, focus: path };
  }
  return { selected: new Set([path]), anchor: path, focus: path };
}

/** Moves the focus to `targetIndex` (clamped); `extend` grows the range from the anchor. */
export function moveFocus(
  state: SelectionState,
  paths: readonly string[],
  targetIndex: number,
  extend: boolean,
): SelectionState {
  if (paths.length === 0) return state;
  const index = Math.min(Math.max(targetIndex, 0), paths.length - 1);
  const target = paths[index] as string;
  if (!extend) return { selected: new Set([target]), anchor: target, focus: target };

  const anchorCandidate = state.anchor ?? state.focus;
  const anchor =
    anchorCandidate !== null && paths.includes(anchorCandidate) ? anchorCandidate : target;
  return { selected: range(paths, paths.indexOf(anchor), index), anchor, focus: target };
}

export function selectOnly(path: string): SelectionState {
  return { selected: new Set([path]), anchor: path, focus: path };
}

export function selectAll(paths: readonly string[]): SelectionState {
  return {
    selected: new Set(paths),
    anchor: paths[0] ?? null,
    focus: paths[paths.length - 1] ?? null,
  };
}

export function clear(): SelectionState {
  return EMPTY_SELECTION;
}

/** Index of the focused item within `paths`, or null. */
export function focusIndexOf(state: SelectionState, paths: readonly string[]): number | null {
  if (state.focus === null) return null;
  const index = paths.indexOf(state.focus);
  return index < 0 ? null : index;
}

/** Keeps only paths that still exist (used when the visible list changes). */
export function prune(state: SelectionState, paths: readonly string[]): SelectionState {
  const available = new Set(paths);
  const selected = new Set([...state.selected].filter((p) => available.has(p)));
  return {
    selected,
    anchor: state.anchor !== null && available.has(state.anchor) ? state.anchor : null,
    focus: state.focus !== null && available.has(state.focus) ? state.focus : null,
  };
}

/** Target index for ↑/↓ in the List view (null focus: ↓ first, ↑ last). */
export function listTarget(
  focusIndex: number | null,
  count: number,
  key: "up" | "down",
): number | null {
  if (count === 0) return null;
  if (focusIndex === null) return key === "down" ? 0 : count - 1;
  return key === "down" ? Math.min(focusIndex + 1, count - 1) : Math.max(focusIndex - 1, 0);
}

/**
 * Selection after the visible list changed through a live refresh (decisions B7): keep selected
 * paths that still exist; if all of them vanished select the item now at the smallest former
 * index (clamped to the last item); an empty list clears the selection.
 */
export function reconcileSelection(
  state: SelectionState,
  oldPaths: readonly string[],
  newPaths: readonly string[],
): SelectionState {
  if (state.selected.size === 0) return state;
  const pruned = prune(state, newPaths);
  if (pruned.selected.size > 0) return pruned;

  const formerIndexes = oldPaths.flatMap((p, i) => (state.selected.has(p) ? [i] : []));
  const former = formerIndexes.length > 0 ? Math.min(...formerIndexes) : 0;
  const target = newPaths[Math.min(former, newPaths.length - 1)];
  return target === undefined ? EMPTY_SELECTION : selectOnly(target);
}
