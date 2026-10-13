import { ask } from "@tauri-apps/plugin-dialog";
import type { Entry } from "../api/bindings/Entry";
import { commands, toAppError } from "../api/commands";
import { useListing } from "../state/listing";
import { useNavigation } from "../state/navigation";
import { useSelection } from "../state/selection";
import { useUi } from "../state/ui";
import { alreadyExistsMessage } from "./names";
import { describeError } from "./open";
import { getSelectedEntries } from "./selected";
import { trashConfirmationText } from "./trashMessage";
import { getVisiblePaths } from "./viewModel";

export type RenameResult = { ok: true } | { ok: false; message: string; keepEditing: boolean };

/** After a refresh: select `path` if it is visible, otherwise drop the selection. */
function selectIfVisible(path: string): boolean {
  const selection = useSelection.getState();
  if (getVisiblePaths().includes(path)) {
    selection.selectOnly(path);
    return true;
  }
  selection.clear();
  return false;
}

/** Return key / Rename menu item: edits the name of the single selected item (decisions B31). */
export function startRename(): void {
  const ui = useUi.getState();
  if (ui.renamingPath !== null) return;
  const selected = getSelectedEntries();
  const only = selected.length === 1 ? selected[0] : undefined;
  if (only) ui.setRenamingPath(only.path);
}

export function cancelRename(): void {
  useUi.getState().setRenamingPath(null);
}

/**
 * Renames `entry`. Name clashes and invalid names keep the editor open with a message; other
 * failures close it and show a status-bar message.
 */
export async function commitRename(entry: Entry, newName: string): Promise<RenameResult> {
  try {
    const newPath = await commands.renamePath(entry.path, newName);
    useUi.getState().setRenamingPath(null);
    await useNavigation.getState().refresh();
    selectIfVisible(newPath);
    return { ok: true };
  } catch (e) {
    const error = toAppError(e);
    if (error.code === "alreadyExists") {
      return { ok: false, message: alreadyExistsMessage(newName), keepEditing: true };
    }
    if (error.code === "invalidName")
      return { ok: false, message: error.reason, keepEditing: true };
    const message = `Couldn’t rename “${entry.name}”: ${describeError(error)}`;
    useUi.getState().setRenamingPath(null);
    useUi.getState().flash(message);
    return { ok: false, message, keepEditing: false };
  }
}

/** New Folder: creates `untitled folder`, selects it and starts renaming it (decisions B33). */
export async function createFolder(): Promise<void> {
  const parent = useNavigation.getState().currentPath;
  if (parent === null || useListing.getState().status !== "ready") return;
  try {
    const newPath = await commands.createFolder(parent);
    await useNavigation.getState().refresh();
    if (selectIfVisible(newPath)) useUi.getState().setRenamingPath(newPath);
  } catch (e) {
    useUi.getState().flash(`Couldn’t create folder: ${describeError(toAppError(e))}`);
  }
}

let trashDialogOpen = false;

/**
 * Asks the user to confirm moving `entries` to the Trash. Never resolves to true unless the user
 * explicitly confirmed; any failure to show the dialog counts as "not confirmed".
 */
async function confirmTrash(entries: readonly Entry[]): Promise<boolean> {
  try {
    return await ask(trashConfirmationText(entries.map((e) => e.name)), {
      title: "Move to Trash",
      kind: "warning",
      okLabel: "Move to Trash",
      cancelLabel: "Cancel",
    });
  } catch (e) {
    useUi.getState().flash(`Couldn’t show the confirmation: ${describeError(toAppError(e))}`);
    return false;
  }
}

/**
 * Move to Trash for the selection, after a confirmation dialog. This is the only caller of the
 * `trash_paths` command, so the menu, ⌘⌫ and the context menu are all guarded. Afterwards the
 * selection moves to the next item (decisions B7).
 */
export async function trashSelection(): Promise<void> {
  if (trashDialogOpen) return;
  const entries = getSelectedEntries();
  if (entries.length === 0) return;

  trashDialogOpen = true;
  let confirmed = false;
  try {
    confirmed = await confirmTrash(entries);
  } finally {
    trashDialogOpen = false;
  }
  if (!confirmed) return;

  try {
    await commands.trashPaths(entries.map((e) => e.path));
    await useNavigation.getState().refresh();
  } catch (e) {
    const error = toAppError(e);
    const only = entries.length === 1 ? entries[0] : undefined;
    useUi
      .getState()
      .flash(
        error.code === "protected" && only
          ? `“${only.name}” can’t be moved to the Trash.`
          : `Couldn’t move to Trash: ${describeError(error)}`,
      );
  }
}
