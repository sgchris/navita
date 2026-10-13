//! The only filesystem-mutating operations: New Folder, Rename and Move to Trash (spec M8).

use std::ffi::CString;
use std::fs;
use std::os::macos::fs::MetadataExt;
use std::os::unix::ffi::OsStrExt;
use std::path::{Path, PathBuf};

use crate::error::AppError;
use crate::fs::canonical_dir;

const MAX_NAME_BYTES: usize = 255;
const NEW_FOLDER_NAME: &str = "untitled folder";
const NEW_FILE_NAME: &str = "untitled file";
const MAX_NEW_ITEM_ATTEMPTS: u32 = 10_000;
const PROTECTED_HOME_FOLDERS: [&str; 9] = [
    "Desktop",
    "Documents",
    "Downloads",
    "Library",
    "Applications",
    "Movies",
    "Music",
    "Pictures",
    "Public",
];

fn invalid_name(name: &str, reason: &str) -> AppError {
    AppError::InvalidName {
        name: name.to_owned(),
        reason: reason.to_owned(),
    }
}

/// Validates a file or folder name (decisions B32): not empty, not `.`/`..`, no `/`, `:` or NUL,
/// at most 255 bytes of UTF-8. The reason strings are shown to the user.
///
/// # Errors
/// `InvalidName` with a user-facing reason.
pub fn validate_name(name: &str) -> Result<(), AppError> {
    if name.is_empty() {
        return Err(invalid_name(name, "A name can't be empty."));
    }
    if name == "." || name == ".." || name.contains('\0') {
        return Err(invalid_name(name, "That name isn't allowed."));
    }
    if name.contains('/') || name.contains(':') {
        return Err(invalid_name(name, "Names can't contain “/” or “:”."));
    }
    if name.len() > MAX_NAME_BYTES {
        return Err(invalid_name(name, "Name is too long."));
    }
    Ok(())
}

/// Paths that must never be renamed or trashed (decisions B36): the root, anything directly under
/// the root, the home folder, its standard folders and the volumes in `/Volumes`.
#[must_use]
pub fn is_protected(path: &Path, home: Option<&Path>) -> bool {
    let normal_components = path
        .components()
        .filter(|c| matches!(c, std::path::Component::Normal(_)))
        .count();
    if normal_components <= 1 {
        return true;
    }
    if home == Some(path) {
        return true;
    }
    let Some(parent) = path.parent() else {
        return true;
    };
    if parent == Path::new("/Volumes") {
        return true;
    }
    if home == Some(parent) {
        return path
            .file_name()
            .and_then(|n| n.to_str())
            .is_some_and(|n| PROTECTED_HOME_FOLDERS.contains(&n));
    }
    false
}

fn ensure_absolute(path: &str) -> Result<PathBuf, AppError> {
    let p = Path::new(path);
    if p.is_absolute() {
        Ok(p.to_path_buf())
    } else {
        Err(AppError::InvalidPath {
            path: path.to_owned(),
        })
    }
}

fn protected_error(path: &Path) -> AppError {
    AppError::Protected {
        path: path.to_string_lossy().into_owned(),
    }
}

/// Creates `base`, `base 2`, `base 3`, ... inside `parent` using `create`, which must fail with
/// `AlreadyExists` when the path is taken. Returns the path that was created.
fn create_unique(
    parent: &str,
    base: &str,
    create: impl Fn(&Path) -> std::io::Result<()>,
) -> Result<String, AppError> {
    let dir = canonical_dir(parent)?;
    for attempt in 1..=MAX_NEW_ITEM_ATTEMPTS {
        let name = if attempt == 1 {
            base.to_owned()
        } else {
            format!("{base} {attempt}")
        };
        let target = dir.join(&name);
        match create(&target) {
            Ok(()) => return Ok(target.to_string_lossy().into_owned()),
            Err(e) if e.kind() == std::io::ErrorKind::AlreadyExists => {}
            Err(e) => return Err(AppError::from_io(&e, &target)),
        }
    }
    Err(AppError::Io {
        path: dir.to_string_lossy().into_owned(),
        message: format!("Too many items named “{base}”."),
    })
}

