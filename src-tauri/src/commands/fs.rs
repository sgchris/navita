use crate::commands::run_blocking;
use crate::error::AppError;
use crate::fs::listing;
use crate::model::{DirListing, TreeNode};

#[tauri::command]
pub async fn list_dir(path: String, request_id: u32) -> Result<DirListing, AppError> {
    run_blocking(move || listing::list_dir(&path, request_id)).await
}

#[tauri::command]
pub async fn list_subdirs(path: String) -> Result<Vec<TreeNode>, AppError> {
    run_blocking(move || listing::list_subdirs(&path)).await
}

#[tauri::command]
pub async fn home_dir() -> Result<String, AppError> {
    dirs::home_dir()
        .map(|h| h.to_string_lossy().into_owned())
        .ok_or(AppError::NotFound {
            path: "~".to_owned(),
        })
}
