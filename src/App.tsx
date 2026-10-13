import type { CSSProperties } from "react";
import { ContentPane } from "./components/ContentPane";
import { Toolbar } from "./components/Toolbar";
import { cx } from "./lib/cx";
import { usePrefs } from "./state/prefs";

export default function App() {
  const sidebarVisible = usePrefs((s) => s.sidebarVisible);
  const sidebarWidth = usePrefs((s) => s.sidebarWidth);
  return (
    <div
      className={cx("app", !sidebarVisible && "app--no-sidebar")}
      style={{ "--sidebar-width": `${sidebarWidth}px` } as CSSProperties}
    >
      <div className="sidebar-col">
        <div className="sidebar-col__drag" data-tauri-drag-region />
        <div className="sidebar" />
      </div>
      <div className="content-col">
        <Toolbar />
        <ContentPane />
      </div>
    </div>
  );
}
