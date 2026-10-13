use std::ffi::CString;
use std::fs::{self, Metadata};
use std::os::unix::ffi::OsStrExt;
use std::path::Path;
use std::time::{SystemTime, UNIX_EPOCH};

use crate::error::AppError;
use crate::fs::canonical_dir;
use crate::fs::hidden::is_hidden;
use crate::fs::kind::classify;
use crate::fs::package::is_package;
use crate::model::{DirListing, Entry, EntryKind, TreeNode};

/// Maximum number of children examined when peeking for sub-folders (spec 6.6).
const PEEK_CAP: usize = 256;

/// Lists a directory. Hidden entries are included and flagged. Unreadable entries get `None`
/// fields instead of failing the listing.
///
/// # Errors
/// See [`canonical_dir`]; `read_dir` failures are mapped (e.g. `PermissionDenied`).
pub fn list_dir(path: &str, request_id: u32) -> Result<DirListing, AppError> {
    let canon = canonical_dir(path)?;
    let read = fs::read_dir(&canon).map_err(|e| AppError::from_io(&e, &canon))?;
    let entries = read
        .filter_map(Result::ok)
        .map(|dirent| build_entry(&canon.join(dirent.file_name())))
        .collect();
    Ok(DirListing {
        request_id,
        path: canon.to_string_lossy().into_owned(),
        parent: canon.parent().map(|p| p.to_string_lossy().into_owned()),
        entries,
    })
}

/// Lists the sub-folders of a directory for the sidebar tree (symlinks to directories included,
/// packages excluded).
///
/// # Errors
/// See [`list_dir`].
pub fn list_subdirs(path: &str) -> Result<Vec<TreeNode>, AppError> {
    let canon = canonical_dir(path)?;
    let read = fs::read_dir(&canon).map_err(|e| AppError::from_io(&e, &canon))?;
    let mut nodes = Vec::new();
    for dirent in read.filter_map(Result::ok) {
        let child = canon.join(dirent.file_name());
        let is_dir = fs::metadata(&child).is_ok_and(|m| m.is_dir());
        if !is_dir || is_package(&child) {
            continue;
        }
        let name = dirent.file_name().to_string_lossy().into_owned();
        let lmeta = fs::symlink_metadata(&child).ok();
        let (has_children, has_visible_children) = peek_children(&child);
        nodes.push(TreeNode {
            is_hidden: is_hidden(&name, lmeta.as_ref()),
            name,
            path: child.to_string_lossy().into_owned(),
            has_children,
            has_visible_children,
        });
    }
    Ok(nodes)
}

/// Returns `(has_children, has_visible_children)` for the sub-folders of `dir` (spec 6.6).
///
/// Examines at most [`PEEK_CAP`] entries. A read error or reaching the cap without finding a
/// visible sub-folder yields `(true, true)`: the user expanding the node resolves it.
#[must_use]
pub fn peek_children(dir: &Path) -> (bool, bool) {
    let Ok(read) = fs::read_dir(dir) else {
        return (true, true);
    };
    let mut found_any = false;
    for (index, dirent) in read.enumerate() {
        if index >= PEEK_CAP {
            return (true, true);
        }
        let Ok(dirent) = dirent else { continue };
        let path = dirent.path();
        let is_dir = match dirent.file_type() {
            Ok(ft) if ft.is_dir() => true,
            Ok(ft) if ft.is_symlink() => fs::metadata(&path).is_ok_and(|m| m.is_dir()),
            _ => false,
        };
        if !is_dir || is_package(&path) {
            continue;
        }
        found_any = true;
        let name = dirent.file_name().to_string_lossy().into_owned();
        let lmeta = fs::symlink_metadata(&path).ok();
        if !is_hidden(&name, lmeta.as_ref()) {
            return (true, true);
        }
    }
    (found_any, false)
}

