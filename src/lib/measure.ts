import { truncateWithFont } from "./middleTruncate";

let family: string | null = null;

/** Canvas font string for the UI font at `size` px (read once from the --font-ui token). */
export function uiFont(size: number, weight = 400): string {
  family ??=
    getComputedStyle(document.documentElement).getPropertyValue("--font-ui").trim() || "system-ui";
  return `${weight} ${size}px ${family}`;
}

export function truncateName(name: string, maxWidth: number, size: number): string {
  return truncateWithFont(name, Math.max(0, Math.floor(maxWidth)), uiFont(size));
}
