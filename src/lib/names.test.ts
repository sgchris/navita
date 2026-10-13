import { describe, expect, it } from "vitest";
import {
  EMPTY_NAME_MESSAGE,
  FORBIDDEN_CHARACTERS_MESSAGE,
  NOT_ALLOWED_MESSAGE,
  TOO_LONG_MESSAGE,
  alreadyExistsMessage,
  renameSelectionEnd,
  splitBaseExt,
  validateName,
} from "./names";

describe("validateName (mirrors the Rust table)", () => {
  it("accepts ordinary names", () => {
    for (const name of ["a", "untitled folder", ".hidden", "Übung 😀.txt", "x".repeat(255)]) {
      expect(validateName(name), name).toBeNull();
    }
  });

  it("rejects invalid names with the shared messages", () => {
    expect(validateName("")).toBe(EMPTY_NAME_MESSAGE);
    expect(validateName(".")).toBe(NOT_ALLOWED_MESSAGE);
    expect(validateName("..")).toBe(NOT_ALLOWED_MESSAGE);
    expect(validateName("a\0b")).toBe(NOT_ALLOWED_MESSAGE);
    expect(validateName("a/b")).toBe(FORBIDDEN_CHARACTERS_MESSAGE);
    expect(validateName("a:b")).toBe(FORBIDDEN_CHARACTERS_MESSAGE);
    expect(validateName("x".repeat(256))).toBe(TOO_LONG_MESSAGE);
    expect(validateName("é".repeat(128))).toBe(TOO_LONG_MESSAGE); // 256 UTF-8 bytes
  });

  it("formats the collision message", () => {
    expect(alreadyExistsMessage("b.txt")).toBe("A file named “b.txt” already exists.");
  });
});

describe("splitBaseExt / renameSelectionEnd", () => {
  it("does not preselect the extension", () => {
    expect(splitBaseExt("report.pdf")).toEqual({ base: "report", ext: ".pdf" });
    expect(renameSelectionEnd("report.pdf")).toBe(6);
    expect(renameSelectionEnd("archive.tar.gz")).toBe("archive.tar".length);
  });

  it("selects the whole name for dotfiles, extensionless names and trailing dots", () => {
    expect(splitBaseExt(".gitignore")).toEqual({ base: ".gitignore", ext: "" });
    expect(renameSelectionEnd("Makefile")).toBe(8);
    expect(renameSelectionEnd("untitled folder")).toBe(15);
    expect(renameSelectionEnd("name.")).toBe(5);
    expect(renameSelectionEnd("")).toBe(0);
  });
});
