import { useEffect, useRef, useState, type KeyboardEvent, type SyntheticEvent } from "react";
import type { Entry } from "../api/bindings/Entry";
import { cx } from "../lib/cx";
import { cancelRename, commitRename } from "../lib/fileOps";
import { renameSelectionEnd, validateName } from "../lib/names";

interface Props {
  entry: Entry;
  variant: "list" | "grid";
}

const stop = (e: SyntheticEvent) => e.stopPropagation();

/** Inline name editor (decisions B31): Return commits, Esc cancels, blur commits. */
export function RenameInput({ entry, variant }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const finished = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    input.focus();
    input.setSelectionRange(0, renameSelectionEnd(entry.name));
  }, [entry.name]);

  /** Returns false when the editor stays open. */
  const finish = async (viaBlur: boolean): Promise<void> => {
    const input = inputRef.current;
    if (finished.current || !input) return;
    const value = input.value;
    if (value === "" || value === entry.name) {
      finished.current = true;
      cancelRename();
      return;
    }
    const reason = validateName(value);
    if (reason) {
      if (viaBlur) {
        // Losing focus with an invalid name reverts instead of fighting the user for focus.
        finished.current = true;
        cancelRename();
      } else {
        setError(reason);
      }
      return;
    }
    finished.current = true;
    const result = await commitRename(entry, value);
    if (!result.ok && result.keepEditing) {
      finished.current = false;
      setError(result.message);
      inputRef.current?.focus();
    }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    e.stopPropagation();
    if (e.nativeEvent.isComposing) return;
    if (e.key === "Enter") {
      e.preventDefault();
      void finish(false);
    } else if (e.key === "Escape") {
      e.preventDefault();
      finished.current = true;
      cancelRename();
    }
  };

  return (
    <input
      ref={inputRef}
      className={cx("rename-input", `rename-input--${variant}`, error && "rename-input--invalid")}
      defaultValue={entry.name}
      title={error ?? undefined}
      spellCheck={false}
      autoComplete="off"
      autoCorrect="off"
      onKeyDown={onKeyDown}
      onBlur={() => void finish(true)}
      onChange={() => setError(null)}
      onClick={stop}
      onDoubleClick={stop}
      onPointerDown={stop}
      onContextMenu={stop}
    />
  );
}
