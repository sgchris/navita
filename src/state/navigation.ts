import { create } from "zustand";
import type { DirListing } from "../api/commands";
import { basename, parentOf } from "../lib/paths";
import { useListing } from "./listing";
import { useSelection } from "./selection";
import { useUi } from "./ui";

export interface NavigateOptions {
  /** Select this child after loading (used by Up). */
  selectChild?: string;
}

interface NavigationState {
  homePath: string;
  /** Canonical path of the folder being shown (the requested path while in error state). */
  currentPath: string | null;
  setHomePath: (path: string) => void;
  /** Starts at `startPath`, falling back to Home on any failure (decisions B3). */
  init: (startPath: string | null) => Promise<void>;
  navigate: (path: string, options?: NavigateOptions) => Promise<void>;
}

export const useNavigation = create<NavigationState>()((set, get) => ({
  homePath: "/",
  currentPath: null,

  setHomePath: (homePath) => set({ homePath }),

  init: async (startPath) => {
    const { homePath } = get();
    const target = startPath ?? homePath;
    const result = await useListing.getState().fetch(target);
    if (result.kind === "stale") return;
    if (result.kind === "ok") {
      commitSuccess(result.listing.path, result.listing, undefined);
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
    const result = await useListing.getState().fetch(path);
    if (result.kind === "stale") return;
    if (result.kind === "ok") {
      commitSuccess(result.listing.path, result.listing, options);
      return;
    }
    const { error } = result;
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
  },
}));

function commitSuccess(
  path: string,
  listing: DirListing,
  options: NavigateOptions | undefined,
): void {
  useListing.getState().commit(listing);
  useNavigation.setState({ currentPath: path });
  const selection = useSelection.getState();
  if (options?.selectChild) selection.selectOnly(options.selectChild);
  else selection.clear();
}
