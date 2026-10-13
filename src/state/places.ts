import { create } from "zustand";
import { commands } from "../api/commands";
import type { Place } from "../api/bindings/Place";

export const FALLBACK_ROOT_NAME = "Macintosh HD";

interface PlacesState {
  places: Place[];
  /** Display name of `/` (the startup volume, decisions B2). */
  rootName: string;
  load: () => Promise<void>;
}

export const usePlaces = create<PlacesState>()((set) => ({
  places: [],
  rootName: FALLBACK_ROOT_NAME,
  load: async () => {
    try {
      const places = await commands.places();
      const root = places.find((p) => p.kind === "root");
      set({ places, rootName: root?.name ?? FALLBACK_ROOT_NAME });
    } catch {
      // keep the previous places; the sidebar still shows the Folders tree
    }
  },
}));
