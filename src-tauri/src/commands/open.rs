use std::path::Path;

use tauri::AppHandle;
use tauri_plugin_opener::OpenerExt;

use crate::commands::run_blocking;
use crate::error::AppError;

/// Opens a file, folder or `.app` bundle with its default application via Launch Services.
#[tauri::command]
pub async fn open_path(app: AppHandle, path: String) -> Result<(), AppError> {
    run_blocking(move || open_with_default_app(&app, &path)).await
}

fn open_with_default_app(app: &AppHandle, path: &str) -> Result<(), AppError> {
    let p = Path::new(path);
    if !p.is_absolute() {
        return Err(AppError::InvalidPath {
            path: path.to_owned(),
        });
    }
    std::fs::symlink_metadata(p).map_err(|e| AppError::from_io(&e, p))?;
    app.opener()
        .open_path(path, None::<&str>)
        .map_err(|e| AppError::Io {
            path: path.to_owned(),
            message: e.to_string(),
        })
}
