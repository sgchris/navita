//! Paste (copy or move) of files and folders into a destination folder.

use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

use crate::error::AppError;
use crate::fs::canonical_dir;
use crate::fs::ops::{is_protected, renamex_exclusive};

const MAX_COPY_SUFFIX: u32 = 10_000;

fn io_error(path: &Path, message: impl Into<String>) -> AppError {
    AppError::Io {
        path: path.to_string_lossy().into_owned(),
        message: message.into(),
    }
}

/// Splits a name into `(base, extension-with-dot)`; dotfiles, extensionless names and trailing
/// dots have no extension.
fn split_extension(name: &str) -> (&str, &str) {
    match name.rfind('.') {
        Some(dot) if dot > 0 && dot + 1 < name.len() => name.split_at(dot),
        _ => (name, ""),
    }
}

/// Finder-style name for the `attempt`-th duplicate: `report copy.pdf`, `report copy 2.pdf`, ...
fn copy_name(name: &str, attempt: u32) -> String {
    let (base, extension) = split_extension(name);
    if attempt <= 1 {
        format!("{base} copy{extension}")
    } else {
        format!("{base} copy {attempt}{extension}")
    }
}

/// `dest/name` if free, otherwise the first free `name copy`, `name copy 2`, ... Never an
/// existing path, so pasting can never overwrite anything.
fn unique_target(dest: &Path, name: &str) -> Result<PathBuf, AppError> {
    let plain = dest.join(name);
    if fs::symlink_metadata(&plain).is_err() {
        return Ok(plain);
    }
    for attempt in 1..=MAX_COPY_SUFFIX {
        let candidate = dest.join(copy_name(name, attempt));
        if fs::symlink_metadata(&candidate).is_err() {
            return Ok(candidate);
        }
    }
    Err(io_error(dest, format!("Too many copies of “{name}”.")))
}

/// Resolves the on-disk spelling of a path (the pasteboard stores decomposed Unicode); symlinks
/// are kept as they are because the link itself is what gets copied.
fn on_disk_path(path: &Path) -> PathBuf {
    match fs::symlink_metadata(path) {
        Ok(meta) if !meta.file_type().is_symlink() => {
            fs::canonicalize(path).unwrap_or_else(|_| path.to_path_buf())
        }
        _ => path.to_path_buf(),
    }
}

/// `cp -c -p -R`: clones on APFS (falls back to a normal copy), keeps metadata and extended
/// attributes, copies symlinks as links. `target` must not exist.
fn copy_item(source: &Path, target: &Path) -> Result<(), AppError> {
    let output = Command::new("/bin/cp")
        .args(["-c", "-p", "-R"])
        .arg(source)
        .arg(target)
        .output()
        .map_err(|e| io_error(source, e.to_string()))?;
    if output.status.success() {
        Ok(())
    } else {
        Err(io_error(
            source,
            String::from_utf8_lossy(&output.stderr).trim().to_owned(),
        ))
    }
}

fn remove_item(path: &Path) -> Result<(), AppError> {
    let meta = fs::symlink_metadata(path).map_err(|e| AppError::from_io(&e, path))?;
    let result = if meta.is_dir() {
        fs::remove_dir_all(path)
    } else {
        fs::remove_file(path)
    };
    result.map_err(|e| AppError::from_io(&e, path))
}

/// Moves `source` to `target` (which must not exist). Across volumes it copies first and removes
/// the source only after the copy succeeded.
fn move_item(source: &Path, target: &Path) -> Result<(), AppError> {
    match renamex_exclusive(source, target) {
        Ok(()) => Ok(()),
        Err(error) if error.raw_os_error() == Some(libc::EXDEV) => {
            copy_item(source, target)?;
            remove_item(source)
        }
        Err(error) if error.raw_os_error() == Some(libc::EEXIST) => Err(AppError::AlreadyExists {
            path: target.to_string_lossy().into_owned(),
        }),
        Err(error) => Err(AppError::from_io(&error, source)),
    }
}

