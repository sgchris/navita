import { getCurrentWindow } from "@tauri-apps/api/window";
import { useNavigation } from "../state/navigation";
import { usePlaces } from "../state/places";
import { useUi } from "../state/ui";
import { basename } from "./paths";

/** Mirrors window focus into `html.window-inactive` and the ui store (spec 8.6 rule 9). */
export async function initWindowActiveClass(): Promise<void> {
  const win = getCurrentWindow();
  const apply = (focused: boolean) => {
    document.documentElement.classList.toggle("window-inactive", !focused);
    useUi.getState().setWindowActive(focused);
  };
  apply(await win.isFocused());
  await win.onFocusChanged(({ payload }) => apply(payload));
}

/** Native-feel listeners (spec 8.6 rules 4 and 5). */
export function installNativeFeelGuards(): void {
  window.addEventListener("contextmenu", (e) => e.preventDefault());
  for (const name of ["gesturestart", "gesturechange", "gestureend"]) {
    window.addEventListener(name, (e) => e.preventDefault());
  }
  // With native drag-and-drop disabled (tauri.conf.json), a file dropped on the window would
  // otherwise navigate the webview to that file.
  for (const name of ["dragover", "drop"]) {
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

let windowShown = false;

/**
 * Shows and focuses the main window (it is created hidden, decisions A14). Idempotent.
 *
 * `requestAnimationFrame` must not be used to wait for a paint here: WebKit does not run animation
 * frames for a hidden window, so the window would never appear.
 */
export function showWindowOnce(): void {
  if (windowShown) return;
  windowShown = true;
  const win = getCurrentWindow();
  void win.show().then(() => win.setFocus());
}

/** Keeps the (hidden) window title equal to the folder name for Mission Control and VoiceOver. */
export function installWindowTitle(): void {
  const update = () => {
    const path = useNavigation.getState().currentPath;
    if (path === null) return;
    const title = path === "/" ? usePlaces.getState().rootName : basename(path);
    void getCurrentWindow().setTitle(title);
  };
  useNavigation.subscribe(update);
  usePlaces.subscribe(update);
}
