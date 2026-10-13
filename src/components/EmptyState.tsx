interface Props {
  hiddenCount: number;
  onShowHidden: () => void;
}

export function EmptyState({ hiddenCount, onShowHidden }: Props) {
  if (hiddenCount > 0) {
    return (
      <div className="state">
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
    <div className="state">
      <div>Folder is empty</div>
    </div>
  );
}
