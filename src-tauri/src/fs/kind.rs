use std::fs::Metadata;
use std::path::Path;

use crate::fs::package::is_package;
use crate::model::EntryKind;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Classified {
    pub kind: EntryKind,
    /// True for a Directory and for a Symlink resolving to a non-package directory.
    pub is_dir_like: bool,
    pub is_broken_link: bool,
}

/// Classifies an entry.
///
/// `lmeta` is `symlink_metadata(path)`. `resolved` is `metadata(path)` and is only consulted when
/// `lmeta` is a symlink: `Some` when it resolves, `None` when the link is broken.
#[must_use]
pub fn classify(path: &Path, lmeta: &Metadata, resolved: Option<&Metadata>) -> Classified {
    if lmeta.file_type().is_symlink() {
        return match resolved {
            Some(target) => Classified {
                kind: EntryKind::Symlink,
                is_dir_like: target.is_dir() && !is_package(path),
                is_broken_link: false,
            },
            None => Classified {
                kind: EntryKind::Symlink,
                is_dir_like: false,
                is_broken_link: true,
            },
        };
    }
    if lmeta.is_dir() {
        let package = is_package(path);
        return Classified {
            kind: if package {
                EntryKind::Package
            } else {
                EntryKind::Directory
            },
            is_dir_like: !package,
            is_broken_link: false,
        };
    }
    Classified {
        kind: EntryKind::File,
        is_dir_like: false,
        is_broken_link: false,
    }
}

#[cfg(test)]
mod tests {
    use super::classify;
    use crate::model::EntryKind;
    use std::fs;
    use std::os::unix::fs::symlink;

    fn classify_path(path: &std::path::Path) -> super::Classified {
        let lmeta = fs::symlink_metadata(path).unwrap();
        let resolved = fs::metadata(path).ok();
        classify(path, &lmeta, resolved.as_ref())
    }

    #[test]
    fn classifies_file_directory_package() {
        let dir = tempfile::tempdir().unwrap();
        let file = dir.path().join("a.txt");
        fs::write(&file, b"x").unwrap();
        let sub = dir.path().join("sub");
        fs::create_dir(&sub).unwrap();
        let app = dir.path().join("X.app");
        fs::create_dir(&app).unwrap();

        let c = classify_path(&file);
        assert_eq!((c.kind, c.is_dir_like), (EntryKind::File, false));
        let c = classify_path(&sub);
        assert_eq!((c.kind, c.is_dir_like), (EntryKind::Directory, true));
        let c = classify_path(&app);
        assert_eq!((c.kind, c.is_dir_like), (EntryKind::Package, false));
    }

    #[test]
    fn classifies_symlinks() {
        let dir = tempfile::tempdir().unwrap();
        let target_dir = dir.path().join("real");
        fs::create_dir(&target_dir).unwrap();
        let target_file = dir.path().join("real.txt");
        fs::write(&target_file, b"x").unwrap();
        let link_dir = dir.path().join("link-dir");
        let link_file = dir.path().join("link-file");
        let link_broken = dir.path().join("link-broken");
        symlink(&target_dir, &link_dir).unwrap();
        symlink(&target_file, &link_file).unwrap();
        symlink(dir.path().join("missing"), &link_broken).unwrap();

        let c = classify_path(&link_dir);
        assert_eq!(
            (c.kind, c.is_dir_like, c.is_broken_link),
            (EntryKind::Symlink, true, false)
        );
        let c = classify_path(&link_file);
        assert_eq!(
            (c.kind, c.is_dir_like, c.is_broken_link),
            (EntryKind::Symlink, false, false)
        );
        let c = classify_path(&link_broken);
        assert_eq!(
            (c.kind, c.is_dir_like, c.is_broken_link),
            (EntryKind::Symlink, false, true)
        );
    }

    #[test]
    fn symlink_to_package_is_not_dir_like() {
        let dir = tempfile::tempdir().unwrap();
        let app = dir.path().join("X.app");
        fs::create_dir(&app).unwrap();
        let link = dir.path().join("Y.app");
        symlink(&app, &link).unwrap();
        let c = classify_path(&link);
        assert_eq!((c.kind, c.is_dir_like), (EntryKind::Symlink, false));
    }
}
