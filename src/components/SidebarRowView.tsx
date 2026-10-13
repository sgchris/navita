import type { CSSProperties, MouseEvent } from "react";
import { cx } from "../lib/cx";
import {
  AppWindow,
  ChevronRight,
  Download,
  FileText,
  Folder,
  HardDrive,
  House,
  Monitor,
  type LucideIcon,
} from "../lib/icons";
import { ICON_SIZE_LIST } from "../lib/layout";
import type { SidebarRow } from "../lib/treeFlatten";
import type { Place } from "../api/bindings/Place";
import { useNavigation } from "../state/navigation";
import { usePrefs } from "../state/prefs";
import { useTree } from "../state/tree";

const PLACE_ICONS: Record<Place["kind"], LucideIcon> = {
  home: House,
  desktop: Monitor,
  documents: FileText,
  downloads: Download,
  applications: AppWindow,
  root: HardDrive,
  volume: HardDrive,
};

interface Props {
  row: SidebarRow;
  /** True when this row's path is the current folder (decisions B13). */
  current: boolean;
  /** Vertical offset of the row inside the list. */
  top: number;
}

const rowStyle = (top: number, depth = 0) =>
  ({ transform: `translateY(${top}px)`, "--depth": depth }) as CSSProperties;

export function SidebarRowView({ row, current, top }: Props) {
  const navigate = (path: string) => (e: MouseEvent) => {
    if (e.button !== 0) return;
    void useNavigation.getState().navigate(path);
  };

  if (row.type === "header") {
    return (
      <div
        className="sidebar-row sidebar-row--header"
        style={rowStyle(top)}
        onClick={() => usePrefs.getState().toggleSection(row.section)}
      >
        <span className="sidebar-row__header-label">{row.label}</span>
        <span className="sidebar-row__header-toggle">{row.collapsed ? "Show" : "Hide"}</span>
      </div>
    );
  }

  if (row.type === "place") {
    const Icon = PLACE_ICONS[row.place.kind];
    return (
      <div
        className={cx("sidebar-row", current && "sidebar-row--selected")}
        style={rowStyle(top)}
        onClick={navigate(row.place.path)}
      >
        <div className="sidebar-row__inner">
          <span className="sidebar-row__icon sidebar-row__icon--place">
            <Icon size={ICON_SIZE_LIST} strokeWidth={1.75} absoluteStrokeWidth />
          </span>
          <span className="sidebar-row__label">{row.place.name}</span>
        </div>
      </div>
    );
  }

  if (row.type === "message") {
    return (
      <div className="sidebar-row sidebar-row--message" style={rowStyle(top, row.depth)}>
        <div className="sidebar-row__inner">
          <span className="sidebar-row__arrow" />
          <span className="sidebar-row__label">{row.text}</span>
        </div>
      </div>
    );
  }

  const Icon = row.isRoot ? HardDrive : Folder;
  return (
    <div
      className={cx("sidebar-row", current && "sidebar-row--selected")}
      style={rowStyle(top, row.depth)}
      onClick={navigate(row.path)}
    >
      <div className="sidebar-row__inner sidebar-row__inner--node">
        <span
          className={cx("sidebar-row__arrow", row.hasArrow && "sidebar-row__arrow--active")}
          onClick={(e) => {
            if (!row.hasArrow) return;
            e.stopPropagation();
            void useTree.getState().toggle(row.path);
          }}
        >
          {row.hasArrow && (
            <ChevronRight
              className={cx("sidebar-row__chevron", row.expanded && "sidebar-row__chevron--open")}
              size={12}
              strokeWidth={2.25}
              absoluteStrokeWidth
            />
          )}
        </span>
        <span
          className={cx(
            "sidebar-row__icon",
            row.isRoot ? "sidebar-row__icon--disk" : "sidebar-row__icon--folder",
          )}
        >
          <Icon
            size={ICON_SIZE_LIST}
            strokeWidth={1.75}
            absoluteStrokeWidth
            {...(row.isRoot ? {} : { fill: "currentColor", fillOpacity: 0.85 })}
          />
        </span>
        <span className="sidebar-row__label">{row.name}</span>
      </div>
    </div>
  );
}
