import { describe, expect, it } from "vitest";
import {
  EMPTY_HISTORY,
  MAX_HISTORY,
  canGoBack,
  canGoForward,
  currentEntry,
  goBack,
  goForward,
  goTo,
  newEntry,
  push,
  updateCurrent,
} from "./history";

const entry = (path: string) => newEntry(path, "icons");
const paths = (h: { entries: { path: string }[] }) => h.entries.map((e) => e.path);

describe("history", () => {
  it("starts empty and cannot move", () => {
    expect(canGoBack(EMPTY_HISTORY)).toBe(false);
    expect(canGoForward(EMPTY_HISTORY)).toBe(false);
    expect(currentEntry(EMPTY_HISTORY)).toBeUndefined();
    expect(goBack(EMPTY_HISTORY)).toBe(EMPTY_HISTORY);
  });

  it("pushes entries and moves back and forward within bounds", () => {
    let h = push(EMPTY_HISTORY, entry("/a"));
    h = push(h, entry("/b"));
    h = push(h, entry("/c"));
    expect(h.index).toBe(2);
    expect(canGoBack(h)).toBe(true);
    expect(canGoForward(h)).toBe(false);

    h = goBack(goBack(h));
    expect(currentEntry(h)?.path).toBe("/a");
    expect(canGoBack(h)).toBe(false);
    expect(goBack(h)).toBe(h);

    h = goForward(h);
    expect(currentEntry(h)?.path).toBe("/b");
    expect(canGoForward(h)).toBe(true);
    h = goForward(goForward(h));
    expect(currentEntry(h)?.path).toBe("/c");
  });

  it("truncates forward entries when pushing after going back", () => {
    let h = push(push(push(EMPTY_HISTORY, entry("/a")), entry("/b")), entry("/c"));
    h = goBack(goBack(h));
    h = push(h, entry("/x"));
    expect(paths(h)).toEqual(["/a", "/x"]);
    expect(h.index).toBe(1);
    expect(canGoForward(h)).toBe(false);
  });

  it("ignores a push of the current path", () => {
    const h = push(EMPTY_HISTORY, entry("/a"));
    expect(push(h, entry("/a"))).toBe(h);
  });

  it("keeps at most 100 entries, dropping the oldest", () => {
    let h = EMPTY_HISTORY;
    for (let i = 0; i < MAX_HISTORY + 20; i++) h = push(h, entry(`/p${i}`));
    expect(h.entries).toHaveLength(MAX_HISTORY);
    expect(h.entries[0]?.path).toBe("/p20");
    expect(currentEntry(h)?.path).toBe(`/p${MAX_HISTORY + 19}`);
    expect(h.index).toBe(MAX_HISTORY - 1);
  });

  it("goTo only accepts valid indexes", () => {
    const h = push(push(EMPTY_HISTORY, entry("/a")), entry("/b"));
    expect(goTo(h, 0).index).toBe(0);
    expect(goTo(h, 5)).toBe(h);
    expect(goTo(h, -1)).toBe(h);
  });

  it("updateCurrent stores selection and scroll in the current entry only", () => {
    let h = push(push(EMPTY_HISTORY, entry("/a")), entry("/b"));
    h = updateCurrent(h, { selection: ["/b/x"], focus: "/b/x", scrollTop: 120, viewMode: "list" });
    expect(currentEntry(h)).toEqual({
      path: "/b",
      selection: ["/b/x"],
      focus: "/b/x",
      scrollTop: 120,
      viewMode: "list",
    });
    expect(h.entries[0]?.selection).toEqual([]);
    expect(updateCurrent(EMPTY_HISTORY, { scrollTop: 1 })).toBe(EMPTY_HISTORY);
  });
});
