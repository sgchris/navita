pub mod hidden;
pub mod kind;
pub mod listing;
pub mod ops;
pub mod package;
pub mod paste;

use std::path::{Path, PathBuf};

use crate::error::AppError;

/// Validates that `path` is absolute, canonicalizes it and checks it is a directory.
///
/// # Errors
/// `InvalidPath` for relative paths, otherwise the mapped I/O error; `NotADirectory` for files.
pub fn canonical_dir(path: &str) -> Result<PathBuf, AppError> {
    let canon = canonical(path)?;
    let meta = std::fs::metadata(&canon).map_err(|e| AppError::from_io(&e, &canon))?;
    if !meta.is_dir() {
        return Err(AppError::NotADirectory {
            path: canon.to_string_lossy().into_owned(),
        });
    }
    Ok(canon)
}

/// Validates that `path` is absolute and canonicalizes it.
///
/// # Errors
/// `InvalidPath` for relative paths, otherwise the mapped I/O error.
pub fn canonical(path: &str) -> Result<PathBuf, AppError> {
    let p = Path::new(path);
    if !p.is_absolute() {
        return Err(AppError::InvalidPath {
            path: path.to_owned(),
        });
    }
    std::fs::canonicalize(p).map_err(|e| AppError::from_io(&e, p))
}
