use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub enum EntryKind {
    File,
    Directory,
    Package,
    Symlink,
}

#[derive(Debug, Clone, Serialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct Entry {
    /// Display name (file name).
    pub name: String,
    /// Absolute path.
    pub path: String,
    pub kind: EntryKind,
    /// Dot-file OR `UF_HIDDEN` flag.
    pub is_hidden: bool,
    /// True for Directory and for Symlink to a (non-package) directory.
    pub is_dir_like: bool,
    /// Bytes; files only.
    #[ts(type = "number | null")]
    pub size: Option<u64>,
    /// Unix milliseconds.
    #[ts(type = "number | null")]
    pub modified_ms: Option<i64>,
    /// Lowercase, without the dot.
    pub extension: Option<String>,
    pub symlink_target: Option<String>,
    pub is_broken_link: bool,
    pub is_readable: bool,
}

#[derive(Debug, Clone, Serialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct DirListing {
    /// Echoed from the request.
    pub request_id: u32,
    /// Canonical absolute path.
    pub path: String,
    /// `None` at `/`.
    pub parent: Option<String>,
    pub entries: Vec<Entry>,
}

#[derive(Debug, Clone, Serialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct TreeNode {
    pub name: String,
    pub path: String,
    pub is_hidden: bool,
    pub has_children: bool,
    pub has_visible_children: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub enum PlaceKind {
    Home,
    Desktop,
    Documents,
    Downloads,
    Applications,
    Root,
    Volume,
}

#[derive(Debug, Clone, Serialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct Place {
    pub name: String,
    pub path: String,
    pub kind: PlaceKind,
}

#[derive(Debug, Clone, Serialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct VolumeInfo {
    #[ts(type = "number")]
    pub free_bytes: u64,
    #[ts(type = "number")]
    pub total_bytes: u64,
}

/// Frontend state mirrored into the native menu (check marks, enabled flags, labels).
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct MenuState {
    /// `"icons"` or `"list"`.
    pub view_mode: String,
    pub show_hidden: bool,
    /// `"name"`, `"modified"`, `"size"` or `"kind"`.
    pub sort_key: String,
    pub sidebar_visible: bool,
    pub path_bar_visible: bool,
    pub status_bar_visible: bool,
    pub has_selection: bool,
    pub single_selection: bool,
    pub can_back: bool,
    pub can_forward: bool,
    pub can_up: bool,
}
