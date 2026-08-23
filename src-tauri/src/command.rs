use crate::clipboard_image;
use crate::db;

use clipboard_rs::{Clipboard, ClipboardContext, common::RustImage};
use enigo::{Enigo, Key, Keyboard, Settings};
use font_kit::source::SystemSource;
use nucleo_matcher::pattern::{Atom, AtomKind, CaseMatching, Normalization};
use nucleo_matcher::{Config, Matcher, Utf32Str};
use serde::{Deserialize, Serialize};
use std::collections::BTreeSet;
use std::path::PathBuf;
use std::str::FromStr;
use tauri::{AppHandle, Manager, WebviewWindow};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};
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
#[tauri::command(rename_all = "snake_case")]
pub fn search_clipboard(
    app_handle: AppHandle,
    search_mode: SearchMode,
    query: String,
    content_type: Vec<db::ContentType>,
    bookmark: Vec<bool>,
) -> Result<Vec<Searched>, String> {
    log::debug!("search_clipboard");

    let max_items = app_handle
        .store("settings.json")
        .ok()
        .and_then(|store| store.get("max_items"))
        .and_then(|val| val.as_u64())
        .map(|v| v as usize)
        .unwrap_or(50 /* defaultMaxItems */);

    let clipboard = db::find_many_clip(&app_handle, content_type, bookmark)?;

    // クエリが空の場合、先頭100件を返す
    if query.trim().is_empty() {
        return Ok(clipboard
            .iter()
            .take(max_items)
            .map(|clip| {
                let content = clip.plain_text.replace("\r\n", "\n");
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
        let content = clip.plain_text.replace("\r\n", "\n");
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

    matches.truncate(max_items);
    Ok(matches)
}

const MAX_LENGTH: usize = 160;
fn extract_around_index_with_indices(
    content: &str,
    indices_origin: &[u32],
) -> (String, Vec<u32>, bool, bool) {
    if content.is_empty() {
        return (String::new(), Vec::new(), false, false);
    }

    if indices_origin.is_empty() {
        return (
            content.chars().take(MAX_LENGTH).collect(),
            Vec::new(),
            false,
            content.chars().count() > MAX_LENGTH,
        );
    }

    let chars: Vec<(usize, char)> = content.char_indices().collect();
    let total_chars = chars.len();
    let first_match = indices_origin[0] as usize;
    if first_match >= total_chars {
        return (
            content.chars().take(MAX_LENGTH).collect(),
            Vec::new(),
            false,
            content.chars().count() > MAX_LENGTH,
        );
    }

    // 開始文字位置の決定 (indexより前)
    let begin_char_idx = first_match.saturating_sub(20);
    let end_char_idx = (first_match + MAX_LENGTH).min(total_chars);

    let begin_byte = chars[begin_char_idx].0;
    let end_byte = if end_char_idx < total_chars {
        chars[end_char_idx].0
    } else {
        content.len()
    };
    let sliced_text = content[begin_byte..end_byte].to_string();

    // indices のオフセット補正とフィルタリング
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
#[tauri::command(rename_all = "snake_case")]
pub fn delete_clip(app_handle: AppHandle, id: i64, image_hash: String) -> Result<(), String> {
    log::debug!("delete_clip");
    db::delete_clip(&app_handle, id)?;

    if !image_hash.is_empty() {
        clipboard_image::delete_image(&app_handle, image_hash);
    }

    Ok(())
}

// 全件削除
#[tauri::command(rename_all = "snake_case")]
pub fn clear_clipboard(app_handle: AppHandle) -> Result<(), String> {
    log::debug!("clear_clipboard");
    db::delete_all_clip(&app_handle)?;

    if let Ok(image_dir) = clipboard_image::get_clipboard_image_dir(&app_handle) {
        let _ = std::fs::remove_dir_all(image_dir);
    }

    Ok(())
}

// ブックマーク更新
#[tauri::command(rename_all = "snake_case")]
pub fn update_clip_bookmark(app_handle: AppHandle, bookmark: bool, id: i64) -> Result<(), String> {
    log::debug!("update_clip_bookmark");
    db::update_clip_bookmark(&app_handle, bookmark, id)?;

    Ok(())
}

//////////////////// ////////////////////
// クリップボード関連
//////////////////// ////////////////////
fn paste() {
    tauri::async_runtime::spawn(async move {
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
}

#[tauri::command(rename_all = "snake_case")]
pub fn send_text(window: WebviewWindow, plain_text: String) -> Result<(), String> {
    log::debug!("send_text");

    let ctx = ClipboardContext::new().map_err(|e| e.to_string())?;
    ctx.set_text(plain_text).map_err(|e| e.to_string())?;

    window.hide().map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command(rename_all = "snake_case")]
pub fn paste_text(window: WebviewWindow, plain_text: String) -> Result<(), String> {
    log::debug!("paste_text");
    let _ = send_text(window, plain_text);

    paste();

    Ok(())
}

#[tauri::command(rename_all = "snake_case")]
pub fn send_image(
    app_handle: AppHandle,
    window: WebviewWindow,
    image_hash: String,
) -> Result<(), String> {
    log::debug!("send_image");

    let path =
        clipboard_image::get_full_path(&app_handle, image_hash).map_err(|e| e.to_string())?;
    let image_data = RustImage::from_path(&path.to_string_lossy()).map_err(|e| e.to_string())?;

    let ctx = ClipboardContext::new().map_err(|e| e.to_string())?;
    ctx.set_image(image_data).map_err(|e| e.to_string())?;

    window.hide().map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command(rename_all = "snake_case")]
pub fn paste_image(
    app_handle: AppHandle,
    window: WebviewWindow,
    image_hash: String,
) -> Result<(), String> {
    log::debug!("paste_image");
    let _ = send_image(app_handle, window, image_hash);

    paste();

    Ok(())
}

#[tauri::command(rename_all = "snake_case")]
pub fn send_files(window: WebviewWindow, files: Vec<String>) -> Result<(), String> {
    log::debug!("send_files");
    let ctx = ClipboardContext::new().map_err(|e| e.to_string())?;
    ctx.set_files(files).map_err(|e| e.to_string())?;

    window.hide().map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command(rename_all = "snake_case")]
pub fn paste_files(window: WebviewWindow, files: Vec<String>) -> Result<(), String> {
    log::debug!("paste_files");
    let _ = send_files(window, files);

    paste();

    Ok(())
}

//////////////////// ////////////////////
// グローバルショートカット関連
//////////////////// ////////////////////

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct WebViewShortcut {
    pub ctrl_key: bool,
    pub shift_key: bool,
    pub alt_key: bool,
    pub meta_key: bool,
    pub code: String,
}

impl WebViewShortcut {
    pub fn to_shortcut(&self, id: u32) -> Result<Shortcut, String> {
        let mut mods = Modifiers::empty();
        if self.ctrl_key {
            mods |= Modifiers::CONTROL;
        }
        if self.shift_key {
            mods |= Modifiers::SHIFT;
        }
        if self.alt_key {
            mods |= Modifiers::ALT;
        }
        if self.meta_key {
            mods |= Modifiers::SUPER; // Tauri では Command / Windows キーは SUPER
        }

        let key =
            Code::from_str(&self.code).map_err(|_| format!("Invalid key code: {}", self.code))?;

        Ok(Shortcut { mods, key, id })
    }
}

#[tauri::command(rename_all = "snake_case")]
pub fn update_global_shortcut_toggle_window(
    app: AppHandle,
    new_shortcut_web_view: WebViewShortcut,
) -> Result<(), String> {
    log::debug!("update_global_shortcut_toggle_window");

    let new_shortcut = new_shortcut_web_view
        .to_shortcut(1)
        .map_err(|err| format!("Failed to load the configuration file.: {}", err))?;

    let store = app
        .store("settings.json")
        .map_err(|err| format!("Failed to load the configuration file.: {}", err))?;

    let current_shortcut = store
        .get("toggle_window")
        .and_then(|val| serde_json::from_value::<WebViewShortcut>(val).ok())
        .and_then(|w| w.to_shortcut(1).ok())
        .map(Shortcut::from)
        .unwrap_or_else(|| Shortcut::from_str("Alt+V").unwrap());

    if current_shortcut == new_shortcut {
        return Ok(());
    }

    let global_shortcut = app.global_shortcut();
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
            store.set("toggle_window", serde_json::json!(new_shortcut_web_view));
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

pub fn register_global_shortcut_toggle_window(
    app: &AppHandle,
    shortcut: &Shortcut,
) -> Option<Shortcut> {
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
        Err(err) => log::warn!("Failed to register global shortcut: {}", err),
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
#[tauri::command(rename_all = "snake_case")]
pub fn restart_app(app_handle: AppHandle) {
    app_handle.restart();
}

#[tauri::command(rename_all = "snake_case")]
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

#[tauri::command(rename_all = "snake_case")]
pub fn get_real_app_local_data_dir(app_handle: AppHandle) -> Result<PathBuf, String> {
    let standard_dir = app_handle
        .path()
        .app_local_data_dir()
        .map_err(|e| e.to_string())?;

    #[cfg(target_os = "windows")]
    {
        if let Some(windows_dir) = get_msix_data_dir(&app_handle, DataDirType::Local) {
            return Ok(windows_dir);
        }
    }

    Ok(standard_dir)
}

#[tauri::command(rename_all = "snake_case")]
pub fn get_real_app_data_dir(app_handle: AppHandle) -> Result<PathBuf, String> {
    let standard_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?;

    #[cfg(target_os = "windows")]
    {
        if let Some(windows_dir) = get_msix_data_dir(&app_handle, DataDirType::Roaming) {
            return Ok(windows_dir);
        }
    }

    Ok(standard_dir)
}

#[cfg(target_os = "windows")]
enum DataDirType {
    Local,
    Roaming,
}

#[cfg(target_os = "windows")]
impl DataDirType {
    pub fn as_str(&self) -> &'static str {
        match self {
            DataDirType::Local => "Local",
            DataDirType::Roaming => "Roaming",
        }
    }
}

#[cfg(target_os = "windows")]
fn get_msix_data_dir(app_handle: &AppHandle, data_dir_type: DataDirType) -> Option<PathBuf> {
    let family_name = get_package_family_name()?;
    let local_app_data = std::env::var("LOCALAPPDATA").ok()?;
    let identifier = app_handle.config().identifier.clone();

    let real_path = PathBuf::from(local_app_data)
        .join("Packages")
        .join(family_name)
        .join("LocalCache")
        .join(data_dir_type.as_str())
        .join(identifier);

    Some(real_path)
}

// Windows APIを使って PackageFamilyName を取得する関数
#[cfg(target_os = "windows")]
fn get_package_family_name() -> Option<String> {
    use windows::Win32::Foundation::WIN32_ERROR;
    use windows::Win32::Storage::Packaging::Appx::GetCurrentPackageFamilyName;
    use windows::core::PWSTR;

    let mut length = 0u32;
    // バッファ長を取得
    let _ = unsafe { GetCurrentPackageFamilyName(&mut length, None) };
    if length == 0 {
        return None; // パッケージ化されていない（通常のEXE実行時など）
    }

    let mut buffer = vec![0u16; length as usize];

    let result =
        unsafe { GetCurrentPackageFamilyName(&mut length, Some(PWSTR(buffer.as_mut_ptr()))) };

    if result == WIN32_ERROR(0) {
        // ERROR_SUCCESS
        if let Some(null_pos) = buffer.iter().position(|&c| c == 0) {
            buffer.truncate(null_pos);
        }
        String::from_utf16(&buffer).ok()
    } else {
        None
    }
}
