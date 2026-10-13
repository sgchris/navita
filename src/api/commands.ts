import { invoke } from "@tauri-apps/api/core";
import type { AppError } from "./bindings/AppError";
import type { DirListing } from "./bindings/DirListing";
import type { MenuState } from "./bindings/MenuState";
import type { Place } from "./bindings/Place";
import type { TreeNode } from "./bindings/TreeNode";
import type { VolumeInfo } from "./bindings/VolumeInfo";

export type { AppError, DirListing, MenuState, Place, TreeNode, VolumeInfo };

/** Normalizes whatever `invoke` rejected with into an `AppError`. */
export function toAppError(error: unknown): AppError {
  if (typeof error === "object" && error !== null && "code" in error) {
    return error as AppError;
  }
  return { code: "io", path: "", message: error instanceof Error ? error.message : String(error) };
}

export const commands = {
  listDir: (path: string, requestId: number) => invoke<DirListing>("list_dir", { path, requestId }),
  listSubdirs: (path: string) => invoke<TreeNode[]>("list_subdirs", { path }),
  homeDir: () => invoke<string>("home_dir"),
  places: () => invoke<Place[]>("places"),
  volumeInfo: (path: string) => invoke<VolumeInfo>("volume_info", { path }),
  openPath: (path: string) => invoke<void>("open_path", { path }),
  revealInFinder: (paths: string[]) => invoke<void>("reveal_in_finder", { paths }),
  getInfo: (paths: string[]) => invoke<void>("get_info", { paths }),
  copyText: (text: string) => invoke<void>("copy_text", { text }),
  openFullDiskAccessSettings: () => invoke<void>("open_full_disk_access_settings"),
  watchDir: (path: string) => invoke<void>("watch_dir", { path }),
  setMenuState: (state: MenuState) => invoke<void>("set_menu_state", { state }),
};
