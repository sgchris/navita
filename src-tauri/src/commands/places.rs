use crate::commands::run_blocking;
use crate::error::AppError;
use crate::model::{Place, VolumeInfo};

#[tauri::command]
pub async fn places() -> Result<Vec<Place>, AppError> {
    run_blocking(|| Ok(crate::places::places())).await
}

#[tauri::command]
pub async fn volume_info(path: String) -> Result<VolumeInfo, AppError> {
    run_blocking(move || crate::places::volume_info(&path)).await
}
