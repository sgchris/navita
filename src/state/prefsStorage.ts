import { load } from "@tauri-apps/plugin-store";
import { DEFAULT_PREFS, usePrefs, type Prefs } from "./prefs";
import { validatePrefs } from "./prefsValidate";

const FILE = "prefs.json";
const SAVE_DEBOUNCE_MS = 300;
const KEYS = Object.keys(DEFAULT_PREFS) as Array<keyof Prefs>;

/**
 * Loads persisted preferences into the store (validated) and persists later changes with a
 * 300 ms debounce; pending changes are also flushed when the window loses focus.
 */
export async function initPrefsStorage(): Promise<void> {
  let store: Awaited<ReturnType<typeof load>>;
  try {
    store = await load(FILE, { autoSave: false, defaults: {} });
  } catch (error) {
    console.error("preferences could not be loaded; using defaults", error);
    return;
  }

  const raw: Partial<Record<keyof Prefs, unknown>> = {};
  for (const key of KEYS) raw[key] = await store.get(key);
  usePrefs.setState(validatePrefs(raw));

  const dirty = new Set<keyof Prefs>();
  let timer: ReturnType<typeof setTimeout> | undefined;

  const flush = async () => {
    clearTimeout(timer);
    if (dirty.size === 0) return;
    const state = usePrefs.getState();
    const keys = [...dirty];
    dirty.clear();
    try {
      for (const key of keys) await store.set(key, state[key]);
      await store.save();
    } catch (error) {
      console.error("preferences could not be saved", error);
    }
  };

  usePrefs.subscribe((state, previous) => {
    for (const key of KEYS) if (!Object.is(state[key], previous[key])) dirty.add(key);
    if (dirty.size === 0) return;
    clearTimeout(timer);
    timer = setTimeout(() => void flush(), SAVE_DEBOUNCE_MS);
  });
  window.addEventListener("blur", () => void flush());
}
