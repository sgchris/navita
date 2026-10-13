import { cx } from "../lib/cx";
import { LayoutGrid, List } from "../lib/icons";
import { usePrefs } from "../state/prefs";

/** Segmented control: Icons | List (default Icons). */
export function ViewSwitch() {
  const viewMode = usePrefs((s) => s.viewMode);
  const setViewMode = usePrefs((s) => s.setViewMode);
  return (
    <div className="segmented" role="group" aria-label="View">
      <button
        type="button"
        className={cx("segmented__item", viewMode === "icons" && "segmented__item--active")}
        aria-pressed={viewMode === "icons"}
        title="as Icons (⌘1)"
        onClick={() => setViewMode("icons")}
      >
        <LayoutGrid size={16} strokeWidth={1.75} />
      </button>
      <button
        type="button"
        className={cx("segmented__item", viewMode === "list" && "segmented__item--active")}
        aria-pressed={viewMode === "list"}
        title="as List (⌘2)"
        onClick={() => setViewMode("list")}
      >
        <List size={16} strokeWidth={1.75} />
      </button>
    </div>
  );
}
