/** Formatting rules (decisions B25). Every function takes injected `now`/locale for testability. */

const numberFormats = new Map<string, Intl.NumberFormat>();
function numberFormat(locale: string | undefined, maxFraction: number | null): Intl.NumberFormat {
  const key = `${locale ?? ""}|${maxFraction ?? "default"}`;
  let format = numberFormats.get(key);
  if (!format) {
    format = new Intl.NumberFormat(
      locale,
      maxFraction === null
        ? undefined
        : { maximumFractionDigits: maxFraction, minimumFractionDigits: 0 },
    );
    numberFormats.set(key, format);
  }
  return format;
}

const dateFormats = new Map<string, Intl.DateTimeFormat>();
function dateFormat(
  locale: string | undefined,
  options: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormat {
  const key = `${locale ?? ""}|${JSON.stringify(options)}`;
  let format = dateFormats.get(key);
  if (!format) {
    format = new Intl.DateTimeFormat(locale, options);
    dateFormats.set(key, format);
  }
  return format;
}

type Unit = { label: string; divisor: number };
const UNITS: readonly Unit[] = [
  { label: "KB", divisor: 1e3 },
  { label: "MB", divisor: 1e6 },
  { label: "GB", divisor: 1e9 },
  { label: "TB", divisor: 1e12 },
];

function unitIndexFor(bytes: number): number {
  let index = 0;
  for (let i = 1; i < UNITS.length; i++) {
    if (bytes >= (UNITS[i] as Unit).divisor) index = i;
  }
  return index;
}

/** Formats >= 1000 bytes using decimal units; `decimals[i]` is the max fraction digits per unit. */
function formatScaled(bytes: number, decimals: readonly number[], locale?: string): string {
  let index = unitIndexFor(bytes);
  const round = (i: number) => Number((bytes / (UNITS[i] as Unit).divisor).toFixed(decimals[i]));
  if (round(index) >= 1000 && index < UNITS.length - 1) index += 1;
  const unit = UNITS[index] as Unit;
  const formatter = numberFormat(locale, decimals[index] ?? 0);
  return `${formatter.format(bytes / unit.divisor)} ${unit.label}`;
}

function formatSmall(bytes: number, locale?: string): string | null {
  if (bytes === 0) return "Zero bytes";
  if (bytes < 1000) {
    return bytes === 1 ? "1 byte" : `${numberFormat(locale, null).format(bytes)} bytes`;
  }
  return null;
}

/** File size column: "Zero bytes", "512 bytes", "4 KB", "1.2 MB", "3.45 GB"; `--` when unknown. */
export function formatSize(bytes: number | null, locale?: string): string {
  if (bytes === null) return "--";
  return formatSmall(bytes, locale) ?? formatScaled(bytes, [0, 1, 2, 2], locale);
}

/** Free space for the status bar (without " available"): one decimal for MB, GB and TB. */
export function formatFreeSpace(bytes: number, locale?: string): string {
  return formatSmall(bytes, locale) ?? formatScaled(bytes, [0, 1, 1, 1], locale);
}

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/** "Today at 14:02", "Yesterday at 18:40", otherwise medium date + short time; `--` when unknown. */
export function formatDate(ms: number | null, now: Date, locale?: string): string {
  if (ms === null) return "--";
  const date = new Date(ms);
  const time = () => dateFormat(locale, { timeStyle: "short" }).format(date);
  const today = startOfDay(now).getTime();
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1).getTime();
  const day = startOfDay(date).getTime();
  if (day === today) return `Today at ${time()}`;
  if (day === yesterday) return `Yesterday at ${time()}`;
  return dateFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export interface StatusInput {
  count: number;
  selected: number;
  freeBytes: number | null;
}

/** "42 items, 1 selected, 312.4 GB available" (selected/available omitted when not applicable). */
export function formatStatus({ count, selected, freeBytes }: StatusInput, locale?: string): string {
  const number = numberFormat(locale, null);
  const parts = [count === 1 ? "1 item" : `${number.format(count)} items`];
  if (selected > 0) parts.push(`${number.format(selected)} selected`);
  if (freeBytes !== null) parts.push(`${formatFreeSpace(freeBytes, locale)} available`);
  return parts.join(", ");
}
