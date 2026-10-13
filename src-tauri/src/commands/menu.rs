use tauri::State;

use crate::error::AppError;
use crate::menu::MenuHandles;
use crate::model::MenuState;

fn menu_error(error: &tauri::Error) -> AppError {
    AppError::Io {
        path: String::new(),
        message: error.to_string(),
    }
}

fn show_hide(visible: bool, what: &str) -> String {
    format!("{} {what}", if visible { "Hide" } else { "Show" })
}

/// Mirrors the frontend state into the native menu: check marks, labels and enabled flags.
#[tauri::command]
pub fn set_menu_state(handles: State<'_, MenuHandles>, state: MenuState) -> Result<(), AppError> {
    apply(&handles, &state).map_err(|e| menu_error(&e))
}

fn apply(h: &MenuHandles, s: &MenuState) -> tauri::Result<()> {
    h.view_icons.set_checked(s.view_mode == "icons")?;
    h.view_list.set_checked(s.view_mode == "list")?;
    h.toggle_hidden.set_checked(s.show_hidden)?;
    h.sort_name.set_checked(s.sort_key == "name")?;
    h.sort_modified.set_checked(s.sort_key == "modified")?;
    h.sort_size.set_checked(s.sort_key == "size")?;
    h.sort_kind.set_checked(s.sort_key == "kind")?;

    h.toggle_sidebar
        .set_text(show_hide(s.sidebar_visible, "Sidebar"))?;
    h.toggle_path_bar
        .set_text(show_hide(s.path_bar_visible, "Path Bar"))?;
    h.toggle_status_bar
        .set_text(show_hide(s.status_bar_visible, "Status Bar"))?;

    h.open.set_enabled(s.has_selection)?;
    h.reveal.set_enabled(s.has_selection)?;
    h.back.set_enabled(s.can_back)?;
    h.forward.set_enabled(s.can_forward)?;
    h.up.set_enabled(s.can_up)?;
    h.rename.set_enabled(s.single_selection)?;
    h.trash.set_enabled(s.has_selection)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::show_hide;

    #[test]
    fn labels_flip_between_show_and_hide() {
        assert_eq!(show_hide(true, "Sidebar"), "Hide Sidebar");
        assert_eq!(show_hide(false, "Path Bar"), "Show Path Bar");
    }
}
