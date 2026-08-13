use crate::clipboard_image;
use crate::db;

use enigo::{Enigo, Key, Keyboard, Settings};
use font_kit::source::SystemSource;
use nucleo_matcher::pattern::{Atom, AtomKind, CaseMatching, Normalization};
use nucleo_matcher::{Config, Matcher, Utf32Str};
use serde::{Deserialize, Serialize};
use std::collections::BTreeSet;
use std::path::Path;
use std::str::FromStr;
use tauri::image::Image;
use tauri::{AppHandle, Manager, WebviewWindow};
use tauri_plugin_clipboard_manager::ClipboardExt;
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};
use tauri_plugin_log::log;
use tauri_plugin_store::StoreExt;

//////////////////// ////////////////////
// DB 関連
//////////////////// ////////////////////
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum SearchMode {
    Fuzzy,
    Substring,
}

#[derive(serde::Serialize)]
pub struct Searched {
    pub clip: db::Clip,
    pub snippet: String,
    pub score: u32,
    pub indices: Vec<u32>,
    pub trimmed_begin: bool,
    pub trimmed_end: bool,
}

// 検索
#[tauri::command]
pub fn search_clipboard(
    app_handle: AppHandle,
    search_mode: SearchMode,
    query: String,
    content_type: Vec<db::ContentType>,
    bookmark: Vec<bool>,
) -> Result<Vec<Searched>, String> {
    log::debug!("search_clipboard");
    let clipboard = db::find_many_clip(&app_handle, content_type, bookmark)?;

    // クエリが空の場合、先頭100件を返す
    if query.trim().is_empty() {
        return Ok(clipboard
            .iter()
            .take(100)
            .map(|clip| {
                let content = match clip.content_type {
                    db::ContentType::Text => clip.content.replace("\r\n", "\n"),
                    db::ContentType::Image => clip.description.replace("\r\n", "\n"),
                };
                let (snippet, indices, trimmed_begin, trimmed_end) =
                    extract_around_index_with_indices(&content, &[]);

                Searched {
                    clip: clip.clone(),
                    snippet,
                    score: 0,
                    indices,
                    trimmed_begin,
                    trimmed_end,
                }
            })
            .collect());
    }

    // fuzzy search
    let mut matcher = Matcher::new(Config::DEFAULT);
    let atom = Atom::new(
        &query,
        CaseMatching::Ignore,
        Normalization::Smart,
        match search_mode {
            SearchMode::Fuzzy => AtomKind::Fuzzy,
            SearchMode::Substring => AtomKind::Substring,
        },
        false,
    );

    let mut matches = Vec::new();
    for clip in clipboard.iter() {
        let mut buf = Vec::new();
        // 改行コード \r\n があると indices がずれるため、除去しておく
        let content = match clip.content_type {
            db::ContentType::Text => clip.content.replace("\r\n", "\n"),
            db::ContentType::Image => clip.description.replace("\r\n", "\n"),
        };
        let utf32 = Utf32Str::new(&content, &mut buf);
        let mut indices_origin: Vec<u32> = Vec::new();

        // score だけでなく indices（マッチ位置）も取得する
        if let Some(score) = atom.indices(utf32, &mut matcher, &mut indices_origin) {
            indices_origin.sort_unstable(); // 位置を昇順にソート

            let (snippet, indices_adjusted, trimmed_begin, trimmed_end) =
                extract_around_index_with_indices(&content, &indices_origin);

            matches.push(Searched {
                clip: clip.clone(),
                snippet,
                score: score as u32,
                indices: indices_adjusted,
                trimmed_begin,
                trimmed_end,
            });
        }
    }

    matches.sort_by(|a, b| b.score.cmp(&a.score));

    matches.truncate(30);
    Ok(matches)
}

