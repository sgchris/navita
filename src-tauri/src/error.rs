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

impl AppError {
    /// Maps an I/O error that happened while touching `path` to the matching variant.
    #[must_use]
    pub fn from_io(err: &std::io::Error, path: impl AsRef<std::path::Path>) -> Self {
        use std::io::ErrorKind;

        let path = path.as_ref().to_string_lossy().into_owned();
        match err.kind() {
            ErrorKind::NotFound => Self::NotFound { path },
            // std maps both EACCES and macOS TCC's EPERM to PermissionDenied.
            ErrorKind::PermissionDenied => Self::PermissionDenied { path },
            ErrorKind::NotADirectory => Self::NotADirectory { path },
            ErrorKind::AlreadyExists => Self::AlreadyExists { path },
            _ if err.raw_os_error() == Some(libc::ENOTDIR) => Self::NotADirectory { path },
            _ => Self::Io {
                path,
                message: err.to_string(),
            },
        }
    }
}

#[cfg(test)]
mod tests {
    use super::AppError;
    use std::io::{Error, ErrorKind};

    fn map(kind: ErrorKind) -> AppError {
        AppError::from_io(&Error::from(kind), "/some/path")
    }

    #[test]
    fn maps_known_kinds() {
        assert!(
            matches!(map(ErrorKind::NotFound), AppError::NotFound { path } if path == "/some/path")
        );
        assert!(matches!(
            map(ErrorKind::PermissionDenied),
            AppError::PermissionDenied { .. }
        ));
        assert!(matches!(
            map(ErrorKind::NotADirectory),
            AppError::NotADirectory { .. }
        ));
        assert!(matches!(
            map(ErrorKind::AlreadyExists),
            AppError::AlreadyExists { .. }
        ));
    }

    #[test]
    fn maps_raw_enotdir() {
        let err = Error::from_raw_os_error(libc::ENOTDIR);
        assert!(matches!(
            AppError::from_io(&err, "/x"),
            AppError::NotADirectory { .. }
        ));
    }

    #[test]
    fn maps_raw_eperm_to_permission_denied() {
        let err = Error::from_raw_os_error(libc::EPERM);
        assert!(matches!(
            AppError::from_io(&err, "/x"),
            AppError::PermissionDenied { .. }
        ));
    }

    #[test]
    fn falls_back_to_io_with_message() {
        match map(ErrorKind::TimedOut) {
            AppError::Io { path, message } => {
                assert_eq!(path, "/some/path");
                assert!(!message.is_empty());
            }
            other => panic!("unexpected {other:?}"),
        }
    }

    #[test]
    fn serializes_with_camel_case_code() {
        let json = serde_json::to_string(&AppError::NotFound { path: "/a".into() }).unwrap();
        assert_eq!(json, r#"{"code":"notFound","path":"/a"}"#);
    }
}
