import { memo } from "react";
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
  entry: Pick<Entry, "kind" | "extension" | "isBrokenLink" | "isDirLike">;
  variant: "list" | "grid";
}

/** Category icon (decisions B23) with a small arrow badge for symlinks. */
export const FileIcon = memo(function FileIcon({ entry, variant }: Props) {
  const { category } = fileTypeOf(entry);
  const Icon = ICONS[category];
  const grid = variant === "grid";
  return (
    <span className={cx("file-icon", `file-icon--${variant}`, `file-icon--${category}`)}>
      <Icon
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
