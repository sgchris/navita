use crate::commands::run_blocking;
use crate::error::AppError;
use crate::fs::ops;

fn home() -> Option<std::path::PathBuf> {
    dirs::home_dir().map(|h| std::fs::canonicalize(&h).unwrap_or(h))
}

/// Creates `untitled folder` (numbered on collision) in `parent` and returns its path.
#[tauri::command]
pub async fn create_folder(parent: String) -> Result<String, AppError> {
    run_blocking(move || ops::create_folder(&parent)).await
}

/// Creates an empty `untitled file` (numbered on collision) in `parent` and returns its path.
#[tauri::command]
pub async fn create_file(parent: String) -> Result<String, AppError> {
    run_blocking(move || ops::create_file(&parent)).await
}

/// Renames `path` to `new_name` inside the same folder and returns the new path.
#[tauri::command]
pub async fn rename_path(path: String, new_name: String) -> Result<String, AppError> {
    run_blocking(move || ops::rename_path(&path, &new_name, home().as_deref())).await
}

/// Moves paths to the Trash (reversible; never deletes permanently).
#[tauri::command]
pub async fn trash_paths(paths: Vec<String>) -> Result<(), AppError> {
    run_blocking(move || ops::trash_paths(&paths, home().as_deref(), &ops::SystemTrash)).await
}
