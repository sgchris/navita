import { useVirtualizer } from "@tanstack/react-virtual";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { Entry } from "../api/bindings/Entry";
import {
  COLUMN_HEADER_HEIGHT,
  ICON_NAME_GAP,
  ICON_SIZE_LIST,
  LIST_INNER_PADDING,
  LIST_OUTER_INSET,
  ROW_HEIGHT,
} from "../lib/layout";
import { nextSort } from "../lib/sort";
import { COLUMN_MIN, usePrefs } from "../state/prefs";
import { useSelection } from "../state/selection";
import { useUi } from "../state/ui";
import { ColumnHeader } from "./ColumnHeader";
import { FileRow } from "./FileRow";

interface Props {
  entries: Entry[];
}

/** "List with details" view: virtualized rows with sortable, resizable columns (spec 8.3). */
export function FileList({ entries }: Props) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const widths = usePrefs((s) => s.columnWidths);
  const sort = usePrefs((s) => s.sort);
  const setSort = usePrefs((s) => s.setSort);
  const selected = useSelection((s) => s.selected);
  const focus = useSelection((s) => s.focus);
  const registerScrollApi = useUi((s) => s.registerScrollApi);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- "now" is refreshed whenever the listing changes
  const now = useMemo(() => new Date(), [entries]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    setContainerWidth(el.clientWidth);
    const observer = new ResizeObserver(() => setContainerWidth(el.clientWidth));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const virtualizer = useVirtualizer({
    count: entries.length,
    getScrollElement: () => scrollerRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
    scrollMargin: COLUMN_HEADER_HEIGHT,
    scrollPaddingStart: COLUMN_HEADER_HEIGHT,
  });

  const indexByPath = useMemo(() => new Map(entries.map((e, i) => [e.path, i])), [entries]);
  const scrollToPath = useCallback(
    (path: string) => {
      const index = indexByPath.get(path);
      if (index !== undefined) virtualizer.scrollToIndex(index, { align: "auto" });
    },
    [indexByPath, virtualizer],
  );

  useEffect(() => {
    registerScrollApi({
      getScrollTop: () => scrollerRef.current?.scrollTop ?? 0,
      setScrollTop: (top) => {
        if (scrollerRef.current) scrollerRef.current.scrollTop = top;
      },
      scrollToPath,
    });
    return () => registerScrollApi(null);
  }, [registerScrollApi, scrollToPath]);

  // Keep the focused row visible (keyboard moves, view switches, "select child" after Up).
  useEffect(() => {
    if (focus) scrollToPath(focus);
  }, [focus, scrollToPath]);

  const fixedSum = widths.modified + widths.size + widths.kind;
  const nameColumn = Math.max(
    COLUMN_MIN.name,
    containerWidth - 2 * LIST_OUTER_INSET - 2 * LIST_INNER_PADDING - fixedSum,
  );
  const nameBudget = nameColumn - ICON_SIZE_LIST - ICON_NAME_GAP - 8;
  const style = {
    "--col-modified": `${widths.modified}px`,
    "--col-size": `${widths.size}px`,
    "--col-kind": `${widths.kind}px`,
    "--list-min-width": `${COLUMN_MIN.name + fixedSum + 2 * LIST_OUTER_INSET + 2 * LIST_INNER_PADDING}px`,
  } as CSSProperties;

  return (
    <div
      ref={scrollerRef}
      className="file-list"
      style={style}
      onClick={(e) => {
        if (!(e.target as HTMLElement).closest("[data-path]")) useSelection.getState().clear();
      }}
    >
      <div className="file-list__content">
        <ColumnHeader
          sort={sort}
          widths={widths}
          containerWidth={containerWidth}
          onSort={(key) => setSort(nextSort(sort, key))}
        />
        <div className="file-list__body" style={{ height: virtualizer.getTotalSize() }}>
          {virtualizer.getVirtualItems().map((item) => {
            const entry = entries[item.index];
            if (!entry) return null;
            return (
              <FileRow
                key={entry.path}
                entry={entry}
                selected={selected.has(entry.path)}
                nameBudget={nameBudget}
                now={now}
                top={item.start - COLUMN_HEADER_HEIGHT}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