fn extract_around_index_with_indices(
    content: &str,
    indices_origin: &[u32],
) -> (String, Vec<u32>, bool, bool) {
    if content.is_empty() {
        return (String::new(), Vec::new(), false, false);
    }

    if indices_origin.is_empty() {
        return (
            content.chars().take(80).collect(),
            Vec::new(),
            false,
            content.chars().count() > 80,
        );
    }

    let chars: Vec<(usize, char)> = content.char_indices().collect();
    let total_chars = chars.len();
    let first_match = indices_origin[0] as usize;
    if first_match >= total_chars {
        return (
            content.chars().take(80).collect(),
            Vec::new(),
            false,
            content.chars().count() > 80,
        );
    }

    // 1. 開始文字位置の決定 (indexより前)
    let begin_char_idx = first_match.saturating_sub(20);
    let end_char_idx = (first_match + 80).min(total_chars);

    let begin_byte = chars[begin_char_idx].0;
    let end_byte = if end_char_idx < total_chars {
        chars[end_char_idx].0
    } else {
        content.len()
    };
    let sliced_text = content[begin_byte..end_byte].to_string();

    // 4. indices のオフセット補正とフィルタリング
    // 切り出した範囲 (begin_char_idx .. end_char_idx) に含まれるインデックスのみを残し、
    // 切り出し開始位置 (begin_char_idx) 分だけ引き算する
    let indices_adjusted: Vec<u32> = indices_origin
        .iter()
        .copied()
        .filter_map(|idx| {
            let idx_usize = idx as usize;
            if idx_usize >= begin_char_idx && idx_usize < end_char_idx {
                Some((idx_usize - begin_char_idx) as u32)
            } else {
                None // 切り出し範囲から外れたものは除外
            }
        })
        .collect();

    (
        sliced_text,
        indices_adjusted,
        begin_char_idx > 0,
        end_char_idx < total_chars,
    )
}

// 指定IDの 1 行削除
#[tauri::command]
pub fn delete_clip(
    app_handle: AppHandle,
    id: i64,
    content: String,
    content_type: db::ContentType,
) -> Result<(), String> {
    log::debug!("delete_clip");
    db::delete_clip(&app_handle, id)?;

    if content_type == db::ContentType::Image {
        let path = Path::new(&content);
        let _ = std::fs::remove_file(path);
        log::debug!("delete_clip {}", content);
    }

    Ok(())
}

// 全件削除
#[tauri::command]
pub fn clear_clipboard(app_handle: AppHandle) -> Result<(), String> {
    log::debug!("clear_clipboard");
    db::delete_many_clip(&app_handle)?;

    if let Ok(image_dir) = clipboard_image::get_clipboard_image_dir(&app_handle) {
        let _ = std::fs::remove_dir_all(image_dir);
    }

    Ok(())
}

