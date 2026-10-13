import { commands, toAppError } from "../api/commands";
import { useClipboard } from "../state/clipboard";
import { useNavigation } from "../state/navigation";
import { useSelection } from "../state/selection";
import { useUi } from "../state/ui";
import { describeError } from "./open";
import { pasteMode } from "./pasteMode";
import { basename } from "./paths";
import { getSelectedEntries } from "./selected";
import { getVisiblePaths } from "./viewModel";

async function writeSelection(mode: "copy" | "cut"): Promise<void> {
  const paths = getSelectedEntries().map((e) => e.path);
  if (paths.length === 0) return;
  try {
    const changeCount = await commands.clipboardWriteFiles(paths);
    useClipboard.getState().set({ mode, paths, changeCount });
  } catch (e) {
    useUi.getState().flash(`Couldn’t ${mode}: ${describeError(toAppError(e))}`);
  }
}

/** Context menu "Copy": the selected items go on the system clipboard (Finder can paste them). */
export const copySelection = () => writeSelection("copy");

/**
 * Context menu "Cut": like Copy, plus Navita remembers to move on paste. macOS has no real "cut"
 * for files, so pasting in Finder or another app copies.
 */
export const cutSelection = () => writeSelection("cut");

/** True when the system clipboard currently holds files (enables the Paste menu items). */
export async function clipboardHasFiles(): Promise<boolean> {
  try {
    return (await commands.clipboardReadFiles()).paths.length > 0;
  } catch {
    return false;
  }
}

/** Pastes the files on the system clipboard into `destDir` (a copy, or a move after Cut). */
export async function pasteInto(destDir: string): Promise<void> {
  const ui = useUi.getState();
  try {
    const clip = await commands.clipboardReadFiles();
    if (clip.paths.length === 0) {
      ui.flash("Nothing to paste.");
      return;
    }
    const mark = useClipboard.getState();
    const move = pasteMode(mark, clip.changeCount) === "move";
    const created = await commands.pasteFiles(clip.paths, destDir, move);
    if (move) useClipboard.getState().clear();

    const navigation = useNavigation.getState();
    await navigation.refresh();
    if (destDir === navigation.currentPath) {
      const visible = new Set(getVisiblePaths());
      const shown = created.filter((p) => visible.has(p));
      useSelection.getState().set({
        selected: new Set(shown),
        anchor: shown[0] ?? null,
        focus: shown[shown.length - 1] ?? null,
      });
    } else {
      const noun = created.length === 1 ? "item" : "items";
      ui.flash(`Pasted ${created.length} ${noun} into “${basename(destDir)}”.`);
    }
  } catch (e) {
    ui.flash(`Couldn’t paste: ${describeError(toAppError(e))}`);
  }
}
