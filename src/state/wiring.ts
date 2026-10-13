import { useNavigation } from "./navigation";
import { usePrefs } from "./prefs";
import { useSelection } from "./selection";
import { useVolume } from "./volume";

/** Cross-store reactions, installed once at startup. */
export function installWiring(): void {
  // Items that become hidden must leave the selection.
  usePrefs.subscribe((state, previous) => {
    if (state.showHidden !== previous.showHidden) useSelection.getState().prune();
  });

  // Free space follows the current folder.
  useNavigation.subscribe((state, previous) => {
    if (state.currentPath !== previous.currentPath && state.currentPath !== null) {
      void useVolume.getState().refresh(state.currentPath);
    }
  });
}
