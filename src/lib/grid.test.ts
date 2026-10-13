import { describe, expect, it } from "vitest";
import { columnCount, gridTarget, rowCount } from "./grid";

describe("columnCount", () => {
  it("follows floor((width - 32 + 12) / 108) with a minimum of 1", () => {
    expect(columnCount(0)).toBe(1);
    expect(columnCount(100)).toBe(1);
    expect(columnCount(128)).toBe(1); // (128 - 20) / 108 = 1
    expect(columnCount(236)).toBe(2); // 216 / 108
    expect(columnCount(235)).toBe(1);
    expect(columnCount(900)).toBe(8); // 880 / 108 = 8.14
  });

  it("rowCount rounds up", () => {
    expect(rowCount(0, 4)).toBe(0);
    expect(rowCount(8, 4)).toBe(2);
    expect(rowCount(9, 4)).toBe(3);
  });
});

describe("gridTarget", () => {
  // 10 items, 4 columns: rows [0..3] [4..7] [8..9]
  const n = 10;
  const cols = 4;

  it("selects first/last when nothing is focused", () => {
    expect(gridTarget(null, n, cols, "down")).toBe(0);
    expect(gridTarget(null, n, cols, "right")).toBe(0);
    expect(gridTarget(null, n, cols, "up")).toBe(9);
    expect(gridTarget(null, n, cols, "left")).toBe(9);
    expect(gridTarget(null, 0, cols, "down")).toBeNull();
  });

  it("moves horizontally by one and clamps", () => {
    expect(gridTarget(5, n, cols, "left")).toBe(4);
    expect(gridTarget(5, n, cols, "right")).toBe(6);
    expect(gridTarget(0, n, cols, "left")).toBe(0);
    expect(gridTarget(9, n, cols, "right")).toBe(9);
  });

  it("moves vertically by one row", () => {
    expect(gridTarget(1, n, cols, "down")).toBe(5);
    expect(gridTarget(5, n, cols, "up")).toBe(1);
    expect(gridTarget(5, n, cols, "down")).toBe(9);
  });

  it("is a no-op for up in the first row and down in the last row", () => {
    expect(gridTarget(2, n, cols, "up")).toBe(2);
    expect(gridTarget(9, n, cols, "down")).toBe(9);
    expect(gridTarget(8, n, cols, "down")).toBe(8);
  });

  it("jumps to the last item when moving down into a partial last row", () => {
    expect(gridTarget(7, n, cols, "down")).toBe(9); // col 3 missing in last row
    expect(gridTarget(6, n, cols, "down")).toBe(9); // col 2 missing
    expect(gridTarget(4, n, cols, "down")).toBe(8);
  });

  it("works with a single column", () => {
    expect(gridTarget(1, 3, 1, "down")).toBe(2);
    expect(gridTarget(1, 3, 1, "up")).toBe(0);
    expect(gridTarget(2, 3, 1, "down")).toBe(2);
  });
});
