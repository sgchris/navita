import { create } from "zustand";
import { commands } from "../api/commands";

interface VolumeState {
  /** Free bytes on the volume of the current folder, or null when unknown. */
  freeBytes: number | null;
  refresh: (path: string) => Promise<void>;
}

let latest = 0;

export const useVolume = create<VolumeState>()((set) => ({
  freeBytes: null,
  refresh: async (path) => {
    const request = ++latest;
    try {
      const info = await commands.volumeInfo(path);
      if (request === latest) set({ freeBytes: info.freeBytes });
    } catch {
      if (request === latest) set({ freeBytes: null });
    }
  },
}));
