pub mod commands;
pub mod error;
pub mod fs;
pub mod model;
pub mod places;

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
        .invoke_handler(tauri::generate_handler![
            commands::fs::list_dir,
            commands::fs::list_subdirs,
            commands::fs::home_dir,
            commands::places::places,
            commands::places::volume_info,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
