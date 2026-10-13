import { describe, expect, it } from "vitest";
import { formatDate, formatFreeSpace, formatSize, formatStatus } from "./format";

describe("formatSize", () => {
  it("handles small values", () => {
    expect(formatSize(null, "en-US")).toBe("--");
    expect(formatSize(0, "en-US")).toBe("Zero bytes");
    expect(formatSize(1, "en-US")).toBe("1 byte");
    expect(formatSize(512, "en-US")).toBe("512 bytes");
    expect(formatSize(999, "en-US")).toBe("999 bytes");
  });

  it("uses decimal units with Finder-style rounding", () => {
    expect(formatSize(1000, "en-US")).toBe("1 KB");
    expect(formatSize(4000, "en-US")).toBe("4 KB");
    expect(formatSize(4400, "en-US")).toBe("4 KB");
    expect(formatSize(1_200_000, "en-US")).toBe("1.2 MB");
    expect(formatSize(2_000_000, "en-US")).toBe("2 MB");
    expect(formatSize(3_450_000_000, "en-US")).toBe("3.45 GB");
    expect(formatSize(1_500_000_000_000, "en-US")).toBe("1.5 TB");
  });

  it("promotes to the next unit when rounding reaches 1000", () => {
    expect(formatSize(999_999, "en-US")).toBe("1 MB");
    expect(formatSize(999_950_000, "en-US")).toBe("1 GB");
  });

  it("respects the locale decimal separator", () => {
    expect(formatSize(1_200_000, "de-DE")).toBe("1,2 MB");
  });
});

describe("formatFreeSpace", () => {
  it("uses one decimal for MB, GB and TB", () => {
    expect(formatFreeSpace(312_412_000_000, "en-US")).toBe("312.4 GB");
    expect(formatFreeSpace(5_000_000, "en-US")).toBe("5 MB");
    expect(formatFreeSpace(2_345_000_000_000, "en-US")).toBe("2.3 TB");
    expect(formatFreeSpace(800, "en-US")).toBe("800 bytes");
  });
});

describe("formatDate", () => {
  const now = new Date(2026, 9, 13, 15, 30); // 13 Oct 2026, local time
  const at = (y: number, m: number, d: number, h: number, min: number) =>
    new Date(y, m, d, h, min).getTime();

  it("uses Today / Yesterday with the short time", () => {
    const time = new Intl.DateTimeFormat("en-US", { timeStyle: "short" });
    expect(formatDate(at(2026, 9, 13, 14, 2), now, "en-US")).toBe(
      `Today at ${time.format(new Date(2026, 9, 13, 14, 2))}`,
    );
    expect(formatDate(at(2026, 9, 12, 18, 40), now, "en-US")).toBe(
      `Yesterday at ${time.format(new Date(2026, 9, 12, 18, 40))}`,
    );
  });

  it("handles month boundaries for Yesterday", () => {
    const firstOfMonth = new Date(2026, 10, 1, 9, 0);
    expect(formatDate(at(2026, 9, 31, 23, 59), firstOfMonth, "en-US")).toMatch(/^Yesterday at /);
  });

  it("uses medium date and short time otherwise", () => {
    const ms = at(2026, 9, 3, 9, 12);
    expect(formatDate(ms, now, "en-US")).toBe(
      new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(
        new Date(ms),
      ),
    );
  });

  it("shows -- for missing dates", () => {
    expect(formatDate(null, now, "en-US")).toBe("--");
  });
});

describe("formatStatus", () => {
  it("builds the status bar text", () => {
    expect(formatStatus({ count: 42, selected: 1, freeBytes: 312_400_000_000 }, "en-US")).toBe(
      "42 items, 1 selected, 312.4 GB available",
    );
    expect(formatStatus({ count: 1, selected: 0, freeBytes: null }, "en-US")).toBe("1 item");
    expect(formatStatus({ count: 10000, selected: 0, freeBytes: 5_000_000 }, "en-US")).toBe(
      "10,000 items, 5 MB available",
    );
  });
});