/// Pastes `sources` into `dest_dir` and returns the new paths (decisions: never overwrites; name
/// clashes become `name copy`; moving an item into the folder it is already in does nothing).
///
/// # Errors
/// Invalid or missing paths, pasting a folder into itself, moving a protected item, or any
/// failure of the copy or move. Items handled before the failure stay done.
pub fn paste(
    sources: &[String],
    dest_dir: &str,
    move_items: bool,
    home: Option<&Path>,
) -> Result<Vec<String>, AppError> {
    let dest = canonical_dir(dest_dir)?;

    // Validate everything before touching anything.
    let mut resolved = Vec::new();
    for raw in sources {
        let path = Path::new(raw);
        if !path.is_absolute() {
            return Err(AppError::InvalidPath { path: raw.clone() });
        }
        let source = on_disk_path(path);
        let meta = fs::symlink_metadata(&source).map_err(|e| AppError::from_io(&e, &source))?;
        if meta.is_dir() && dest.starts_with(&source) {
            return Err(io_error(&source, "Can’t paste a folder into itself."));
        }
        if move_items && is_protected(&source, home) {
            return Err(AppError::Protected {
                path: source.to_string_lossy().into_owned(),
            });
        }
        resolved.push(source);
    }

    let mut created = Vec::new();
    for source in resolved {
        let name =
            source
                .file_name()
                .and_then(|n| n.to_str())
                .ok_or_else(|| AppError::InvalidPath {
                    path: source.to_string_lossy().into_owned(),
                })?;
        if move_items && source.parent() == Some(dest.as_path()) {
            created.push(source.to_string_lossy().into_owned());
            continue;
        }
        let target = unique_target(&dest, name)?;
        if move_items {
            move_item(&source, &target)?;
        } else {
            copy_item(&source, &target)?;
        }
        created.push(target.to_string_lossy().into_owned());
    }
    Ok(created)
}

#[cfg(test)]
mod tests {
    use super::{copy_name, paste, split_extension};
    use crate::error::AppError;
    use std::fs;
    use std::os::unix::fs::symlink;
    use std::path::Path;
    use std::time::{Duration, SystemTime};

    fn s(path: &Path) -> String {
        path.to_string_lossy().into_owned()
    }

    fn names(dir: &Path) -> Vec<String> {
        let mut names: Vec<_> = fs::read_dir(dir)
            .unwrap()
            .map(|e| e.unwrap().file_name().to_string_lossy().into_owned())
            .collect();
        names.sort();
        names
    }

    #[test]
    fn splits_extensions_like_finder() {
        assert_eq!(split_extension("report.pdf"), ("report", ".pdf"));
        assert_eq!(split_extension("archive.tar.gz"), ("archive.tar", ".gz"));
        assert_eq!(split_extension(".env"), (".env", ""));
        assert_eq!(split_extension("Makefile"), ("Makefile", ""));
        assert_eq!(split_extension("name."), ("name.", ""));
    }

    #[test]
    fn copy_names_follow_the_finder_pattern() {
        assert_eq!(copy_name("report.pdf", 1), "report copy.pdf");
        assert_eq!(copy_name("report.pdf", 2), "report copy 2.pdf");
        assert_eq!(copy_name("Docs", 1), "Docs copy");
        assert_eq!(copy_name("Docs", 3), "Docs copy 3");
        assert_eq!(copy_name(".env", 1), ".env copy");
        assert_eq!(copy_name("a.b.c", 2), "a.b copy 2.c");
    }

