pub mod fs;
pub mod menu;
pub mod open;
pub mod places;
pub mod watch;

use crate::error::AppError;

/// Runs blocking I/O on the blocking pool so the UI thread never stalls.
pub(crate) async fn run_blocking<T, F>(work: F) -> Result<T, AppError>
where
    T: Send + 'static,
    F: FnOnce() -> Result<T, AppError> + Send + 'static,
{
    tauri::async_runtime::spawn_blocking(work)
        .await
        .map_err(|e| AppError::Io {
            path: String::new(),
            message: e.to_string(),
        })?
}
