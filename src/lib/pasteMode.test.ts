import { describe, expect, it } from "vitest";
import { pasteMode } from "./pasteMode";

const mark = (mode: "copy" | "cut" | null, changeCount: number) => ({
  mode,
  paths: ["/a"],
  changeCount,
});

describe("pasteMode", () => {
  it("moves only after a cut whose clipboard is unchanged", () => {
    expect(pasteMode(mark("cut", 7), 7)).toBe("move");
  });

  it("copies when the clipboard changed after the cut", () => {
    expect(pasteMode(mark("cut", 7), 8)).toBe("copy");
  });

  it("copies after a copy, with no mark, and for files that came from another app", () => {
    expect(pasteMode(mark("copy", 7), 7)).toBe("copy");
    expect(pasteMode(mark(null, 0), 0)).toBe("copy");
    expect(pasteMode(mark(null, 0), 42)).toBe("copy");
  });
});