    #[test]
    fn copies_a_tree_with_symlinks_and_metadata() {
        let tmp = tempfile::tempdir().unwrap();
        let src = tmp.path().join("src");
        let dest = tmp.path().join("dest");
        fs::create_dir_all(src.join("Docs/sub")).unwrap();
        fs::create_dir(&dest).unwrap();
        fs::write(src.join("Docs/a.txt"), b"alpha").unwrap();
        fs::write(src.join("Docs/sub/b.txt"), b"beta").unwrap();
        symlink("a.txt", src.join("Docs/link")).unwrap();
        let old = SystemTime::UNIX_EPOCH + Duration::from_secs(1_000_000_000);
        fs::File::options()
            .write(true)
            .open(src.join("Docs/a.txt"))
            .unwrap()
            .set_modified(old)
            .unwrap();

        let created = paste(&[s(&src.join("Docs"))], dest.to_str().unwrap(), false, None).unwrap();
        let copy = dest.join("Docs");
        assert_eq!(created, [s(&fs::canonicalize(&dest).unwrap().join("Docs"))]);
        assert_eq!(fs::read(copy.join("a.txt")).unwrap(), b"alpha");
        assert_eq!(fs::read(copy.join("sub/b.txt")).unwrap(), b"beta");
        assert_eq!(
            fs::read_link(copy.join("link")).unwrap(),
            Path::new("a.txt")
        );
        assert_eq!(
            fs::metadata(copy.join("a.txt"))
                .unwrap()
                .modified()
                .unwrap(),
            old
        );
        assert!(
            src.join("Docs/a.txt").exists(),
            "copy leaves the source in place"
        );
    }

    #[test]
    fn name_clashes_get_a_copy_suffix_and_nothing_is_overwritten() {
        let tmp = tempfile::tempdir().unwrap();
        let src = tmp.path().join("src");
        let dest = tmp.path().join("dest");
        fs::create_dir(&src).unwrap();
        fs::create_dir(&dest).unwrap();
        fs::write(src.join("r.pdf"), b"new").unwrap();
        fs::write(dest.join("r.pdf"), b"old").unwrap();

        let first = paste(
            &[s(&src.join("r.pdf"))],
            dest.to_str().unwrap(),
            false,
            None,
        )
        .unwrap();
        assert!(first[0].ends_with("/r copy.pdf"));
        let second = paste(
            &[s(&src.join("r.pdf"))],
            dest.to_str().unwrap(),
            false,
            None,
        )
        .unwrap();
        assert!(second[0].ends_with("/r copy 2.pdf"));
        assert_eq!(fs::read(dest.join("r.pdf")).unwrap(), b"old");
        assert_eq!(names(&dest), ["r copy 2.pdf", "r copy.pdf", "r.pdf"]);
    }

    #[test]
    fn copying_into_the_same_folder_duplicates() {
        let tmp = tempfile::tempdir().unwrap();
        fs::write(tmp.path().join("x.txt"), b"x").unwrap();
        let created = paste(
            &[s(&tmp.path().join("x.txt"))],
            tmp.path().to_str().unwrap(),
            false,
            None,
        )
        .unwrap();
        assert!(created[0].ends_with("/x copy.txt"));
        assert_eq!(names(tmp.path()), ["x copy.txt", "x.txt"]);
    }

    #[test]
    fn moves_items_and_removes_the_source() {
        let tmp = tempfile::tempdir().unwrap();
        let src = tmp.path().join("src");
        let dest = tmp.path().join("dest");
        fs::create_dir_all(src.join("Folder")).unwrap();
        fs::create_dir(&dest).unwrap();
        fs::write(src.join("Folder/in.txt"), b"in").unwrap();
        fs::write(src.join("f.txt"), b"f").unwrap();

        let created = paste(
            &[s(&src.join("Folder")), s(&src.join("f.txt"))],
            dest.to_str().unwrap(),
            true,
            None,
        )
        .unwrap();
        assert_eq!(created.len(), 2);
        assert_eq!(names(&src), Vec::<String>::new());
        assert_eq!(fs::read(dest.join("Folder/in.txt")).unwrap(), b"in");
        assert_eq!(fs::read(dest.join("f.txt")).unwrap(), b"f");
    }

