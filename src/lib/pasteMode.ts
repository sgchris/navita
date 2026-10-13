import type { ClipboardMark } from "../state/clipboard";

/**
 * Pasting moves only when Navita cut the files **and** nothing else was put on the clipboard since
 * (the change counter still matches); in every other case, including files copied in Finder,
 * pasting copies.
 */
export function pasteMode(mark: ClipboardMark, pasteboardChangeCount: number): "move" | "copy" {
  return mark.mode === "cut" && mark.changeCount === pasteboardChangeCount ? "move" : "copy";
}
