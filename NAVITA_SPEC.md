# Navita — Product & Technical Specification

> Where this spec and docs/DECISIONS.md differ, DECISIONS.md wins.

> A minimal, fast, native-feeling file browser for macOS, built with Rust + Tauri v2.
> Target: macOS 26 Tahoe (tested on 26.6.x), Apple Silicon first, Intel supported.
> Status: v1 spec, ready for planning and implementation.

---

## 0. How to use this spec (for Claude Code)

1. Read the whole document before writing code. Plan using the milestones in §14; each milestone has acceptance criteria — treat them as the definition of done.
2. **Resolve exact dependency versions at scaffold time**, don't guess: use `cargo add <crate>@<major>` and `npm install <pkg>@<major>`, then commit the lockfiles. §3 lists the majors.
3. Tauri v2 APIs and config keys evolve between minor versions. **Before using any config key or API named here, verify it against the Tauri v2 docs** (https://v2.tauri.app) or the crate's docs.rs page for the resolved version. If a name differs, use the current one and keep the intended behavior.
4. Keep the app **read-mostly** in v1: the only filesystem-mutating features are in the optional milestone (M8). Nothing in v1 deletes, moves, or renames files.
5. When a requirement is ambiguous, prefer **what Finder does**, and note the decision in `docs/DECISIONS.md`.

---

## 1. Goals and non-goals

### Goals
- Browse the local filesystem with a **folder tree on the left** and the **contents of the selected folder on the right**.
- Look and behave like a first-party macOS Tahoe app: system font, system colors, vibrancy sidebar, native menus, native context menus, Finder keyboard conventions, light/dark mode.
- Be **fast**: 10,000-item folders render and scroll smoothly.
- Be **maintainable**: small codebase, strict types end to end, all filesystem logic in Rust with unit tests.

### Non-goals (v1)
- Dual-pane, tabs, multiple windows (stretch).
- File operations: copy/move/rename/delete/new folder (M8 optional covers trash + new folder + rename).
- Network protocols (SFTP, S3, SMB browsing beyond what's mounted under `/Volumes`).
- Search / Spotlight integration, tags, Quick Look previews (stretch).
- Windows/Linux builds (the architecture shouldn't prevent them, but don't test them).
- Mac App Store distribution (we use the macOS private API for window transparency; see §7.1).

---

## 2. Feature list

### 2.1 Required (from the brief)
| # | Feature | Notes |
|---|---------|-------|
| F1 | Folder tree in the left sidebar | Lazy-loaded, expand/collapse, syncs with current folder |
| F2 | Contents of selected folder in the main pane | Two views, switchable: **Icons** (default, virtualized grid) and **List with details** (virtualized, with columns) |
| F3 | Minimal icons per file type | Category-based icon set (§8.4) |
| F4 | Double-click opens with default app | Folders navigate; files and app bundles open via Launch Services |
| F5 | Navigation: Up, Home | Toolbar buttons + shortcuts |
| F6 | Sorting by Name and Date Modified, **folders always first** | Click column headers; ascending/descending |

### 2.2 Added fundamentals (needed for this to feel like a real file browser)
| # | Feature | Why |
|---|---------|-----|
| A1 | Back / Forward history | Every browser-style app has it; Finder's primary navigation |
| A2 | Sidebar **Favorites** (Home, Desktop, Documents, Downloads, Applications) and **Locations** (mounted volumes) | Fast jumps; volumes appear/disappear live |
| A3 | Path bar (clickable breadcrumb) at the bottom | Shows where you are, click any segment to go there |
| A4 | Status bar: item count, selection count, free space on volume | Finder parity |
| A5 | **Show hidden files** switch (toolbar toggle + `⌘⇧.`), **default: off** | Hides items whose name starts with `.` (files and folders), plus items with the macOS `UF_HIDDEN` flag (e.g. `~/Library`). Applies to the file list, icon view, **and** the sidebar folder tree. Persisted |
| A6 | Size and Kind columns (also sortable) | Cheap to add; sorting rules still put folders first |
| A7 | Keyboard navigation and type-to-select | Arrow keys, Finder shortcuts (§9) |
| A8 | Multi-selection (⌘-click, ⇧-click, ⌘A) | Needed for context-menu actions on several items |
| A9 | Native context menu: Open, Reveal in Finder, Copy Path, Get Info (opens Finder's info) | Uses Tauri native menus, not HTML |
| A10 | Live refresh when the current folder changes on disk | `notify` crate (FSEvents backend) |
| A11 | Permission-denied and empty states | With a button to open *Full Disk Access* settings |
| A12 | Persisted state: window size/position, last folder, sort, hidden-files toggle, sidebar width, expanded tree nodes | Feels native on relaunch |
| A13 | Native app menu bar with standard menus and accelerators | Navita / File / Edit / View / Go / Window / Help |
| A14 | Resizable sidebar (splitter) and resizable list columns | Finder parity |
| A15 | **View switch**: *Icons* ⇄ *List (details)*, **default: Icons** (`⌘1` / `⌘2`) | Segmented control in the toolbar + View menu. Same data, sorting, selection and hidden-file filtering in both views; persisted (§8.3, §8.3.1) |

### 2.3 Stretch (post-v1, not in scope unless time allows)
Quick Look on Space, real system file icons (via `NSWorkspace`), filter-as-you-type, multiple windows (`⌘N`), tabs, adjustable icon size slider, drag files out to other apps, Open With submenu.

---

## 3. Tech stack and dependencies

> Only the Tauri version and its Rust requirements were verified on 2026-10-13 (Tauri **2.12.3**, released 2026-10-10, MSRV **1.90**, edition **2024**). For everything else, install the **latest stable release of the listed major** and commit the lockfile.

### 3.1 Toolchain
| Tool | Version |
|------|---------|
| Rust | stable, ≥ 1.90 (via `rustup`), edition 2024 |
| Node.js | current LTS (24.x) |
| Package manager | npm (lockfile committed) |
| Xcode Command Line Tools | latest for macOS 26 |
| Tauri CLI | `@tauri-apps/cli` 2.x (npm devDependency, use `npx tauri …`) |

### 3.2 Rust crates (`src-tauri/Cargo.toml`)
| Crate | Major | Purpose |
|-------|-------|---------|
| `tauri` | 2 (2.12.x) | App runtime. Features: `macos-private-api` (needed for transparent/vibrant window) |
| `tauri-build` | 2 | Build script |
| `tauri-plugin-opener` | 2 | Open files with default app, reveal in Finder |
| `tauri-plugin-window-state` | 2 | Persist window size/position |
| `tauri-plugin-store` | 2 | Persist preferences (JSON store) |
| `serde` (+ `derive`) | 1 | Serialization |
| `serde_json` | 1 | JSON |
| `thiserror` | 2 | Error types |
| `notify` | 8 | Filesystem watching (FSEvents on macOS) |
| `notify-debouncer-full` | latest (0.x) | Debounce/coalesce watch events |
| `dirs` | latest (6.x) | Home and standard folder paths |
| `ts-rs` | latest (10+/11+) | Generate TypeScript types from Rust structs (single source of truth for IPC types) |
| `libc` | 0.2 | `statfs` for free space, `st_flags` constants |
| `tempfile` | 3 | **dev-dependency** — unit tests |

Optional (M8 / stretch only): `trash` (move to Trash), `objc2` + `objc2-app-kit` + `objc2-foundation` (native icons, Quick Look).

### 3.3 Frontend (`package.json`)
| Package | Major | Purpose |
|---------|-------|---------|
| `react`, `react-dom` | 19 | UI |
| `typescript` | latest stable | Strict mode |
| `vite` | latest stable | Dev server & bundler |
| `@vitejs/plugin-react` | latest stable | React plugin |
| `@tauri-apps/api` | 2 | `invoke`, events, window, menu APIs |
| `@tauri-apps/plugin-opener` | 2 | JS bindings (only if needed; prefer calling from Rust) |
| `@tauri-apps/plugin-store` | 2 | Prefs from JS |
| `@tauri-apps/plugin-window-state` | 2 | Only if JS calls are needed |
| `zustand` | 5 | App state |
| `@tanstack/react-virtual` | 3 | Virtualized list & tree |
| `lucide-react` | latest | File-type icons (ISC license) |
| `vitest` | latest stable | Unit tests (sorting, formatting, keyboard reducers) |
| `eslint` (flat config) + `typescript-eslint` + `eslint-plugin-react-hooks` | latest | Lint |
| `prettier` | latest | Formatting |

**No UI component library and no CSS framework.** Native look comes from hand-written CSS using macOS system colors (§8). Generic component kits look like the web, which is exactly what we're avoiding.

### 3.4 Why these choices
- **React + TypeScript + Vite**: the most common Tauri frontend combination; huge ecosystem, easy to hire/AI-assist.
- **zustand**: minimal boilerplate, works outside React (event handlers, menu callbacks).
- **@tanstack/react-virtual**: headless, so it doesn't impose a look.
- **ts-rs**: IPC types are defined once in Rust and exported to `src/api/bindings/`, so the two sides can't drift.
- **All filesystem access in Rust custom commands**: the frontend never gets the `fs` plugin. Smaller attack surface, consistent error handling, testable.

---

## 4. Architecture

```
┌──────────────────────────── Navita.app ───────────────────────────────┐
│  WKWebView (React)                                                     │
│   ├─ components/ (Toolbar, Sidebar, FolderTree, FileList, PathBar…)   │
│   ├─ state/ (zustand stores)                                          │
│   └─ api/ (typed invoke wrappers + ts-rs bindings)                    │
│                 │ invoke()                ▲ events (fs:changed, …)    │
│─────────────────┼─────────────────────────┼───────────────────────────│
│  Rust core (tauri)                                                     │
│   ├─ commands/   thin #[tauri::command] layer, validation              │
│   ├─ fs/         listing, hidden detection, package detection, kinds   │
│   ├─ places      favorites, volumes, free space                        │
│   ├─ watcher     notify + debouncer → emits events                     │
│   ├─ menu        native app menu + context menus                       │
│   └─ plugins     opener, store, window-state                           │
└────────────────────────────────────────────────────────────────────────┘
```

### Principles
- **Rust owns truth about the filesystem**; the frontend owns presentation (sorting, filtering hidden items, formatting). Sorting in the frontend keeps header clicks instant and avoids refetching.
- Listings return **all** entries including hidden ones, flagged with `is_hidden`; toggling hidden files is a pure frontend filter, no refetch.
- All commands are **async** and run blocking I/O on `tauri::async_runtime::spawn_blocking` so the UI thread never stalls (slow network volumes, huge folders).
- Every listing request carries a **request id**; the frontend ignores responses for anything but the latest request (fast clicking must never show a stale folder).

---

## 5. Project structure

```
navita/
├─ CLAUDE.md                     # short pointer to this spec + conventions
├─ NAVITA_SPEC.md                # this file
├─ docs/DECISIONS.md             # decisions log
├─ package.json  vite.config.ts  tsconfig.json  eslint.config.js  .prettierrc
├─ index.html
├─ src/
│  ├─ main.tsx  App.tsx
│  ├─ api/
│  │  ├─ bindings/               # ts-rs generated — do not edit
│  │  ├─ commands.ts             # typed invoke wrappers
│  │  └─ events.ts               # typed event listeners
│  ├─ state/
│  │  ├─ navigation.ts           # current path, history, back/forward
│  │  ├─ listing.ts              # entries of current folder, loading/error, request ids
│  │  ├─ selection.ts            # selected paths, anchor, focus row
│  │  ├─ tree.ts                 # expanded nodes, children cache
│  │  └─ prefs.ts                # viewMode, sort, showHidden, sidebarWidth, columns (persisted)
│  ├─ components/
│  │  ├─ Toolbar.tsx  ViewSwitch.tsx  HiddenToggle.tsx  Sidebar.tsx  SidebarSection.tsx  FolderTree.tsx  TreeRow.tsx
│  │  ├─ FileList.tsx  FileRow.tsx  ColumnHeader.tsx  IconGrid.tsx  IconCell.tsx  PathBar.tsx  StatusBar.tsx
│  │  ├─ Splitter.tsx  EmptyState.tsx  ErrorState.tsx  FileIcon.tsx
│  ├─ lib/
│  │  ├─ sort.ts                 # comparator (pure, unit-tested)
│  │  ├─ format.ts               # size/date/kind formatting (pure, unit-tested)
│  │  ├─ fileTypes.ts            # extension → category → icon + kind label
│  │  ├─ keyboard.ts             # shortcut handling, type-to-select buffer
│  │  └─ platform.ts             # window focus state, etc.
│  └─ styles/
│     ├─ tokens.css              # colors, sizes, radii (system colors)
│     └─ base.css                # resets, native-feel rules (§8.6)
└─ src-tauri/
   ├─ Cargo.toml  build.rs  tauri.conf.json  Info.plist
   ├─ capabilities/default.json
   ├─ icons/                     # placeholder until the logo exists
   └─ src/
      ├─ main.rs                 # calls navita_lib::run()
      ├─ lib.rs                  # builder, plugins, commands, menu, state
      ├─ error.rs                # AppError (serializable)
      ├─ model.rs                # Entry, DirListing, TreeNode, Place… (#[derive(TS)])
      ├─ commands/{mod.rs, fs.rs, open.rs, places.rs, watch.rs}
      ├─ fs/{mod.rs, listing.rs, hidden.rs, package.rs, kind.rs}
      ├─ places.rs
      ├─ watcher.rs
      └─ menu.rs
```

---

## 6. Rust core

### 6.1 Data model (`model.rs`, exported to TS via `ts-rs`)

```rust
#[derive(Serialize, TS)] #[serde(rename_all = "camelCase")]
pub enum EntryKind { File, Directory, Package, Symlink }

#[derive(Serialize, TS)] #[serde(rename_all = "camelCase")]
pub struct Entry {
    pub name: String,            // display name (file name)
    pub path: String,            // absolute path
    pub kind: EntryKind,
    pub is_hidden: bool,         // dot-file OR UF_HIDDEN flag
    pub is_dir_like: bool,       // true for Directory, and Symlink→directory (not Package)
    pub size: Option<u64>,       // bytes, files only; None for dirs
    pub modified_ms: Option<i64>,// unix ms; None if unavailable
    pub extension: Option<String>, // lowercase, no dot
    pub symlink_target: Option<String>, // for symlinks
    pub is_broken_link: bool,
    pub is_readable: bool,
}

pub struct DirListing {
    pub request_id: u32,         // echoed from the request
    pub path: String,            // canonical absolute path
    pub parent: Option<String>,  // None at "/"
    pub entries: Vec<Entry>,
}

pub struct TreeNode { pub name: String, pub path: String, pub is_hidden: bool, pub has_children: bool }

pub struct Place { pub name: String, pub path: String, pub kind: PlaceKind } // Home, Desktop, Documents, Downloads, Applications, Volume, Root

pub struct VolumeInfo { pub free_bytes: u64, pub total_bytes: u64 }
```

`size`/`modified_ms` are `Option` so a single unreadable entry never fails the whole listing.

### 6.2 Errors (`error.rs`)

```rust
#[derive(Debug, thiserror::Error, Serialize, TS)]
#[serde(tag = "code", rename_all = "camelCase")]
pub enum AppError {
    NotFound { path: String },
    PermissionDenied { path: String },
    NotADirectory { path: String },
    InvalidPath { path: String },
    Io { path: String, message: String },
}
```
Map `std::io::ErrorKind` → variant. The frontend switches on `code` to show the right state (§8.8).

### 6.3 Commands (`commands/*.rs`)

| Command | Signature | Behavior |
|---------|-----------|----------|
| `list_dir` | `(path: String, request_id: u32) -> Result<DirListing, AppError>` | Canonicalize; read entries via `read_dir`; per entry use `symlink_metadata` then `metadata` for symlink targets; never follow symlinks recursively. Unreadable entries get `None` fields, not an error |
| `list_subdirs` | `(path: String) -> Result<Vec<TreeNode>, AppError>` | Directory children only (incl. symlinks to dirs, excluding packages). `has_children` via a cheap peek (§6.6) |
| `open_path` | `(path: String) -> Result<(), AppError>` | Open with default app via `tauri_plugin_opener` (`app.opener().open_path(path, None::<&str>)`). Works for files and `.app` bundles |
| `reveal_in_finder` | `(paths: Vec<String>)` | `app.opener().reveal_item_in_dir(…)` |
| `get_info` | `(path: String)` | Optional: run AppleScript `tell application "Finder" to open information window of (POSIX file …)`; if this proves flaky, drop it from the context menu |
| `copy_paths` | — | Done in frontend via `navigator.clipboard.writeText` (newline-separated); no command needed |
| `places` | `() -> Vec<Place>` | Favorites that exist on disk + `/` ("Macintosh HD") + mounted volumes from `/Volumes` (skip the symlink pointing to `/`) |
| `volume_info` | `(path: String) -> VolumeInfo` | `libc::statfs` on the path |
| `home_dir` | `() -> String` | `dirs::home_dir()` |
| `watch_dir` | `(path: String)` | Replace the current watch (§6.7) |
| `open_full_disk_access_settings` | `()` | Opens `x-apple.systempreferences:com.apple.preference.security?Privacy_AllFiles` via opener |

All path inputs: must be absolute, are canonicalized (`std::fs::canonicalize`), and errors are mapped to `AppError`. No command accepts a glob or relative path.

### 6.4 Hidden detection (`fs/hidden.rs`)
An entry is hidden if **either**:
1. Name starts with `.`, or
2. The BSD `UF_HIDDEN` flag is set: `std::os::macos::fs::MetadataExt::st_flags() & libc::UF_HIDDEN != 0` (this is what hides `~/Library`, `/bin`, `/usr`, etc. in Finder).

Gate the flag check with `#[cfg(target_os = "macos")]`.

### 6.5 Package detection (`fs/package.rs`)
A directory is a **Package** (shown and opened as a single file, like Finder) if:
- Its extension is in a known list: `app, bundle, framework, plugin, kext, appex, xpc, prefPane, qlgenerator, mdimporter, photoslibrary, musiclibrary, tvlibrary, imovielibrary, fcpbundle, rtfd, pages, numbers, key, xcodeproj, xcworkspace, playground, xcarchive, logicx, band, sparsebundle, pkg, mpkg`, **or**
- It contains `Contents/Info.plist` (generic bundle heuristic).

Double-click on a Package → `open_path` (launches app / opens document). Packages are excluded from the tree. A context-menu "Show Package Contents" is a stretch item.

### 6.6 Tree `has_children` peek
For each child directory, open `read_dir` and stop at the **first** entry that is a non-package directory → `true`. Cap work: at most 256 entries examined per child; if the cap is hit without finding one, return `true` (show the disclosure; the user expanding it will resolve). Permission errors → `true` (expanding will show the error inline). Run with `rayon`-free simple iteration inside `spawn_blocking`; if profiling shows it's slow for big folders, parallelize later.

### 6.7 Watcher (`watcher.rs`)
- One `notify-debouncer-full` debouncer stored in managed state (`Mutex<Option<Debouncer>>`), debounce **250 ms**.
- `watch_dir(path)` unwatches the previous path and watches the new one **non-recursively**.
- Additionally watch `/Volumes` non-recursively for the whole app lifetime (mount/unmount).
- On events, emit to the frontend:
  - `fs:changed` with `{ path: String }` (the watched folder) → frontend refetches the listing and refreshes that tree node's children if expanded.
  - `volumes:changed` → frontend refetches `places`.
- If the watched folder itself is deleted or renamed, emit `fs:changed`; the refetch returns `NotFound` and the frontend navigates to the nearest existing ancestor.

### 6.8 Performance targets
| Scenario | Target |
|----------|--------|
| `list_dir` of 10,000 entries (local SSD) | < 150 ms in Rust, < 300 ms to first paint |
| Header click to resort 10,000 entries | < 50 ms |
| Scrolling a 10,000-row list | 60 fps, no blank rows |
| Scrolling a 10,000-item icon grid; switching Icons ⇄ List | 60 fps, no blank cells; switch < 100 ms (no refetch) |
| Toggling hidden files in a 10,000-item folder | < 50 ms (pure frontend filter) |
| Cold app launch to first listing | < 1 s |

Add a Rust test that creates 10,000 temp files and asserts listing completes (no strict timing in CI; log the duration).

---

## 7. Tauri configuration

### 7.1 `tauri.conf.json` (key parts — verify key names against the resolved Tauri version)

```json
{
  "productName": "Navita",
  "identifier": "com.sgchris.navita",
  "version": "0.1.0",
  "build": {
    "beforeDevCommand": "npm run dev",
    "beforeBuildCommand": "npm run build",
    "devUrl": "http://localhost:1420",
    "frontendDist": "../dist"
  },
  "app": {
    "macOSPrivateApi": true,
    "withGlobalTauri": false,
    "windows": [
      {
        "label": "main",
        "title": "Navita",
        "width": 1100, "height": 700,
        "minWidth": 640, "minHeight": 400,
        "titleBarStyle": "Overlay",
        "hiddenTitle": true,
        "trafficLightPosition": { "x": 20, "y": 24 },
        "transparent": true,
        "windowEffects": { "effects": ["sidebar"], "state": "followsWindowActiveState" },
        "dragDropEnabled": false
      }
    ],
    "security": {
      "csp": "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src ipc: http://ipc.localhost"
    }
  },
  "bundle": {
    "active": true,
    "targets": ["app", "dmg"],
    "category": "public.app-category.utilities",
    "macOS": { "minimumSystemVersion": "13.0", "signingIdentity": "-" },
    "icon": ["icons/32x32.png", "icons/128x128.png", "icons/128x128@2x.png", "icons/icon.icns"]
  }
}
```

Notes:
- `macOSPrivateApi: true` + Cargo feature `macos-private-api` are required for `transparent` windows. This rules out the Mac App Store, which is fine.
- `signingIdentity: "-"` = ad-hoc signing. It lets macOS remember privacy (TCC) permissions between rebuilds better than an unsigned binary. See §13 for proper signing.
- `trafficLightPosition` should vertically center the traffic lights in the 52 px toolbar (§8.2). Tune by eye.
- Set `minimumSystemVersion` to 13.0 for broader support; design and test only on 26.

### 7.2 Capabilities (`capabilities/default.json`)
Grant the minimum:
- `core:default`
- `core:window:allow-start-dragging` (toolbar drag region)
- `core:menu:default` (context menus from JS) — or build all menus in Rust and skip this
- `opener:default` is **not** needed if opening is done only from Rust commands; keep the JS side without opener permissions.
- `store:default`, `window-state:default`

**Do not** add the `fs` plugin. Custom commands are the only filesystem access.

### 7.3 `Info.plist` (merged automatically by Tauri from `src-tauri/Info.plist`)
Purpose strings for the privacy prompts macOS shows when browsing protected folders:
```xml
<key>NSDesktopFolderUsageDescription</key><string>Navita shows the contents of your Desktop folder.</string>
<key>NSDocumentsFolderUsageDescription</key><string>Navita shows the contents of your Documents folder.</string>
<key>NSDownloadsFolderUsageDescription</key><string>Navita shows the contents of your Downloads folder.</string>
<key>NSRemovableVolumesUsageDescription</key><string>Navita shows the contents of external drives.</string>
<key>NSNetworkVolumesUsageDescription</key><string>Navita shows the contents of network volumes.</string>
<key>NSAppleEventsUsageDescription</key><string>Navita asks Finder to show the Get Info window for a selected item.</string>
```
The app is **not sandboxed** (a sandboxed file browser can't browse freely).

---

## 8. UI and visual design (macOS 26 Tahoe native look)

Tahoe uses the "Liquid Glass" design: a floating, inset translucent sidebar with large rounded corners, a unified toolbar with grouped capsule controls, and softer, larger corner radii. A webview can't render real Liquid Glass, so we approximate it with the native **sidebar vibrancy** material behind a transparent sidebar region, plus CSS for shapes. The goal is that a Mac user doesn't notice it's a web app at a glance.

### 8.1 Layout

```
┌───────────────────────────────────────────────────────────────────────┐
│ ●●●   [‹ ›]  [↑] [⌂]   Documents        [▦|☰]  [👁]                   │ ← toolbar 52px (drag region); right: view switch, hidden toggle
├──────────────────┬────────────────────────────────────────────────────┤
│ ╭──────────────╮ │ Name ▲                Date Modified     Size  Kind │ ← column header 28px
│ │ Favorites    │ │ 📁 Projects            Today at 10:02     --   Folder
│ │  ⌂ Home      │ │ 📁 Receipts            Yesterday at 18:40 --   Folder
│ │  ▭ Desktop   │ │ 📄 notes.md            3 Oct 2026 09:12  4 KB  Markdown
│ │  …           │ │ …                                              │
│ │ Locations    │ │                                                │
│ │  ⛁ Macintosh │ │                                                │
│ │ Folders      │ │                                                │
│ │  ▾ Users     │ │                                                │
│ │    ▾ greg    │ │                                                │
│ │      ▸ Docs  │ │                                                │
│ ╰──────────────╯ ├────────────────────────────────────────────────────┤
│                  │ Macintosh HD › Users › greg › Documents            │ ← path bar 24px
│                  │ 42 items, 1 selected, 312 GB available             │ ← status bar 22px
└──────────────────┴────────────────────────────────────────────────────┘
```

- **Sidebar** (left, default 240 px, min 180, max 400, resizable via a 6 px invisible splitter): floating inset panel, 8 px margin from window edges, 16 px corner radius, transparent background showing window vibrancy, a faint 1 px border (`--separator` at ~50%) and soft shadow. It extends **under the toolbar** to the top of the window (traffic lights sit on top of it), as in Tahoe Finder.
- Sidebar sections: **Favorites**, **Locations**, **Folders** (the tree, rooted at `/` shown as the startup volume name "Macintosh HD"). Section headers: 11 px, semibold, secondary label color; hover shows a "Hide/Show" toggle to collapse the section (persisted).
- **Content area** (right): opaque `--content-bg`. Toolbar area above the list belongs to the content side.
- The folder tree auto-expands to and highlights the current folder whenever navigation happens from anywhere (list, path bar, history, favorites), and scrolls it into view.

### 8.2 Toolbar
- Height 52 px, entire empty area is a drag region (`data-tauri-drag-region`); double-click on it zooms the window (call `window.toggleMaximize()` — Finder behavior per System Settings "double-click a window's title bar to: Zoom").
- Left (after traffic lights, aligned with the sidebar's right edge when sidebar is visible): a **capsule group** with Back ‹ and Forward ›, then separate capsule buttons for **Up** (`arrow.up` style) and **Home**.
- Center-left: current folder name, 15 px semibold (Tahoe toolbar title style).
- Right side, in order:
  - **View switch**: a two-segment capsule control, *Icons* (`LayoutGrid`) | *List* (`List`), exactly one segment selected (accent-tinted when active). **Default: Icons.** Tooltips: "as Icons (⌘1)", "as List (⌘2)". Persisted as `viewMode`.
  - **Show Hidden Files toggle**: a single capsule toggle button (`Eye` when on, `EyeOff` when off); pressed state = accent-tinted fill. **Default: off.** Tooltip: "Show Hidden Files (⇧⌘.)". Mirrors the View-menu checkmark and the `⌘⇧.` shortcut; persisted as `showHidden`.
- Buttons: 32 px tall capsules, translucent fill (`--control-bg`), icon 16 px, disabled state at 30% opacity, hover = slightly darker fill, active = darker still. No pointer cursor.
- Tooltips via the `title` attribute, including the shortcut (e.g. "Back (⌘[)").

### 8.3 List view — "List with details" (main pane)
Shown when `viewMode = 'list'`.
- Columns: **Name** (flex, min 200), **Date Modified** (180), **Size** (80, right-aligned), **Kind** (140). Columns resizable by dragging header dividers; widths persisted.
- Row height **24 px**, font 13 px. Icon 16 px with 6 px gap before the name. Long names truncate in the middle like Finder (`report-final-…-v3.pdf`): implement middle truncation in JS for the Name column (measure with a canvas, cache per width).
- Alternating row backgrounds **off** (Tahoe Finder default).
- Header: 28 px, 11 px semibold secondary label; the sorted column shows a small chevron (up/down). Click toggles direction; clicking a different column selects it with its default direction (Name: ascending; Date Modified: descending, newest first; Size: descending; Kind: ascending).
- Selection: rounded rectangle (6 px radius) inset 8 px from list edges. Focused list: `--selection-bg` (accent) with white text. Unfocused list or inactive window: `--selection-bg-unemphasized` (gray) with normal text.
- Hidden items (when shown) render at 50% opacity, like Finder.
- Symlinks show a tiny arrow badge on the icon (bottom-left). Broken symlinks at 50% opacity with a "Broken alias" kind.
- Empty space click deselects. Rubber-band (marquee) selection is a stretch item.
- Virtualized with `@tanstack/react-virtual`; overscan 10 rows.

### 8.3.1 Icons view (main pane, **default**)
Shown when `viewMode = 'icons'`. Same entries, same sort (§12), same hidden-file filter, same selection store and same context menu as the List view; only the layout differs.
- **Grid** of cells, flowing left-to-right, top-to-bottom, wrapping to the pane width. Cell: 96 px wide × 96 px tall, 12 px gap, 16 px content padding. Column count is recomputed on resize (`ResizeObserver`).
- Each cell: icon centered at **48 px** (same category icons as §8.4, scaled; symlink badge and 50% opacity for hidden/broken items apply), name below in 12 px, centered, **up to 2 lines**, middle-truncated when it doesn't fit. A selected cell shows a rounded (8 px radius) accent highlight behind the icon and a rounded accent pill behind the name, like Finder; unfocused/inactive uses the unemphasized gray.
- **Sorting still applies**: the sort key/direction chosen in the List-view headers (or View ▸ Sort By) orders the grid; folders first in both directions. Since the grid has no column headers, sort is changed via View ▸ Sort By and the empty-space context menu.
- Virtualized **by row** with `@tanstack/react-virtual` (each virtual row renders N cells); overscan 4 rows.
- Keyboard: ←/→ move by one cell, ↑/↓ move by one grid row (⇧ extends); type-to-select, Space/⌘↓/⌘O/Esc work as in List view (§9.2).
- Double-click, ⌘/⇧-click, right-click and empty-space-click-to-deselect behave exactly as in the List view (§9.1).
- Switching views preserves selection, focus item and scroll position (scrolls the focus item into view if the offsets don't map exactly).

### 8.3.2 Hidden files (applies to all views and the tree)
- **Default: `showHidden = false`.** When off, any entry with `isHidden` is excluded from the Icons view, List view, status-bar item count, type-to-select, select-all, and the sidebar folder tree.
- `isHidden` = name starts with `.` (file or folder) **or** the macOS `UF_HIDDEN` flag (§6.4). The dot-prefix rule is the one the user sees; the flag rule is kept for Finder parity (e.g. `~/Library`).
- When on, hidden items appear at 50% opacity (§8.3).
- Toggling is a pure frontend filter (no refetch). The selection is pruned of items that become hidden. The tree re-filters its cached `TreeNode`s by `isHidden`.
- If the *current folder itself* is hidden (user navigated into `~/.config` via path bar or history) it stays visible in the path bar and tree even when the toggle is off.

### 8.4 Icons (minimal, category-based)
Use `lucide-react` at 16 px, stroke 1.75, colored per category (subtle tints, adapt to dark mode). Folders use a **filled** folder glyph in the system blue tint to match Finder's folder color.

| Category | Extensions (non-exhaustive, keep in `fileTypes.ts`) | Icon | Kind label |
|----------|------------------------------------------------------|------|------------|
| Folder | — | `Folder` (filled, blue) | Folder |
| Application | `app` | `AppWindow` | Application |
| Image | png jpg jpeg gif heic heif webp tiff bmp svg raw cr2 nef dng | `FileImage` | "PNG image" etc. |
| Video | mp4 mov m4v mkv avi webm | `FileVideo` | "MPEG-4 movie" etc. |
| Audio | mp3 m4a aac wav flac aiff ogg | `FileAudio` | "MP3 audio" |
| PDF | pdf | `FileText` (red tint) | PDF document |
| Text / Markdown | txt md rtf log csv tsv | `FileText` | "Plain text" / "Markdown" |
| Code | rs ts tsx js jsx json toml yaml yml py go rb swift c h cpp java kt sh zsh html css xml sql | `FileCode` | "Rust source" etc. (fallback: "<EXT> file") |
| Archive | zip tar gz tgz bz2 xz 7z rar | `FileArchive` | "ZIP archive" |
| Disk image | dmg iso img sparsebundle | `HardDrive` | Disk image |
| Document | doc docx pages odt | `FileText` (blue tint) | Document |
| Spreadsheet | xls xlsx numbers ods | `FileSpreadsheet` (green tint) | Spreadsheet |
| Presentation | ppt pptx key odp | `Presentation` (orange tint) | Presentation |
| Package (other) | per §6.5 | `Package` | "<EXT> package" |
| Unknown | — | `File` | "<EXT> file" or "Document" if no extension |

### 8.5 Colors, typography, spacing (`styles/tokens.css`)
WebKit exposes macOS system colors as CSS keywords. Use them with fallbacks so the app follows the user's accent color and light/dark appearance automatically:

```css
:root {
  color-scheme: light dark;
  --font-ui: -apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif;
  --font-size: 13px;

  --label:            -apple-system-label;
  --label-secondary:  -apple-system-secondary-label;
  --label-tertiary:   -apple-system-tertiary-label;
  --separator:        -apple-system-separator;
  --accent:           -apple-system-control-accent;              /* fallback: AccentColor */
  --selection-bg:     -apple-system-selected-content-background;
  --selection-bg-unemphasized: -apple-system-unemphasized-selected-content-background;
  --selection-text:   -apple-system-alternate-selected-control-text;
  --content-bg:       -apple-system-text-background;              /* list background */
  --control-bg:       color-mix(in srgb, var(--label) 7%, transparent);
  --control-bg-hover: color-mix(in srgb, var(--label) 11%, transparent);

  --radius-panel: 16px;  --radius-control: 999px;  --radius-row: 6px;
  --row-height: 24px;    --sidebar-row-height: 28px;  --toolbar-height: 52px;
}
```
Verify each `-apple-system-*` keyword renders in the Tahoe WKWebView during M0; replace any that don't with `prefers-color-scheme` light/dark values sampled from Finder.

Typography: everything 13 px except section headers (11 px semibold), toolbar title (15 px semibold), status/path bar (11 px). Use `font-variant-numeric: tabular-nums` for Size and Date columns.

### 8.6 Native-feel rules (`styles/base.css` + JS) — **mandatory**
1. `user-select: none` everywhere except text inputs; no text cursor over labels.
2. `cursor: default` everywhere; never a pointer/hand cursor on buttons or rows.
3. No visible web focus rings (`outline: none`); keyboard focus is expressed through selection emphasis, like Finder.
4. Disable the default webview context menu (`contextmenu` → `preventDefault`) and show native menus instead.
5. Disable browser shortcuts in production: reload (`⌘R`), find (`⌘F`), zoom (`⌘+/⌘-/⌘0`), back via swipe-history; disable pinch-zoom (`touch-action: none` on root, `gesturestart` preventDefault).
6. `html, body { overflow: hidden; overscroll-behavior: none }`; only the list and tree scroll, with native elastic scrolling inside them.
7. `-webkit-user-drag: none` on images and icons; no ghost-image dragging (until drag-out is implemented).
8. Overlay scrollbars only (default in WKWebView when the system setting is "automatic"); don't style scrollbars.
9. Window inactive state: listen to the Tauri window focus event; add `.window-inactive` to `<html>` → selection becomes unemphasized, toolbar icons dim to tertiary label color.
10. Animations: only where macOS animates — disclosure triangle rotation (150 ms ease-out) and sidebar section collapse. Respect `prefers-reduced-motion`.
11. No flash of white on launch: set `body` background to transparent and content area color via CSS before React mounts; show the window only after first paint if a flash appears (`visible: false` + `window.show()` after mount).

### 8.7 Dark mode
Follows the system automatically via system color keywords and `color-scheme`. Icon tints come from a light and a dark palette in `tokens.css` under `@media (prefers-color-scheme: dark)`.

### 8.8 Empty, loading and error states
- **Loading**: show nothing for the first 150 ms (avoid flicker); after that, a small native-style spinner centered in the list.
- **Empty folder**: centered tertiary-label text "Folder is empty" (or "No visible items — 3 hidden items" if hidden files are off and hidden items exist, with a "Show Hidden Files" link-style button).
- **Permission denied**: icon + "Navita doesn't have permission to view this folder." + button "Open Privacy Settings…" (→ `open_full_disk_access_settings`) + secondary "Go Back".
- **Not found** (folder deleted while viewing): navigate silently to the nearest existing ancestor and show a transient status-bar message.
- Tree nodes that fail to expand show a single dimmed child row "Can't open folder".

---

## 9. Interaction and keyboard

### 9.1 Mouse
| Action | Result |
|--------|--------|
| Single-click row | Select (replace) |
| ⌘-click / ⇧-click | Toggle / range-extend selection |
| Double-click folder | Navigate into it |
| Double-click file / package / app | `open_path` (default app). Multiple selected → open each |
| Right-click row | Select it if not selected, then native context menu |
| Click tree row | Navigate to that folder (sidebar semantics: single click) |
| Click disclosure triangle | Expand/collapse without navigating |
| ⌥-click disclosure | Expand/collapse that node only, no recursion in v1 (reserved) |
| Click path-bar segment | Navigate there |
| Mouse back/forward buttons, two-finger swipe | Back / Forward (swipe: stretch) |

### 9.2 Keyboard (Finder conventions)
| Shortcut | Action |
|----------|--------|
| ↑ / ↓ | Move selection (⇧ to extend) |
| ⌘↓ / ⌘O | Open selection (enter folder or open file) |
| ⌘↑ | Enclosing folder (Up); select the folder we came from |
| ⌘[ / ⌘] | Back / Forward |
| ⌘⇧H | Home |
| ⌘⇧D / ⌘⇧O / ⌘⌥L / ⌘⇧A | Desktop / Documents / Downloads / Applications |
| ⌘⇧. | Toggle hidden files (default off) |
| ⌘1 / ⌘2 | View as Icons (default) / View as List (details) |
| ⌘A | Select all |
| Esc | Deselect all |
| ⌘⌥C | Copy path(s) of selection |
| ⌘R | Reveal selection in Finder (Navita has no other use for ⌘R) |
| ⌘⌥S | Toggle sidebar |
| ⌘⌥P | Toggle path bar |
| ⌘/ | Toggle status bar |
| Tab / ⇧Tab | Move focus between sidebar tree and file list |
| ← / → (in tree) | Collapse/go to parent · expand/go to first child |
| Type letters | Type-to-select: buffer resets after 1 s idle; selects first item whose name starts with buffer (case-insensitive, collator-based) |
| Return | Reserved for rename (M8); does nothing in v1 |
| ⌘W / ⌘Q / ⌘M / ⌘H | Close window / Quit / Minimize / Hide (from native menu) |

All shortcuts are registered as **native menu accelerators** (§10) so they appear in menus and work like a native app; the frontend receives menu events and dispatches actions. Arrow keys, type-to-select, Tab and Esc are handled in the frontend.

### 9.3 Navigation semantics
- History is a list of paths + an index; navigating to a new folder truncates forward history. Max 100 entries.
- Each history entry stores the selection and scroll offset; Back/Forward restores them.
- Going Up selects the child folder you came from and scrolls it into view.
- Selection is preserved across live refreshes by path; if the selected item disappears, select the next item in sort order.

---

## 10. Native menus

Built in Rust (`menu.rs`) with Tauri's menu API; item clicks emit a `menu` event with an action id that the frontend handles (or Rust handles directly for window actions).

- **Navita**: About Navita, Settings… (disabled in v1), Services, Hide Navita ⌘H, Hide Others ⌥⌘H, Show All, Quit Navita ⌘Q
- **File**: Open ⌘O, Reveal in Finder ⌘R, Copy Path ⌥⌘C, Close Window ⌘W *(M8 adds New Folder ⇧⌘N, Rename, Move to Trash ⌘⌫)*
- **Edit**: Undo/Redo (disabled), Cut/Copy/Paste (standard items, so text fields work), Select All ⌘A
- **View**: as Icons ⌘1 (checked by default), as List ⌘2 (radio pair, checkmark synced with the toolbar switch), Show/Hide Hidden Files ⇧⌘. (unchecked by default), Show/Hide Sidebar ⌥⌘S, Show/Hide Path Bar ⌥⌘P, Show/Hide Status Bar ⌘/, Sort By ▸ (Name, Date Modified, Size, Kind — checkmarks), Enter Full Screen ⌃⌘F
- **Go**: Back ⌘[, Forward ⌘], Enclosing Folder ⌘↑, Home ⇧⌘H, Desktop ⇧⌘D, Documents ⇧⌘O, Downloads ⌥⌘L, Applications ⇧⌘A
- **Window**: Minimize ⌘M, Zoom, Bring All to Front
- **Help**: Navita on GitHub (opens repo URL)

Menu check states (view mode, hidden files, sort) are kept in sync from the frontend via a `set_menu_state` command or by rebuilding the menu.

**Context menu** (native, built per-click): Open · Open in New Window *(stretch, omit)* · — · Reveal in Finder · Copy Path · Get Info · — · *(M8: Rename…, Move to Trash)*. For a click on empty space: View ▸ (as Icons, as List), Show/Hide Hidden Files, Sort By ▸.

---

## 11. State management (frontend)

zustand stores (each small, typed, with selectors):

- **navigation**: `currentPath`, `history[]`, `historyIndex`, actions `navigate(path, {pushHistory, selectChild})`, `back()`, `forward()`, `up()`, `home()`.
- **listing**: `entries`, `status: 'idle'|'loading'|'ready'|'error'`, `error?: AppError`, `latestRequestId`; `load(path)` increments the id, calls `list_dir`, ignores stale responses, then calls `watch_dir`.
- **selection**: `selected: Set<string>`, `anchor`, `focusIndex`; pure reducers for click / shift-click / cmd-click / arrows (unit-tested).
- **tree**: `expanded: Set<string>`, `children: Map<string, TreeNode[] | 'loading' | AppError>`; `expand(path)`, `collapse(path)`, `revealPath(path)` (expands every ancestor, loading as needed).
- **prefs** (persisted via `plugin-store`, debounced 300 ms): `viewMode: 'icons' | 'list'` (default `'icons'`), `sort: {key, dir}`, `showHidden` (default `false`), `sidebarWidth`, `sidebarVisible`, `pathBarVisible`, `statusBarVisible`, `columnWidths`, `collapsedSections`, `lastPath`, `expandedTreePaths`.

Derived data (sorted + filtered entries) is computed with `useMemo` from `entries`, `sort`, `showHidden`. Both views consume the same derived array; `viewMode` only selects the renderer (`IconGrid` vs `FileList`).

On launch: restore `lastPath` (fall back to Home if missing), restore expanded tree paths that still exist, then reveal the current path in the tree.

---

## 12. Sorting and formatting rules (`lib/sort.ts`, `lib/format.ts`)

### 12.1 Sort
- **Group first**: `isDirLike` entries (directories and symlinks to directories; *not* packages, *not* `.app`) always come before everything else, **in both ascending and descending order**. Within each group the selected key applies.
- **Name**: `Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })` — natural order (`file2` < `file10`), case-insensitive, locale-aware; tie-break with a case-sensitive compare, then by path. This closely matches Finder's `localizedStandardCompare`.
- **Date Modified**: by `modifiedMs`; `null` sorts last; tie-break by name ascending.
- **Size**: files by `size`; directories have no size, so within the folder group sort by name; `null` last.
- **Kind**: by kind label (collator), tie-break by name.
- The same comparator and the same `sort` pref drive both the List and Icons views.
- Sorting is stable and deterministic. Unit-test each rule, including folders-first in descending order and natural number ordering.

### 12.2 Formatting
- **Size**: decimal units like Finder (1 KB = 1000 B): `Zero bytes`, `512 bytes`, `4 KB`, `1.2 MB`, `3.45 GB` (Finder-style rounding: KB no decimals, MB 1 decimal, GB+ 2 decimals). Directories show `--`.
- **Date**: "Today at 14:02", "Yesterday at 18:40", otherwise `Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' })`. Use the user's locale and 12/24h preference (default `Intl` behavior). Missing dates show `--`.
- **Kind**: from `fileTypes.ts` (§8.4).
- **Free space** (status bar): "312.4 GB available".

---

## 13. Security, privacy, signing, distribution

- **No `fs` plugin**; all filesystem access via audited custom commands taking absolute, canonicalized paths.
- Strict CSP (§7.1); no remote content; `withGlobalTauri: false`.
- The app never executes files except through Launch Services (`open_path`), and only on explicit user action (double-click / ⌘O / menu).
- **Privacy prompts (TCC)**: browsing Desktop/Documents/Downloads/external drives triggers a one-time macOS prompt with the purpose strings from §7.3. Some folders (e.g. `~/Library/Mail`, other users' homes) require Full Disk Access; show the permission state with the settings button (§8.8).
- **Local builds**: ad-hoc signed (`signingIdentity: "-"`). Note in the README that macOS may re-ask permissions after rebuilds because the code signature changes.
- **Sharing builds** (optional, M7): sign with a Developer ID Application certificate and notarize (requires an Apple Developer account, $99/year). Tauri's bundler supports this via `APPLE_SIGNING_IDENTITY`, `APPLE_ID`, `APPLE_PASSWORD` (app-specific), `APPLE_TEAM_ID` env vars — verify current variable names in the Tauri distribution docs. Without notarization, others must right-click → Open or allow it in Privacy & Security.

---

## 14. Milestones and acceptance criteria

### M0 — Scaffold and native window shell
- `npm create tauri-app@latest` (React + TypeScript + Vite template), rename to Navita, set identifier.
- Cargo features (`macos-private-api`), plugins registered (opener, store, window-state), capabilities trimmed (§7.2), CSP set.
- Overlay title bar, traffic lights positioned, sidebar vibrancy visible, toolbar drag region works, double-click toolbar zooms.
- ESLint + Prettier + `cargo fmt` + `cargo clippy -D warnings` configured; `npm run lint`, `npm test`, `cargo test` scripts.
- `ts-rs` export wired (types written to `src/api/bindings/` by `cargo test`).
- Verify every `-apple-system-*` color keyword (§8.5) in the WKWebView; document results in DECISIONS.md.
- **Done when**: `npx tauri dev` shows an empty Navita window that's indistinguishable in chrome from a native Tahoe app (traffic lights, vibrancy, light/dark switching live), and all lint/test scripts pass.

### M1 — Rust filesystem core
- `model.rs`, `error.rs`, `fs/*`, commands `list_dir`, `list_subdirs`, `home_dir`, `places`, `volume_info`.
- Hidden detection incl. `UF_HIDDEN`; package detection; symlink and broken-link handling; per-entry metadata failures don't fail the listing.
- **Tests** (with `tempfile`): normal listing; hidden dot-files; `UF_HIDDEN` (set with `chflags hidden` via `std::process::Command` in the test, macOS only); packages (`Foo.app/Contents/Info.plist`); symlink to dir, symlink to file, broken symlink; permission-denied directory (chmod 000) → `PermissionDenied`; not-a-directory; non-existent; 10,000-file folder.
- **Done when**: all tests pass and `cargo clippy` is clean.

### M2 — File list and Icons view
- `FileList` (List with details) with virtualized rows, columns, header sorting (§12), icons (§8.4), formatting, selection model, double-click to open/navigate, native-feel rules (§8.6).
- `IconGrid` (§8.3.1, **default view**) with row-virtualized grid, 2D keyboard navigation, shared selection store; `ViewSwitch` in the toolbar (`⌘1`/`⌘2`) persisting `viewMode`.
- `HiddenToggle` in the toolbar and the `showHidden` filter (**default off**) applied to both views (§8.3.2); the tree filter lands in M3.
- Stale-response protection via request ids.
- Vitest for `sort.ts`, `format.ts`, `fileTypes.ts`, selection reducers, grid-navigation reducer (arrow movement across wrapped rows, column-count changes), hidden filter (dot-files and dot-folders excluded by default, `UF_HIDDEN` items too).
- **Done when**: the app opens in **Icons view with hidden files not shown**; you can start at Home, double-click into folders, open files in their default apps, switch to List and back with selection preserved, sort by all four columns with folders first in both directions, toggle hidden files from the toolbar and see `.`-prefixed files and folders appear/disappear, and scroll a 10,000-item folder smoothly in both views.

### M3 — Sidebar: Favorites, Locations, folder tree
- Sections with collapse toggles; Favorites only show folders that exist; Locations from `places`.
- Lazy tree with disclosure triangles, `has_children` peek, inline error rows, virtualized if a node has many children.
- Tree ↔ list sync: navigating anywhere reveals and highlights the current folder in the tree.
- Resizable sidebar (splitter), toggle sidebar.
- **Done when**: you can browse entirely via the tree, the tree always reflects the current folder, and plugging in a USB drive adds it to Locations within ~1 s (after M5 watcher; static refresh acceptable in M3).

### M4 — Navigation, path bar, status bar, keyboard, menus
- History (back/forward with restored selection and scroll), Up (selects origin folder), Home, Favorites shortcuts.
- Path bar with clickable segments (root shown as volume name), status bar (counts + free space).
- Full keyboard map (§9.2), type-to-select, Tab focus switching, tree arrow keys.
- Native app menu (§10) with accelerators and checkmark sync; native context menus; Reveal in Finder, Copy Path, Get Info.
- **Done when**: every shortcut in §9.2 works and appears in the menu bar, and the app can be used without a mouse.

### M5 — Live refresh, hidden files, persistence
- Watcher (§6.7) for the current folder and `/Volumes`; selection preserved across refreshes; deleted current folder → nearest ancestor.
- Hidden-files toggle (no refetch, default off) persisted, synced between toolbar button, View menu and `⌘⇧.`, with "N hidden items" hint in empty state; `viewMode` persisted alongside it.
- Persistence (§11) with window-state plugin and store.
- **Done when**: creating/deleting/renaming files in Terminal updates the list within ~0.5 s without losing selection; relaunching restores window frame, folder, view mode, sort, hidden toggle, sidebar width, column widths, and expanded tree nodes.

### M6 — Polish and native feel pass
- Empty/loading/error states (§8.8), Full Disk Access button.
- Inactive-window styling, middle truncation of long names, symlink badges, hidden-item dimming.
- Dark-mode icon palette; reduced-motion support.
- Disable all browser-ish behaviors in release builds (§8.6) and verify none leak (try ⌘R, ⌘+, pinch, right-click on empty areas, dragging icons, selecting text).
- Performance check against §6.8 targets, document results.
- **Done when**: a side-by-side comparison with Finder in light and dark mode shows matching typography, spacing, selection behavior and colors closely enough that nothing looks "webby".

### M7 — Packaging
- App icon placeholders replaced when the logo is ready (`npx tauri icon path/to/logo.png` generates all sizes).
- `npx tauri build` produces `Navita.app` and a `.dmg`; ad-hoc signed.
- README: requirements, dev setup, build, permissions notes, known limitations.
- Optional: Developer ID signing + notarization, GitHub Actions workflow (`macos-latest` runner) for lint/test/build.
- **Done when**: the built app runs from `/Applications`, browses protected folders after granting prompts, and opens files correctly.

### M8 (optional) — Basic file operations
- New Folder (⇧⌘N) with inline rename field; Rename (Return) inline with Finder rules (extension not preselected); Move to Trash (⌘⌫) using the `trash` crate (reversible — never permanent delete); undo for rename/trash is a stretch.
- Validation: no `/` or `:` in names, collision handling ("untitled folder 2").
- **Done when**: operations work, are reflected via the watcher, and have Rust tests.

---

## 15. Testing strategy

- **Rust unit/integration tests** for everything in `fs/`, `places`, error mapping (M1). Run on macOS only for flag/package tests (`#[cfg(target_os = "macos")]`).
- **Vitest** for pure frontend logic: sort comparator, formatting, file-type mapping, selection reducers, history reducer, type-to-select buffer.
- **No WebDriver E2E**: Tauri's WebDriver support doesn't cover macOS WKWebView. Instead, maintain a **manual QA checklist** in `docs/QA.md`, derived from the acceptance criteria above, run before each milestone is closed.
- CI (optional): `cargo fmt --check`, `cargo clippy -D warnings`, `cargo test`, `npm run lint`, `npm test`, `npx tauri build` on a macOS runner.

---

## 16. Coding conventions

- Rust: edition 2024, `clippy::pedantic` warnings reviewed (allow noisy lints explicitly), no `unwrap()` outside tests, errors via `AppError`.
- TypeScript: `strict: true`, `noUncheckedIndexedAccess: true`; no `any`; IPC only through `src/api/commands.ts` wrappers that use the generated bindings.
- Components are function components with hooks; keep them presentational, put logic in stores and `lib/`.
- CSS: plain CSS files with the tokens in §8.5; class names BEM-ish (`file-row`, `file-row--selected`); no inline styles except dynamic sizes (widths, virtual offsets).
- Commit per milestone step; conventional commit messages.

---

## 17. Open questions / decisions to confirm

All questions resolved. Record each in `docs/DECISIONS.md` at scaffold time.

1. **Bundle identifier** — **Decided: `com.sgchris.navita`** (already set in §7.1). TCC grants are tied to it; don't change it after the first permission prompt.
2. **Tree root** — **Decided: root at `/`** (shown as "Macintosh HD"), with **Home auto-expanded** on launch (and the current folder always revealed, §8.1).
3. **Get Info** via AppleScript — **Decided: keep it.** The Automation prompt ("Navita wants to control Finder") is acceptable. Add `NSAppleEventsUsageDescription` to `Info.plist` (§7.3): "Navita asks Finder to show the Get Info window for a selected item."
4. **Native icons** — **Decided: v1 uses Lucide category icons** (§8.4). Real Finder icons via `NSWorkspace` remain a stretch item.
5. **Logo** — **Decided: pending**; the app uses Tauri's default icon until the logo exists (M7).
6. **Main-pane view** (added) — **Decided: two views, Icons (default) and List with details**, switchable via toolbar segmented control, View menu and `⌘1`/`⌘2`; persisted (§8.3, §8.3.1).
7. **Hidden files** (added) — **Decided: switch available in the toolbar, View menu and `⌘⇧.`; default off**; hides dot-prefixed files/folders (and `UF_HIDDEN` items, for Finder parity), in both views and the tree (§8.3.2).