    #[test]
    fn moving_into_the_folder_the_item_is_already_in_does_nothing() {
        let tmp = tempfile::tempdir().unwrap();
        fs::write(tmp.path().join("same.txt"), b"x").unwrap();
        let path = fs::canonicalize(tmp.path().join("same.txt")).unwrap();
        let created = paste(&[s(&path)], tmp.path().to_str().unwrap(), true, None).unwrap();
        assert_eq!(created, [s(&path)]);
        assert_eq!(names(tmp.path()), ["same.txt"]);
    }

    #[test]
    fn move_clashes_do_not_overwrite_either() {
        let tmp = tempfile::tempdir().unwrap();
        let src = tmp.path().join("src");
        let dest = tmp.path().join("dest");
        fs::create_dir(&src).unwrap();
        fs::create_dir(&dest).unwrap();
        fs::write(src.join("a.txt"), b"mine").unwrap();
        fs::write(dest.join("a.txt"), b"theirs").unwrap();
        let created = paste(&[s(&src.join("a.txt"))], dest.to_str().unwrap(), true, None).unwrap();
        assert!(created[0].ends_with("/a copy.txt"));
        assert_eq!(fs::read(dest.join("a.txt")).unwrap(), b"theirs");
        assert_eq!(fs::read(dest.join("a copy.txt")).unwrap(), b"mine");
    }

    #[test]
    fn a_folder_cannot_be_pasted_into_itself_or_a_descendant() {
        let tmp = tempfile::tempdir().unwrap();
        let folder = tmp.path().join("F");
        fs::create_dir_all(folder.join("inner")).unwrap();
        for dest in [&folder, &folder.join("inner")] {
            for move_items in [false, true] {
                let result = paste(&[s(&folder)], dest.to_str().unwrap(), move_items, None);
                assert!(matches!(result, Err(AppError::Io { .. })), "{result:?}");
            }
        }
        assert_eq!(names(&folder), ["inner"]);
    }

    #[test]
    fn protected_items_cannot_be_moved_but_can_be_copied() {
        let tmp = tempfile::tempdir().unwrap();
        let home = fs::canonicalize(tmp.path()).unwrap().join("home");
        fs::create_dir_all(home.join("Documents")).unwrap();
        let dest = fs::canonicalize(tmp.path()).unwrap().join("dest");
        fs::create_dir(&dest).unwrap();
        let docs = s(&home.join("Documents"));
        let moved = paste(
            std::slice::from_ref(&docs),
            dest.to_str().unwrap(),
            true,
            Some(&home),
        );
        assert!(matches!(moved, Err(AppError::Protected { .. })));
        assert!(home.join("Documents").is_dir());
        let copied = paste(&[docs], dest.to_str().unwrap(), false, Some(&home)).unwrap();
        assert_eq!(copied.len(), 1);
        assert!(dest.join("Documents").is_dir());
    }

    #[test]
    fn rejects_bad_input_before_touching_anything() {
        let tmp = tempfile::tempdir().unwrap();
        let dest = tmp.path().join("dest");
        fs::create_dir(&dest).unwrap();
        fs::write(tmp.path().join("ok.txt"), b"x").unwrap();
        let d = dest.to_str().unwrap();
        assert!(matches!(
            paste(&["relative".to_owned()], d, false, None),
            Err(AppError::InvalidPath { .. })
        ));
        assert!(matches!(
            paste(
                &[
                    s(&tmp.path().join("ok.txt")),
                    s(&tmp.path().join("missing"))
                ],
                d,
                false,
                None
            ),
            Err(AppError::NotFound { .. })
        ));
        assert!(
            names(&dest).is_empty(),
            "nothing is pasted when a later source is invalid"
        );
        assert!(matches!(
            paste(&[s(&tmp.path().join("ok.txt"))], "relative", false, None),
            Err(AppError::InvalidPath { .. })
        ));
    }
}
