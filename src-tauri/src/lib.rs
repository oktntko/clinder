use enigo::{Enigo, Key, Keyboard, Settings};
use nucleo_matcher::pattern::{Atom, AtomKind, CaseMatching, Normalization};
use nucleo_matcher::{Config, Matcher, Utf32Str};
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::collections::VecDeque;
use std::path::{Path, PathBuf};
use std::str::FromStr;
use std::sync::{Arc, RwLock};
use std::time::Duration;
use std::{fs, thread};
use tauri::{AppHandle, Emitter, Manager, State, WebviewWindow};
use tauri_plugin_clipboard_manager::ClipboardExt;
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};
use tauri_plugin_log::log;
use tauri_plugin_store::StoreExt;

// RAM 上で保持する要素（ID と テキスト）
#[derive(Clone, serde::Serialize)]
pub struct HistoryItem {
    pub id: i64,
    pub content: String,
}

// アプリ全体で共有する State
pub struct AppState {
    // RAM 上の履歴（id と content のペアを保持）
    pub history: Arc<RwLock<VecDeque<HistoryItem>>>,
    // DB への書き込みキュー
    pub db_tx: tokio::sync::mpsc::UnboundedSender<String>,
}

// 検索結果の型定義（フロントに返す）
#[derive(serde::Serialize)]
pub struct SearchResult {
    pub id: i64,
    pub content: String,
    pub snippet: String,
    pub score: u32,
    pub indices: Vec<u32>,
    pub trimmed_begin: bool,
    pub trimmed_end: bool,
}

fn get_database_path(app_handle: &AppHandle) -> Result<PathBuf, Box<dyn std::error::Error>> {
    // %USERPROFILE%\AppData\Local\oktntko.clinder
    let app_data_dir = app_handle.path().app_local_data_dir()?;

    if !app_data_dir.exists() {
        fs::create_dir_all(&app_data_dir)?;
    }

    Ok(app_data_dir.join("clipboard_history.db"))
}

fn open_db_connection(path: &Path) -> Result<Connection, rusqlite::Error> {
    Connection::open(path)
}

fn ensure_db_schema(conn: &Connection) -> Result<(), rusqlite::Error> {
    conn.execute(
        "CREATE TABLE IF NOT EXISTS history(
                id INTEGER PRIMARY KEY AUTOINCREMENT
                , content TEXT NOT NULL UNIQUE
                , created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )",
        [],
    )?;

    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_history_created_at 
        ON history(created_at DESC)",
        [],
    )?;

    Ok(())
}

fn init_db(app: &AppHandle) -> Result<Connection, Box<dyn std::error::Error>> {
    let db_path = get_database_path(app)?;
    let existed = db_path.exists();
    let conn = open_db_connection(&db_path)?;

    if !existed {
        ensure_db_schema(&conn)?;
    }

    Ok(conn)
}

// 指定IDの 1 行削除
#[tauri::command]
fn delete_history_item(
    app_handle: AppHandle,
    id: i64,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let conn = init_db(&app_handle).map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM history WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;

    // RAM（RwLock）からも該当 ID を削除
    let mut mem = state.history.write().unwrap();
    mem.retain(|item| item.id != id);

    Ok(())
}

// 全件削除
#[tauri::command]
fn clear_all_history(app_handle: AppHandle, state: State<'_, AppState>) -> Result<(), String> {
    // DB を全件削除 (DELETE OR TRUNCATE)
    let conn = init_db(&app_handle).map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM history", [])
        .map_err(|e| e.to_string())?;

    // RAM も空にする
    let mut mem = state.history.write().unwrap();
    mem.clear();

    Ok(())
}

fn load_history_from_db(app_handle: &AppHandle) -> Result<Vec<HistoryItem>, String> {
    let conn = init_db(app_handle).map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT
                id,
                content
            FROM history
            ORDER BY created_at DESC, id DESC",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| {
            Ok(HistoryItem {
                id: row.get(0)?,
                content: row.get(1)?,
            })
        })
        .map_err(|e| e.to_string())?;

    rows.into_iter()
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum SearchMode {
    Fuzzy,
    Substring,
}