fn build_entry(path: &Path) -> Entry {
    let name = path
        .file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or_default();
    let path_string = path.to_string_lossy().into_owned();
    let extension = path
        .extension()
        .and_then(|e| e.to_str())
        .map(str::to_ascii_lowercase);

    let Ok(lmeta) = fs::symlink_metadata(path) else {
        return Entry {
            is_hidden: is_hidden(&name, None),
            name,
            path: path_string,
            kind: EntryKind::File,
            is_dir_like: false,
            size: None,
            modified_ms: None,
            extension,
            symlink_target: None,
            is_broken_link: false,
            is_readable: false,
        };
    };

    let is_symlink = lmeta.file_type().is_symlink();
    let resolved = if is_symlink {
        fs::metadata(path).ok()
    } else {
        None
    };
    let classified = classify(path, &lmeta, resolved.as_ref());
    // For symlinks size and date describe the target when it resolves.
    let describing: &Metadata = resolved.as_ref().unwrap_or(&lmeta);
    let size = describing.is_file().then_some(describing.len());
    let symlink_target = is_symlink
        .then(|| fs::read_link(path).ok())
        .flatten()
        .map(|t| t.to_string_lossy().into_owned());

    Entry {
        is_hidden: is_hidden(&name, Some(&lmeta)),
        name,
        path: path_string,
        kind: classified.kind,
        is_dir_like: classified.is_dir_like,
        size,
        modified_ms: describing.modified().ok().map(unix_ms),
        extension,
        symlink_target,
        is_broken_link: classified.is_broken_link,
        is_readable: is_readable(path),
    }
}

fn unix_ms(time: SystemTime) -> i64 {
    match time.duration_since(UNIX_EPOCH) {
        Ok(d) => i64::try_from(d.as_millis()).unwrap_or(i64::MAX),
        Err(e) => -i64::try_from(e.duration().as_millis()).unwrap_or(i64::MAX),
    }
}

fn is_readable(path: &Path) -> bool {
    let Ok(c_path) = CString::new(path.as_os_str().as_bytes()) else {
        return false;
    };
    // SAFETY: `c_path` is a valid NUL-terminated string that outlives the call.
    unsafe { libc::access(c_path.as_ptr(), libc::R_OK) == 0 }
}

#[cfg(test)]
mod tests {
    use super::{list_dir, list_subdirs, peek_children};
    use crate::error::AppError;
    use crate::model::{Entry, EntryKind};
    use std::fs;
    use std::os::unix::fs::{PermissionsExt, symlink};
    use std::path::Path;
    use std::time::Instant;

    #[cfg(target_os = "macos")]
    use std::process::Command;

    fn p(path: &Path) -> &str {
        path.to_str().unwrap()
    }