//////////////////// ////////////////////
// クリップボード関連
//////////////////// ////////////////////
#[tauri::command]
pub async fn send_clipboard(
    app_handle: AppHandle,
    window: WebviewWindow,
    content: String,
    content_type: db::ContentType,
) -> Result<(), String> {
    log::debug!("send_clipboard");
    if content_type == db::ContentType::Text {
        app_handle
            .clipboard()
            .write_text(content)
            .map_err(|e| e.to_string())?;
    } else {
        let image = Image::from_path(&content).map_err(|e| e.to_string())?;
        app_handle
            .clipboard()
            .write_image(&image)
            .map_err(|e| e.to_string())?;
    }

    window.hide().map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn send_and_paste(
    app_handle: AppHandle,
    window: WebviewWindow,
    content: String,
    content_type: db::ContentType,
) -> Result<(), String> {
    log::debug!("send_and_paste");
    let _ = send_clipboard(app_handle, window, content, content_type).await;

    tokio::spawn(async move {
        tokio::time::sleep(std::time::Duration::from_millis(50)).await;

        if let Ok(mut enigo) = Enigo::new(&Settings::default()) {
            #[cfg(target_os = "windows")]
            {
                let _ = enigo.key(Key::Control, enigo::Direction::Press);
                let _ = enigo.key(Key::Unicode('v'), enigo::Direction::Click);
                let _ = enigo.key(Key::Control, enigo::Direction::Release);
            }
            #[cfg(target_os = "macos")]
            {
                let _ = enigo.key(Key::Meta, enigo::Direction::Press);
                let _ = enigo.key(Key::Unicode('v'), enigo::Direction::Click);
                let _ = enigo.key(Key::Meta, enigo::Direction::Release);
            }
        }
    });

    Ok(())
}

//////////////////// ////////////////////
// グローバルショートカット関連
//////////////////// ////////////////////
#[tauri::command]
pub async fn update_window_toggle_shortcut(
    app: AppHandle,
    new_shortcut_str: String,
) -> Result<(), String> {
    log::debug!("update_window_toggle_shortcut");
    let global_shortcut = app.global_shortcut();

    let new_shortcut: Shortcut = new_shortcut_str
        .parse()
        .map_err(|_| format!("Invalid key.: {}", new_shortcut_str))?;

    let store = app
        .store("settings.json")
        .map_err(|err| format!("Failed to load the configuration file.: {}", err))?;

    let current_shortcut_str = match store.get("window_toggle_shortcut") {
        Some(value) => value.as_str().unwrap_or("Alt+V").to_string(),
        None => "Alt+V".to_string(),
    };

    let current_shortcut: Shortcut = current_shortcut_str
        .parse()
        .unwrap_or_else(|_| Shortcut::from_str("Alt+V").unwrap());

    if current_shortcut == new_shortcut {
        return Ok(());
    }

    let _ = global_shortcut.unregister(current_shortcut.clone());

    let app_handle = app.clone();
    let new_shortcut_for_closure = new_shortcut.clone();

    let register_result =
        global_shortcut.on_shortcut(new_shortcut.clone(), move |_app, shortcut, event| {
            if shortcut == &new_shortcut_for_closure && event.state() == ShortcutState::Pressed {
                toggle_window(&app_handle);
            }
        });

    match register_result {
        Ok(_) => {
            // 成功：設定ファイルに保存
            store.set(
                "window_toggle_shortcut",
                serde_json::json!(new_shortcut_str),
            );
            store
                .save()
                .map_err(|err| format!("Failed to save settings.: {}", err))?;

            Ok(())
        }
        Err(err) => {
            // 失敗：旧キーをハンドラー付きで復元（ロールバック）
            let app_handle_rollback = app.clone();
            let current_shortcut_for_closure = current_shortcut.clone();

            let _ = global_shortcut.on_shortcut(current_shortcut, move |_app, shortcut, event| {
                if shortcut == &current_shortcut_for_closure
                    && event.state() == ShortcutState::Pressed
                {
                    toggle_window(&app_handle_rollback);
                }
            });

            Err(format!(
                "Registration failed. It may already be in use by another app.: {}",
                err
            ))
        }
    }
}

pub fn register_toggle_shortcut(app: &AppHandle, preferred_shortcut: &str) -> Option<Shortcut> {
    let candidates = [preferred_shortcut, "Alt+V", "Alt+Shift+V", "Ctrl+Alt+V"];

    for candidate in candidates {
        let shortcut = match Shortcut::from_str(candidate) {
            Ok(shortcut) => shortcut,
            Err(err) => {
                log::warn!("Invalid shortcut candidate '{}': {}", candidate, err);
                continue;
            }
        };

        let app_handle = app.clone();
        let shortcut_for_closure = shortcut.clone();

        match app
            .global_shortcut()
            .on_shortcut(shortcut.clone(), move |_, shortcut, event| {
                if shortcut == &shortcut_for_closure && event.state() == ShortcutState::Pressed {
                    toggle_window(&app_handle);
                }
            }) {
            Ok(_) => return Some(shortcut_for_closure),
            Err(err) => log::warn!(
                "Failed to register global shortcut '{}': {}",
                candidate,
                err
            ),
        }
    }

    None
}

pub fn toggle_window(app_handle: &AppHandle) {
    if let Some(window) = app_handle.get_webview_window("main") {
        if window.is_visible().unwrap_or(false) {
            let _ = window.hide();
        } else {
            let _ = window.show();
            let _ = window.set_focus();
        }
    }
}

//////////////////// ////////////////////
// その他
//////////////////// ////////////////////
#[tauri::command]
pub fn list_system_font() -> Vec<String> {
    log::debug!("list_system_font");
    let source = SystemSource::new();
    let mut font_names = BTreeSet::new();

    if let Ok(families) = source.all_families() {
        for family in families {
            if !family.is_empty() && !family.starts_with('.') {
                font_names.insert(family);
            }
        }
    }

    font_names.into_iter().collect()
}
