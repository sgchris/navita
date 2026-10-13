import { describe, expect, it } from "vitest";
import { ancestorsOf, basename, isAncestorOrSelf, join, parentOf, segments } from "./paths";

describe("paths", () => {
  it("parentOf", () => {
    expect(parentOf("/")).toBeNull();
    expect(parentOf("/Users")).toBe("/");
    expect(parentOf("/Users/greg/Documents")).toBe("/Users/greg");
  });

  it("basename", () => {
    expect(basename("/")).toBe("/");
    expect(basename("/Users")).toBe("Users");
    expect(basename("/Users/greg/a b.txt")).toBe("a b.txt");
  });

  it("segments and join", () => {
    expect(segments("/")).toEqual([]);
    expect(segments("/Users/greg")).toEqual(["Users", "greg"]);
    expect(join("/", "Users")).toBe("/Users");
    expect(join("/Users", "greg")).toBe("/Users/greg");
  });

  it("ancestorsOf includes root and the path itself", () => {
    expect(ancestorsOf("/")).toEqual(["/"]);
    expect(ancestorsOf("/Users/greg/Docs")).toEqual([
      "/",
      "/Users",
      "/Users/greg",
      "/Users/greg/Docs",
    ]);
  });

  it("isAncestorOrSelf respects segment boundaries", () => {
    expect(isAncestorOrSelf("/Users/greg", "/Users/greg")).toBe(true);
    expect(isAncestorOrSelf("/Users/greg", "/Users/greg/Docs")).toBe(true);
    expect(isAncestorOrSelf("/Users/greg", "/Users/gregory")).toBe(false);
    expect(isAncestorOrSelf("/", "/anything")).toBe(true);
    expect(isAncestorOrSelf("/a/b", "/a")).toBe(false);
  });
});
