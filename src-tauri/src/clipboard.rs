//! File clipboard on the macOS general pasteboard (`NSPasteboard`), so Navita interoperates with
//! Finder: files copied here can be pasted in Finder and the other way round.

use objc2::rc::Retained;
use objc2::runtime::ProtocolObject;
use objc2_app_kit::{NSPasteboard, NSPasteboardTypeFileURL, NSPasteboardWriting};
use objc2_foundation::{NSArray, NSString, NSURL};

use crate::error::AppError;

/// Replaces the pasteboard contents with file URLs for `paths`; returns the new change count.
///
/// # Errors
/// `Io` if the pasteboard refuses the data.
pub fn write_files(pasteboard: &NSPasteboard, paths: &[String]) -> Result<i64, AppError> {
    let urls: Vec<Retained<ProtocolObject<dyn NSPasteboardWriting>>> = paths
        .iter()
        .map(|path| {
            ProtocolObject::from_retained(NSURL::fileURLWithPath(&NSString::from_str(path)))
        })
        .collect();
    let array = NSArray::from_retained_slice(&urls);
    pasteboard.clearContents();
    if !pasteboard.writeObjects(&array) {
        return Err(AppError::Io {
            path: String::new(),
            message: "The clipboard did not accept the files.".to_owned(),
        });
    }
    Ok(i64::try_from(pasteboard.changeCount()).unwrap_or(i64::MAX))
}

/// File paths currently on the pasteboard (empty if it holds anything else) and the change count.
#[must_use]
pub fn read_files(pasteboard: &NSPasteboard) -> (Vec<String>, i64) {
    let mut paths = Vec::new();
    if let Some(items) = pasteboard.pasteboardItems() {
        for item in items.iter() {
            // SAFETY: reading an immutable AppKit string constant.
            let file_url_type = unsafe { NSPasteboardTypeFileURL };
            let Some(text) = item.stringForType(file_url_type) else {
                continue;
            };
            let Some(url) = NSURL::URLWithString(&text) else {
                continue;
            };
            // File reference URLs (file:///.file/id=...) are converted to plain path URLs.
            let resolved = url.filePathURL().unwrap_or(url);
            if let Some(path) = resolved.path() {
                paths.push(path.to_string());
            }
        }
    }
    (
        paths,
        i64::try_from(pasteboard.changeCount()).unwrap_or(i64::MAX),
    )
}

#[cfg(test)]
mod tests {
    use super::{read_files, write_files};
    use objc2_app_kit::{NSPasteboard, NSPasteboardTypeString};
    use objc2_foundation::NSString;

    #[test]
    fn round_trips_paths_with_spaces_and_unicode() {
        let dir = tempfile::tempdir().unwrap();
        let a = dir.path().join("my report 😀.txt");
        let b = dir.path().join("Übung");
        std::fs::write(&a, b"x").unwrap();
        std::fs::create_dir(&b).unwrap();
        let paths = vec![
            a.to_string_lossy().into_owned(),
            b.to_string_lossy().into_owned(),
        ];

        let pasteboard = NSPasteboard::pasteboardWithUniqueName();
        let count = write_files(&pasteboard, &paths).unwrap();
        let (read, read_count) = read_files(&pasteboard);
        // NSURL stores names in decomposed form ("U" + combining diaeresis); both spellings are the
        // same file on APFS, so compare the resolved paths.
        let resolve = |list: &[String]| -> Vec<std::path::PathBuf> {
            list.iter()
                .map(|p| std::fs::canonicalize(p).unwrap())
                .collect()
        };
        assert_eq!(resolve(&read), resolve(&paths));
        assert_eq!(read_count, count);
    }

    #[test]
    fn change_count_grows_with_every_write() {
        let pasteboard = NSPasteboard::pasteboardWithUniqueName();
        let first = write_files(&pasteboard, &["/tmp".to_owned()]).unwrap();
        let second = write_files(&pasteboard, &["/tmp".to_owned()]).unwrap();
        assert!(second > first);
    }

    #[test]
    fn an_empty_or_text_only_pasteboard_has_no_files() {
        let pasteboard = NSPasteboard::pasteboardWithUniqueName();
        assert!(read_files(&pasteboard).0.is_empty());
        pasteboard.clearContents();
        // SAFETY: reading an immutable AppKit string constant.
        let string_type = unsafe { NSPasteboardTypeString };
        assert!(pasteboard.setString_forType(&NSString::from_str("just text"), string_type));
        assert!(read_files(&pasteboard).0.is_empty());
    }
}
