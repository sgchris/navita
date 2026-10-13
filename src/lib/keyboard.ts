import { focusIndexOf, listTarget } from "./selectionReducer";
import { gridTarget, type GridKey } from "./grid";
import { openSelected } from "./open";
import {
  EMPTY_TYPE_AHEAD,
  findTypeAheadMatch,
  typeAheadStep,
  type TypeAheadState,
} from "./typeToSelect";
import { getVisibleEntries } from "./viewModel";
import { usePrefs } from "../state/prefs";
import { useSelection } from "../state/selection";
import { useUi } from "../state/ui";

const ARROWS: Record<string, GridKey> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
};
const SUPPRESSED = new Set(["Home", "End", "PageUp", "PageDown"]);

let typeAhead: TypeAheadState = EMPTY_TYPE_AHEAD;

function isTextInput(target: EventTarget | null): boolean {
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;
}

function handleContentKey(e: KeyboardEvent): void {
  const selection = useSelection.getState();
  const entries = getVisibleEntries();

  if (e.metaKey && e.key === "ArrowDown") {
    e.preventDefault();
    void openSelected();
    return;
  }
  if (e.metaKey || e.ctrlKey || e.altKey) return;

  const arrow = ARROWS[e.key];
  if (arrow) {
    e.preventDefault();
    const paths = entries.map((entry) => entry.path);
    const focusIndex = focusIndexOf(selection, paths);
    const target =
      usePrefs.getState().viewMode === "list"
        ? arrow === "up" || arrow === "down"
          ? listTarget(focusIndex, paths.length, arrow)
          : null
        : gridTarget(focusIndex, paths.length, useUi.getState().columns, arrow);
    if (target !== null) selection.moveTo(target, e.shiftKey);
    return;
  }
  if (e.key === "Escape") {
    selection.clear();
    return;
  }
  if (SUPPRESSED.has(e.key)) {
    e.preventDefault();
    return;
  }

  const next = typeAheadStep(typeAhead, e.key, Date.now());
  if (next) {
    e.preventDefault();
    typeAhead = next;
    const index = findTypeAheadMatch(
      entries.map((entry) => entry.name),
      next.text,
    );
    if (index >= 0) selection.moveTo(index, false);
  } else if (e.key === " ") {
    e.preventDefault(); // Space does nothing in v1 (decisions A12)
  }
}

function onKeyDown(e: KeyboardEvent): void {
  if (e.defaultPrevented || isTextInput(e.target)) return;
  // TEMPORARY until M4 replaces it with the native menu accelerator (decisions B39).
  if (e.metaKey && e.altKey && e.code === "KeyS") {
    e.preventDefault();
    const prefs = usePrefs.getState();
    prefs.setSidebarVisible(!prefs.sidebarVisible);
    return;
  }
  const ui = useUi.getState();
  if (ui.renamingPath !== null) return;
  if (ui.focusedPane === "content") handleContentKey(e);
}

/** Installs the single window-level keydown handler (arrows, type-to-select, Esc, ⌘↓). */
export function installKeyboard(): void {
  window.addEventListener("keydown", onKeyDown);
}