/// Creates `untitled folder`, `untitled folder 2`, ... inside `parent` (decisions B33).
///
/// # Errors
/// Path validation or the first non-collision I/O error.
pub fn create_folder(parent: &str) -> Result<String, AppError> {
    create_unique(parent, NEW_FOLDER_NAME, |target| fs::create_dir(target))
}

/// Creates an empty `untitled file`, `untitled file 2`, ... inside `parent`.
///
/// # Errors
/// Path validation or the first non-collision I/O error.
pub fn create_file(parent: &str) -> Result<String, AppError> {
    create_unique(parent, NEW_FILE_NAME, |target| {
        fs::OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(target)
            .map(|_| ())
    })
}

/// Renames `path` to `new_name` in the same folder and returns the new path (decisions B34).
/// Never overwrites: a case-only rename of the same file is allowed, any other existing target is
/// an `AlreadyExists` error.
///
/// # Errors
/// `InvalidName`, `Protected`, `NotFound`, `AlreadyExists` or another mapped I/O error.
pub fn rename_path(path: &str, new_name: &str, home: Option<&Path>) -> Result<String, AppError> {
    validate_name(new_name)?;
    let source = ensure_absolute(path)?;
    if is_protected(&source, home) {
        return Err(protected_error(&source));
    }
    let source_meta = fs::symlink_metadata(&source).map_err(|e| AppError::from_io(&e, &source))?;
    let Some(parent) = source.parent() else {
        return Err(protected_error(&source));
    };
    let target = parent.join(new_name);
    if target == source {
        return Ok(path.to_owned());
    }

    if let Ok(target_meta) = fs::symlink_metadata(&target) {
        let same_file = target_meta.st_dev() == source_meta.st_dev()
            && target_meta.st_ino() == source_meta.st_ino();
        let case_only =
            target.to_string_lossy().to_lowercase() == source.to_string_lossy().to_lowercase();
        if same_file && case_only {
            fs::rename(&source, &target).map_err(|e| AppError::from_io(&e, &source))?;
            return Ok(target.to_string_lossy().into_owned());
        }
        return Err(AppError::AlreadyExists {
            path: target.to_string_lossy().into_owned(),
        });
    }

    rename_exclusive(&source, &target)?;
    Ok(target.to_string_lossy().into_owned())
}

/// `renamex_np(RENAME_EXCL)`: atomically refuses to replace an existing target.
fn rename_exclusive(source: &Path, target: &Path) -> Result<(), AppError> {
    let from = CString::new(source.as_os_str().as_bytes()).map_err(|_| AppError::InvalidPath {
        path: source.to_string_lossy().into_owned(),
    })?;
    let to = CString::new(target.as_os_str().as_bytes()).map_err(|_| AppError::InvalidPath {
        path: target.to_string_lossy().into_owned(),
    })?;
    // SAFETY: both arguments are valid NUL-terminated strings that outlive the call.
    let rc = unsafe { libc::renamex_np(from.as_ptr(), to.as_ptr(), libc::RENAME_EXCL) };
    if rc == 0 {
        return Ok(());
    }
    let error = std::io::Error::last_os_error();
    if error.raw_os_error() == Some(libc::EEXIST) {
        return Err(AppError::AlreadyExists {
            path: target.to_string_lossy().into_owned(),
        });
    }
    Err(AppError::from_io(&error, source))
}

/// Moves paths to the Trash. Abstracted so tests do not fill the user's real Trash.
pub trait Trasher {
    /// # Errors
    /// A human-readable failure message.
    fn trash_all(&self, paths: &[PathBuf]) -> Result<(), String>;
}

/// The real Trash through `NSFileManager.trashItemAtURL` (decisions A16).
pub struct SystemTrash;

impl Trasher for SystemTrash {
    fn trash_all(&self, paths: &[PathBuf]) -> Result<(), String> {
        use trash::macos::{DeleteMethod, TrashContextExtMacos};

        let mut context = trash::TrashContext::default();
        context.set_delete_method(DeleteMethod::NsFileManager);
        context.delete_all(paths).map_err(|e| e.to_string())
    }
}

