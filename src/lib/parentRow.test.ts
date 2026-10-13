import { describe, expect, it } from "vitest";
import type { Entry } from "../api/bindings/Entry";
import {
  countRealSelected,
  isParentEntry,
  isParentPath,
  makeParentEntry,
  withParentRow,
} from "./parentRow";

const file = (name: string): Entry => ({
  name,
  path: `/Users/me/proj/${name}`,
  kind: "file",
  isHidden: false,
  isDirLike: false,
  size: 1,
  modifiedMs: 1,
  extension: null,
  symlinkTarget: null,
  isBrokenLink: false,
  isReadable: true,
});

describe("parent row", () => {
  it("builds a synthetic folder entry with a non-real path", () => {
    const parent = makeParentEntry("/Users/me/proj");
    expect(parent.name).toBe("..");
    expect(parent.path).toBe("/Users/me/proj/..");
    expect(parent.isDirLike).toBe(true);
    expect(parent.isHidden).toBe(false);
    expect(isParentEntry(parent)).toBe(true);
    expect(isParentPath(parent.path)).toBe(true);
    expect(isParentEntry(file("a.txt"))).toBe(false);
    expect(isParentPath("/Users/me/proj/a.txt")).toBe(false);
    expect(isParentPath("/Users/me/proj/..hidden")).toBe(false);
  });

  it("is prepended in list view for non-root folders", () => {
    const entries = [file("a"), file("b")];
    const result = withParentRow(entries, "/Users/me/proj", true);
    expect(result.map((e) => e.name)).toEqual(["..", "a", "b"]);
  });

  it("is absent in icons view, at the root and without a path", () => {
    const entries = [file("a")];
    expect(withParentRow(entries, "/Users/me/proj", false).map((e) => e.name)).toEqual(["a"]);
    expect(withParentRow(entries, "/", true).map((e) => e.name)).toEqual(["a"]);
    expect(withParentRow(entries, null, true).map((e) => e.name)).toEqual(["a"]);
  });

  it("is present in an empty folder", () => {
    expect(withParentRow([], "/Users/me/empty", true).map((e) => e.name)).toEqual([".."]);
  });

  it("does not count towards the selection size", () => {
    expect(countRealSelected(new Set())).toBe(0);
    expect(countRealSelected(new Set(["/a/b/.."]))).toBe(0);
    expect(countRealSelected(new Set(["/a/b/..", "/a/b/c", "/a/b/d"]))).toBe(2);
  });
});
