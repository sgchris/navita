/** Icons-view geometry and 2D keyboard navigation (decisions B18, B20). */

export const CELL_SIZE = 96;
export const GRID_GAP = 12;
export const GRID_PADDING = 16;
export const ROW_STRIDE = CELL_SIZE + GRID_GAP;

/** Number of columns that fit in `width` px: `max(1, floor((width - 32 + 12) / 108))`. */
export function columnCount(width: number): number {
  return Math.max(1, Math.floor((width - 2 * GRID_PADDING + GRID_GAP) / ROW_STRIDE));
}

export function rowCount(itemCount: number, columns: number): number {
  return Math.ceil(itemCount / columns);
}

export type GridKey = "left" | "right" | "up" | "down";

/**
 * Target index for an arrow key. With no focus: ↓/→ select the first item, ↑/← the last.
 * ↑ in the first row and ↓ in the last row are no-ops; ↓ from a column missing in the (partial)
 * last row jumps to the last item.
 */
export function gridTarget(
  focusIndex: number | null,
  count: number,
  columns: number,
  key: GridKey,
): number | null {
  if (count === 0) return null;
  if (focusIndex === null) return key === "down" || key === "right" ? 0 : count - 1;

  const last = count - 1;
  switch (key) {
    case "left":
      return Math.max(focusIndex - 1, 0);
    case "right":
      return Math.min(focusIndex + 1, last);
    case "up":
      return focusIndex - columns < 0 ? focusIndex : focusIndex - columns;
    case "down": {
      const target = focusIndex + columns;
      if (target <= last) return target;
      const inLastRow = Math.floor(focusIndex / columns) === Math.floor(last / columns);
      return inLastRow ? focusIndex : last;
    }
  }
}
