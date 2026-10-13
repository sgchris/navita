use std::path::Path;

/// Directory extensions that Finder treats as a single item (spec 6.5), lowercase.
const PACKAGE_EXTENSIONS: &[&str] = &[
    "app",
    "bundle",
    "framework",
    "plugin",
    "kext",
    "appex",
    "xpc",
    "prefpane",
    "qlgenerator",
    "mdimporter",
    "photoslibrary",
    "musiclibrary",
    "tvlibrary",
    "imovielibrary",
    "fcpbundle",
    "rtfd",
    "pages",
    "numbers",
    "key",
    "xcodeproj",
    "xcworkspace",
    "playground",
    "xcarchive",
    "logicx",
    "band",
    "sparsebundle",
    "pkg",
    "mpkg",
];

/// True if the directory at `path` is a package: a known extension (case-insensitive) or a
/// `Contents/Info.plist` inside. The caller guarantees `path` is a directory.
#[must_use]
pub fn is_package(path: &Path) -> bool {
    has_package_extension(path) || path.join("Contents").join("Info.plist").is_file()
}

#[must_use]
pub fn has_package_extension(path: &Path) -> bool {
    path.extension()
        .and_then(|e| e.to_str())
        .is_some_and(|e| PACKAGE_EXTENSIONS.contains(&e.to_ascii_lowercase().as_str()))
}

#[cfg(test)]
mod tests {
    use super::{has_package_extension, is_package};
    use std::fs;
    use std::path::Path;

    #[test]
    fn known_extensions_are_packages_case_insensitively() {
        assert!(has_package_extension(Path::new("/x/Foo.app")));
        assert!(has_package_extension(Path::new("/x/Foo.APP")));
        assert!(has_package_extension(Path::new("/x/Foo.xcodeproj")));
        assert!(has_package_extension(Path::new("/x/Settings.prefPane")));
        assert!(!has_package_extension(Path::new("/x/Foo.d")));
        assert!(!has_package_extension(Path::new("/x/app")));
    }

    #[test]
    fn app_directory_is_package() {
        let dir = tempfile::tempdir().unwrap();
        let app = dir.path().join("Foo.app");
        fs::create_dir_all(app.join("Contents")).unwrap();
        fs::write(app.join("Contents").join("Info.plist"), b"<plist/>").unwrap();
        assert!(is_package(&app));
    }

    #[test]
    fn generic_bundle_heuristic_uses_info_plist() {
        let dir = tempfile::tempdir().unwrap();
        let bundle = dir.path().join("Thing.custom");
        fs::create_dir_all(bundle.join("Contents")).unwrap();
        assert!(!is_package(&bundle));
        fs::write(bundle.join("Contents").join("Info.plist"), b"<plist/>").unwrap();
        assert!(is_package(&bundle));
    }

    #[test]
    fn plain_directory_is_not_package() {
        let dir = tempfile::tempdir().unwrap();
        let plain = dir.path().join("Projects");
        fs::create_dir(&plain).unwrap();
        assert!(!is_package(&plain));
    }
}
