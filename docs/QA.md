# Navita — manual QA checklist

Items the agent cannot verify (visual / interactive). Run before closing each milestone.

## M0 — Native shell

- [ ] `npm run tauri dev` opens a window with traffic lights vertically centered in the 52 px toolbar area (if off, adjust `trafficLightPosition.y` in `src-tauri/tauri.conf.json` in steps of 2 px).
- [ ] Sidebar region shows the system vibrancy material; the content area is opaque.
- [ ] Switching macOS between Light and Dark updates colors live.
- [ ] No white flash when the window appears; quitting and relaunching restores the window size and position.
- [ ] Double-clicking an empty part of the toolbar zooms the window.

## M2 — Icons / List views, selection, sorting, hidden files

- [ ] The app opens in **Icons view** with hidden files **not shown**; the toolbar view switch shows Icons active and the eye toggle is off.
- [ ] Double-click a folder to enter it; double-click a file to open it in its default app; double-click an `.app` launches it.
- [ ] Switch Icons ⇄ List with the toolbar switch: the selection, focused item and scroll position are kept.
- [ ] List view: click each header (Name, Date Modified, Size, Kind): folders always stay first, ascending and descending; a second click reverses; drag a column divider (left edge of Date Modified / Size / Kind) to resize.
- [ ] Toggle the eye button: `.`-prefixed files and folders appear (dimmed) and disappear again; the selection drops items that become hidden.
- [ ] ⌘-click toggles, ⇧-click selects a range, click on empty space deselects, arrow keys move the selection (⇧ extends), ⌘↓ opens, Esc deselects, typing letters jumps to the first matching name.
- [ ] Icons view: ←/→ move by one cell, ↑/↓ by one row; long names are middle-truncated on two lines.
- [ ] A folder with 10,000 files (create one with `mkdir big && cd big && for i in $(seq 1 10000); do : > f$i.txt; done`) scrolls smoothly in both views.
- [ ] Symlinks show a small arrow badge; a broken symlink is dimmed and its Kind is "Broken alias".
