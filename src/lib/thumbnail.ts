import type { Entry } from "../api/bindings/Entry";
import { fileTypeOf } from "./fileTypes";

type ThumbnailEntry = Pick<
  Entry,
  "kind" | "extension" | "isBrokenLink" | "isDirLike" | "isReadable" | "path" | "modifiedMs"
>;

/** Image files (category "image") that can be read get a thumbnail instead of the icon. */
export function wantsThumbnail(entry: ThumbnailEntry): boolean {
  if (entry.isDirLike || entry.isBrokenLink || !entry.isReadable) return false;
  if (entry.kind === "directory" || entry.kind === "package") return false;
  return fileTypeOf(entry).category === "image";
}

/**
 * URL served by the `thumb://` scheme of the Rust core (macOS form). `px` is the longest side in
 * pixels; the modification time busts the cache when the file changes.
 */
export function thumbnailUrl(entry: Pick<Entry, "path" | "modifiedMs">, px: number): string {
  return `thumb://localhost/${encodeURIComponent(entry.path)}?px=${px}&m=${entry.modifiedMs ?? 0}`;
}

const failedUrls = new Set<string>();

/** Remembers URLs that failed so virtualized rows that remount do not retry them endlessly. */
export const markFailed = (url: string): void => {
  failedUrls.add(url);
};

export const hasFailed = (url: string): boolean => failedUrls.has(url);
