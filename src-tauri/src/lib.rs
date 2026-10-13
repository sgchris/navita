pub mod clipboard;
pub mod commands;
pub mod error;
pub mod fs;
pub mod menu;
pub mod model;
pub mod places;
pub mod watcher;

use tauri::Manager;
use tauri_plugin_window_state::StateFlags;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(
            tauri_plugin_window_state::Builder::default()
                .with_state_flags(StateFlags::all() - StateFlags::VISIBLE)
                .build(),
        )
        .setup(|app| {
            let (menu, handles) = menu::build(app.handle())?;
            app.set_menu(menu)?;
            app.manage(handles);
            app.manage(watcher::Watchers::default());
            watcher::start_volumes_watcher(app.handle());
            Ok(())
        })
        .on_menu_event(|app, event| menu::handle_event(app, event.id().as_ref()))
        .invoke_handler(tauri::generate_handler![
            commands::clipboard::clipboard_read_files,
            commands::clipboard::clipboard_write_files,
            commands::clipboard::paste_files,
            commands::fs::list_dir,
            commands::fs::list_subdirs,
            commands::fs::home_dir,
            commands::menu::set_menu_state,
            commands::ops::create_file,
            commands::ops::create_folder,
            commands::ops::rename_path,
            commands::ops::trash_paths,
            commands::open::open_path,
            commands::open::reveal_in_finder,
            commands::open::get_info,
            commands::open::copy_text,
            commands::open::open_full_disk_access_settings,
            commands::places::places,
            commands::places::volume_info,
            commands::watch::watch_dir,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
