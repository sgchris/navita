interface Props {
  /** Drawn below the List view's header and ".." row instead of centered in the pane. */
  belowList?: boolean;
  hiddenCount: number;
  onShowHidden: () => void;
}

export function EmptyState({ belowList = false, hiddenCount, onShowHidden }: Props) {
  const className = belowList ? "state state--below-list" : "state";
  if (hiddenCount > 0) {
    return (
      <div className={className}>
        <div>
          No visible items — {hiddenCount} hidden {hiddenCount === 1 ? "item" : "items"}
        </div>
        <button type="button" className="state__button" onClick={onShowHidden}>
          Show Hidden Files
        </button>
      </div>
    );
  }
  return (
    <div className={className}>
      <div>Folder is empty</div>
    </div>
  );
}
