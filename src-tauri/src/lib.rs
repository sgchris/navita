pub mod commands;
pub mod error;
pub mod fs;
pub mod menu;
pub mod model;
pub mod places;

use tauri::Manager;
use tauri_plugin_window_state::StateFlags;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
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
            Ok(())
        })
        .on_menu_event(|app, event| menu::handle_event(app, event.id().as_ref()))
        .invoke_handler(tauri::generate_handler![
            commands::fs::list_dir,
            commands::fs::list_subdirs,
            commands::fs::home_dir,
            commands::menu::set_menu_state,
            commands::open::open_path,
            commands::open::reveal_in_finder,
            commands::open::get_info,
            commands::open::copy_text,
            commands::open::open_full_disk_access_settings,
            commands::places::places,
            commands::places::volume_info,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
