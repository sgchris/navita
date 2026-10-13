/** Middle truncation like Finder: `report-final-…-v3.pdf` (decisions B20, spec 8.3). */

export type Measure = (text: string) => number;

const ELLIPSIS = "…";

/**
 * Returns `text` unchanged if it fits `maxWidth`, otherwise the longest `head…tail` that fits,
 * where `k` kept characters split as head `ceil(k/2)` and tail `floor(k/2)`.
 */
export function middleTruncate(text: string, maxWidth: number, measure: Measure): string {
  if (measure(text) <= maxWidth) return text;
  const chars = Array.from(text);
  const build = (k: number): string => {
    const head = Math.ceil(k / 2);
    const tail = Math.floor(k / 2);
    return (
      chars.slice(0, head).join("") +
      ELLIPSIS +
      (tail > 0 ? chars.slice(chars.length - tail).join("") : "")
    );
  };

  let low = 0;
  let high = chars.length - 1;
  let best = -1;
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    if (measure(build(mid)) <= maxWidth) {
      best = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return best < 0 ? ELLIPSIS : build(best);
}

let canvasContext: CanvasRenderingContext2D | null = null;
const cache = new Map<string, string>();
const CACHE_LIMIT = 5000;

/** Canvas-backed `middleTruncate` with a per `font|width|text` cache (browser only). */
export function truncateWithFont(text: string, maxWidth: number, font: string): string {
  const key = `${font}|${maxWidth}|${text}`;
  const cached = cache.get(key);
  if (cached !== undefined) return cached;

  canvasContext ??= document.createElement("canvas").getContext("2d");
  const context = canvasContext;
  if (!context) return text;
  context.font = font;
  const result = middleTruncate(text, maxWidth, (t) => context.measureText(t).width);
  if (cache.size >= CACHE_LIMIT) cache.clear();
  cache.set(key, result);
  return result;
}
