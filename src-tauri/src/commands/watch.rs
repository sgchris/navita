use tauri::AppHandle;

use crate::commands::run_blocking;
use crate::error::AppError;

/// Replaces the watch on the folder being shown (non-recursive, debounced).
#[tauri::command]
pub async fn watch_dir(app: AppHandle, path: String) -> Result<(), AppError> {
    run_blocking(move || crate::watcher::watch_dir(&app, &path)).await
}
