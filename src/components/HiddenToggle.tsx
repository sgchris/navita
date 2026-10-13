import { cx } from "../lib/cx";
import { Eye, EyeOff } from "../lib/icons";
import { usePrefs } from "../state/prefs";

/** Toolbar toggle for hidden files (default off). */
export function HiddenToggle() {
  const showHidden = usePrefs((s) => s.showHidden);
  const toggle = usePrefs((s) => s.toggleShowHidden);
  const Icon = showHidden ? Eye : EyeOff;
  return (
    <button
      type="button"
      className={cx("toolbar__button", showHidden && "toolbar__button--on")}
      aria-pressed={showHidden}
      title="Show Hidden Files (⇧⌘.)"
      onClick={toggle}
    >
      <Icon size={16} strokeWidth={1.75} />
    </button>
  );
}
