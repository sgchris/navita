import type { Entry } from "../api/bindings/Entry";
import { useSelection } from "../state/selection";
import { getVisibleEntries } from "./viewModel";

/** Selected entries in display order. */
export function getSelectedEntries(): Entry[] {
  const { selected } = useSelection.getState();
  return getVisibleEntries().filter((e) => selected.has(e.path));
}
