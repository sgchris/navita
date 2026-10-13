# Navita

A minimal, fast, native-feeling file browser for macOS, built with Rust and Tauri v2 (React + TypeScript frontend).

- Folder tree, Favorites and Locations in a floating sidebar; contents of the selected folder on the right.
- **Icons** (default) and **List with details** views, switchable from the toolbar or with `⌘1` / `⌘2`.
- Hidden files (dot-files and the macOS hidden flag) are **off** by default; toggle with the eye button or `⇧⌘.`.
- Sorting by Name, Date Modified, Size and Kind with folders always first; Back / Forward history; path bar; status bar; live refresh; Finder-style keyboard shortcuts and native menus.
- New Folder, inline Rename and Move to Trash.

The full product and technical specification is in [`NAVITA_SPEC.md`](NAVITA_SPEC.md); deviations and decisions are in [`docs/DECISIONS.md`](docs/DECISIONS.md); the manual QA checklist is [`docs/QA.md`](docs/QA.md).

## Requirements

- macOS 13 or later (designed and tested on macOS 26 Tahoe, Apple Silicon first)
- Rust 1.90 or later (stable) and Xcode Command Line Tools
- Node.js 24 LTS and npm

## Development

```sh
npm install
npm run tauri dev        # starts Vite and the app with hot reload
```

Useful scripts:

| Command                                            | Purpose                                                                                                             |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `npm run check`                                    | all gates: typecheck, eslint, prettier, vitest, rustfmt, clippy (`-D warnings`), `cargo test`, bindings consistency |
| `npm test` / `npm run test:rust`                   | frontend (Vitest) / Rust tests                                                                                      |
| `npm run lint` / `npm run lint:rust`               | ESLint / clippy                                                                                                     |
| `npm run format`                                   | Prettier                                                                                                            |
| `NAVITA_DEV_LOG=/tmp/navita.log npm run tauri dev` | additionally writes webview errors and `[navita]` log lines to the file (development builds only)                   |

TypeScript types for the IPC layer are generated from the Rust structs by `cargo test` into `src/api/bindings/` (committed; do not edit). After changing a model run `npm run test:rust`, then `git add src/api/bindings`.

## Build

```sh
npm run tauri build      # produces Navita.app and a .dmg under src-tauri/target/release/bundle/
```

Builds are **ad-hoc signed** (`signingIdentity: "-"`). To share a build with others, sign with a Developer ID Application certificate and notarize it (Tauri reads `APPLE_SIGNING_IDENTITY`, `APPLE_ID`, `APPLE_PASSWORD` and `APPLE_TEAM_ID`; check the Tauri distribution docs for the current names). Without notarization, other Macs need right-click > Open or an exception in Privacy & Security.

## Permissions

Navita is not sandboxed and reads folders through its own Rust commands.

- Browsing Desktop, Documents, Downloads, removable and network volumes triggers a one-time macOS privacy prompt with the purpose strings from `src-tauri/Info.plist`. Some folders (for example `~/Library/Mail`) need **Full Disk Access**; Navita then shows a permission message with a button that opens System Settings.
- **Get Info** asks Finder through AppleScript, which triggers an Automation prompt ("Navita wants to control Finder") the first time.
- Because local builds are ad-hoc signed, macOS may ask again for these permissions after a rebuild (the code signature changes). During `npm run tauri dev` the prompts are attributed to the terminal application that started it.

## Known limitations

- No tabs, multiple windows, dual pane, Quick Look, search or drag-and-drop out of the window yet.
- Icons are category icons (Lucide), not the system icons Finder shows.
- "Free space" comes from `statfs` and can differ slightly from Finder, which also counts purgeable space.
- Move to Trash uses the Trash directly (no Finder "Put Back" entry).
- Not distributed through the Mac App Store (uses the macOS private API for the translucent window).
