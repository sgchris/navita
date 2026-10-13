use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::Duration;

use notify::{RecommendedWatcher, RecursiveMode};
use notify_debouncer_full::{DebounceEventResult, Debouncer, RecommendedCache, new_debouncer};
use tauri::{AppHandle, Emitter, Manager};

use crate::error::AppError;
use crate::fs::canonical_dir;

const DEBOUNCE: Duration = Duration::from_millis(250);
const VOLUMES_DIR: &str = "/Volumes";

type FsDebouncer = Debouncer<RecommendedWatcher, RecommendedCache>;

/// The two filesystem watchers (decisions A4): the replaceable current-folder watcher and the
/// `/Volumes` watcher that lives as long as the app.
#[derive(Default)]
pub struct Watchers {
    dir: Mutex<Option<FsDebouncer>>,
    volumes: Mutex<Option<FsDebouncer>>,
}

/// True if one of `event_paths` is the watched folder itself or one of its direct children.
/// FSEvents may report deeper paths, which must not trigger a refresh of this folder.
#[must_use]
pub fn affects_dir(watched: &Path, event_paths: &[PathBuf]) -> bool {
    event_paths
        .iter()
        .any(|p| p == watched || p.parent() == Some(watched))
}

fn watch_error(path: &Path, error: &notify::Error) -> AppError {
    AppError::Io {
        path: path.to_string_lossy().into_owned(),
        message: error.to_string(),
    }
}

/// Replaces the current-folder watch; emits `fs:changed { path }` for debounced changes.
///
/// # Errors
/// Path validation errors, or the watcher could not be created.
pub fn watch_dir(app: &AppHandle, path: &str) -> Result<(), AppError> {
    let canon = canonical_dir(path)?;
    let emitter = app.clone();
    let watched = canon.clone();
    let mut debouncer = new_debouncer(DEBOUNCE, None, move |result: DebounceEventResult| {
        let Ok(events) = result else { return };
        let affected = events
            .iter()
            .any(|event| affects_dir(&watched, &event.paths));
        if affected {
            let payload = serde_json::json!({ "path": watched.to_string_lossy() });
            let _ = emitter.emit("fs:changed", payload);
        }
    })
    .map_err(|e| watch_error(&canon, &e))?;
    debouncer
        .watch(&canon, RecursiveMode::NonRecursive)
        .map_err(|e| watch_error(&canon, &e))?;

    let watchers = app.state::<Watchers>();
    let mut slot = watchers.dir.lock().map_err(|_| AppError::Io {
        path: String::new(),
        message: "watcher state poisoned".to_owned(),
    })?;
    *slot = Some(debouncer); // dropping the previous debouncer stops its watch
    Ok(())
}

/// Starts the app-lifetime `/Volumes` watcher; emits `volumes:changed` on mount/unmount.
pub fn start_volumes_watcher(app: &AppHandle) {
    let emitter = app.clone();
    let Ok(mut debouncer) = new_debouncer(DEBOUNCE, None, move |result: DebounceEventResult| {
        if result.is_ok() {
            let _ = emitter.emit("volumes:changed", ());
        }
    }) else {
        return;
    };
    if debouncer
        .watch(Path::new(VOLUMES_DIR), RecursiveMode::NonRecursive)
        .is_err()
    {
        return;
    }
    let watchers = app.state::<Watchers>();
    if let Ok(mut slot) = watchers.volumes.lock() {
        *slot = Some(debouncer);
    }
}

#[cfg(test)]
mod tests {
    use super::affects_dir;
    use std::path::{Path, PathBuf};

    fn paths(items: &[&str]) -> Vec<PathBuf> {
        items.iter().map(PathBuf::from).collect()
    }

    #[test]
    fn direct_children_and_the_folder_itself_count() {
        let watched = Path::new("/Users/me/Docs");
        assert!(affects_dir(watched, &paths(&["/Users/me/Docs/a.txt"])));
        assert!(affects_dir(watched, &paths(&["/Users/me/Docs"])));
        assert!(affects_dir(
            watched,
            &paths(&["/elsewhere", "/Users/me/Docs/sub"])
        ));
    }

    #[test]
    fn deeper_or_unrelated_paths_do_not_count() {
        let watched = Path::new("/Users/me/Docs");
        assert!(!affects_dir(
            watched,
            &paths(&["/Users/me/Docs/sub/deep.txt"])
        ));
        assert!(!affects_dir(watched, &paths(&["/Users/me/Docs2/a.txt"])));
        assert!(!affects_dir(watched, &paths(&["/Users/me"])));
        assert!(!affects_dir(watched, &[]));
    }
}