fn search_history_items(
    history: &[HistoryItem],
    query: &str,
    search_mode: SearchMode,
) -> Vec<SearchResult> {
    // クエリが空の場合は、直近の最新30件をそのまま返す
    if query.trim().is_empty() {
        return history
            .iter()
            .take(30)
            .map(|item| {
                let (snippet, indices, trimmed_begin, trimmed_end) =
                    extract_around_index_with_indices(&item.content, &[]);

                SearchResult {
                    id: item.id,
                    content: item.content.clone(),
                    snippet,
                    score: 0,
                    indices,
                    trimmed_begin,
                    trimmed_end,
                }
            })
            .collect();
    }

    // nucleo マッチャーの初期化
    let mut matcher = Matcher::new(Config::DEFAULT);
    let atom = Atom::new(
        query,
        CaseMatching::Ignore,
        Normalization::Smart,
        match search_mode {
            SearchMode::Fuzzy => AtomKind::Fuzzy,
            SearchMode::Substring => AtomKind::Substring,
        },
        false,
    );

    let mut matches = Vec::new();

    for item in history.iter() {
        let mut buf = Vec::new();
        // 改行コード \r\n があると indices がずれるため、除去しておく
        let content = item.content.replace("\r\n", "\n");
        let utf32 = Utf32Str::new(&content, &mut buf);
        let mut indices = Vec::new();

        // score だけでなく indices（マッチ位置）も取得する
        if let Some(score) = atom.indices(utf32, &mut matcher, &mut indices) {
            indices.sort_unstable(); // 位置を昇順にソート

            let (snippet, adjusted_indices, trimmed_begin, trimmed_end) =
                extract_around_index_with_indices(&content, &indices);

            matches.push(SearchResult {
                id: item.id,
                content: item.content.clone(),
                snippet,
                score: score as u32,
                indices: adjusted_indices,
                trimmed_begin,
                trimmed_end,
            });
        }
    }

    // スコアが高い順（降順）にソート
    matches.sort_by(|a, b| b.score.cmp(&a.score));

    // 上位30件に絞って返す
    matches.truncate(30);
    matches
}

// 検索
#[tauri::command]
fn search_history(
    query: String,
    search_mode: SearchMode,
    app_handle: AppHandle,
    state: State<'_, AppState>,
) -> Vec<SearchResult> {
    let history_from_db = load_history_from_db(&app_handle);

    let history_items = match history_from_db {
        Ok(items) => items,
        Err(err) => {
            log::warn!("Falling back to in-memory history for search: {}", err);
            state
                .history
                .read()
                .unwrap()
                .iter()
                .cloned()
                .collect::<Vec<_>>()
        }
    };

    search_history_items(&history_items, &query, search_mode)
}

