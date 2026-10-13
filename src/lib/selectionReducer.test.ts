import { describe, expect, it } from "vitest";
import {
  EMPTY_SELECTION,
  click,
  clear,
  focusIndexOf,
  listTarget,
  moveFocus,
  prune,
  selectAll,
  selectOnly,
} from "./selectionReducer";

const paths = ["/a", "/b", "/c", "/d", "/e"];
const sel = (state: { selected: ReadonlySet<string> }) => [...state.selected].sort();
const none = { meta: false, shift: false };

describe("click", () => {
  it("plain click replaces the selection and sets anchor and focus", () => {
    const s = click(selectOnly("/a"), paths, "/c", none);
    expect(sel(s)).toEqual(["/c"]);
    expect(s.anchor).toBe("/c");
    expect(s.focus).toBe("/c");
  });

  it("meta-click toggles and moves the anchor", () => {
    let s = click(EMPTY_SELECTION, paths, "/a", { meta: true, shift: false });
    s = click(s, paths, "/c", { meta: true, shift: false });
    expect(sel(s)).toEqual(["/a", "/c"]);
    s = click(s, paths, "/a", { meta: true, shift: false });
    expect(sel(s)).toEqual(["/c"]);
    expect(s.anchor).toBe("/a");
  });

  it("shift-click selects the range from the anchor in either direction", () => {
    let s = click(EMPTY_SELECTION, paths, "/b", none);
    s = click(s, paths, "/d", { meta: false, shift: true });
    expect(sel(s)).toEqual(["/b", "/c", "/d"]);
    expect(s.anchor).toBe("/b");
    s = click(s, paths, "/a", { meta: false, shift: true });
    expect(sel(s)).toEqual(["/a", "/b"]);
  });

  it("meta+shift behaves like shift; shift without anchor selects just the item", () => {
    const s = click(EMPTY_SELECTION, paths, "/c", { meta: true, shift: true });
    expect(sel(s)).toEqual(["/c"]);
    const t = click(selectOnly("/a"), paths, "/c", { meta: true, shift: true });
    expect(sel(t)).toEqual(["/a", "/b", "/c"]);
  });

  it("ignores paths that are not in the list", () => {
    expect(click(EMPTY_SELECTION, paths, "/zzz", none)).toBe(EMPTY_SELECTION);
  });
});

describe("moveFocus", () => {
  it("moves and selects only the target without extend", () => {
    const s = moveFocus(selectOnly("/a"), paths, 2, false);
    expect(sel(s)).toEqual(["/c"]);
    expect(s.focus).toBe("/c");
    expect(s.anchor).toBe("/c");
  });

  it("clamps the target index", () => {
    expect(moveFocus(EMPTY_SELECTION, paths, 99, false).focus).toBe("/e");
    expect(moveFocus(EMPTY_SELECTION, paths, -5, false).focus).toBe("/a");
  });

  it("extends the range from the anchor and keeps the anchor", () => {
    let s = selectOnly("/b");
    s = moveFocus(s, paths, 3, true);
    expect(sel(s)).toEqual(["/b", "/c", "/d"]);
    expect(s.anchor).toBe("/b");
    s = moveFocus(s, paths, 0, true);
    expect(sel(s)).toEqual(["/a", "/b"]);
  });

  it("does nothing on an empty list", () => {
    expect(moveFocus(EMPTY_SELECTION, [], 0, false)).toBe(EMPTY_SELECTION);
  });
});

describe("select all / clear / prune / focusIndex", () => {
  it("selectAll selects everything visible", () => {
    expect(sel(selectAll(paths))).toEqual(paths);
    expect(selectAll([]).selected.size).toBe(0);
  });

  it("clear empties the selection", () => {
    expect(clear().selected.size).toBe(0);
  });

  it("prune drops vanished paths and stale anchor/focus", () => {
    const s = prune(click(selectOnly("/a"), paths, "/c", { meta: true, shift: false }), [
      "/a",
      "/b",
    ]);
    expect(sel(s)).toEqual(["/a"]);
    expect(s.focus).toBeNull();
  });

  it("focusIndexOf resolves the focus path", () => {
    expect(focusIndexOf(selectOnly("/c"), paths)).toBe(2);
    expect(focusIndexOf(EMPTY_SELECTION, paths)).toBeNull();
    expect(focusIndexOf(selectOnly("/zzz"), paths)).toBeNull();
  });
});

describe("listTarget", () => {
  it("handles no focus, ends and empty lists", () => {
    expect(listTarget(null, 5, "down")).toBe(0);
    expect(listTarget(null, 5, "up")).toBe(4);
    expect(listTarget(2, 5, "down")).toBe(3);
    expect(listTarget(2, 5, "up")).toBe(1);
    expect(listTarget(4, 5, "down")).toBe(4);
    expect(listTarget(0, 5, "up")).toBe(0);
    expect(listTarget(null, 0, "down")).toBeNull();
  });
});
