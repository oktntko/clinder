mod command;
mod db;

use std::thread;
use std::time::Duration;
use tauri::Emitter;
use tauri_plugin_clipboard_manager::ClipboardExt;
use tauri_plugin_log::log;
use tauri_plugin_store::StoreExt;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(
            tauri_plugin_log::Builder::new()
                .level(if cfg!(debug_assertions) {
                    log::LevelFilter::Trace
                } else {
                    log::LevelFilter::Warn
                })
                .build(),
        )
        .plugin(tauri_plugin_clipboard_manager::init())
        .setup(move |app: &mut tauri::App| {
            let app_handle = app.handle().clone();

            let store = match app.store("settings.json") {
                Ok(store) => Some(store),
                Err(err) => {
                    log::warn!("Failed to load settings store: {}", err);
                    None
                }
            };

            let shortcut_str = match store
                .as_ref()
                .and_then(|store| store.get("window_toggle_shortcut"))
            {
                Some(value) => value.as_str().unwrap_or("Alt+V").to_string(),
                None => "Alt+V".to_string(),
            };

            if command::register_toggle_shortcut(&app_handle, &shortcut_str).is_none() {
                log::warn!("Global shortcut registration skipped; continuing without it.");
            }

            let clipboard_handle = app_handle.clone();
            thread::spawn(move || {
                let mut last_text = String::new();

                loop {
                    if let Ok(current_text) = clipboard_handle.clipboard().read_text() {
                        if !current_text.is_empty() && current_text != last_text {
                            last_text = current_text.clone();
                            log::debug!("changed-clipboard {}", current_text);

                            if let Ok(clip_item) = db::upsert_clip(
                                &clipboard_handle,
                                db::ContentType::Text,
                                current_text,
                            ) {
                                let _ = app_handle.emit("clipboard-updated", &clip_item);
                            }
                        }
                    }

                    thread::sleep(Duration::from_millis(500));
                }
            });

            Ok(())
        })
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            command::search_clipboard,
            command::delete_clip,
            command::clear_clipboard,
            command::send_clipboard,
            command::send_and_paste,
            command::update_window_toggle_shortcut,
            command::list_system_font
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
