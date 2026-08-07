use enigo::{Enigo, Key, Keyboard, Settings};
use nucleo_matcher::pattern::{Atom, AtomKind, CaseMatching, Normalization};
use nucleo_matcher::{Config, Matcher, Utf32Str};
use rusqlite::{params, Connection};
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

// 検索
#[tauri::command]
fn search_history(query: String, state: State<'_, AppState>) -> Vec<SearchResult> {
    let history = state.history.read().unwrap();

    // クエリが空の場合は、直近の最新30件をそのまま返す
    if query.trim().is_empty() {
        return history
            .iter()
            .take(30)
            .map(|item| {
                // 空検索でも 100 文字を超える場合は先頭 100 文字にする（安全策）
                let truncated_content = if item.content.chars().count() > 100 {
                    let mut s: String = item.content.chars().take(100).collect();
                    s.push_str("...");
                    s
                } else {
                    item.content.clone()
                };

                SearchResult {
                    id: item.id,
                    content: item.content.clone(),
                    snippet: truncated_content,
                    score: 0,
                    indices: Vec::new(),
                }
            })
            .collect();
    }

    // nucleo マッチャーの初期化
    let mut matcher = Matcher::new(Config::DEFAULT);
    let atom = Atom::new(
        &query,
        CaseMatching::Ignore,
        Normalization::Smart,
        AtomKind::Fuzzy,
        false,
    );

    let mut matches = Vec::new();

    for item in history.iter() {
        let mut buf = Vec::new();
        let utf32 = Utf32Str::new(&item.content, &mut buf);
        let mut indices = Vec::new();

        // score だけでなく indices（マッチ位置）も取得する
        if let Some(score) = atom.indices(utf32, &mut matcher, &mut indices) {
            indices.sort_unstable(); // 位置を昇順にソート

            let char_count = item.content.chars().count();
            let (snippet, adjusted_indices) = if char_count > 100 && !indices.is_empty() {
                // -------------------------------------------------------------
                // ★ スニペット化処理 (100文字以上の場合)
                // -------------------------------------------------------------
                let first_match = indices[0] as usize;

                // 最初のマッチ位置の「前50文字」を開始点とする
                let start_char_idx = first_match.saturating_sub(50);
                // 開始点から「最大100文字」を切出範囲とする
                let end_char_idx = (start_char_idx + 100).min(char_count);

                // 文字単位で安全にスライス
                let mut snippet_str: String = item
                    .content
                    .chars()
                    .skip(start_char_idx)
                    .take(end_char_idx - start_char_idx)
                    .collect();

                // 先頭・末尾が切り取られていれば "..." を付与
                if start_char_idx > 0 {
                    snippet_str.insert_str(0, "...");
                }
                if end_char_idx < char_count {
                    snippet_str.push_str("...");
                }

                // 「...」を先頭に付けた場合オフセットが 3 文字分ずれる
                let prefix_offset = if start_char_idx > 0 { 3 } else { 0 };

                // スニペット範囲内に含まれるインデックスだけを抽出＆位置再計算
                let new_indices: Vec<u32> = indices
                    .iter()
                    .map(|&i| i as usize)
                    .filter(|&i| i >= start_char_idx && i < end_char_idx)
                    .map(|i| (i - start_char_idx + prefix_offset) as u32)
                    .collect();

                (snippet_str, new_indices)
            } else {
                // 100文字以下の場合はそのまま使う
                (item.content.clone(), indices)
            };

            matches.push(SearchResult {
                id: item.id,
                content: item.content.clone(),
                snippet: snippet,
                score: score as u32,
                indices: adjusted_indices,
            });
        }
    }

    // スコアが高い順（降順）にソート
    matches.sort_by(|a, b| b.score.cmp(&a.score));

    // 上位30件に絞って返す
    matches.truncate(30);
    matches
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

            let store = app.store("settings.json")?;
            let shortcut_str = match store.get("window_toggle_shortcut") {
                Some(value) => value.as_str().unwrap_or("Alt+V").to_string(),
                None => "Alt+V".to_string(),
            };
            let toggle_shortcut = Shortcut::from_str(&shortcut_str)
                .unwrap_or_else(|_| Shortcut::from_str("Alt+V").unwrap());

            app.global_shortcut().on_shortcut(
                toggle_shortcut,
                move |app_handle, shortcut, event| {
                    if shortcut == &toggle_shortcut && event.state() == ShortcutState::Pressed {
                        toggle_window(app_handle);
                    }
                },
            )?;

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
