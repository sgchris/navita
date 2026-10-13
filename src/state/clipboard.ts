import { create } from "zustand";

/** Navita's side of the clipboard: whether the files on the system clipboard were cut or copied. */
export interface ClipboardMark {
  mode: "copy" | "cut" | null;
  /** Paths as Navita wrote them. */
  paths: string[];
  /** `NSPasteboard.changeCount` right after Navita wrote them. */
  changeCount: number;
}

interface ClipboardStore extends ClipboardMark {
  set: (mark: ClipboardMark) => void;
  clear: () => void;
}

const NONE: ClipboardMark = { mode: null, paths: [], changeCount: 0 };

export const useClipboard = create<ClipboardStore>()((set) => ({
  ...NONE,
  set: (mark) => set(mark),
  clear: () => set(NONE),
}));
