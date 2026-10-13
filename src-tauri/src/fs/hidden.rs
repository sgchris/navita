use std::fs::Metadata;

/// An entry is hidden if its name starts with `.` or (macOS) the BSD `UF_HIDDEN` flag is set.
///
/// `meta` must come from `symlink_metadata` so the flag of a symlink itself is honoured
/// (this is what hides `/etc`, `/tmp`, `/var`, `~/Library`, ... in Finder).
#[must_use]
pub fn is_hidden(name: &str, meta: Option<&Metadata>) -> bool {
    if name.starts_with('.') {
        return true;
    }
    has_hidden_flag(meta)
}

#[cfg(target_os = "macos")]
fn has_hidden_flag(meta: Option<&Metadata>) -> bool {
    use std::os::macos::fs::MetadataExt;

    meta.is_some_and(|m| m.st_flags() & libc::UF_HIDDEN != 0)
}

#[cfg(not(target_os = "macos"))]
fn has_hidden_flag(_meta: Option<&Metadata>) -> bool {
    false
}

#[cfg(test)]
mod tests {
    use super::is_hidden;
    use std::fs;
    use std::process::Command;

    #[test]
    fn dot_names_are_hidden() {
        assert!(is_hidden(".gitignore", None));
        assert!(is_hidden(".config", None));
        assert!(!is_hidden("notes.txt", None));
        assert!(!is_hidden("a.b", None));
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn uf_hidden_flag_is_detected() {
        let dir = tempfile::tempdir().unwrap();
        let file = dir.path().join("visible-name");
        fs::write(&file, b"x").unwrap();
        let before = fs::symlink_metadata(&file).unwrap();
        assert!(!is_hidden("visible-name", Some(&before)));

        let status = Command::new("chflags")
            .arg("hidden")
            .arg(&file)
            .status()
            .unwrap();
        assert!(status.success());
        let after = fs::symlink_metadata(&file).unwrap();
        assert!(is_hidden("visible-name", Some(&after)));
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn hidden_flag_on_symlink_itself_counts() {
        let dir = tempfile::tempdir().unwrap();
        let target = dir.path().join("target");
        fs::write(&target, b"x").unwrap();
        let link = dir.path().join("link");
        std::os::unix::fs::symlink(&target, &link).unwrap();
        let status = Command::new("chflags")
            .args(["-h", "hidden"])
            .arg(&link)
            .status()
            .unwrap();
        assert!(status.success());
        let meta = fs::symlink_metadata(&link).unwrap();
        assert!(is_hidden("link", Some(&meta)));
    }
}
