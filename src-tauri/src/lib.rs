mod clipboard_image;
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
                let mut last_image_hash = String::new();

                loop {
                    if let Ok(current_text) = clipboard_handle.clipboard().read_text() {
                        if !current_text.is_empty() && current_text != last_text {
                            last_text = current_text.clone();
                            log::debug!("changed-clipboard {}", current_text);

                            if let Ok(clip_item) = db::upsert_clip(
                                &clipboard_handle,
                                db::ContentType::Text,
                                current_text,
                                "".to_string(),
                                false,
                            ) {
                                log::debug!("clipboard-updated text");
                                let _ = app_handle.emit("clipboard-updated", &clip_item);
                            }
                        }
                    }

                    if let Ok(rgba_image) = clipboard_handle.clipboard().read_image() {
                        let bytes = rgba_image.rgba();
                        let width = rgba_image.width();
                        let height = rgba_image.height();

                        let current_image_hash = clipboard_image::calculate_hash(bytes);

                        if !current_image_hash.is_empty() && current_image_hash != last_image_hash {
                            last_image_hash = current_image_hash.clone();
                            log::debug!("changed-clipboard {}", current_image_hash);

                            if let Ok(image_dir) =
                                clipboard_image::get_clipboard_image_dir(&clipboard_handle)
                            {
                                let filename = format!("{}.png", &current_image_hash);
                                let image_path = image_dir.join(&filename);

                                // image クレートを使って RGBA データから PNG ファイルを作成
                                if let Some(img_buf) =
                                    image::RgbaImage::from_raw(width, height, bytes.to_vec())
                                {
                                    if img_buf.save(&image_path).is_ok() {
                                        if let Ok(clip_item) = db::upsert_clip(
                                            &clipboard_handle,
                                            db::ContentType::Image,
                                            image_path.to_string_lossy().into_owned(),
                                            "".to_string(),
                                            false,
                                        ) {
                                            log::debug!("clipboard-updated image");
                                            let _ =
                                                app_handle.emit("clipboard-updated", &clip_item);
                                        }
                                    }
                                }
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
            command::update_clip,
            command::send_clipboard,
            command::send_and_paste,
            command::update_window_toggle_shortcut,
            command::list_system_font
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