    fn entry<'a>(entries: &'a [Entry], name: &str) -> &'a Entry {
        entries
            .iter()
            .find(|e| e.name == name)
            .unwrap_or_else(|| panic!("no entry {name}"))
    }

    #[test]
    fn lists_files_and_directories() {
        let dir = tempfile::tempdir().unwrap();
        fs::write(dir.path().join("Notes.TXT"), b"hello").unwrap();
        fs::create_dir(dir.path().join("sub")).unwrap();
        let listing = list_dir(p(dir.path()), 7).unwrap();
        assert_eq!(listing.request_id, 7);
        assert_eq!(listing.entries.len(), 2);

        let file = entry(&listing.entries, "Notes.TXT");
        assert_eq!(file.kind, EntryKind::File);
        assert_eq!(file.size, Some(5));
        assert_eq!(file.extension.as_deref(), Some("txt"));
        assert!(file.modified_ms.is_some());
        assert!(file.is_readable);
        assert!(!file.is_dir_like);

        let sub = entry(&listing.entries, "sub");
        assert_eq!(sub.kind, EntryKind::Directory);
        assert!(sub.is_dir_like);
        assert_eq!(sub.size, None);
    }

    #[test]
    fn returns_canonical_path_and_parent() {
        let dir = tempfile::tempdir().unwrap();
        let canon = fs::canonicalize(dir.path()).unwrap();
        let listing = list_dir(p(dir.path()), 1).unwrap();
        assert_eq!(listing.path, canon.to_string_lossy());
        assert_eq!(
            listing.parent.as_deref(),
            canon.parent().and_then(Path::to_str)
        );
        assert_eq!(list_dir("/", 1).unwrap().parent, None);
    }

    #[test]
    fn flags_dot_files_and_folders_as_hidden() {
        let dir = tempfile::tempdir().unwrap();
        fs::write(dir.path().join(".env"), b"").unwrap();
        fs::create_dir(dir.path().join(".git")).unwrap();
        fs::write(dir.path().join("visible"), b"").unwrap();
        let listing = list_dir(p(dir.path()), 1).unwrap();
        assert!(entry(&listing.entries, ".env").is_hidden);
        assert!(entry(&listing.entries, ".git").is_hidden);
        assert!(!entry(&listing.entries, "visible").is_hidden);
        assert_eq!(entry(&listing.entries, ".env").extension, None);
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn flags_uf_hidden_entries() {
        let dir = tempfile::tempdir().unwrap();
        let file = dir.path().join("secret-by-flag");
        fs::write(&file, b"").unwrap();
        assert!(
            Command::new("chflags")
                .arg("hidden")
                .arg(&file)
                .status()
                .unwrap()
                .success()
        );
        let listing = list_dir(p(dir.path()), 1).unwrap();
        assert!(entry(&listing.entries, "secret-by-flag").is_hidden);
    }

    #[test]
    fn detects_packages() {
        let dir = tempfile::tempdir().unwrap();
        let app = dir.path().join("Foo.app");
        fs::create_dir_all(app.join("Contents")).unwrap();
        fs::write(app.join("Contents").join("Info.plist"), b"<plist/>").unwrap();
        let listing = list_dir(p(dir.path()), 1).unwrap();
        let e = entry(&listing.entries, "Foo.app");
        assert_eq!(e.kind, EntryKind::Package);
        assert!(!e.is_dir_like);
        assert_eq!(e.extension.as_deref(), Some("app"));
    }

    #[test]
    fn handles_symlinks() {
        let dir = tempfile::tempdir().unwrap();
        let real_dir = dir.path().join("real-dir");
        fs::create_dir(&real_dir).unwrap();
        let real_file = dir.path().join("real.txt");
        fs::write(&real_file, b"abc").unwrap();
        symlink(&real_dir, dir.path().join("to-dir")).unwrap();
        symlink(&real_file, dir.path().join("to-file")).unwrap();
        symlink(dir.path().join("missing"), dir.path().join("broken")).unwrap();

        let listing = list_dir(p(dir.path()), 1).unwrap();
        let to_dir = entry(&listing.entries, "to-dir");
        assert_eq!(to_dir.kind, EntryKind::Symlink);
        assert!(to_dir.is_dir_like);
        assert_eq!(to_dir.symlink_target.as_deref(), real_dir.to_str());

        let to_file = entry(&listing.entries, "to-file");
        assert_eq!(to_file.kind, EntryKind::Symlink);
        assert!(!to_file.is_dir_like);
        assert_eq!(to_file.size, Some(3));

        let broken = entry(&listing.entries, "broken");
        assert_eq!(broken.kind, EntryKind::Symlink);
        assert!(broken.is_broken_link);
        assert_eq!(broken.size, None);
        assert!(!broken.is_readable);
    }

    #[test]
    fn permission_denied_directory() {
        let dir = tempfile::tempdir().unwrap();
        let locked = dir.path().join("locked");
        fs::create_dir(&locked).unwrap();
        fs::set_permissions(&locked, fs::Permissions::from_mode(0o000)).unwrap();
        let result = list_dir(p(&locked), 1);
        fs::set_permissions(&locked, fs::Permissions::from_mode(0o755)).unwrap();
        assert!(
            matches!(result, Err(AppError::PermissionDenied { .. })),
            "{result:?}"
        );
    }

    #[test]
    fn error_cases() {
        let dir = tempfile::tempdir().unwrap();
        let file = dir.path().join("f");
        fs::write(&file, b"x").unwrap();
        assert!(matches!(
            list_dir(p(&file), 1),
            Err(AppError::NotADirectory { .. })
        ));
        let missing = dir.path().join("missing");
        assert!(matches!(
            list_dir(p(&missing), 1),
            Err(AppError::NotFound { .. })
        ));
        assert!(matches!(
            list_dir("relative/path", 1),
            Err(AppError::InvalidPath { .. })
        ));
        assert!(matches!(
            list_subdirs("relative"),
            Err(AppError::InvalidPath { .. })
        ));
    }

    #[test]
    fn lists_ten_thousand_files() {
        let dir = tempfile::tempdir().unwrap();
        for i in 0..10_000 {
            fs::write(dir.path().join(format!("file-{i:05}.txt")), b"").unwrap();
        }
        let start = Instant::now();
        let listing = list_dir(p(dir.path()), 1).unwrap();
        eprintln!("list_dir of 10,000 entries took {:?}", start.elapsed());
        assert_eq!(listing.entries.len(), 10_000);
    }

    #[test]
    fn subdirs_exclude_files_and_packages_and_include_dir_symlinks() {
        let dir = tempfile::tempdir().unwrap();
        fs::write(dir.path().join("file.txt"), b"").unwrap();
        fs::create_dir(dir.path().join("Folder")).unwrap();
        fs::create_dir(dir.path().join("Thing.app")).unwrap();
        fs::create_dir(dir.path().join(".hidden-dir")).unwrap();
        symlink(dir.path().join("Folder"), dir.path().join("link")).unwrap();
        symlink(dir.path().join("file.txt"), dir.path().join("file-link")).unwrap();

        let mut names: Vec<_> = list_subdirs(p(dir.path()))
            .unwrap()
            .into_iter()
            .map(|n| (n.name, n.is_hidden))
            .collect();
        names.sort();
        assert_eq!(
            names,
            vec![
                (".hidden-dir".to_owned(), true),
                ("Folder".to_owned(), false),
                ("link".to_owned(), false)
            ]
        );
    }

    #[test]
    fn subdirs_permission_denied() {
        let dir = tempfile::tempdir().unwrap();
        let locked = dir.path().join("locked");
        fs::create_dir(&locked).unwrap();
        fs::set_permissions(&locked, fs::Permissions::from_mode(0o000)).unwrap();
        let result = list_subdirs(p(&locked));
        fs::set_permissions(&locked, fs::Permissions::from_mode(0o755)).unwrap();
        assert!(matches!(result, Err(AppError::PermissionDenied { .. })));
    }

    #[test]
    fn peek_empty_and_files_only() {
        let dir = tempfile::tempdir().unwrap();
        assert_eq!(peek_children(dir.path()), (false, false));
        fs::write(dir.path().join("a.txt"), b"").unwrap();
        assert_eq!(peek_children(dir.path()), (false, false));
    }

    #[test]
    fn peek_only_hidden_dirs() {
        let dir = tempfile::tempdir().unwrap();
        fs::create_dir(dir.path().join(".git")).unwrap();
        assert_eq!(peek_children(dir.path()), (true, false));
    }

    #[test]
    fn peek_visible_dir_and_packages_ignored() {
        let dir = tempfile::tempdir().unwrap();
        fs::create_dir(dir.path().join("X.app")).unwrap();
        assert_eq!(peek_children(dir.path()), (false, false));
        fs::create_dir(dir.path().join("src")).unwrap();
        assert_eq!(peek_children(dir.path()), (true, true));
    }

    #[test]
    fn peek_cap_returns_true_true() {
        let dir = tempfile::tempdir().unwrap();
        for i in 0..300 {
            fs::write(dir.path().join(format!("f{i}")), b"").unwrap();
        }
        assert_eq!(peek_children(dir.path()), (true, true));
    }

    #[test]
    fn peek_unreadable_is_true_true() {
        let dir = tempfile::tempdir().unwrap();
        let locked = dir.path().join("locked");
        fs::create_dir(&locked).unwrap();
        fs::set_permissions(&locked, fs::Permissions::from_mode(0o000)).unwrap();
        let result = peek_children(&locked);
        fs::set_permissions(&locked, fs::Permissions::from_mode(0o755)).unwrap();
        assert_eq!(result, (true, true));
    }
}
