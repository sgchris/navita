import type { CSSProperties } from "react";
import { ContentPane } from "./components/ContentPane";
import { PathBar } from "./components/PathBar";
import { Sidebar } from "./components/Sidebar";
import { Splitter } from "./components/Splitter";
import { StatusBar } from "./components/StatusBar";
import { Toolbar } from "./components/Toolbar";
import { cx } from "./lib/cx";
import { usePrefs } from "./state/prefs";

export default function App() {
  const sidebarVisible = usePrefs((s) => s.sidebarVisible);
  const sidebarWidth = usePrefs((s) => s.sidebarWidth);
  const pathBarVisible = usePrefs((s) => s.pathBarVisible);
  const statusBarVisible = usePrefs((s) => s.statusBarVisible);
  return (
    <div
      className={cx("app", !sidebarVisible && "app--no-sidebar")}
      style={{ "--sidebar-width": `${sidebarWidth}px` } as CSSProperties}
    >
      <div className="sidebar-col">
        <div className="sidebar-col__drag" data-tauri-drag-region />
        <Sidebar />
        {sidebarVisible && <Splitter />}
      </div>
      <div className="content-col">
        <Toolbar />
        <ContentPane />
        {pathBarVisible && <PathBar />}
        {statusBarVisible && <StatusBar />}
      </div>
    </div>
  );
}
