import { create } from "zustand";
import {
  EMPTY_SELECTION,
  click as clickReducer,
  moveFocus as moveFocusReducer,
  prune as pruneReducer,
  selectAll as selectAllReducer,
  selectOnly as selectOnlyReducer,
  type ClickModifiers,
  type SelectionState,
} from "../lib/selectionReducer";
import { getVisiblePaths } from "../lib/viewModel";

interface SelectionActions {
  click: (path: string, mods: ClickModifiers) => void;
  /** Moves focus to a visible-list index (clamped); `extend` grows the range from the anchor. */
  moveTo: (index: number, extend: boolean) => void;
  selectAll: () => void;
  selectOnly: (path: string) => void;
  clear: () => void;
  /** Drops selected paths that are no longer visible (hidden toggle, refresh). */
  prune: () => void;
  set: (state: SelectionState) => void;
}

export const useSelection = create<SelectionState & SelectionActions>()((set, get) => ({
  ...EMPTY_SELECTION,
  click: (path, mods) => set(clickReducer(get(), getVisiblePaths(), path, mods)),
  moveTo: (index, extend) => set(moveFocusReducer(get(), getVisiblePaths(), index, extend)),
  selectAll: () => set(selectAllReducer(getVisiblePaths())),
  selectOnly: (path) => set(selectOnlyReducer(path)),
  clear: () => set(EMPTY_SELECTION),
  prune: () => set(pruneReducer(get(), getVisiblePaths())),
  set: (state) => set(state),
}));
