import { memo, type MouseEvent } from "react";
import type { Entry } from "../api/bindings/Entry";
import { cx } from "../lib/cx";
import { CELL_SIZE } from "../lib/grid";
import { truncateName } from "../lib/measure";
import { showItemMenu } from "../lib/contextMenu";
import { openSelected } from "../lib/open";
import { useSelection } from "../state/selection";
import { FileIcon } from "./FileIcon";

/** Two lines of text inside the cell minus padding, minus slack for wrapping at line ends. */
const NAME_BUDGET = 2 * (CELL_SIZE - 8) - 6;

interface Props {
  entry: Entry;
  selected: boolean;
}

export const IconCell = memo(function IconCell({ entry, selected }: Props) {
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
        "icon-cell",
        selected && "icon-cell--selected",
        (entry.isHidden || entry.isBrokenLink) && "icon-cell--dim",
      )}
      data-path={entry.path}
      title={entry.name}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        void showItemMenu(entry.path);
      }}
    >
      <div className="icon-cell__icon">
        <FileIcon entry={entry} variant="grid" />
      </div>
      <div className="icon-cell__name">
        <span className="icon-cell__label">{truncateName(entry.name, NAME_BUDGET, 12)}</span>
      </div>
    </div>
  );
});
