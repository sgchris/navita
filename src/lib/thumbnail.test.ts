import { describe, expect, it } from "vitest";
import { hasFailed, markFailed, thumbnailUrl, wantsThumbnail } from "./thumbnail";

const entry = (extra: Record<string, unknown> = {}) => ({
  kind: "file" as const,
  extension: "png" as string | null,
  isBrokenLink: false,
  isDirLike: false,
  isReadable: true,
  path: "/Users/me/pic.png",
  modifiedMs: 1700000000000 as number | null,
  ...extra,
});

describe("wantsThumbnail", () => {
  it("is true for readable image files of every image extension", () => {
    for (const extension of [
      "png",
      "jpg",
      "jpeg",
      "gif",
      "heic",
      "heif",
      "webp",
      "tiff",
      "bmp",
      "svg",
      "raw",
      "cr2",
      "nef",
      "dng",
    ]) {
      expect(wantsThumbnail(entry({ extension })), extension).toBe(true);
    }
  });

  it("is false for other files, folders, packages, broken links and unreadable files", () => {
    expect(wantsThumbnail(entry({ extension: "pdf" }))).toBe(false);
    expect(wantsThumbnail(entry({ extension: null }))).toBe(false);
    expect(wantsThumbnail(entry({ kind: "directory", isDirLike: true }))).toBe(false);
    expect(wantsThumbnail(entry({ kind: "package" }))).toBe(false);
    expect(wantsThumbnail(entry({ isBrokenLink: true }))).toBe(false);
    expect(wantsThumbnail(entry({ isReadable: false }))).toBe(false);
  });

  it("is true for a symlink to an image file", () => {
    expect(wantsThumbnail(entry({ kind: "symlink" }))).toBe(true);
  });
});

describe("thumbnailUrl", () => {
  it("encodes the path and carries size and modification time", () => {
    expect(thumbnailUrl({ path: "/Users/me/my pic 😀.png", modifiedMs: 42 }, 96)).toBe(
      `thumb://localhost/${encodeURIComponent("/Users/me/my pic 😀.png")}?px=96&m=42`,
    );
    expect(thumbnailUrl({ path: "/a.png", modifiedMs: null }, 32)).toBe(
      "thumb://localhost/%2Fa.png?px=32&m=0",
    );
  });
});

describe("failed urls", () => {
  it("are remembered", () => {
    const url = thumbnailUrl({ path: "/broken.png", modifiedMs: 1 }, 32);
    expect(hasFailed(url)).toBe(false);
    markFailed(url);
    expect(hasFailed(url)).toBe(true);
  });
});
