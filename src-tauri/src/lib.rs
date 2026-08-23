mod clipboard_image;
mod command;
mod db;

use clipboard_rs::{
    Clipboard, ClipboardContext, ClipboardHandler, ClipboardWatcher, ClipboardWatcherContext,
    ContentFormat, RustImageData, common::RustImage,
};
use std::str::FromStr;
use std::thread;
use std::time::Duration;
use tauri::{
    AppHandle, Emitter, Manager,
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
};
use tauri_plugin_global_shortcut::Shortcut;
use tauri_plugin_log::log;
use tauri_plugin_store::StoreExt;
use tokio::time;

use crate::command::WebViewShortcut;

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

            let shortcut = app
                .store("settings.json")
                .ok()
                .and_then(|store| store.get("toggle_window"))
                .and_then(|val| serde_json::from_value::<WebViewShortcut>(val.clone()).ok())
                .and_then(|w| w.to_shortcut(1).ok())
                .unwrap_or_else(|| Shortcut::from_str("Alt+V").unwrap());

            let app_handle = app.handle().clone();

            if command::register_global_shortcut_toggle_window(&app_handle, &shortcut).is_none() {
                log::warn!("Global shortcut registration skipped; continuing without it.");
            }

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

            let clipboard_handle = app.handle().clone();

            let trim_final_newlines = clipboard_handle
                .store("settings.json")
                .ok()
                .and_then(|store| store.get("trim_final_newlines"))
                .and_then(|val| val.as_bool())
                .unwrap_or(true /* defaultMaxItems */);

            thread::spawn(move || {
                let ctx = ClipboardContext::new().unwrap();
                let handler = WatcherHandler {
                    ctx,
                    last_clip: TempClip {
                        plain_text: "".to_string(),
                        image_hash: "".to_string(),
                        files: Vec::new(),
                    },
                    app_handle: clipboard_handle,
                    trim_final_newlines,
                };

                let mut watcher = ClipboardWatcherContext::new().unwrap();
                watcher.add_handler(handler);
                watcher.start_watch(); // 監視ループを開始（スレッドをブロックする）
            });

            Ok(())
        })
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            command::search_clipboard,
            command::delete_clip,
            command::clear_clipboard,
            command::update_clip_bookmark,
            command::send_text,
            command::paste_text,
            command::send_image,
            command::paste_image,
            command::send_files,
            command::paste_files,
            command::update_global_shortcut_toggle_window,
            command::restart_app,
            command::list_system_font,
            command::get_real_app_local_data_dir,
            command::get_real_app_data_dir
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn cleanup(app_handle: &AppHandle) {
    log::info!("delete clipboard task started");

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
                if !clip.image_hash.is_empty() {
                    clipboard_image::delete_image(app_handle, clip.image_hash);
                }
            }
        }
        Err(err) => {
            log::error!("Failed to delete clips from DB: {}", err);
        }
    }
}

// クリップボードの変更を検知するハンドラ構造体
struct WatcherHandler {
    ctx: ClipboardContext,
    app_handle: tauri::AppHandle,
    last_clip: TempClip,
    trim_final_newlines: bool,
}

#[derive(PartialEq, Eq, Debug, Clone)]
struct TempClip {
    plain_text: String,
    image_hash: String,
    files: Vec<String>,
}

impl ClipboardHandler for WatcherHandler {
    fn on_clipboard_change(&mut self) {
        let mut current_clip = TempClip {
            plain_text: "".to_string(),
            image_hash: "".to_string(),
            files: Vec::new(),
        };

        let mut current_image: Option<RustImageData> = None;

        if self.ctx.has(ContentFormat::Text) {
            if let Ok(read_text) = self.ctx.get_text() {
                let plain_text = if self.trim_final_newlines {
                    read_text.trim_end_matches(['\n', '\r']).to_string()
                } else {
                    read_text
                };

                log::debug!("on_clipboard_change plain_text {}", plain_text);
                current_clip.plain_text = plain_text;
            }
        }

        if self.ctx.has(ContentFormat::Image) {
            if let Ok(image) = self.ctx.get_image() {
                if let Ok(png_bytes) = image.to_png() {
                    let bytes = png_bytes.get_bytes();
                    let image_hash = clipboard_image::calculate_hash(bytes);

                    log::debug!("on_clipboard_change image {}", image_hash);
                    current_clip.image_hash = image_hash;
                    current_image = Some(image);
                }
            }
        }

        if self.ctx.has(ContentFormat::Files) {
            if let Ok(files) = self.ctx.get_files() {
                log::debug!("on_clipboard_change files {:?}", files);
                current_clip.plain_text = files.join("\n");
                current_clip.files = files;
            }
        }

        let last_clip = current_clip.clone();
        if (current_clip.plain_text.is_empty()
            && current_clip.image_hash.is_empty()
            && current_clip.files.is_empty())
            || self.last_clip == current_clip
        {
            return;
        }

        log::debug!("clipboard changed {:?}", current_clip);

        let image_hash = current_clip.image_hash.clone();
        if let Some(current_image) = current_image
            && !image_hash.is_empty()
        {
            clipboard_image::get_full_path(&self.app_handle, image_hash)
                .ok()
                .map(|path| {
                    if let Err(e) = current_image.save_to_path(&path.to_string_lossy()) {
                        log::warn!("Failed to save image file {:?}: {}", path, e);
                    }
                });
        }

        if let Ok(clip_item) = db::upsert_clip(
            &self.app_handle,
            if !current_clip.files.is_empty() {
                // ファイルがある場合＝ファイル
                db::ContentType::Files
            } else if current_clip.plain_text.is_empty() {
                // 画像のみ＝画像
                db::ContentType::Image
            } else {
                // テキストのみ＝テキスト, 画像もテキストも両方ある＝テキスト
                db::ContentType::Text
            },
            current_clip.plain_text,
            current_clip.image_hash,
            current_clip.files.clone(),
            false,
        ) {
            log::debug!("clipboard-updated");
            let _ = self.app_handle.emit("clipboard-updated", &clip_item);
        }

        self.last_clip = last_clip;
    }
}
