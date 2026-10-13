use std::path::Path;

use objc2_app_kit::NSPasteboard;

use crate::clipboard;
use crate::commands::run_blocking;
use crate::error::AppError;
use crate::fs::paste;
use crate::model::ClipboardFiles;

fn home() -> Option<std::path::PathBuf> {
    dirs::home_dir().map(|h| std::fs::canonicalize(&h).unwrap_or(h))
}

/// Puts file URLs for `paths` on the system clipboard; returns the clipboard's change count.
#[tauri::command]
pub async fn clipboard_write_files(paths: Vec<String>) -> Result<i64, AppError> {
    run_blocking(move || {
        if let Some(path) = paths.iter().find(|p| !Path::new(p).is_absolute()) {
            return Err(AppError::InvalidPath { path: path.clone() });
        }
        clipboard::write_files(&NSPasteboard::generalPasteboard(), &paths)
    })
    .await
}

/// Files on the system clipboard (empty when it holds something else) and its change count.
#[tauri::command]
pub async fn clipboard_read_files() -> Result<ClipboardFiles, AppError> {
    run_blocking(|| {
        let (paths, change_count) = clipboard::read_files(&NSPasteboard::generalPasteboard());
        Ok(ClipboardFiles {
            paths,
            change_count,
        })
    })
    .await
}

/// Copies or moves `sources` into `dest_dir`; returns the new paths.
#[tauri::command]
pub async fn paste_files(
    sources: Vec<String>,
    dest_dir: String,
    move_items: bool,
) -> Result<Vec<String>, AppError> {
    run_blocking(move || paste::paste(&sources, &dest_dir, move_items, home().as_deref())).await
}
