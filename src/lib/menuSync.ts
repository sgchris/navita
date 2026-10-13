import { commands, type MenuState } from "../api/commands";
import { selectCanBack, selectCanForward, selectCanUp, useNavigation } from "../state/navigation";
import { usePrefs } from "../state/prefs";
import { useSelection } from "../state/selection";

function computeState(): MenuState {
  const prefs = usePrefs.getState();
  const navigation = useNavigation.getState();
  const selected = useSelection.getState().selected.size;
  return {
    viewMode: prefs.viewMode,
    showHidden: prefs.showHidden,
    sortKey: prefs.sort.key,
    sidebarVisible: prefs.sidebarVisible,
    pathBarVisible: prefs.pathBarVisible,
    statusBarVisible: prefs.statusBarVisible,
    hasSelection: selected > 0,
    singleSelection: selected === 1,
    canBack: selectCanBack(navigation),
    canForward: selectCanForward(navigation),
    canUp: selectCanUp(navigation),
  };
}

let last = "";

/**
 * Pushes the current state into the native menu. `force` re-sends unchanged state; needed after a
 * menu click because macOS toggles a check mark by itself even when the state did not change.
 */
export function syncMenu(force = false): void {
  const state = computeState();
  const key = JSON.stringify(state);
  if (!force && key === last) return;
  last = key;
  void commands.setMenuState(state).catch(() => undefined);
}

export function installMenuSync(): void {
  usePrefs.subscribe(() => syncMenu());
  useNavigation.subscribe(() => syncMenu());
  useSelection.subscribe(() => syncMenu());
  syncMenu(true);
}
