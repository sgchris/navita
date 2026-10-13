import { describe, expect, it } from "vitest";
import { DEFAULT_PREFS } from "./prefs";
import { validatePrefs } from "./prefsValidate";

describe("validatePrefs", () => {
  it("returns the defaults for empty input", () => {
    expect(validatePrefs({})).toEqual(DEFAULT_PREFS);
  });

  it("defaults are icons view, name ascending, hidden files off", () => {
    expect(DEFAULT_PREFS.viewMode).toBe("icons");
    expect(DEFAULT_PREFS.showHidden).toBe(false);
    expect(DEFAULT_PREFS.sort).toEqual({ key: "name", dir: "asc" });
  });

  it("accepts valid stored values", () => {
    const stored = {
      viewMode: "list",
      sort: { key: "modified", dir: "desc" },
      showHidden: true,
      sidebarWidth: 300,
      sidebarVisible: false,
      pathBarVisible: false,
      statusBarVisible: false,
      columnWidths: { modified: 200, size: 90, kind: 150 },
      collapsedSections: ["folders"],
      lastPath: "/Users/greg",
      expandedTreePaths: ["/", "/Users"],
    } as const;
    expect(validatePrefs(stored)).toEqual(stored);
  });

  it("replaces invalid values with defaults", () => {
    const result = validatePrefs({
      viewMode: "grid",
      sort: { key: "color", dir: "up" },
      showHidden: "yes",
      sidebarWidth: "wide",
      sidebarVisible: 1,
      columnWidths: "nope",
      collapsedSections: "folders",
      lastPath: "relative/path",
      expandedTreePaths: "x",
    });
    expect(result).toEqual(DEFAULT_PREFS);
  });

  it("clamps numbers into their allowed ranges", () => {
    const result = validatePrefs({
      sidebarWidth: 10,
      columnWidths: { modified: 5, size: 99999, kind: Number.NaN },
    });
    expect(result.sidebarWidth).toBe(180);
    expect(validatePrefs({ sidebarWidth: 9999 }).sidebarWidth).toBe(400);
    expect(result.columnWidths).toEqual({
      modified: 120,
      size: 2000,
      kind: DEFAULT_PREFS.columnWidths.kind,
    });
  });

  it("filters section and path lists", () => {
    const result = validatePrefs({
      collapsedSections: ["folders", "bogus", "favorites", "folders"],
      expandedTreePaths: ["/a", 5, "relative", "/a", "/b", null],
    });
    expect(result.collapsedSections).toEqual(["favorites", "folders"]);
    expect(result.expandedTreePaths).toEqual(["/a", "/b"]);
  });

  it("caps the number of stored expanded paths", () => {
    const many = Array.from({ length: 800 }, (_, i) => `/p${i}`);
    expect(validatePrefs({ expandedTreePaths: many }).expandedTreePaths).toHaveLength(500);
  });
});
