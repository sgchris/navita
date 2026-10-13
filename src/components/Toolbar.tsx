import type { CSSProperties } from "react";
import { basename } from "../lib/paths";
import {
  TOOLBAR_PADDING_LEFT_WITHOUT_SIDEBAR,
  TOOLBAR_PADDING_LEFT_WITH_SIDEBAR,
} from "../lib/layout";
import { useNavigation } from "../state/navigation";
import { usePlaces } from "../state/places";
import { usePrefs } from "../state/prefs";
import { HiddenToggle } from "./HiddenToggle";
import { ViewSwitch } from "./ViewSwitch";

export function Toolbar() {
  const currentPath = useNavigation((s) => s.currentPath);
  const rootName = usePlaces((s) => s.rootName);
  const sidebarVisible = usePrefs((s) => s.sidebarVisible);
  const paddingLeft = sidebarVisible
    ? TOOLBAR_PADDING_LEFT_WITH_SIDEBAR
    : TOOLBAR_PADDING_LEFT_WITHOUT_SIDEBAR;
  return (
    <div
      className="toolbar"
      data-tauri-drag-region
      style={{ "--toolbar-padding-left": `${paddingLeft}px` } as CSSProperties}
    >
      <span className="toolbar__title" data-tauri-drag-region>
        {currentPath === null ? "" : currentPath === "/" ? rootName : basename(currentPath)}
      </span>
      <div className="toolbar__spacer" data-tauri-drag-region />
      <div className="toolbar__group">
        <ViewSwitch />
        <HiddenToggle />
      </div>
    </div>
  );
}
