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

/// Opens the system's default terminal in `path`, always as a new instance.
#[tauri::command]
pub async fn open_terminal(path: String) -> Result<(), AppError> {
    run_blocking(move || crate::terminal::open_terminal(&path)).await
}

/// Reveals each path in Finder (selecting it in its enclosing folder).
#[tauri::command]
pub async fn reveal_in_finder(app: AppHandle, paths: Vec<String>) -> Result<(), AppError> {
    run_blocking(move || {
        for path in &paths {
            let p = Path::new(path);
            if !p.is_absolute() {
                return Err(AppError::InvalidPath { path: path.clone() });
            }
            app.opener()
                .reveal_item_in_dir(p)
                .map_err(|e| AppError::Io {
                    path: path.clone(),
                    message: e.to_string(),
                })?;
        }
        Ok(())
    })
    .await
}

/// Opens Finder's Get Info window for each path (may trigger the Automation permission prompt).
#[tauri::command]
pub async fn get_info(paths: Vec<String>) -> Result<(), AppError> {
    run_blocking(move || {
        if let Some(path) = paths.iter().find(|p| !Path::new(p).is_absolute()) {
            return Err(AppError::InvalidPath { path: path.clone() });
        }
        run_osascript(&get_info_script(&paths))
    })
    .await
}

/// Puts `text` on the general pasteboard via `pbcopy` (UTF-8 locale forced, decisions A7).
#[tauri::command]
pub async fn copy_text(text: String) -> Result<(), AppError> {
    run_blocking(move || pipe_text("/usr/bin/pbcopy", &text).map(|_| ())).await
}

/// Opens System Settings at Privacy & Security > Full Disk Access.
#[tauri::command]
pub async fn open_full_disk_access_settings(app: AppHandle) -> Result<(), AppError> {
    run_blocking(move || {
        app.opener()
            .open_url(FULL_DISK_ACCESS_URL, None::<&str>)
            .map_err(|e| AppError::Io {
                path: FULL_DISK_ACCESS_URL.to_owned(),
                message: e.to_string(),
            })
    })
    .await
}

const FULL_DISK_ACCESS_URL: &str =
    "x-apple.systempreferences:com.apple.preference.security?Privacy_AllFiles";

/// Escapes a string for use inside an AppleScript double-quoted literal.
fn escape_applescript(text: &str) -> String {
    text.replace('\\', "\\\\").replace('"', "\\\"")
}

/// AppleScript that opens a Finder information window per path.
fn get_info_script(paths: &[String]) -> String {
    let mut script = String::from("tell application \"Finder\"\nactivate\n");
    for path in paths {
        script.push_str(&format!(
            "open information window of (POSIX file \"{}\" as alias)\n",
            escape_applescript(path)
        ));
    }
    script.push_str("end tell");
    script
}

fn run_osascript(script: &str) -> Result<(), AppError> {
    let output = std::process::Command::new("/usr/bin/osascript")
        .arg("-e")
        .arg(script)
        .output()
        .map_err(|e| AppError::Io {
            path: String::new(),
            message: e.to_string(),
        })?;
    if output.status.success() {
        Ok(())
    } else {
        Err(AppError::Io {
            path: String::new(),
            message: String::from_utf8_lossy(&output.stderr).trim().to_owned(),
        })
    }
}

/// Writes `text` to the stdin of `program` (UTF-8 locale) and returns its stdout.
fn pipe_text(program: &str, text: &str) -> Result<String, AppError> {
    use std::io::Write;
    use std::process::{Command, Stdio};

    let io_error = |e: std::io::Error| AppError::Io {
        path: program.to_owned(),
        message: e.to_string(),
    };
    let mut child = Command::new(program)
        .env("LANG", "en_US.UTF-8")
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .spawn()
        .map_err(io_error)?;
    child
        .stdin
        .take()
        .ok_or_else(|| AppError::Io {
            path: program.to_owned(),
            message: "no stdin".to_owned(),
        })?
        .write_all(text.as_bytes())
        .map_err(io_error)?;
    let output = child.wait_with_output().map_err(io_error)?;
    if !output.status.success() {
        return Err(AppError::Io {
            path: program.to_owned(),
            message: format!("exited with {}", output.status),
        });
    }
    Ok(String::from_utf8_lossy(&output.stdout).into_owned())
}

#[cfg(test)]
mod tests {
    use super::{escape_applescript, get_info_script, pipe_text};

    #[test]
    fn escapes_backslashes_and_quotes() {
        assert_eq!(escape_applescript(r#"a"b\c"#), r#"a\"b\\c"#);
        assert_eq!(escape_applescript("plain"), "plain");
    }

    #[test]
    fn builds_one_information_window_line_per_path() {
        let script = get_info_script(&["/a/b".to_owned(), "/c \"d\"".to_owned()]);
        assert_eq!(
            script,
            "tell application \"Finder\"\nactivate\n\
             open information window of (POSIX file \"/a/b\" as alias)\n\
             open information window of (POSIX file \"/c \\\"d\\\"\" as alias)\n\
             end tell"
        );
    }

    #[test]
    fn pipes_utf8_text_through_a_program() {
        let text = "/Users/me/Dokumente/Übung 😀.txt\n/second";
        assert_eq!(pipe_text("/bin/cat", text).unwrap(), text);
    }

    #[test]
    fn reports_a_missing_program() {
        assert!(pipe_text("/definitely/not/a/program", "x").is_err());
    }
}
