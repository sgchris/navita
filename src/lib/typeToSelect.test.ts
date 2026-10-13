import { describe, expect, it } from "vitest";
import { EMPTY_TYPE_AHEAD, findTypeAheadMatch, typeAheadStep } from "./typeToSelect";

describe("typeAheadStep", () => {
  it("accumulates characters typed quickly", () => {
    const a = typeAheadStep(EMPTY_TYPE_AHEAD, "n", 5000);
    const b = typeAheadStep(a!, "o", 5400);
    expect(b).toEqual({ text: "no", at: 5400 });
  });

  it("resets the buffer after 1000 ms idle", () => {
    const a = typeAheadStep(EMPTY_TYPE_AHEAD, "n", 5000)!;
    expect(typeAheadStep(a, "d", 6000)).toEqual({ text: "nd", at: 6000 });
    expect(typeAheadStep(a, "d", 6001)).toEqual({ text: "d", at: 6001 });
  });

  it("ignores non-printable keys and a leading space but accepts a space inside the buffer", () => {
    expect(typeAheadStep(EMPTY_TYPE_AHEAD, "Enter", 1)).toBeNull();
    expect(typeAheadStep(EMPTY_TYPE_AHEAD, "ArrowDown", 1)).toBeNull();
    expect(typeAheadStep(EMPTY_TYPE_AHEAD, " ", 1)).toBeNull();
    const a = typeAheadStep(EMPTY_TYPE_AHEAD, "a", 1000)!;
    expect(typeAheadStep(a, " ", 1100)?.text).toBe("a ");
  });
});

describe("findTypeAheadMatch", () => {
  const names = ["Applications", "archive.zip", "Desktop", "Éclair.txt", "notes.md"];

  it("matches the first name with the prefix, case-insensitively", () => {
    expect(findTypeAheadMatch(names, "a", "en")).toBe(0);
    expect(findTypeAheadMatch(names, "ar", "en")).toBe(1);
    expect(findTypeAheadMatch(names, "DES", "en")).toBe(2);
    expect(findTypeAheadMatch(names, "no", "en")).toBe(4);
  });

  it("is accent-insensitive and reports no match as -1", () => {
    expect(findTypeAheadMatch(names, "ec", "en")).toBe(3);
    expect(findTypeAheadMatch(names, "zzz", "en")).toBe(-1);
  });
});
