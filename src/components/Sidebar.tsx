import { useVirtualizer } from "@tanstack/react-virtual";
import { useEffect, useMemo, useRef } from "react";
import { cx } from "../lib/cx";
import { SIDEBAR_ROW_HEIGHT } from "../lib/layout";
import { flattenSidebar, indexOfNode, rowKey } from "../lib/treeFlatten";
import { useNavigation } from "../state/navigation";
import { usePlaces } from "../state/places";
import { usePrefs } from "../state/prefs";
import { useTree } from "../state/tree";
import { useUi } from "../state/ui";
import { SidebarRowView } from "./SidebarRowView";

/** Floating sidebar: Favorites, Locations and the lazy Folders tree as one virtual list. */
export function Sidebar() {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const places = usePlaces((s) => s.places);
  const rootName = usePlaces((s) => s.rootName);
  const collapsedSections = usePrefs((s) => s.collapsedSections);
  const showHidden = usePrefs((s) => s.showHidden);
  const expanded = useTree((s) => s.expanded);
  const children = useTree((s) => s.children);
  const currentPath = useNavigation((s) => s.currentPath);
  const emphasized = useUi((s) => s.focusedPane === "sidebar" && s.windowActive);
  const setFocusedPane = useUi((s) => s.setFocusedPane);
  const focusKey = useUi((s) => s.sidebarFocusKey);

  const rows = useMemo(
    () =>
      flattenSidebar({
        places,
        rootName,
        collapsedSections,
        expanded,
        children,
        showHidden,
        currentPath,
      }),
    [places, rootName, collapsedSections, expanded, children, showHidden, currentPath],
  );

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollerRef.current,
    estimateSize: () => SIDEBAR_ROW_HEIGHT,
    overscan: 10,
  });

  // Scroll the current folder's tree row into view once per navigation (rows load lazily).
  const scrolledFor = useRef<string | null>(null);
  useEffect(() => {
    if (currentPath === null || scrolledFor.current === currentPath) return;
    const index = indexOfNode(rows, currentPath);
    if (index < 0) return;
    scrolledFor.current = currentPath;
    virtualizer.scrollToIndex(index, { align: "auto" });
  }, [rows, currentPath, virtualizer]);

  // Keep the keyboard-focused row visible.
  useEffect(() => {
    if (focusKey === null) return;
    const index = rows.findIndex((r) => rowKey(r) === focusKey);
    if (index >= 0) virtualizer.scrollToIndex(index, { align: "auto" });
  }, [focusKey, rows, virtualizer]);

  return (
    <div
      className={cx("sidebar", emphasized && "sidebar--emphasized")}
      onPointerDown={() => setFocusedPane("sidebar")}
    >
      <div ref={scrollerRef} className="sidebar__list">
        <div className="sidebar__body" style={{ height: virtualizer.getTotalSize() }}>
          {virtualizer.getVirtualItems().map((item) => {
            const row = rows[item.index];
            if (!row) return null;
            const path =
              row.type === "place" ? row.place.path : row.type === "node" ? row.path : null;
            return (
              <SidebarRowView
                key={`${row.type}:${row.type === "header" ? row.section : (path ?? item.index)}:${item.index}`}
                row={row}
                current={path !== null && path === currentPath}
                top={item.start}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
