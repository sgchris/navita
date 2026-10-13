import { describe, expect, it } from "vitest";
import { middleTruncate } from "./middleTruncate";

const measure = (text: string) => Array.from(text).length; // 1 px per character

describe("middleTruncate", () => {
  it("returns text that already fits", () => {
    expect(middleTruncate("short.txt", 20, measure)).toBe("short.txt");
    expect(middleTruncate("exactly10!", 10, measure)).toBe("exactly10!");
  });

  it("keeps head and tail around an ellipsis within the budget", () => {
    const out = middleTruncate("report-final-version-3.pdf", 12, measure);
    expect(measure(out)).toBeLessThanOrEqual(12);
    expect(out).toContain("…");
    expect(out.startsWith("report")).toBe(true);
    expect(out.endsWith(".pdf")).toBe(true);
  });

  it("gives the head the extra character when k is odd", () => {
    // width 6 -> ellipsis + k=5 chars kept: head 3, tail 2
    expect(middleTruncate("abcdefghij", 6, measure)).toBe("abc…ij");
  });

  it("falls back to just the ellipsis when nothing else fits", () => {
    expect(middleTruncate("abcdefghij", 1, measure)).toBe("…");
    expect(middleTruncate("abcdefghij", 0, measure)).toBe("…");
  });

  it("never splits surrogate pairs", () => {
    const out = middleTruncate("😀😀😀😀😀😀", 4, measure);
    expect(out).toBe("😀😀…😀");
  });
});
