import type { PointerEvent } from "react";
import { COLUMN_MIN, usePrefs, type ColumnWidths } from "../state/prefs";
import { cx } from "../lib/cx";
import { ChevronDown, ChevronUp } from "../lib/icons";
import type { SortKey, SortSpec } from "../lib/sort";

interface Props {
  sort: SortSpec;
  widths: ColumnWidths;
  /** Width of the scroll container; bounds how wide a fixed column may grow. */
  containerWidth: number;
  onSort: (key: SortKey) => void;
}

const FIXED: Array<{ key: keyof ColumnWidths; label: string; right?: boolean }> = [
  { key: "modified", label: "Date Modified" },
  { key: "size", label: "Size", right: true },
  { key: "kind", label: "Kind" },
];

export function ColumnHeader({ sort, widths, containerWidth, onSort }: Props) {
  const setColumnWidth = usePrefs((s) => s.setColumnWidth);

  const startResize = (column: keyof ColumnWidths) => (e: PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startWidth = widths[column];
    const others = widths.modified + widths.size + widths.kind - startWidth;
    const max = Math.max(COLUMN_MIN[column], containerWidth - 16 - others - COLUMN_MIN.name);
    const target = e.currentTarget;
    target.setPointerCapture(e.pointerId);
    const move = (ev: globalThis.PointerEvent) =>
      setColumnWidth(column, Math.min(max, startWidth + (startX - ev.clientX)));
    const up = () => {
      target.removeEventListener("pointermove", move);
      target.removeEventListener("pointerup", up);
    };
    target.addEventListener("pointermove", move);
    target.addEventListener("pointerup", up);
  };

  const indicator = (key: SortKey) =>
    sort.key === key &&
    (sort.dir === "asc" ? (
      <ChevronUp size={12} strokeWidth={2} />
    ) : (
      <ChevronDown size={12} strokeWidth={2} />
    ));

  return (
    <div className="column-header">
      <div className="column-header__inner">
        <div className="header-cell" onClick={() => onSort("name")}>
          Name {indicator("name")}
        </div>
        {FIXED.map(({ key, label, right }) => {
          const sortKey: SortKey = key;
          return (
            <div
              key={key}
              className={cx("header-cell", right && "header-cell--right")}
              onClick={() => onSort(sortKey)}
            >
              {right && indicator(sortKey)}
              {label}
              {!right && indicator(sortKey)}
              <div
                className="header-divider"
                onPointerDown={startResize(key)}
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
