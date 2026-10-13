import { describe, expect, it } from "vitest";
import { fileTypeOf } from "./fileTypes";

const file = (extension: string | null, extra = {}) => ({
  kind: "file" as const,
  extension,
  isBrokenLink: false,
  isDirLike: false,
  ...extra,
});

describe("fileTypeOf", () => {
  it("classifies every extension category from the spec", () => {
    const cases: Array<[string, string, string]> = [
      ["png", "image", "PNG image"],
      ["jpg", "image", "JPEG image"],
      ["heic", "image", "HEIC image"],
      ["mp4", "video", "MPEG-4 movie"],
      ["mov", "video", "QuickTime movie"],
      ["mp3", "audio", "MP3 audio"],
      ["flac", "audio", "FLAC audio"],
      ["pdf", "pdf", "PDF document"],
      ["txt", "text", "Plain text"],
      ["md", "text", "Markdown"],
      ["csv", "text", "CSV document"],
      ["rs", "code", "Rust source"],
      ["tsx", "code", "TSX source"],
      ["sh", "code", "Shell script"],
      ["zip", "archive", "ZIP archive"],
      ["7z", "archive", "7-Zip archive"],
      ["dmg", "disk", "Disk image"],
      ["iso", "disk", "Disk image"],
      ["docx", "document", "Document"],
      ["xlsx", "spreadsheet", "Spreadsheet"],
      ["pptx", "presentation", "Presentation"],
      ["app", "application", "Application"],
    ];
    for (const [ext, category, label] of cases) {
      expect(fileTypeOf(file(ext)), ext).toEqual({ category, kindLabel: label });
    }
  });

  it("falls back to '<EXT> file' for unknown extensions and 'Document' without one", () => {
    expect(fileTypeOf(file("xyz"))).toEqual({ category: "unknown", kindLabel: "XYZ file" });
    expect(fileTypeOf(file(null))).toEqual({ category: "unknown", kindLabel: "Document" });
  });

  it("treats directories as folders regardless of extension", () => {
    const dir = {
      kind: "directory" as const,
      extension: "json",
      isBrokenLink: false,
      isDirLike: true,
    };
    expect(fileTypeOf(dir)).toEqual({ category: "folder", kindLabel: "Folder" });
    const link = {
      kind: "symlink" as const,
      extension: null,
      isBrokenLink: false,
      isDirLike: true,
    };
    expect(fileTypeOf(link).category).toBe("folder");
  });

  it("prefers the extension category for packages and uses the package icon otherwise", () => {
    const app = {
      kind: "package" as const,
      extension: "app",
      isBrokenLink: false,
      isDirLike: false,
    };
    expect(fileTypeOf(app)).toEqual({ category: "application", kindLabel: "Application" });
    const pages = { ...app, extension: "pages" };
    expect(fileTypeOf(pages).category).toBe("document");
    const sparse = { ...app, extension: "sparsebundle" };
    expect(fileTypeOf(sparse).category).toBe("disk");
    const xcode = { ...app, extension: "xcodeproj" };
    expect(fileTypeOf(xcode)).toEqual({ category: "package", kindLabel: "XCODEPROJ package" });
    const bare = { ...app, extension: null };
    expect(fileTypeOf(bare)).toEqual({ category: "package", kindLabel: "Package" });
  });

  it("labels broken links", () => {
    const broken = {
      kind: "symlink" as const,
      extension: "txt",
      isBrokenLink: true,
      isDirLike: false,
    };
    expect(fileTypeOf(broken)).toEqual({ category: "unknown", kindLabel: "Broken alias" });
  });

  it("symlinks to files use their name's extension", () => {
    const link = {
      kind: "symlink" as const,
      extension: "pdf",
      isBrokenLink: false,
      isDirLike: false,
    };
    expect(fileTypeOf(link)).toEqual({ category: "pdf", kindLabel: "PDF document" });
  });
});
