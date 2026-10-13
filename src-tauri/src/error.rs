use serde::Serialize;
use ts_rs::TS;

/// Serializable error returned by every command. The frontend switches on `code`.
#[derive(Debug, Clone, thiserror::Error, Serialize, TS)]
#[serde(tag = "code", rename_all = "camelCase")]
#[ts(export)]
pub enum AppError {
    #[error("not found: {path}")]
    NotFound { path: String },
    #[error("permission denied: {path}")]
    PermissionDenied { path: String },
    #[error("not a directory: {path}")]
    NotADirectory { path: String },
    #[error("invalid path: {path}")]
    InvalidPath { path: String },
    #[error("{message} ({path})")]
    Io { path: String, message: String },
    #[error("already exists: {path}")]
    AlreadyExists { path: String },
    #[error("invalid name {name:?}: {reason}")]
    InvalidName { name: String, reason: String },
    #[error("protected path: {path}")]
    Protected { path: String },
}
