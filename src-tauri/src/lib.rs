mod clipboard_image;
mod command;
mod db;

use std::time::Duration;
use std::{path::Path, thread};
use tauri::AppHandle;
use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    Emitter, Manager,
};
use tauri_plugin_clipboard_manager::ClipboardExt;
use tauri_plugin_log::log;
use tauri_plugin_store::StoreExt;
use tokio::time;

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
            let open_item = MenuItem::with_id(app, "open", "Open", true, None::<&str>)?;
            let hide_item = MenuItem::with_id(app, "hide", "Hide", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let tray_menu = Menu::with_items(app, &[&open_item, &hide_item, &quit_item])?;

            TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .tooltip("clinder")
                .menu(&tray_menu)
                .show_menu_on_left_click(true)
                .on_menu_event(|_app_handle, event| match event.id.as_ref() {
                    "open" => {
                        if let Some(window) = _app_handle.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    "hide" => {
                        if let Some(window) = _app_handle.get_webview_window("main") {
                            let _ = window.hide();
                        }
                    }
                    "quit" => {
                        _app_handle.exit(0);
                    }
                    _ => {}
                })
                .build(app)?;

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

            let app_handle = app.handle().clone();

            if command::register_toggle_shortcut(&app_handle, &shortcut_str).is_none() {
                log::warn!("Global shortcut registration skipped; continuing without it.");
            }

            let clipboard_handle = app.handle().clone();
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

            // 古いデータを削除する
            let cleanup_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                let mut interval = time::interval(Duration::from_hours(24));

                loop {
                    interval.tick().await;

                    let handle = cleanup_handle.clone();

                    let _ = tokio::task::spawn_blocking(move || {
                        cleanup(&handle);
                    })
                    .await;
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

fn cleanup(app_handle: &AppHandle) {
    log::info!("delete clipboard task started");

    // 設定ストアから history_size を取得
    let store = match app_handle.store("settings.json") {
        Ok(store) => store,
        Err(err) => {
            log::warn!("Failed to load settings store: {}", err);
            return;
        }
    };

    let history_size = match store.get("history_size").and_then(|value| value.as_i64()) {
        Some(value) => {
            if value <= 0 {
                return;
            }
            value
        }
        None => {
            log::warn!("history_size not found in settings");
            return;
        }
    };

    match db::delete_many_clip_offset(app_handle, history_size) {
        Ok(deleted_clipboard) => {
            for clip in deleted_clipboard {
                if clip.content_type == db::ContentType::Image {
                    let path = Path::new(&clip.content);
                    if let Err(e) = std::fs::remove_file(path) {
                        log::warn!("Failed to delete image file {:?}: {}", path, e);
                    }
                }
            }
        }
        Err(err) => {
            log::error!("Failed to delete clips from DB: {}", err);
        }
    }
}
