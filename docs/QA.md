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

## M3 — Sidebar

- [ ] The sidebar shows Favorites (Home, Desktop, Documents, Downloads, Applications), Locations (Macintosh HD plus mounted volumes) and a Folders tree rooted at `/` with Home expanded.
- [ ] Clicking any row navigates; clicking the arrow only expands/collapses; the tree always highlights (and scrolls to) the current folder, also when navigating from the list.
- [ ] Hovering a section header shows Hide/Show; clicking collapses/expands that section.
- [ ] Dragging the sidebar's right edge resizes it between 180 and 400 px.
- [ ] `⌘⌥S` hides and shows the sidebar (toolbar padding grows so it clears the traffic lights).
- [ ] A folder containing only `.git` shows no arrow while hidden files are off, and an arrow when they are on; hidden folders in the tree appear/disappear with the eye toggle (except ancestors of the current folder).
- [ ] An unreadable folder shows "Can’t open folder" when expanded.

## M4 — Navigation, path/status bars, keyboard, menus

Tip for accelerator problems: start with `NAVITA_DEV_LOG=/tmp/navita.log npm run tauri dev` and `tail -f /tmp/navita.log`; every menu click and accelerator logs `[navita] menu <id>`.

- [ ] Back/Forward/Up/Home toolbar buttons work and are disabled when not applicable; Back/Forward restore the selection and scroll position; Up selects the folder you came from.
- [ ] The path bar (bottom) shows `Macintosh HD › … › current`; clicking a segment navigates; the status bar shows `N items, M selected, X GB available`.
- [ ] **S5 — every menu accelerator fires** (the item's effect happens): ⌘O, ⌘R, ⌥⌘C, ⌘A, ⌘1, ⌘2, ⇧⌘., ⌥⌘S, ⌥⌘P, ⌘/, ⌘[, ⌘], ⌘↑, ⇧⌘H, ⇧⌘D, ⇧⌘O, ⌥⌘L, ⇧⌘A. Report any that do not.
- [ ] ⌘↓ opens the selection, Tab / ⇧Tab switches focus between sidebar and list, ↑/↓ in the sidebar navigate, ←/→ collapse/expand tree rows.
- [ ] Menu bar: View ▸ as Icons / as List show a check on the active one, Show Hidden Files is checked after toggling, Sort By shows a check on the active key, Hide/Show Sidebar / Path Bar / Status Bar labels flip, Back/Forward/Enclosing Folder/Open/Reveal are disabled when not applicable.
- [ ] Context menu on an item: Open, Reveal in Finder, Copy Path, Get Info (first use shows the Automation prompt for Finder; Rename and Move to Trash are disabled until M8). Context menu on empty space: View ▸, Show Hidden Files, Sort By ▸.
- [ ] Copy Path (menu and context menu) puts the newline-joined paths on the clipboard (paste into a text editor; non-ASCII names are intact).
- [ ] Help ▸ Navita on GitHub opens https://github.com/sgchris/navita in the browser.

## M5 — Live refresh, persistence

- [ ] In Terminal, create, rename and delete files in the folder shown by Navita: the list updates within about half a second, and the selection is kept (if the selected item is deleted, the item now at its position is selected).
- [ ] Delete the folder currently shown (or rename it): Navita jumps to the nearest existing parent folder and shows "“name” no longer exists." in the status bar.
- [ ] Mount a disk image (or plug in a USB drive): it appears under Locations within about a second; eject it: it disappears.
- [ ] Empty folder with only hidden items shows "No visible items — N hidden items" with a **Show Hidden Files** button that reveals them.
- [ ] Change the view mode, sort, hidden toggle, sidebar width, column widths, expand some tree folders, navigate to another folder, quit (⌘Q) and relaunch: the window frame, folder, view mode, sort, hidden toggle, sidebar width, column widths and expanded tree nodes are restored. A deleted last folder falls back to Home.

## M6 — Native-feel pass (release build: `npm run tauri build`, run the `.app`)

- [ ] Compare side by side with Finder (light and dark): typography, spacing, selection colors, sidebar material, icon tints; nothing looks "webby".
- [ ] Inactive window: selection turns gray, toolbar icons dim.
- [ ] Try ⌘+, ⌘-, ⌘0, ⌘F: nothing happens (no zoom, no find). Pinch on the trackpad: no zoom.
- [ ] Right-click on empty areas (toolbar, sidebar, path bar): no web context menu appears; on the list background the native View/Sort menu appears.
- [ ] Drag an item or icon: no ghost image; drag a file from Finder onto the window: nothing happens (the UI must not be replaced).
- [ ] Try to select text by dragging or double-clicking labels: nothing gets selected.
- [ ] Permission-denied folder (for example `~/Library/Mail` without Full Disk Access): the error state shows the lock icon, "Open Privacy Settings…" opens System Settings, "Go Back" returns.
- [ ] Long names are middle-truncated (`report-final-…-v3.pdf`) in both views; hidden items are dimmed; symlinks show the arrow badge.

## M8 — File operations

- [ ] ⇧⌘N (File ▸ New Folder) creates "untitled folder" (then "untitled folder 2", …), selects it and opens the name editor with the whole name selected; type a name and press Return.
- [ ] Select one item and press Return (or File ▸ Rename): the editor opens with the extension not selected (`report.pdf` → `report` selected); Esc cancels; clicking elsewhere commits; an empty or unchanged name cancels.
- [ ] Typing `/` or `:` shows a red outline with the reason on Return; a name that already exists shows "A file named “…” already exists."; a case-only rename (`a.txt` → `A.txt`) works.
- [ ] ⌘⌫ (File ▸ Move to Trash) moves the selection to the Trash (check in Finder) and selects the next item; the Trash item can be restored by dragging it out.
- [ ] `~/Documents`, `~/Desktop`, `~/Downloads`, `~/Library`, the home folder and top-level folders such as `/Users` refuse Rename and Move to Trash with a status-bar message.
- [ ] Changes made in Terminal while the editor is closed still refresh the list; the context menu on an item shows Rename… (only for a single selection) and Move to Trash enabled.

## Follow-up batch

### S1 — Logo

- [ ] The built app shows the new Navita logo in the Dock, in Finder (`Navita.app`), in ⌘Tab and in the `.dmg` (if the old icon still shows, move the app or run `killall Dock`).
