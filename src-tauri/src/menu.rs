use tauri::menu::{
    AboutMetadataBuilder, CheckMenuItem, CheckMenuItemBuilder, Menu, MenuItem, MenuItemBuilder,
    SubmenuBuilder,
};
use tauri::{AppHandle, Emitter, Wry};
use tauri_plugin_opener::OpenerExt;

/// Repository opened by Help > Navita on GitHub (the repo is created later by the user).
pub const GITHUB_URL: &str = "https://github.com/sgchris/navita";

const HELP_GITHUB_ID: &str = "help.github";
/// Menu ids that the frontend handles (everything else is native).
const FRONTEND_PREFIXES: [&str; 4] = ["file.", "edit.", "view.", "go."];

/// Handles of the menu items whose state follows the frontend (see `set_menu_state`).
pub struct MenuHandles {
    pub view_icons: CheckMenuItem<Wry>,
    pub view_list: CheckMenuItem<Wry>,
    pub toggle_hidden: CheckMenuItem<Wry>,
    pub sort_name: CheckMenuItem<Wry>,
    pub sort_modified: CheckMenuItem<Wry>,
    pub sort_size: CheckMenuItem<Wry>,
    pub sort_kind: CheckMenuItem<Wry>,
    pub toggle_sidebar: MenuItem<Wry>,
    pub toggle_path_bar: MenuItem<Wry>,
    pub toggle_status_bar: MenuItem<Wry>,
    pub open: MenuItem<Wry>,
    pub reveal: MenuItem<Wry>,
    pub rename: MenuItem<Wry>,
    pub trash: MenuItem<Wry>,
    pub back: MenuItem<Wry>,
    pub forward: MenuItem<Wry>,
    pub up: MenuItem<Wry>,
}

fn item(
    app: &AppHandle,
    id: &str,
    label: &str,
    accelerator: Option<&str>,
    enabled: bool,
) -> tauri::Result<MenuItem<Wry>> {
    let mut builder = MenuItemBuilder::with_id(id, label).enabled(enabled);
    if let Some(accelerator) = accelerator {
        builder = builder.accelerator(accelerator);
    }
    builder.build(app)
}

fn check_item(
    app: &AppHandle,
    id: &str,
    label: &str,
    accelerator: Option<&str>,
    checked: bool,
) -> tauri::Result<CheckMenuItem<Wry>> {
    let mut builder = CheckMenuItemBuilder::with_id(id, label).checked(checked);
    if let Some(accelerator) = accelerator {
        builder = builder.accelerator(accelerator);
    }
    builder.build(app)
}

