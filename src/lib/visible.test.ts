import { describe, expect, it } from "vitest";
import { countHidden, filterVisible } from "./visible";

const entries = [
  { name: ".env", isHidden: true },
  { name: ".git", isHidden: true },
  { name: "Library", isHidden: true }, // UF_HIDDEN flag: listed with isHidden true by Rust
  { name: "notes.txt", isHidden: false },
  { name: "src", isHidden: false },
];

describe("filterVisible", () => {
  it("hides dot-files, dot-folders and flagged items by default", () => {
    expect(filterVisible(entries, false).map((e) => e.name)).toEqual(["notes.txt", "src"]);
  });

  it("shows everything when showHidden is on and preserves order", () => {
    expect(filterVisible(entries, true).map((e) => e.name)).toEqual(entries.map((e) => e.name));
  });

  it("does not mutate the input", () => {
    const copy = [...entries];
    filterVisible(entries, false);
    expect(entries).toEqual(copy);
  });

  it("counts hidden entries", () => {
    expect(countHidden(entries)).toBe(3);
    expect(countHidden([])).toBe(0);
  });
});