/// Validates every path first (absolute, existing, not protected) and only then trashes them all.
///
/// # Errors
/// `InvalidPath`, `NotFound`, `Protected` (nothing is trashed in that case) or `Io`.
pub fn trash_paths(
    paths: &[String],
    home: Option<&Path>,
    trasher: &dyn Trasher,
) -> Result<(), AppError> {
    let mut checked: Vec<PathBuf> = Vec::new();
    for path in paths {
        let p = ensure_absolute(path)?;
        if is_protected(&p, home) {
            return Err(protected_error(&p));
        }
        fs::symlink_metadata(&p).map_err(|e| AppError::from_io(&e, &p))?;
        if !checked.contains(&p) {
            checked.push(p);
        }
    }
    if checked.is_empty() {
        return Ok(());
    }
    trasher.trash_all(&checked).map_err(|message| AppError::Io {
        path: checked
            .first()
            .map(|p| p.to_string_lossy().into_owned())
            .unwrap_or_default(),
        message,
    })
}

#[cfg(test)]
mod tests {
    use super::{
        SystemTrash, Trasher, create_file, create_folder, is_protected, rename_path, trash_paths,
        validate_name,
    };
    use crate::error::AppError;
    use std::cell::RefCell;
    use std::fs;
    use std::path::{Path, PathBuf};

    fn names(dir: &Path) -> Vec<String> {
        let mut names: Vec<_> = fs::read_dir(dir)
            .unwrap()
            .map(|e| e.unwrap().file_name().to_string_lossy().into_owned())
            .collect();
        names.sort();
        names
    }

    #[test]
    fn validates_names() {
        for ok in [
            "a",
            "untitled folder",
            ".hidden",
            "Übung 😀.txt",
            &"x".repeat(255),
        ] {
            assert!(validate_name(ok).is_ok(), "{ok}");
        }
        let reason = |name: &str| match validate_name(name) {
            Err(AppError::InvalidName { reason, .. }) => reason,
            other => panic!("{name:?} -> {other:?}"),
        };
        assert_eq!(reason(""), "A name can't be empty.");
        assert_eq!(reason("."), "That name isn't allowed.");
        assert_eq!(reason(".."), "That name isn't allowed.");
        assert_eq!(reason("a\0b"), "That name isn't allowed.");
        assert_eq!(reason("a/b"), "Names can't contain “/” or “:”.");
        assert_eq!(reason("a:b"), "Names can't contain “/” or “:”.");
        assert_eq!(reason(&"x".repeat(256)), "Name is too long.");
        assert_eq!(reason(&"é".repeat(128)), "Name is too long."); // 256 bytes
    }

    #[test]
    fn protects_system_and_home_locations() {
        let home = Path::new("/Users/me");
        let protected = [
            "/",
            "/Users",
            "/Applications",
            "/System",
            "/Users/me",
            "/Users/me/Desktop",
            "/Users/me/Documents",
            "/Users/me/Downloads",
            "/Users/me/Library",
            "/Users/me/Public",
            "/Volumes/Macintosh HD",
            "/Volumes/USB",
        ];
        for p in protected {
            assert!(is_protected(Path::new(p), Some(home)), "{p}");
        }
        let allowed = [
            "/Users/me/Desktop/file.txt",
            "/Users/me/Projects",
            "/Users/me/notes.txt",
            "/Users/other/Desktop",
            "/Volumes/USB/file.txt",
            "/Applications/Foo.app",
            "/tmp/x/y",
        ];
        for p in allowed {
            assert!(!is_protected(Path::new(p), Some(home)), "{p}");
        }
        assert!(!is_protected(Path::new("/Users/me/Desktop"), None));
    }

    #[test]
    fn create_folder_picks_the_next_free_name() {
        let dir = tempfile::tempdir().unwrap();
        let parent = dir.path().to_str().unwrap();
        let first = create_folder(parent).unwrap();
        assert!(first.ends_with("/untitled folder"));
        let second = create_folder(parent).unwrap();
        assert!(second.ends_with("/untitled folder 2"));
        let third = create_folder(parent).unwrap();
        assert!(third.ends_with("/untitled folder 3"));
        assert!(Path::new(&third).is_dir());
        assert_eq!(
            names(dir.path()),
            ["untitled folder", "untitled folder 2", "untitled folder 3"]
        );
    }

