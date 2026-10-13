import { memo, type MouseEvent } from "react";
import type { Entry } from "../api/bindings/Entry";
import { cx } from "../lib/cx";
import { fileTypeOf } from "../lib/fileTypes";
import { formatDate, formatSize } from "../lib/format";
import { truncateName } from "../lib/measure";
import { showItemMenu } from "../lib/contextMenu";
import { openSelected } from "../lib/open";
import { useSelection } from "../state/selection";
import { FileIcon } from "./FileIcon";
import { RenameInput } from "./RenameInput";

interface Props {
  entry: Entry;
  selected: boolean;
  renaming: boolean;
  /** Pixel budget for the (middle-truncated) name text. */
  nameBudget: number;
  now: Date;
  /** Vertical offset of the row inside the list body. */
  top: number;
}

export const FileRow = memo(function FileRow({
  entry,
  selected,
  renaming,
  nameBudget,
  now,
  top,
}: Props) {
  const onClick = (e: MouseEvent) => {
    if (e.button !== 0) return;
    useSelection.getState().click(entry.path, { meta: e.metaKey, shift: e.shiftKey });
  };
  const onDoubleClick = (e: MouseEvent) => {
    if (e.button !== 0 || e.metaKey || e.shiftKey) return;
    void openSelected();
  };

  return (
    <div
      className={cx(
        "file-row",
        selected && "file-row--selected",
        (entry.isHidden || entry.isBrokenLink) && "file-row--dim",
      )}
      data-path={entry.path}
      style={{ transform: `translateY(${top}px)` }}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        void showItemMenu(entry.path);
      }}
    >
      <div className="file-row__inner">
        <div className="file-row__name">
          <FileIcon entry={entry} variant="list" />
          {renaming ? (
            <RenameInput entry={entry} variant="list" />
          ) : (
            <span className="file-row__label" title={entry.name}>
              {truncateName(entry.name, nameBudget, 13)}
            </span>
          )}
        </div>
        <div className="file-row__cell">{formatDate(entry.modifiedMs, now)}</div>
        <div className="file-row__cell file-row__cell--size">{formatSize(entry.size)}</div>
        <div className="file-row__cell">{fileTypeOf(entry).kindLabel}</div>
      </div>
    </div>
  );
});
