import type { Entry } from "../api/bindings/Entry";
import { kindLabelOf } from "./fileTypes";

export type SortKey = "name" | "modified" | "size" | "kind";
export type SortDir = "asc" | "desc";
export interface SortSpec {
  key: SortKey;
  dir: SortDir;
}

/** Default direction when a different column is selected (spec 8.3). */
export const DEFAULT_SORT_DIR: Record<SortKey, SortDir> = {
  name: "asc",
  modified: "desc",
  size: "desc",
  kind: "asc",
};

/** Header click / menu pick: same key toggles direction, other key uses its default direction. */
export function nextSort(current: SortSpec, key: SortKey): SortSpec {
  if (current.key === key) return { key, dir: current.dir === "asc" ? "desc" : "asc" };
  return { key, dir: DEFAULT_SORT_DIR[key] };
}

type SortEntry = Pick<
  Entry,
  "name" | "path" | "isDirLike" | "size" | "modifiedMs" | "kind" | "extension" | "isBrokenLink"
>;

/** Natural, case-insensitive name comparator with the deterministic tie-breaks of decisions B10. */
export function createNameComparator<T extends { name: string; path: string }>(
  locale?: string,
): (a: T, b: T) => number {
  const natural = new Intl.Collator(locale, { numeric: true, sensitivity: "base" });
  return (a, b) => {
    const c = natural.compare(a.name, b.name);
    if (c !== 0) return c;
    const strict = a.name.localeCompare(b.name, locale, { numeric: true, sensitivity: "variant" });
    if (strict !== 0) return strict;
    return a.path < b.path ? -1 : a.path > b.path ? 1 : 0;
  };
}

/**
 * Builds the entry comparator (decisions B10): `isDirLike` entries first in both directions;
 * direction only reverses the primary key; nulls last in both directions; ties fall back to the
 * name ascending (natural order, then case-sensitive, then path).
 */
export function createComparator<T extends SortEntry>(
  sort: SortSpec,
  locale?: string,
): (a: T, b: T) => number {
  const natural = new Intl.Collator(locale, { numeric: true, sensitivity: "base" });
  const sign = sort.dir === "asc" ? 1 : -1;

  const nameAsc = createNameComparator<T>(locale);

  const nullable = (x: number | null, y: number | null): number => {
    if (x === null && y === null) return 0;
    if (x === null) return 1;
    if (y === null) return -1;
    return sign * (x - y);
  };

  const kindCache = new WeakMap<T, string>();
  const kindOf = (e: T): string => {
    let label = kindCache.get(e);
    if (label === undefined) {
      label = kindLabelOf(e);
      kindCache.set(e, label);
    }
    return label;
  };

  return (a, b) => {
    if (a.isDirLike !== b.isDirLike) return a.isDirLike ? -1 : 1;
    let primary = 0;
    switch (sort.key) {
      case "name":
        return sign * nameAsc(a, b);
      case "modified":
        primary = nullable(a.modifiedMs, b.modifiedMs);
        break;
      case "size":
        if (a.isDirLike) return nameAsc(a, b);
        primary = nullable(a.size, b.size);
        break;
      case "kind":
        primary = sign * natural.compare(kindOf(a), kindOf(b));
        break;
    }
    return primary !== 0 ? primary : nameAsc(a, b);
  };
}

export function sortEntries<T extends SortEntry>(
  entries: readonly T[],
  sort: SortSpec,
  locale?: string,
): T[] {
  return [...entries].sort(createComparator<T>(sort, locale));
}