    #[test]
    fn create_file_picks_the_next_free_name_and_creates_an_empty_file() {
        let dir = tempfile::tempdir().unwrap();
        let parent = dir.path().to_str().unwrap();
        let first = create_file(parent).unwrap();
        assert!(first.ends_with("/untitled file"));
        assert!(create_file(parent).unwrap().ends_with("/untitled file 2"));
        let third = create_file(parent).unwrap();
        assert!(third.ends_with("/untitled file 3"));
        let meta = fs::metadata(&third).unwrap();
        assert!(meta.is_file());
        assert_eq!(meta.len(), 0);
        assert_eq!(
            names(dir.path()),
            ["untitled file", "untitled file 2", "untitled file 3"]
        );
    }

    #[test]
    fn create_file_skips_a_folder_with_the_same_name() {
        let dir = tempfile::tempdir().unwrap();
        fs::create_dir(dir.path().join("untitled file")).unwrap();
        let created = create_file(dir.path().to_str().unwrap()).unwrap();
        assert!(created.ends_with("/untitled file 2"));
        assert!(Path::new(&created).is_file());
    }

    #[test]
    fn create_file_errors() {
        assert!(matches!(
            create_file("relative"),
            Err(AppError::InvalidPath { .. })
        ));
        let dir = tempfile::tempdir().unwrap();
        let file = dir.path().join("f");
        fs::write(&file, b"").unwrap();
        assert!(matches!(
            create_file(file.to_str().unwrap()),
            Err(AppError::NotADirectory { .. })
        ));
        let missing = dir.path().join("missing");
        assert!(matches!(
            create_file(missing.to_str().unwrap()),
            Err(AppError::NotFound { .. })
        ));
    }

    #[test]
    fn create_folder_errors() {
        assert!(matches!(
            create_folder("relative"),
            Err(AppError::InvalidPath { .. })
        ));
        let dir = tempfile::tempdir().unwrap();
        let file = dir.path().join("f");
        fs::write(&file, b"").unwrap();
        assert!(matches!(
            create_folder(file.to_str().unwrap()),
            Err(AppError::NotADirectory { .. })
        ));
    }

    #[test]
    fn renames_a_file_and_a_folder() {
        let dir = tempfile::tempdir().unwrap();
        fs::write(dir.path().join("a.txt"), b"hello").unwrap();
        fs::create_dir(dir.path().join("old")).unwrap();

        let renamed =
            rename_path(dir.path().join("a.txt").to_str().unwrap(), "b.txt", None).unwrap();
        assert!(renamed.ends_with("/b.txt"));
        assert_eq!(fs::read(dir.path().join("b.txt")).unwrap(), b"hello");
        rename_path(dir.path().join("old").to_str().unwrap(), "new", None).unwrap();
        assert_eq!(names(dir.path()), ["b.txt", "new"]);
    }

    #[test]
    fn rename_never_overwrites_an_existing_target() {
        let dir = tempfile::tempdir().unwrap();
        fs::write(dir.path().join("a.txt"), b"A").unwrap();
        fs::write(dir.path().join("b.txt"), b"B").unwrap();
        let result = rename_path(dir.path().join("a.txt").to_str().unwrap(), "b.txt", None);
        assert!(
            matches!(result, Err(AppError::AlreadyExists { .. })),
            "{result:?}"
        );
        assert_eq!(fs::read(dir.path().join("a.txt")).unwrap(), b"A");
        assert_eq!(fs::read(dir.path().join("b.txt")).unwrap(), b"B");
    }

    #[test]
    fn rename_allows_a_case_only_change_and_treats_the_same_name_as_a_no_op() {
        let dir = tempfile::tempdir().unwrap();
        fs::write(dir.path().join("report.txt"), b"x").unwrap();
        let path = dir.path().join("report.txt");
        assert_eq!(
            rename_path(path.to_str().unwrap(), "report.txt", None).unwrap(),
            path.to_str().unwrap()
        );
        rename_path(path.to_str().unwrap(), "Report.txt", None).unwrap();
        assert_eq!(names(dir.path()), ["Report.txt"]);
    }

