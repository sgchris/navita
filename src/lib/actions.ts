import { commands, toAppError } from "../api/commands";
import { nextSort, type SortKey } from "./sort";
import { createItem, startRename, trashSelection } from "./fileOps";
import { describeError, openSelected } from "./open";
import { getSelectedEntries } from "./selected";
import { useNavigation } from "../state/navigation";
import { usePlaces } from "../state/places";
import { usePrefs } from "../state/prefs";
import { useSelection } from "../state/selection";
import { useUi } from "../state/ui";
import type { Place } from "../api/bindings/Place";

/** Every action the native menu, context menus and keyboard can trigger (menu ids, spec 10). */
export type ActionId =
  | "file.open"
  | "file.reveal"
  | "file.copyPath"
  | "file.getInfo"
  | "file.newFolder"
  | "file.rename"
  | "file.trash"
  | "edit.selectAll"
  | "view.icons"
  | "view.list"
  | "view.toggleHidden"
  | "view.toggleSidebar"
  | "view.togglePathBar"
  | "view.toggleStatusBar"
  | "view.sort.name"
  | "view.sort.modified"
  | "view.sort.size"
  | "view.sort.kind"
  | "go.back"
  | "go.forward"
  | "go.up"
  | "go.home"
  | "go.desktop"
  | "go.documents"
  | "go.downloads"
  | "go.applications";

const SORT_KEYS: Record<string, SortKey> = {
  "view.sort.name": "name",
  "view.sort.modified": "modified",
  "view.sort.size": "size",
  "view.sort.kind": "kind",
};

const GO_PLACES: Record<string, Place["kind"]> = {
  "go.desktop": "desktop",
  "go.documents": "documents",
  "go.downloads": "downloads",
  "go.applications": "applications",
};

async function guarded(label: string, work: () => Promise<unknown>): Promise<void> {
  try {
    await work();
  } catch (e) {
    useUi.getState().flash(`${label}: ${describeError(toAppError(e))}`);
  }
}

function goToPlace(kind: Place["kind"]): void {
  const place = usePlaces.getState().places.find((p) => p.kind === kind);
  if (place) void useNavigation.getState().navigate(place.path);
  else useUi.getState().flash("That folder doesn’t exist.");
}

/** Runs an action by id; unknown ids are ignored. */
export function dispatchAction(id: string): void {
  // While a name is being edited only Select All (of the text) is honoured (decisions B31).
  if (useUi.getState().renamingPath !== null) {
    if (id === "edit.selectAll")
      document.querySelector<HTMLInputElement>(".rename-input")?.select();
    return;
  }
  const prefs = usePrefs.getState();
  const navigation = useNavigation.getState();
  const sortKey = SORT_KEYS[id];
  if (sortKey) {
    prefs.setSort(nextSort(prefs.sort, sortKey));
    return;
  }
  const placeKind = GO_PLACES[id];
  if (placeKind) {
    goToPlace(placeKind);
    return;
  }

  switch (id as ActionId) {
    case "file.open":
      void openSelected();
      return;
    case "file.reveal": {
      const paths = getSelectedEntries().map((e) => e.path);
      if (paths.length > 0)
        void guarded("Couldn’t reveal in Finder", () => commands.revealInFinder(paths));
      return;
    }
    case "file.copyPath": {
      const paths = getSelectedEntries().map((e) => e.path);
      const text = paths.length > 0 ? paths.join("\n") : (navigation.currentPath ?? "");
      if (text) void guarded("Couldn’t copy", () => commands.copyText(text));
      return;
    }
    case "file.getInfo": {
      const paths = getSelectedEntries().map((e) => e.path);
      if (paths.length > 0) void guarded("Couldn’t show info", () => commands.getInfo(paths));
      return;
    }
    case "file.newFolder":
      void createItem("folder");
      return;
    case "file.rename":
      startRename();
      return;
    case "file.trash":
      void trashSelection();
      return;
    case "edit.selectAll":
      useSelection.getState().selectAll();
      return;
    case "view.icons":
      prefs.setViewMode("icons");
      return;
    case "view.list":
      prefs.setViewMode("list");
      return;
    case "view.toggleHidden":
      prefs.toggleShowHidden();
      return;
    case "view.toggleSidebar":
      prefs.setSidebarVisible(!prefs.sidebarVisible);
      return;
    case "view.togglePathBar":
      prefs.setPathBarVisible(!prefs.pathBarVisible);
      return;
    case "view.toggleStatusBar":
      prefs.setStatusBarVisible(!prefs.statusBarVisible);
      return;
    case "go.back":
      void navigation.back();
      return;
    case "go.forward":
      void navigation.forward();
      return;
    case "go.up":
      void navigation.up();
      return;
    case "go.home":
      void navigation.home();
      return;
    default:
      return;
  }
}
