import { create } from "zustand";
import { commands, type AppError, type DirListing } from "../api/commands";
import {
  EMPTY_HISTORY,
  canGoBack,
  canGoForward,
  currentEntry,
  goBack,
  goForward,
  goTo,
  newEntry,
  push,
  updateCurrent,
  type History,
  type HistoryEntry,
} from "../lib/history";
import { basename, parentOf } from "../lib/paths";
import { reconcileSelection, selectOnly } from "../lib/selectionReducer";
import { getVisibleEntries } from "../lib/viewModel";
import { isParentPath } from "../lib/parentRow";
import { useListing } from "./listing";
import { usePrefs } from "./prefs";
import { useSelection } from "./selection";
import { useTree } from "./tree";
import { useUi } from "./ui";

export interface NavigateOptions {
  /** Select this child after loading (used by Up). */
  selectChild?: string;
}

interface NavigationState {
  homePath: string;
  /** Canonical path of the folder being shown (the requested path while in error state). */
  currentPath: string | null;
  history: History;
  setHomePath: (path: string) => void;
  /** Starts at `startPath`, falling back to Home on any failure (decisions B3). */
  init: (startPath: string | null) => Promise<void>;
  navigate: (path: string, options?: NavigateOptions) => Promise<void>;
  /** Silent reload of the current folder after a filesystem change (decisions B5, B7). */
  refresh: () => Promise<void>;
  back: () => Promise<void>;
  forward: () => Promise<void>;
  up: () => Promise<void>;
  home: () => Promise<void>;
}

