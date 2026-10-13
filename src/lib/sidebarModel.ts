import { useNavigation } from "../state/navigation";
import { usePlaces } from "../state/places";
import { usePrefs } from "../state/prefs";
import { useTree } from "../state/tree";
import { flattenSidebar, type SidebarRow } from "./treeFlatten";

/** Current sidebar rows read outside React (keyboard handler). */
export function getSidebarRows(): SidebarRow[] {
  const { places, rootName } = usePlaces.getState();
  const { collapsedSections, showHidden } = usePrefs.getState();
  const { expanded, children } = useTree.getState();
  const { currentPath } = useNavigation.getState();
  return flattenSidebar({
    places,
    rootName,
    collapsedSections,
    expanded,
    children,
    showHidden,
    currentPath,
  });
}
