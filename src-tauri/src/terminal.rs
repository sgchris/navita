//! Opens the system's default terminal in a folder.
//!
//! macOS has no explicit "default terminal" setting; the closest thing is the application that
//! opens `.command` shell scripts (Finder ▸ Get Info ▸ Open with ▸ Change All). That handler is
//! used, with Terminal.app as the fallback. Every call starts a **new instance** of the app
//! (`open -n`), as requested.

use std::path::Path;
use std::process::Command;
use std::ptr::NonNull;

use objc2_core_foundation::{CFRetained, CFString};

use crate::error::AppError;
use crate::fs::canonical_dir;

const FALLBACK_BUNDLE_ID: &str = "com.apple.Terminal";
/// UTI of `.command` files, which Terminal.app (or the user's terminal of choice) opens.
const SHELL_SCRIPT_TYPE: &str = "com.apple.terminal.shell-script";
const LS_ROLES_ALL: u32 = 0xFFFF_FFFF;

#[link(name = "CoreServices", kind = "framework")]
unsafe extern "C" {
    fn LSCopyDefaultRoleHandlerForContentType(
        content_type: &CFString,
        role: u32,
    ) -> Option<NonNull<CFString>>;
}

/// Bundle identifier of the application registered to open `.command` files, if any.
fn default_handler_bundle_id() -> Option<String> {
    let content_type = CFString::from_str(SHELL_SCRIPT_TYPE);
    // SAFETY: valid CFString argument; the result follows the Create rule, so it is adopted by
    // `CFRetained::from_raw` and released when dropped.
    let handler = unsafe { LSCopyDefaultRoleHandlerForContentType(&content_type, LS_ROLES_ALL) }?;
    // SAFETY: see above; `handler` is a +1 retained CFString.
    let handler = unsafe { CFRetained::from_raw(handler) };
    Some(handler.to_string())
}

/// The handler's bundle id, or Terminal.app when there is none (or it is empty).
#[must_use]
pub fn terminal_bundle_id(handler: Option<String>) -> String {
    handler
        .filter(|id| !id.trim().is_empty())
        .unwrap_or_else(|| FALLBACK_BUNDLE_ID.to_owned())
}

/// Arguments for `/usr/bin/open`: a new instance of the app `bundle_id` opening `folder`.
#[must_use]
pub fn open_arguments(bundle_id: &str, folder: &Path) -> Vec<std::ffi::OsString> {
    vec![
        "-n".into(),
        "-b".into(),
        bundle_id.into(),
        folder.as_os_str().to_owned(),
    ]
}

/// Opens the default terminal in `folder` (a new instance every time).
///
/// # Errors
/// Path validation errors, or the `open` command failed.
pub fn open_terminal(folder: &str) -> Result<(), AppError> {
    let dir = canonical_dir(folder)?;
    let bundle_id = terminal_bundle_id(default_handler_bundle_id());
    let output = Command::new("/usr/bin/open")
        .args(open_arguments(&bundle_id, &dir))
        .output()
        .map_err(|e| AppError::Io {
            path: folder.to_owned(),
            message: e.to_string(),
        })?;
    if output.status.success() {
        Ok(())
    } else {
        Err(AppError::Io {
            path: folder.to_owned(),
            message: String::from_utf8_lossy(&output.stderr).trim().to_owned(),
        })
    }
}

#[cfg(test)]
mod tests {
    use super::{default_handler_bundle_id, open_arguments, terminal_bundle_id};
    use std::path::Path;

    #[test]
    fn uses_the_handler_or_falls_back_to_terminal_app() {
        assert_eq!(
            terminal_bundle_id(Some("com.googlecode.iterm2".to_owned())),
            "com.googlecode.iterm2"
        );
        assert_eq!(terminal_bundle_id(None), "com.apple.Terminal");
        assert_eq!(
            terminal_bundle_id(Some(String::new())),
            "com.apple.Terminal"
        );
        assert_eq!(
            terminal_bundle_id(Some("  ".to_owned())),
            "com.apple.Terminal"
        );
    }

    #[test]
    fn always_asks_for_a_new_instance() {
        let args = open_arguments("com.apple.Terminal", Path::new("/Users/me/My Folder"));
        let args: Vec<_> = args
            .iter()
            .map(|a| a.to_string_lossy().into_owned())
            .collect();
        assert_eq!(
            args,
            ["-n", "-b", "com.apple.Terminal", "/Users/me/My Folder"]
        );
    }

    #[test]
    fn the_system_lookup_returns_a_bundle_id_or_nothing() {
        if let Some(id) = default_handler_bundle_id() {
            assert!(id.contains('.'), "{id}");
        }
    }
}
