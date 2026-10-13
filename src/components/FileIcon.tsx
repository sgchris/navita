import { memo, useState } from "react";
import type { Entry } from "../api/bindings/Entry";
import { cx } from "../lib/cx";
import { fileTypeOf, type Category } from "../lib/fileTypes";
import {
  AppWindow,
  ArrowUpRight,
  File,
  FileArchive,
  FileAudio,
  FileCode,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileVideo,
  Folder,
  HardDrive,
  Package,
  Presentation,
  type LucideIcon,
} from "../lib/icons";
import { ICON_SIZE_GRID, ICON_SIZE_LIST } from "../lib/layout";
import { hasFailed, markFailed, thumbnailUrl, wantsThumbnail } from "../lib/thumbnail";

const ICONS: Record<Category, LucideIcon> = {
  folder: Folder,
  application: AppWindow,
  image: FileImage,
  video: FileVideo,
  audio: FileAudio,
  pdf: FileText,
  text: FileText,
  code: FileCode,
  archive: FileArchive,
  disk: HardDrive,
  document: FileText,
  spreadsheet: FileSpreadsheet,
  presentation: Presentation,
  package: Package,
  unknown: File,
};

interface Props {
  entry: Pick<
    Entry,
    "kind" | "extension" | "isBrokenLink" | "isDirLike" | "path" | "modifiedMs" | "isReadable"
  >;
  variant: "list" | "grid";
}

/** Thumbnail pixels requested per variant: twice the icon size for retina displays. */
const THUMBNAIL_PX = { list: 32, grid: 96 } as const;

/**
 * The image itself, laid over the icon box. It stays invisible until it has loaded (the category
 * icon shows meanwhile) and disappears for good if it fails (the icon stays).
 */
function Thumbnail({ url }: { url: string }) {
  const [status, setStatus] = useState<"loading" | "loaded" | "failed">(
    hasFailed(url) ? "failed" : "loading",
  );
  if (status === "failed") return null;
  return (
    <img
      className={cx("file-icon__image", status === "loaded" && "file-icon__image--loaded")}
      src={url}
      alt=""
      decoding="async"
      draggable={false}
      ref={(img) => {
        // A cached image can be complete before React attached onLoad.
        if (img?.complete && img.naturalWidth > 0 && status !== "loaded") setStatus("loaded");
      }}
      onLoad={() => setStatus("loaded")}
      onError={() => {
        markFailed(url);
        setStatus("failed");
      }}
    />
  );
}

/** Category icon (decisions B23) with a small arrow badge for symlinks. */
export const FileIcon = memo(function FileIcon({ entry, variant }: Props) {
  const { category } = fileTypeOf(entry);
  const Icon = ICONS[category];
  const grid = variant === "grid";
  const url = wantsThumbnail(entry) ? thumbnailUrl(entry, THUMBNAIL_PX[variant]) : null;
  return (
    <span className={cx("file-icon", `file-icon--${variant}`, `file-icon--${category}`)}>
      {url !== null && <Thumbnail key={url} url={url} />}
      <Icon
        className="file-icon__glyph"
        size={grid ? ICON_SIZE_GRID : ICON_SIZE_LIST}
        strokeWidth={grid ? 1.5 : 1.75}
        absoluteStrokeWidth
        {...(category === "folder" ? { fill: "currentColor", fillOpacity: 0.85 } : {})}
      />
      {entry.kind === "symlink" && (
        <span className="file-icon__badge">
          <ArrowUpRight size={grid ? 12 : 7} strokeWidth={2.5} absoluteStrokeWidth />
        </span>
      )}
    </span>
  );
});