    #[test]
    fn rename_rejects_bad_input() {
        let dir = tempfile::tempdir().unwrap();
        let file = dir.path().join("a.txt");
        fs::write(&file, b"x").unwrap();
        let f = file.to_str().unwrap();
        assert!(matches!(
            rename_path(f, "a/b", None),
            Err(AppError::InvalidName { .. })
        ));
        assert!(matches!(
            rename_path(f, "", None),
            Err(AppError::InvalidName { .. })
        ));
        assert!(matches!(
            rename_path("relative", "x", None),
            Err(AppError::InvalidPath { .. })
        ));
        let missing = dir.path().join("missing");
        assert!(matches!(
            rename_path(missing.to_str().unwrap(), "x", None),
            Err(AppError::NotFound { .. })
        ));
        assert!(matches!(
            rename_path("/Users", "Users2", None),
            Err(AppError::Protected { .. })
        ));
        let home = dir.path().join("home");
        fs::create_dir_all(home.join("Documents")).unwrap();
        let docs = home.join("Documents");
        assert!(matches!(
            rename_path(docs.to_str().unwrap(), "Docs", Some(&home)),
            Err(AppError::Protected { .. })
        ));
        assert!(docs.is_dir());
    }

    struct FakeTrash(RefCell<Vec<PathBuf>>);
    impl Trasher for FakeTrash {
        fn trash_all(&self, paths: &[PathBuf]) -> Result<(), String> {
            self.0.borrow_mut().extend_from_slice(paths);
            Ok(())
        }
    }

    #[test]
    fn trash_validates_everything_before_trashing_anything() {
        let dir = tempfile::tempdir().unwrap();
        let a = dir.path().join("a.txt");
        fs::write(&a, b"x").unwrap();
        let a_str = a.to_str().unwrap().to_owned();
        let fake = FakeTrash(RefCell::new(Vec::new()));

        trash_paths(&[a_str.clone(), a_str.clone()], None, &fake).unwrap();
        assert_eq!(fake.0.borrow().as_slice(), std::slice::from_ref(&a)); // deduplicated

        let blocked = FakeTrash(RefCell::new(Vec::new()));
        let result = trash_paths(&[a_str.clone(), "/Users".to_owned()], None, &blocked);
        assert!(matches!(result, Err(AppError::Protected { .. })));
        assert!(blocked.0.borrow().is_empty());

        let missing = dir.path().join("missing").to_string_lossy().into_owned();
        assert!(matches!(
            trash_paths(&[missing], None, &blocked),
            Err(AppError::NotFound { .. })
        ));
        assert!(matches!(
            trash_paths(&["relative".to_owned()], None, &blocked),
            Err(AppError::InvalidPath { .. })
        ));
        assert!(blocked.0.borrow().is_empty());
        trash_paths(&[], None, &blocked).unwrap();
    }

    #[test]
    fn trash_refuses_the_home_folder_and_its_standard_folders() {
        let dir = tempfile::tempdir().unwrap();
        let home = dir.path().join("home");
        fs::create_dir_all(home.join("Desktop")).unwrap();
        let fake = FakeTrash(RefCell::new(Vec::new()));
        for p in [home.clone(), home.join("Desktop")] {
            let result = trash_paths(&[p.to_string_lossy().into_owned()], Some(&home), &fake);
            assert!(matches!(result, Err(AppError::Protected { .. })));
        }
        assert!(fake.0.borrow().is_empty());
    }

    /// Moves a real file to the real Trash. Ignored by default so `cargo test` never fills the
    /// user's Trash; run with `cargo test real_trash -- --ignored`.
    #[test]
    #[ignore = "moves a file to the user's real Trash"]
    fn real_trash_moves_a_file_out_of_its_folder() {
        let dir = tempfile::tempdir().unwrap();
        let file = dir
            .path()
            .join(format!("navita-test-{}-trash.tmp", std::process::id()));
        fs::write(&file, b"").unwrap();
        trash_paths(&[file.to_string_lossy().into_owned()], None, &SystemTrash).unwrap();
        assert!(!file.exists());
    }
}