export const useNavigation = create<NavigationState>()((set, get) => {
  /** Saves selection and scroll of the folder being left into its history entry. */
  const captureCurrent = () => {
    const selection = useSelection.getState();
    set((s) => ({
      history: updateCurrent(s.history, {
        selection: [...selection.selected],
        focus: selection.focus,
        scrollTop: useUi.getState().scrollApi?.getScrollTop() ?? 0,
        viewMode: usePrefs.getState().viewMode,
      }),
    }));
  };

  /** Commits a successful listing together with path, history and selection (one tick). */
  const commitSuccess = (
    listing: DirListing,
    mode:
      | { kind: "push"; selectChild?: string }
      | { kind: "restore"; index: number; entry: HistoryEntry },
  ) => {
    const samePath = get().currentPath === listing.path && mode.kind === "push";
    useListing.getState().commit(listing);
    set((s) => ({
      currentPath: listing.path,
      history:
        mode.kind === "restore"
          ? goTo(s.history, mode.index)
          : push(s.history, newEntry(listing.path, usePrefs.getState().viewMode)),
    }));
    usePrefs.getState().setLastPath(listing.path);
    void useTree.getState().revealPath(listing.path);
    void commands.watchDir(listing.path).catch(() => undefined);

    const selection = useSelection.getState();
    if (mode.kind === "restore") {
      const available = new Set(listing.entries.map((e) => e.path));
      const kept = mode.entry.selection.filter((p) => available.has(p));
      const focus =
        mode.entry.focus !== null && available.has(mode.entry.focus) ? mode.entry.focus : null;
      selection.set({
        selected: new Set(kept),
        anchor: focus ?? kept[0] ?? null,
        focus: focus ?? kept[0] ?? null,
      });
      restoreScroll(mode.entry, kept[0] ?? null);
    } else if (mode.selectChild) {
      selection.set(selectOnly(mode.selectChild));
    } else if (samePath) {
      selection.prune();
    } else {
      selection.clear();
    }
  };

  /** After the views re-rendered: same view mode restores scrollTop, otherwise reveal selection. */
  const restoreScroll = (entry: HistoryEntry, firstSelected: string | null) => {
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        const api = useUi.getState().scrollApi;
        if (!api) return;
        if (entry.viewMode === usePrefs.getState().viewMode) api.setScrollTop(entry.scrollTop);
        else if (firstSelected) api.scrollToPath(firstSelected);
      }),
    );
  };

  const failWith = async (path: string, error: AppError): Promise<void> => {
    if (error.code === "notFound") {
      const ancestor = parentOf(path);
      useUi.getState().flash(`“${basename(path)}” no longer exists.`);
      if (ancestor !== null) await get().navigate(ancestor);
      return;
    }
    if (error.code === "notADirectory") {
      useUi.getState().flash(`“${basename(path)}” is not a folder.`);
      return;
    }
    set({ currentPath: path });
    useListing.getState().setError(error);
    useSelection.getState().clear();
  };

  const moveInHistory = async (index: number): Promise<void> => {
    const entry = get().history.entries[index];
    if (!entry) return;
    captureCurrent();
    const result = await useListing.getState().fetch(entry.path);
    if (result.kind === "stale") return;
    if (result.kind === "ok") {
      commitSuccess(result.listing, { kind: "restore", index, entry });
      return;
    }
    await failWith(entry.path, result.error);
  };

  return {
    homePath: "/",
    currentPath: null,
    history: EMPTY_HISTORY,

    setHomePath: (homePath) => set({ homePath }),

    init: async (startPath) => {
      const { homePath } = get();
      const target = startPath ?? homePath;
      const result = await useListing.getState().fetch(target);
      if (result.kind === "stale") return;
      if (result.kind === "ok") {
        commitSuccess(result.listing, { kind: "push" });
        return;
      }
      if (target !== homePath) {
        await get().navigate(homePath);
        return;
      }
      set({ currentPath: homePath });
      useListing.getState().setError(result.error);
    },

    navigate: async (path, options) => {
      if (get().currentPath !== null) captureCurrent();
      const result = await useListing.getState().fetch(path);
      if (result.kind === "stale") return;
      if (result.kind === "ok") {
        commitSuccess(result.listing, { kind: "push", selectChild: options?.selectChild });
        return;
      }
      await failWith(path, result.error);
    },

    refresh: async () => {
      const path = get().currentPath;
      if (path === null) return;
      const result = await useListing.getState().fetch(path, { silent: true });
      if (result.kind === "stale") return;
      if (result.kind === "error") {
        await failWith(path, result.error);
        return;
      }
      const selection = useSelection.getState();
      const parentOnly =
        selection.selected.size === 1 && isParentPath([...selection.selected][0] ?? "");
      const oldPaths = getVisibleEntries().map((e) => e.path);
      useListing.getState().commit(result.listing);
      // Reconcile on real items only; a selection of just the ".." row is left alone (B7).
      if (!parentOnly) {
        selection.set(
          reconcileSelection(
            { selected: selection.selected, anchor: selection.anchor, focus: selection.focus },
            oldPaths,
            getVisibleEntries().map((e) => e.path),
          ),
        );
      }
      if (import.meta.env.DEV) {
        console.info(`[navita] refreshed ${path} entries=${result.listing.entries.length}`);
      }
    },

    back: async () => {
      const { history } = get();
      if (canGoBack(history)) await moveInHistory(goBack(history).index);
    },

    forward: async () => {
      const { history } = get();
      if (canGoForward(history)) await moveInHistory(goForward(history).index);
    },

    up: async () => {
      const { currentPath } = get();
      const parent = currentPath === null ? null : parentOf(currentPath);
      if (currentPath !== null && parent !== null) {
        await get().navigate(parent, { selectChild: currentPath });
      }
    },

    home: async () => get().navigate(get().homePath),
  };
});

/** Derived flags for the toolbar and the native menu. */
export const selectCanBack = (s: NavigationState) => canGoBack(s.history);
export const selectCanForward = (s: NavigationState) => canGoForward(s.history);
export const selectCanUp = (s: NavigationState) => s.currentPath !== null && s.currentPath !== "/";
export const selectCurrentHistoryEntry = (s: NavigationState) => currentEntry(s.history);
