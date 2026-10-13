/** Hidden-file filtering (decisions B14, spec 8.3.2): a pure frontend filter, no refetch. */
export interface MaybeHidden {
  isHidden: boolean;
}

export function filterVisible<T extends MaybeHidden>(
  entries: readonly T[],
  showHidden: boolean,
): T[] {
  return showHidden ? [...entries] : entries.filter((e) => !e.isHidden);
}

export function countHidden(entries: readonly MaybeHidden[]): number {
  return entries.reduce((n, e) => n + (e.isHidden ? 1 : 0), 0);
}
