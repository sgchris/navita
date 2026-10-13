import { ArrowUp, ChevronLeft, ChevronRight, House } from "../lib/icons";
import { selectCanBack, selectCanForward, selectCanUp, useNavigation } from "../state/navigation";

/** Back/Forward capsule plus Up and Home capsule buttons (spec 8.2). */
export function NavButtons() {
  const canBack = useNavigation(selectCanBack);
  const canForward = useNavigation(selectCanForward);
  const canUp = useNavigation(selectCanUp);
  const { back, forward, up, home } = useNavigation.getState();
  return (
    <div className="toolbar__group toolbar__group--nav">
      <div className="segmented">
        <button
          type="button"
          className="segmented__item"
          title="Back (⌘[)"
          disabled={!canBack}
          onClick={() => void back()}
        >
          <ChevronLeft size={16} strokeWidth={1.75} />
        </button>
        <button
          type="button"
          className="segmented__item"
          title="Forward (⌘])"
          disabled={!canForward}
          onClick={() => void forward()}
        >
          <ChevronRight size={16} strokeWidth={1.75} />
        </button>
      </div>
      <button
        type="button"
        className="toolbar__button"
        title="Enclosing Folder (⌘↑)"
        disabled={!canUp}
        onClick={() => void up()}
      >
        <ArrowUp size={16} strokeWidth={1.75} />
      </button>
      <button
        type="button"
        className="toolbar__button"
        title="Home (⇧⌘H)"
        onClick={() => void home()}
      >
        <House size={16} strokeWidth={1.75} />
      </button>
    </div>
  );
}
