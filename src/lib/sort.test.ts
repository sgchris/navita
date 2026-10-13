import { describe, expect, it } from "vitest";
import { nextSort, sortEntries, type SortSpec } from "./sort";

interface T {
  name: string;
  path: string;
  isDirLike: boolean;
  size: number | null;
  modifiedMs: number | null;
  kind: "file" | "directory" | "package" | "symlink";
  extension: string | null;
  isBrokenLink: boolean;
}

function file(name: string, extra: Partial<T> = {}): T {
  const dot = name.lastIndexOf(".");
  return {
    name,
    path: `/d/${name}`,
    isDirLike: false,
    size: 1,
    modifiedMs: 1000,
    kind: "file",
    extension: dot > 0 ? name.slice(dot + 1).toLowerCase() : null,
    isBrokenLink: false,
    ...extra,
  };
}
const dir = (name: string, extra: Partial<T> = {}): T =>
  file(name, { isDirLike: true, kind: "directory", size: null, extension: null, ...extra });

const names = (entries: T[]) => entries.map((e) => e.name);
const run = (entries: T[], sort: SortSpec) => names(sortEntries(entries, sort, "en"));

describe("sort by name", () => {
  const entries = [
    file("file10.txt"),
    file("File2.txt"),
    dir("zeta"),
    dir("Alpha"),
    file("apple.txt"),
  ];

  it("puts folders first and uses natural, case-insensitive order (ascending)", () => {
    expect(run(entries, { key: "name", dir: "asc" })).toEqual([
      "Alpha",
      "zeta",
      "apple.txt",
      "File2.txt",
      "file10.txt",
    ]);
  });

  it("keeps folders first when descending", () => {
    expect(run(entries, { key: "name", dir: "desc" })).toEqual([
      "zeta",
      "Alpha",
      "file10.txt",
      "File2.txt",
      "apple.txt",
    ]);
  });

  it("breaks case-insensitive ties case-sensitively, then by path", () => {
    const a = file("Same.txt", { path: "/a/Same.txt" });
    const b = file("same.txt", { path: "/b/same.txt" });
    const c = file("same.txt", { path: "/a/same.txt" });
    const sorted = sortEntries([b, c, a], { key: "name", dir: "asc" }, "en");
    expect(sorted.map((e) => e.path)).toEqual(["/a/same.txt", "/b/same.txt", "/a/Same.txt"]);
  });

  it("is deterministic regardless of input order", () => {
    const forward = run(entries, { key: "name", dir: "asc" });
    const backward = run([...entries].reverse(), { key: "name", dir: "asc" });
    expect(backward).toEqual(forward);
  });
});

describe("sort by modified", () => {
  const entries = [
    file("old.txt", { modifiedMs: 100 }),
    file("new.txt", { modifiedMs: 300 }),
    file("none.txt", { modifiedMs: null }),
    dir("older-dir", { modifiedMs: 50 }),
    dir("newer-dir", { modifiedMs: 500 }),
    file("tie-b.txt", { modifiedMs: 200 }),
    file("tie-a.txt", { modifiedMs: 200 }),
  ];

  it("ascending: oldest first, nulls last, ties by name, folders first", () => {
    expect(run(entries, { key: "modified", dir: "asc" })).toEqual([
      "older-dir",
      "newer-dir",
      "old.txt",
      "tie-a.txt",
      "tie-b.txt",
      "new.txt",
      "none.txt",
    ]);
  });

  it("descending: newest first, nulls still last, ties still by name ascending", () => {
    expect(run(entries, { key: "modified", dir: "desc" })).toEqual([
      "newer-dir",
      "older-dir",
      "new.txt",
      "tie-a.txt",
      "tie-b.txt",
      "old.txt",
      "none.txt",
    ]);
  });
});

describe("sort by size", () => {
  const entries = [
    file("big.bin", { size: 5000 }),
    file("small.bin", { size: 10 }),
    file("unknown.bin", { size: null }),
    dir("b-dir"),
    dir("a-dir"),
  ];

  it("sorts files by size and folders by name ascending regardless of direction", () => {
    expect(run(entries, { key: "size", dir: "asc" })).toEqual([
      "a-dir",
      "b-dir",
      "small.bin",
      "big.bin",
      "unknown.bin",
    ]);
    expect(run(entries, { key: "size", dir: "desc" })).toEqual([
      "a-dir",
      "b-dir",
      "big.bin",
      "small.bin",
      "unknown.bin",
    ]);
  });
});

describe("sort by kind", () => {
  const entries = [file("b.png"), file("a.zip"), file("c.png"), file("d.pdf"), dir("folder")];

  it("sorts by kind label then name, folders first, direction reverses the kind order", () => {
    expect(run(entries, { key: "kind", dir: "asc" })).toEqual([
      "folder",
      "d.pdf",
      "b.png",
      "c.png",
      "a.zip",
    ]);
    expect(run(entries, { key: "kind", dir: "desc" })).toEqual([
      "folder",
      "a.zip",
      "b.png",
      "c.png",
      "d.pdf",
    ]);
  });
});

describe("nextSort", () => {
  it("toggles direction on the same key and uses default direction on a new key", () => {
    expect(nextSort({ key: "name", dir: "asc" }, "name")).toEqual({ key: "name", dir: "desc" });
    expect(nextSort({ key: "name", dir: "desc" }, "name")).toEqual({ key: "name", dir: "asc" });
    expect(nextSort({ key: "name", dir: "asc" }, "modified")).toEqual({
      key: "modified",
      dir: "desc",
    });
    expect(nextSort({ key: "name", dir: "asc" }, "size")).toEqual({ key: "size", dir: "desc" });
    expect(nextSort({ key: "modified", dir: "desc" }, "kind")).toEqual({ key: "kind", dir: "asc" });
    expect(nextSort({ key: "kind", dir: "desc" }, "name")).toEqual({ key: "name", dir: "asc" });
  });
});