/// Builds the native menu bar (spec section 10, decisions A10/A11).
///
/// # Errors
/// Any menu construction error (for example an accelerator string that does not parse).
pub fn build(app: &AppHandle) -> tauri::Result<(Menu<Wry>, MenuHandles)> {
    let about = AboutMetadataBuilder::new()
        .name(Some("Navita"))
        .version(Some(env!("CARGO_PKG_VERSION")))
        .build();
    let settings = item(app, "app.settings", "Settings…", Some("CmdOrCtrl+,"), false)?;
    let app_menu = SubmenuBuilder::new(app, "Navita")
        .about(Some(about))
        .separator()
        .item(&settings)
        .separator()
        .services()
        .separator()
        .hide()
        .hide_others()
        .show_all()
        .separator()
        .quit()
        .build()?;

    let open = item(app, "file.open", "Open", Some("CmdOrCtrl+O"), false)?;
    let reveal = item(
        app,
        "file.reveal",
        "Reveal in Finder",
        Some("CmdOrCtrl+R"),
        false,
    )?;
    let copy_path = item(
        app,
        "file.copyPath",
        "Copy Path",
        Some("CmdOrCtrl+Alt+C"),
        true,
    )?;
    // File operations are enabled in M8.
    let new_folder = item(
        app,
        "file.newFolder",
        "New Folder",
        Some("CmdOrCtrl+Shift+N"),
        false,
    )?;
    let rename = item(app, "file.rename", "Rename", None, false)?;
    let trash = item(
        app,
        "file.trash",
        "Move to Trash",
        Some("CmdOrCtrl+Backspace"),
        false,
    )?;
    let file_menu = SubmenuBuilder::new(app, "File")
        .item(&open)
        .item(&reveal)
        .item(&copy_path)
        .separator()
        .item(&new_folder)
        .item(&rename)
        .item(&trash)
        .separator()
        .close_window()
        .build()?;

    let undo = item(app, "edit.undo", "Undo", None, false)?;
    let redo = item(app, "edit.redo", "Redo", None, false)?;
    let select_all = item(
        app,
        "edit.selectAll",
        "Select All",
        Some("CmdOrCtrl+A"),
        true,
    )?;
    let edit_menu = SubmenuBuilder::new(app, "Edit")
        .item(&undo)
        .item(&redo)
        .separator()
        .cut()
        .copy()
        .paste()
        .item(&select_all)
        .build()?;

    let view_icons = check_item(app, "view.icons", "as Icons", Some("CmdOrCtrl+1"), true)?;
    let view_list = check_item(app, "view.list", "as List", Some("CmdOrCtrl+2"), false)?;
    let toggle_hidden = check_item(
        app,
        "view.toggleHidden",
        "Show Hidden Files",
        Some("CmdOrCtrl+Shift+."),
        false,
    )?;
    let toggle_sidebar = item(
        app,
        "view.toggleSidebar",
        "Hide Sidebar",
        Some("CmdOrCtrl+Alt+S"),
        true,
    )?;
    let toggle_path_bar = item(
        app,
        "view.togglePathBar",
        "Hide Path Bar",
        Some("CmdOrCtrl+Alt+P"),
        true,
    )?;
    let toggle_status_bar = item(
        app,
        "view.toggleStatusBar",
        "Hide Status Bar",
        Some("CmdOrCtrl+/"),
        true,
    )?;
    let sort_name = check_item(app, "view.sort.name", "Name", None, true)?;
    let sort_modified = check_item(app, "view.sort.modified", "Date Modified", None, false)?;
    let sort_size = check_item(app, "view.sort.size", "Size", None, false)?;
    let sort_kind = check_item(app, "view.sort.kind", "Kind", None, false)?;
    let sort_menu = SubmenuBuilder::new(app, "Sort By")
        .item(&sort_name)
        .item(&sort_modified)
        .item(&sort_size)
        .item(&sort_kind)
        .build()?;
    let view_menu = SubmenuBuilder::new(app, "View")
        .item(&view_icons)
        .item(&view_list)
        .separator()
        .item(&toggle_hidden)
        .item(&toggle_sidebar)
        .item(&toggle_path_bar)
        .item(&toggle_status_bar)
        .separator()
        .item(&sort_menu)
        .separator()
        .fullscreen()
        .build()?;

    let back = item(app, "go.back", "Back", Some("CmdOrCtrl+["), false)?;
    let forward = item(app, "go.forward", "Forward", Some("CmdOrCtrl+]"), false)?;
    let up = item(
        app,
        "go.up",
        "Enclosing Folder",
        Some("CmdOrCtrl+Up"),
        false,
    )?;
    let home = item(app, "go.home", "Home", Some("CmdOrCtrl+Shift+H"), true)?;
    let desktop = item(
        app,
        "go.desktop",
        "Desktop",
        Some("CmdOrCtrl+Shift+D"),
        true,
    )?;
    let documents = item(
        app,
        "go.documents",
        "Documents",
        Some("CmdOrCtrl+Shift+O"),
        true,
    )?;
    let downloads = item(
        app,
        "go.downloads",
        "Downloads",
        Some("CmdOrCtrl+Alt+L"),
        true,
    )?;
    let applications = item(
        app,
        "go.applications",
        "Applications",
        Some("CmdOrCtrl+Shift+A"),
        true,
    )?;
    let go_menu = SubmenuBuilder::new(app, "Go")
        .item(&back)
        .item(&forward)
        .item(&up)
        .separator()
        .item(&home)
        .item(&desktop)
        .item(&documents)
        .item(&downloads)
        .item(&applications)
        .build()?;

    let window_menu = SubmenuBuilder::new(app, "Window")
        .minimize()
        .maximize()
        .separator()
        .bring_all_to_front()
        .build()?;

    let github = item(app, HELP_GITHUB_ID, "Navita on GitHub", None, true)?;
    let help_menu = SubmenuBuilder::new(app, "Help").item(&github).build()?;

    #[cfg(target_os = "macos")]
    {
        window_menu.set_as_windows_menu_for_nsapp()?;
        help_menu.set_as_help_menu_for_nsapp()?;
    }

    let menu = Menu::with_items(
        app,
        &[
            &app_menu,
            &file_menu,
            &edit_menu,
            &view_menu,
            &go_menu,
            &window_menu,
            &help_menu,
        ],
    )?;
    let handles = MenuHandles {
        view_icons,
        view_list,
        toggle_hidden,
        sort_name,
        sort_modified,
        sort_size,
        sort_kind,
        toggle_sidebar,
        toggle_path_bar,
        toggle_status_bar,
        open,
        reveal,
        rename,
        trash,
        back,
        forward,
        up,
    };
    Ok((menu, handles))
}

/// Routes a menu click: Help is handled here, frontend ids are emitted as the `menu` event.
pub fn handle_event(app: &AppHandle, id: &str) {
    if id == HELP_GITHUB_ID {
        let _ = app.opener().open_url(GITHUB_URL, None::<&str>);
    } else if FRONTEND_PREFIXES
        .iter()
        .any(|prefix| id.starts_with(prefix))
    {
        let _ = app.emit("menu", id.to_owned());
    }
}
