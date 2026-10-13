import { useVirtualizer } from "@tanstack/react-virtual";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Entry } from "../api/bindings/Entry";
import { CELL_SIZE, GRID_GAP, GRID_PADDING, ROW_STRIDE, columnCount, rowCount } from "../lib/grid";
import { useSelection } from "../state/selection";
import { useUi } from "../state/ui";
import { IconCell } from "./IconCell";

interface Props {
  entries: Entry[];
}

/** Icons view: row-virtualized grid of 96 px cells (spec 8.3.1, decisions B20). */
export function IconGrid({ entries }: Props) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const selected = useSelection((s) => s.selected);
  const focus = useSelection((s) => s.focus);
  const renamingPath = useUi((s) => s.renamingPath);
  const registerScrollApi = useUi((s) => s.registerScrollApi);
  const setColumns = useUi((s) => s.setColumns);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    setWidth(el.clientWidth);
    const observer = new ResizeObserver(() => setWidth(el.clientWidth));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const columns = columnCount(width);
  useEffect(() => setColumns(columns), [columns, setColumns]);

  const rows = rowCount(entries.length, columns);
  const virtualizer = useVirtualizer({
    count: rows,
    getScrollElement: () => scrollerRef.current,
    estimateSize: () => ROW_STRIDE,
    overscan: 4,
    paddingStart: GRID_PADDING,
    paddingEnd: GRID_PADDING - GRID_GAP,
  });

  const indexByPath = useMemo(() => new Map(entries.map((e, i) => [e.path, i])), [entries]);
  const scrollToPath = useCallback(
    (path: string) => {
      const index = indexByPath.get(path);
      if (index !== undefined) {
        virtualizer.scrollToIndex(Math.floor(index / columns), { align: "auto" });
      }
    },
    [indexByPath, columns, virtualizer],
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

  useEffect(() => {
    if (focus) scrollToPath(focus);
  }, [focus, scrollToPath]);

  return (
    <div
      ref={scrollerRef}
      className="icon-grid"
      onClick={(e) => {
        if (!(e.target as HTMLElement).closest("[data-path]")) useSelection.getState().clear();
      }}
    >
      <div className="icon-grid__body" style={{ height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map((item) => {
          const slice = entries.slice(item.index * columns, (item.index + 1) * columns);
          return (
            <div
              key={item.index}
              className="icon-grid__row"
              style={{ transform: `translateY(${item.start}px)`, height: CELL_SIZE }}
            >
              {slice.map((entry) => (
                <IconCell
                  key={entry.path}
                  entry={entry}
                  selected={selected.has(entry.path)}
                  renaming={renamingPath === entry.path}
                />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
