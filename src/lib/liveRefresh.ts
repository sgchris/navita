import { events } from "../api/events";
import { useNavigation } from "../state/navigation";
import { usePlaces } from "../state/places";
import { useTree } from "../state/tree";

/** Reacts to filesystem events from the Rust watchers (spec 6.7). */
export async function installLiveRefresh(): Promise<void> {
  await events.onFsChanged((path) => {
    const navigation = useNavigation.getState();
    if (import.meta.env.DEV) console.info(`[navita] fs:changed ${path}`);
    if (path === navigation.currentPath) void navigation.refresh();
    void useTree.getState().reload(path);
  });
  await events.onVolumesChanged(() => {
    if (import.meta.env.DEV) console.info("[navita] volumes:changed");
    void usePlaces.getState().load();
    void useTree.getState().reload("/Volumes");
  });
}
