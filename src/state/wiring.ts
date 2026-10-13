import { useNavigation } from "./navigation";
import { usePrefs } from "./prefs";
import { useSelection } from "./selection";
import { useTree } from "./tree";
import { useVolume } from "./volume";

/** Cross-store reactions, installed once at startup. */
export function installWiring(): void {
  // Items that become hidden must leave the selection.
  usePrefs.subscribe((state, previous) => {
    if (state.showHidden !== previous.showHidden || state.viewMode !== previous.viewMode) {
      useSelection.getState().prune();
    }
  });

  // Remember which tree folders are expanded.
  useTree.subscribe((state, previous) => {
    if (state.expanded !== previous.expanded) {
      usePrefs.getState().setExpandedTreePaths([...state.expanded].slice(0, 500));
    }
  });

  // Free space follows the current folder.
  useNavigation.subscribe((state, previous) => {
    if (state.currentPath !== previous.currentPath && state.currentPath !== null) {
      void useVolume.getState().refresh(state.currentPath);
    }
  });
}
