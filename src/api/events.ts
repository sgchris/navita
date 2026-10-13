import { listen, type UnlistenFn } from "@tauri-apps/api/event";

/** Typed listeners for the events emitted by the Rust core. */
export const events = {
  onFsChanged: (handler: (path: string) => void): Promise<UnlistenFn> =>
    listen<{ path: string }>("fs:changed", (e) => handler(e.payload.path)),
  onVolumesChanged: (handler: () => void): Promise<UnlistenFn> =>
    listen("volumes:changed", () => handler()),
  onMenu: (handler: (id: string) => void): Promise<UnlistenFn> =>
    listen<string>("menu", (e) => handler(e.payload)),
};
