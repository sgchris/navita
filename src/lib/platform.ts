import { getCurrentWindow } from "@tauri-apps/api/window";

/** Mirrors window focus into `html.window-inactive` (spec 8.6 rule 9). */
export async function initWindowActiveClass(): Promise<void> {
  const win = getCurrentWindow();
  const apply = (focused: boolean) =>
    document.documentElement.classList.toggle("window-inactive", !focused);
  apply(await win.isFocused());
  await win.onFocusChanged(({ payload }) => apply(payload));
}

/** Native-feel listeners (spec 8.6 rules 4 and 5). */
export function installNativeFeelGuards(): void {
  window.addEventListener("contextmenu", (e) => e.preventDefault());
  for (const name of ["gesturestart", "gesturechange", "gestureend"]) {
    window.addEventListener(name, (e) => e.preventDefault());
  }
  window.addEventListener(
    "keydown",
    (e) => {
      if (!e.metaKey) return;
      // browser zoom and find; never wanted in Navita
      if (["=", "+", "-", "0", "f"].includes(e.key.toLowerCase()) && !e.altKey) {
        e.preventDefault();
      }
    },
    true,
  );
}

/** Shows the window after the first paint (the window is created hidden, see DECISIONS A14). */
export function showWindowAfterPaint(): void {
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      void getCurrentWindow().show();
    }),
  );
}
