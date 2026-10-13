import type { Entry } from "../api/bindings/Entry";
import { commands, toAppError } from "../api/commands";
import { useNavigation } from "../state/navigation";
import { useUi } from "../state/ui";
import { getSelectedEntries } from "./selected";

const BROKEN_ALIAS_MESSAGE = "The alias can’t be opened because the original item can’t be found.";

/** Opening semantics (decisions B6). */
export async function openEntries(entries: readonly Entry[]): Promise<void> {
  const only = entries.length === 1 ? entries[0] : undefined;
  if (only?.isDirLike) {
    await useNavigation.getState().navigate(only.path);
    return;
  }
  const { flash } = useUi.getState();
  for (const entry of entries) {
    if (entry.isDirLike) continue;
    if (entry.isBrokenLink) {
      flash(BROKEN_ALIAS_MESSAGE);
      continue;
    }
    try {
      await commands.openPath(entry.path);
    } catch (e) {
      const error = toAppError(e);
      flash(`Couldn’t open “${entry.name}”: ${describeError(error)}`);
    }
  }
}

export function describeError(error: ReturnType<typeof toAppError>): string {
  switch (error.code) {
    case "permissionDenied":
      return "permission denied.";
    case "notFound":
      return "item not found.";
    case "notADirectory":
      return "not a folder.";
    case "invalidPath":
      return "invalid path.";
    case "alreadyExists":
      return "an item with that name already exists.";
    case "invalidName":
      return error.reason;
    case "protected":
      return "this item is protected.";
    case "io":
      return error.message;
  }
}

/** Opens the current selection (double-click, ⌘↓). */
export async function openSelected(): Promise<void> {
  const entries = getSelectedEntries();
  if (entries.length > 0) await openEntries(entries);
}
