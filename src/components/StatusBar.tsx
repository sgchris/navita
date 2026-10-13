import { formatStatus } from "../lib/format";
import { useVisibleEntries } from "../lib/viewModel";
import { useSelection } from "../state/selection";
import { useUi } from "../state/ui";
import { useVolume } from "../state/volume";

/** "42 items, 1 selected, 312.4 GB available"; a transient flash message replaces the text. */
export function StatusBar() {
  const flashMessage = useUi((s) => s.flashMessage);
  const count = useVisibleEntries().length;
  const selected = useSelection((s) => s.selected.size);
  const freeBytes = useVolume((s) => s.freeBytes);
  return (
    <div className="status-bar">{flashMessage ?? formatStatus({ count, selected, freeBytes })}</div>
  );
}
