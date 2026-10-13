import { usePrefs } from "./prefs";
import { useSelection } from "./selection";

/** Cross-store reactions, installed once at startup. */
export function installWiring(): void {
  // Items that become hidden must leave the selection.
  usePrefs.subscribe((state, previous) => {
    if (state.showHidden !== previous.showHidden) useSelection.getState().prune();
  });
}
