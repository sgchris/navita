use std::ffi::CString;
use std::fs;
use std::os::unix::ffi::OsStrExt;
use std::path::{Path, PathBuf};

use crate::error::AppError;
use crate::fs::canonical;
use crate::model::{Place, PlaceKind, VolumeInfo};

const ROOT_FALLBACK_NAME: &str = "Macintosh HD";

/// Sidebar places for the real system: favorites that exist, the startup volume and `/Volumes`.
#[must_use]
pub fn places() -> Vec<Place> {
    let home = dirs::home_dir();
    compute_places(
        home.as_deref(),
        Path::new("/Applications"),
        Path::new("/"),
        Path::new("/Volumes"),
    )
}

/// Pure(ish) core of [`places`] with injectable locations (used by tests).
///
/// Order: Home, Desktop, Documents, Downloads, Applications (only existing directories), then the
/// Root place, then volumes sorted by name. The Root name is the name of the `volumes_dir` entry
/// that resolves to `root`, falling back to "Macintosh HD".
#[must_use]
pub fn compute_places(
    home: Option<&Path>,
    applications: &Path,
    root: &Path,
    volumes_dir: &Path,
) -> Vec<Place> {
    let mut places = Vec::new();

    if let Some(home) = home.filter(|h| h.is_dir()) {
        let name = home
            .file_name()
            .map_or_else(|| "Home".to_owned(), |n| n.to_string_lossy().into_owned());
        places.push(place(name, home, PlaceKind::Home));
        for (folder, kind) in [
            ("Desktop", PlaceKind::Desktop),
            ("Documents", PlaceKind::Documents),
            ("Downloads", PlaceKind::Downloads),
        ] {
            let path = home.join(folder);
            if path.is_dir() {
                places.push(place(folder.to_owned(), &path, kind));
            }
        }
    }
    if applications.is_dir() {
        places.push(place(
            "Applications".to_owned(),
            applications,
            PlaceKind::Applications,
        ));
    }

    let canonical_root = fs::canonicalize(root).ok();
    let mut root_name = None;
    let mut volumes = Vec::new();
    if let Ok(read) = fs::read_dir(volumes_dir) {
        for dirent in read.filter_map(Result::ok) {
            let path = dirent.path();
            let name = dirent.file_name().to_string_lossy().into_owned();
            if name.starts_with('.') || !fs::metadata(&path).is_ok_and(|m| m.is_dir()) {
                continue;
            }
            let resolved = fs::canonicalize(&path).ok();
            if resolved.is_some() && resolved == canonical_root {
                root_name = Some(name);
            } else {
                volumes.push(place(name, &path, PlaceKind::Volume));
            }
        }
    }
    places.push(place(
        root_name.unwrap_or_else(|| ROOT_FALLBACK_NAME.to_owned()),
        root,
        PlaceKind::Root,
    ));
    volumes.sort_by_key(|v| v.name.to_lowercase());
    places.extend(volumes);
    places
}

fn place(name: String, path: &Path, kind: PlaceKind) -> Place {
    Place {
        name,
        path: path.to_string_lossy().into_owned(),
        kind,
    }
}

/// Free and total bytes of the volume containing `path` (`statfs`; free is `f_bavail`).
///
/// # Errors
/// `InvalidPath` for relative paths, otherwise the mapped I/O error.
pub fn volume_info(path: &str) -> Result<VolumeInfo, AppError> {
    let canon: PathBuf = canonical(path)?;
    let c_path = CString::new(canon.as_os_str().as_bytes()).map_err(|_| AppError::InvalidPath {
        path: path.to_owned(),
    })?;
    // SAFETY: `statfs` is a plain C struct for which all-zero bytes are a valid value.
    let mut stat: libc::statfs = unsafe { std::mem::zeroed() };
    // SAFETY: `c_path` is NUL-terminated and `stat` is a valid out pointer for the call.
    let rc = unsafe { libc::statfs(c_path.as_ptr(), &raw mut stat) };
    if rc != 0 {
        return Err(AppError::from_io(&std::io::Error::last_os_error(), &canon));
    }
    let block = u64::from(stat.f_bsize);
    Ok(VolumeInfo {
        free_bytes: stat.f_bavail * block,
        total_bytes: stat.f_blocks * block,
    })
}

#[cfg(test)]
mod tests {
    use super::{compute_places, volume_info};
    use crate::error::AppError;
    use crate::model::PlaceKind;
    use std::fs;
    use std::os::unix::fs::symlink;

    #[test]
    fn favorites_only_include_existing_directories() {
        let tmp = tempfile::tempdir().unwrap();
        let home = tmp.path().join("greg");
        fs::create_dir_all(home.join("Desktop")).unwrap();
        fs::create_dir_all(home.join("Downloads")).unwrap();
        let apps = tmp.path().join("Applications");
        fs::create_dir(&apps).unwrap();
        let root = tmp.path().join("root");
        fs::create_dir(&root).unwrap();
        let volumes = tmp.path().join("Volumes");
        fs::create_dir(&volumes).unwrap();

        let places = compute_places(Some(&home), &apps, &root, &volumes);
        let summary: Vec<_> = places.iter().map(|p| (p.name.as_str(), p.kind)).collect();
        assert_eq!(
            summary,
            vec![
                ("greg", PlaceKind::Home),
                ("Desktop", PlaceKind::Desktop),
                ("Downloads", PlaceKind::Downloads),
                ("Applications", PlaceKind::Applications),
                ("Macintosh HD", PlaceKind::Root),
            ]
        );
    }

    #[test]
    fn root_name_comes_from_the_volumes_entry_pointing_at_root_and_volumes_are_sorted() {
        let tmp = tempfile::tempdir().unwrap();
        let root = tmp.path().join("root");
        fs::create_dir(&root).unwrap();
        let volumes = tmp.path().join("Volumes");
        fs::create_dir(&volumes).unwrap();
        symlink(&root, volumes.join("Startup Disk")).unwrap();
        fs::create_dir(volumes.join("zeta")).unwrap();
        fs::create_dir(volumes.join("Alpha")).unwrap();
        fs::create_dir(volumes.join(".hidden")).unwrap();
        fs::write(volumes.join("file"), b"").unwrap();

        let missing_apps = tmp.path().join("nope");
        let places = compute_places(None, &missing_apps, &root, &volumes);
        let summary: Vec<_> = places.iter().map(|p| (p.name.as_str(), p.kind)).collect();
        assert_eq!(
            summary,
            vec![
                ("Startup Disk", PlaceKind::Root),
                ("Alpha", PlaceKind::Volume),
                ("zeta", PlaceKind::Volume),
            ]
        );
        assert_eq!(places[0].path, root.to_string_lossy());
    }

    #[test]
    fn missing_volumes_dir_still_yields_root() {
        let tmp = tempfile::tempdir().unwrap();
        let places = compute_places(
            None,
            &tmp.path().join("a"),
            tmp.path(),
            &tmp.path().join("v"),
        );
        assert_eq!(places.len(), 1);
        assert_eq!(places[0].kind, PlaceKind::Root);
    }

    #[test]
    fn volume_info_reports_sane_numbers() {
        let info = volume_info("/").unwrap();
        assert!(info.total_bytes > 0);
        assert!(info.free_bytes <= info.total_bytes);
    }

    #[test]
    fn volume_info_errors() {
        assert!(matches!(
            volume_info("relative"),
            Err(AppError::InvalidPath { .. })
        ));
        assert!(matches!(
            volume_info("/definitely/not/here"),
            Err(AppError::NotFound { .. })
        ));
    }
}