#[tauri::command]
async fn select(
    content: String,
    app_handle: AppHandle,
    window: WebviewWindow,
) -> Result<(), String> {
    app_handle
        .clipboard()
        .write_text(content)
        .map_err(|e| e.to_string())?;

    window.hide().map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
async fn select_and_paste(
    content: String,
    app_handle: AppHandle,
    window: WebviewWindow,
) -> Result<(), String> {
    let _ = select(content, app_handle, window).await;

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

#[tauri::command]
async fn update_window_toggle_shortcut(
    new_shortcut_str: String,
    app: AppHandle,
) -> Result<(), String> {
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

fn register_toggle_shortcut(app: &AppHandle, preferred_shortcut: &str) -> Option<Shortcut> {
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let (db_tx, mut db_rx) = tokio::sync::mpsc::unbounded_channel::<String>();

    let history = Arc::new(RwLock::new(VecDeque::<HistoryItem>::with_capacity(100)));

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
        .manage(AppState {
            history: Arc::clone(&history),
            db_tx,
        })
        .setup(move |app| {
            let app_handle = app.handle().clone();
            let history_for_setup = Arc::clone(&history);
            let history_for_db_thread = Arc::clone(&history);
            let history_clone = Arc::clone(&history);

            if let Ok(conn) = init_db(&app_handle) {
                if let Ok(mut stmt) = conn.prepare(
                    "SELECT
                            id
                            , content
                        FROM
                            history
                        ORDER BY
                            created_at DESC
                            , id DESC
                        LIMIT
                            100",
                ) {
                    if let Ok(rows) = stmt.query_map([], |row| {
                        Ok(HistoryItem {
                            id: row.get(0)?,
                            content: row.get(1)?,
                        })
                    }) {
                        let mut mem = history_for_setup.write().unwrap();
                        for item in rows.flatten() {
                            mem.push_back(item);
                        }
                    }
                }
            }

            let db_handle = app_handle.clone();
            thread::spawn(move || {
                let conn = match init_db(&db_handle) {
                    Ok(c) => c,
                    Err(e) => {
                        log::error!("Failed to open DB: {}", e);
                        return;
                    }
                };

                while let Some(text) = db_rx.blocking_recv() {
                    let res = conn.execute(
                        "INSERT
                            INTO history(content)
                            VALUES (?1)
                                ON CONFLICT(content) DO UPDATE
                            SET
                                created_at = CURRENT_TIMESTAMP",
                        params![text],
                    );

                    if res.is_ok() {
                        if let Ok(last_id) = conn.query_row(
                            "SELECT id FROM history WHERE content = ?1",
                            params![text],
                            |row| row.get::<_, i64>(0),
                        ) {
                            let mut mem = history_for_db_thread.write().unwrap();
                            mem.retain(|x| x.content != text);
                            mem.push_front(HistoryItem {
                                id: last_id,
                                content: text,
                            });
                            if mem.len() > 100 {
                                mem.pop_back();
                            }
                        }
                    }
                }
            });

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

            if register_toggle_shortcut(&app_handle, &shortcut_str).is_none() {
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

                            if let Ok(conn) = init_db(&clipboard_handle) {
                                let res: Result<i64, _> = conn.query_row(
                                    "INSERT
                                        INTO history(content)
                                        VALUES (?1)
                                            ON CONFLICT(content) DO UPDATE
                                        SET
                                            created_at = CURRENT_TIMESTAMP RETURNING id",
                                    params![current_text],
                                    |row| row.get(0),
                                );

                                if let Ok(new_id) = res {
                                    // --- 2. メモリ（RAM）の先頭に追加 ＆ 重複・上限制御 ---
                                    let mut mem = history_clone.write().unwrap();

                                    // 既存の同じテキストを削除（重複除去）
                                    mem.retain(|x| x.content != current_text);

                                    // 最新の id と content を先頭に追加
                                    mem.push_front(HistoryItem {
                                        id: new_id,
                                        content: current_text.clone(),
                                    });

                                    // 100件を超えたら古いものを削除
                                    if mem.len() > 100 {
                                        mem.pop_back();
                                    }
                                }
                            }

                            let _ = app_handle.emit("clipboard-updated", &current_text);
                        }
                    }

                    thread::sleep(Duration::from_millis(500));
                }
            });

            Ok(())
        })
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            select,
            search_history,
            select_and_paste,
            delete_history_item,
            clear_all_history,
            update_window_toggle_shortcut
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn toggle_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        if window.is_visible().unwrap_or(false) {
            let _ = window.hide();
        } else {
            let _ = window.show();
            let _ = window.set_focus();
        }
    }
}

fn extract_around_index_with_indices(
    text: &str,
    indices: &[u32],
) -> (String, Vec<u32>, bool, bool) {
    if text.is_empty() {
        return (String::new(), Vec::new(), false, false);
    }

    if indices.is_empty() {
        return (
            text.chars().take(80).collect(),
            Vec::new(),
            false,
            text.chars().count() > 80,
        );
    }

    let chars: Vec<(usize, char)> = text.char_indices().collect();
    let total_chars = chars.len();
    let first_match = indices[0] as usize;
    if first_match >= total_chars {
        return (
            text.chars().take(80).collect(),
            Vec::new(),
            false,
            text.chars().count() > 80,
        );
    }

    // 1. 開始文字位置の決定 (indexより前)
    let begin_char_idx = first_match.saturating_sub(20);
    let end_char_idx = (first_match + 80).min(total_chars);

    let begin_byte = chars[begin_char_idx].0;
    let end_byte = if end_char_idx < total_chars {
        chars[end_char_idx].0
    } else {
        text.len()
    };
    let sliced_text = text[begin_byte..end_byte].to_string();

    // 4. indices のオフセット補正とフィルタリング
    // 切り出した範囲 (begin_char_idx .. end_char_idx) に含まれるインデックスのみを残し、
    // 切り出し開始位置 (begin_char_idx) 分だけ引き算する
    let adjusted_indices: Vec<u32> = indices
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
        adjusted_indices,
        begin_char_idx > 0,
        end_char_idx < total_chars,
    )
}
