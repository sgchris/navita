/** File name rules for New Folder / Rename (decisions B31, B32); mirrors `fs/ops.rs` exactly. */

const MAX_NAME_BYTES = 255;
const encoder = new TextEncoder();

export const EMPTY_NAME_MESSAGE = "A name can't be empty.";
export const NOT_ALLOWED_MESSAGE = "That name isn't allowed.";
export const FORBIDDEN_CHARACTERS_MESSAGE = "Names can't contain “/” or “:”.";
export const TOO_LONG_MESSAGE = "Name is too long.";

/** Reason a name is invalid, or null when it is acceptable. */
export function validateName(name: string): string | null {
  if (name.length === 0) return EMPTY_NAME_MESSAGE;
  if (name === "." || name === ".." || name.includes("\0")) return NOT_ALLOWED_MESSAGE;
  if (name.includes("/") || name.includes(":")) return FORBIDDEN_CHARACTERS_MESSAGE;
  if (encoder.encode(name).length > MAX_NAME_BYTES) return TOO_LONG_MESSAGE;
  return null;
}

export const alreadyExistsMessage = (name: string): string =>
  `A file named “${name}” already exists.`;

/**
 * Splits a name at its last dot. Names without a real extension (no dot, a leading dot only, or a
 * trailing dot) are all base.
 */
export function splitBaseExt(name: string): { base: string; ext: string } {
  const dot = name.lastIndexOf(".");
  if (dot <= 0 || dot === name.length - 1) return { base: name, ext: "" };
  return { base: name.slice(0, dot), ext: name.slice(dot) };
}

/** End of the initially selected range when renaming: the extension is not preselected. */
export function renameSelectionEnd(name: string): number {
  return splitBaseExt(name).base.length;
}
