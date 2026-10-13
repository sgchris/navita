import { describe, expect, it } from "vitest";
import type { Place } from "../api/bindings/Place";
import type { TreeNode } from "../api/bindings/TreeNode";
import { flattenSidebar, indexOfNode, type FlattenInput, type SidebarRow } from "./treeFlatten";

const places: Place[] = [
  { name: "greg", path: "/Users/greg", kind: "home" },
  { name: "Desktop", path: "/Users/greg/Desktop", kind: "desktop" },
  { name: "Applications", path: "/Applications", kind: "applications" },
  { name: "Macintosh HD", path: "/", kind: "root" },
  { name: "USB", path: "/Volumes/USB", kind: "volume" },
];

const node = (path: string, extra: Partial<TreeNode> = {}): TreeNode => ({
  name: path.slice(path.lastIndexOf("/") + 1),
  path,
  isHidden: false,
  hasChildren: true,
  hasVisibleChildren: true,
  ...extra,
});

function input(extra: Partial<FlattenInput> = {}): FlattenInput {
  return {
    places,
    rootName: "Macintosh HD",
    collapsedSections: [],
    expanded: new Set(),
    children: {},
    showHidden: false,
    currentPath: null,
    locale: "en",
    ...extra,
  };
}

const summary = (rows: SidebarRow[]) =>
  rows.map((r) => {
    switch (r.type) {
      case "header":
        return `# ${r.label}${r.collapsed ? " (collapsed)" : ""}`;
      case "place":
        return `place ${r.place.name}`;
      case "node":
        return `${"  ".repeat(r.depth)}${r.name}${r.hasArrow ? (r.expanded ? " v" : " >") : ""}`;
      case "message":
        return `${"  ".repeat(r.depth)}! ${r.text}`;
    }
  });

describe("flattenSidebar", () => {
  it("lists headers, favorites, locations and the collapsed root", () => {
    expect(summary(flattenSidebar(input()))).toEqual([
      "# Favorites",
      "place greg",
      "place Desktop",
      "place Applications",
      "# Locations",
      "place Macintosh HD",
      "place USB",
      "# Folders",
      "Macintosh HD >",
    ]);
  });

  it("omits the rows of collapsed sections but keeps their headers", () => {
    const rows = flattenSidebar(input({ collapsedSections: ["favorites", "folders"] }));
    expect(summary(rows)).toEqual([
      "# Favorites (collapsed)",
      "# Locations",
      "place Macintosh HD",
      "place USB",
      "# Folders (collapsed)",
    ]);
  });

  it("expands nodes with depth, sorting children naturally", () => {
    const rows = flattenSidebar(
      input({
        expanded: new Set(["/", "/Users"]),
        children: {
          "/": [node("/Users"), node("/Applications"), node("/tmp10"), node("/tmp2")],
          "/Users": [node("/Users/greg", { hasChildren: false, hasVisibleChildren: false })],
        },
      }),
    );
    expect(summary(rows).slice(7)).toEqual([
      "# Folders",
      "Macintosh HD v",
      "  Applications >",
      "  tmp2 >",
      "  tmp10 >",
      "  Users v",
      "    greg",
    ]);
  });

  it("hides hidden nodes unless showHidden, except ancestors of the current folder", () => {
    const children = {
      "/": [node("/Users"), node("/private", { isHidden: true })],
      "/private": [
        node("/private/tmp", { isHidden: true }),
        node("/private/etc", { isHidden: true }),
      ],
    };
    const base = { expanded: new Set(["/", "/private"]), children };
    const plain = summary(flattenSidebar(input(base))).slice(8);
    expect(plain).toEqual(["Macintosh HD v", "  Users >"]);

    const withCurrent = summary(
      flattenSidebar(input({ ...base, currentPath: "/private/tmp" })),
    ).slice(8);
    expect(withCurrent).toEqual(["Macintosh HD v", "  private v", "    tmp >", "  Users >"]);

    const shown = summary(flattenSidebar(input({ ...base, showHidden: true }))).slice(8);
    expect(shown).toEqual(["Macintosh HD v", "  private v", "    etc >", "    tmp >", "  Users >"]);
  });

  it("uses hasVisibleChildren for the arrow unless hidden files are shown", () => {
    const children = {
      "/": [node("/proj", { hasChildren: true, hasVisibleChildren: false })],
    };
    const base = { expanded: new Set(["/"]), children };
    expect(summary(flattenSidebar(input(base)))[8 + 1]).toBe("  proj");
    expect(summary(flattenSidebar(input({ ...base, showHidden: true })))[8 + 1]).toBe("  proj >");
  });

  it("renders an error row for a folder that failed to load and nothing while loading", () => {
    const error = { code: "permissionDenied" as const, path: "/Users" };
    const failed = flattenSidebar(
      input({
        expanded: new Set(["/", "/Users"]),
        children: { "/": [node("/Users")], "/Users": error },
      }),
    );
    expect(summary(failed).slice(8)).toEqual([
      "Macintosh HD v",
      "  Users v",
      "    ! Can’t open folder",
    ]);

    const loading = flattenSidebar(
      input({ expanded: new Set(["/"]), children: { "/": "loading" } }),
    );
    expect(summary(loading).slice(8)).toEqual(["Macintosh HD v"]);
  });

  it("marks the root row and finds node rows by path", () => {
    const rows = flattenSidebar(
      input({ expanded: new Set(["/"]), children: { "/": [node("/Users")] } }),
    );
    const root = rows.find((r) => r.type === "node" && r.isRoot);
    expect(root).toBeDefined();
    expect(indexOfNode(rows, "/Users")).toBeGreaterThan(indexOfNode(rows, "/"));
    expect(indexOfNode(rows, "/nope")).toBe(-1);
  });
});
