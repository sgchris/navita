import { focusIndexOf, listTarget } from "./selectionReducer";
import { gridTarget, type GridKey } from "./grid";
import { startRename } from "./fileOps";
import { openSelected } from "./open";
import {
  EMPTY_TYPE_AHEAD,
  findTypeAheadMatch,
  typeAheadStep,
  type TypeAheadState,
} from "./typeToSelect";
import { getSidebarRows } from "./sidebarModel";
import { rowKey, type SidebarRow } from "./treeFlatten";
import { getListEntries, getVisibleEntries } from "./viewModel";
import { usePrefs } from "../state/prefs";
import { useSelection } from "../state/selection";
import { useNavigation } from "../state/navigation";
import { useTree } from "../state/tree";
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
    const paths = getListEntries().map((entry) => entry.path);
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
  if (e.key === "Enter") {
    e.preventDefault();
    void openSelected();
    return;
  }
  if (e.key === "F2") {
    e.preventDefault();
    startRename();
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
    const match = entries[index];
    if (match) selection.selectOnly(match.path);
  } else if (e.key === " ") {
    e.preventDefault(); // Space does nothing in v1 (decisions A12)
  }
}

const isNavigable = (row: SidebarRow) => row.type === "place" || row.type === "node";
const pathOf = (row: SidebarRow) =>
  row.type === "place" ? row.place.path : row.type === "node" ? row.path : null;

/** Index of the row with sidebar keyboard focus: the stored key, else the current folder's row. */
function focusedSidebarIndex(rows: readonly SidebarRow[]): number {
  const { sidebarFocusKey } = useUi.getState();
  const byKey =
    sidebarFocusKey === null ? -1 : rows.findIndex((r) => rowKey(r) === sidebarFocusKey);
  if (byKey >= 0) return byKey;
  const current = useNavigation.getState().currentPath;
  const node = rows.findIndex((r) => r.type === "node" && r.path === current);
  return node >= 0 ? node : rows.findIndex((r) => r.type === "place" && r.place.path === current);
}

/** Moves sidebar focus to `row` and navigates there (decisions B15). */
function goToRow(row: SidebarRow): void {
  const path = pathOf(row);
  if (path === null) return;
  useUi.getState().setSidebarFocusKey(rowKey(row));
  void useNavigation.getState().navigate(path);
}

function handleSidebarKey(e: KeyboardEvent): void {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const rows = getSidebarRows();
  const index = focusedSidebarIndex(rows);
  const row = rows[index];

  if (e.key === "ArrowDown" || e.key === "ArrowUp") {
    e.preventDefault();
    const step = e.key === "ArrowDown" ? 1 : -1;
    for (let i = index + step; i >= 0 && i < rows.length; i += step) {
      const candidate = rows[i];
      if (candidate && isNavigable(candidate)) {
        goToRow(candidate);
        return;
      }
    }
    if (index < 0) {
      const first = rows.find(isNavigable);
      if (first) goToRow(first);
    }
    return;
  }

  if ((e.key === "ArrowLeft" || e.key === "ArrowRight") && row?.type === "node") {
    e.preventDefault();
    const tree = useTree.getState();
    if (e.key === "ArrowLeft") {
      if (row.expanded && row.hasArrow) {
        tree.collapse(row.path);
        return;
      }
      for (let i = index - 1; i >= 0; i--) {
        const candidate = rows[i];
        if (candidate?.type === "node" && candidate.depth === row.depth - 1) {
          goToRow(candidate);
          return;
        }
      }
      return;
    }
    if (!row.expanded && row.hasArrow) {
      void tree.expand(row.path);
      return;
    }
    const next = rows[index + 1];
    if (row.expanded && next?.type === "node" && next.depth === row.depth + 1) goToRow(next);
    return;
  }

  if (e.key === "Home" || e.key === "End" || e.key === "PageUp" || e.key === "PageDown") {
    e.preventDefault();
  }
}

function onKeyDown(e: KeyboardEvent): void {
  if (e.defaultPrevented || isTextInput(e.target)) return;
  const ui = useUi.getState();
  if (ui.renamingPath !== null) return;

  if (e.key === "Tab" && !e.metaKey && !e.ctrlKey && !e.altKey) {
    e.preventDefault();
    ui.setFocusedPane(ui.focusedPane === "sidebar" ? "content" : "sidebar");
    return;
  }
  if (ui.focusedPane === "content") handleContentKey(e);
  else handleSidebarKey(e);
}

/** Installs the single window-level keydown handler (arrows, type-to-select, Esc, ⌘↓). */
export function installKeyboard(): void {
  window.addEventListener("keydown", onKeyDown);
}
