/** Type-to-select (decisions B19): pure buffer step and prefix matching. */

export const TYPE_AHEAD_RESET_MS = 1000;

export interface TypeAheadState {
  text: string;
  /** Timestamp (ms) of the last accepted key. */
  at: number;
}

export const EMPTY_TYPE_AHEAD: TypeAheadState = { text: "", at: 0 };

/**
 * Appends a printable single character to the buffer (resetting it after 1000 ms of idleness).
 * Returns `null` when the key is not part of type-to-select (a leading space is ignored).
 */
export function typeAheadStep(
  previous: TypeAheadState,
  key: string,
  now: number,
): TypeAheadState | null {
  if (Array.from(key).length !== 1) return null;
  const text = now - previous.at > TYPE_AHEAD_RESET_MS ? "" : previous.text;
  if (key === " " && text === "") return null;
  return { text: text + key, at: now };
}

/** Index of the first name whose prefix equals `text` (case/accent-insensitive), or -1. */
export function findTypeAheadMatch(
  names: readonly string[],
  text: string,
  locale?: string,
): number {
  const collator = new Intl.Collator(locale, { sensitivity: "base" });
  const length = Array.from(text).length;
  return names.findIndex(
    (name) => collator.compare(Array.from(name).slice(0, length).join(""), text) === 0,
  );
}
