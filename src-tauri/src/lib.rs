use enigo::{Enigo, Key, Keyboard, Settings};
use nucleo_matcher::pattern::{Atom, AtomKind, CaseMatching, Normalization};
use nucleo_matcher::{Config, Matcher, Utf32Str};
use rusqlite::{params, Connection};
use std::collections::VecDeque;
use std::sync::{Arc, RwLock};
use std::thread;
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager, State, WebviewWindow};
use tauri_plugin_clipboard_manager::ClipboardExt;
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};
use tauri_plugin_log::log;

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
    pub score: u32,
}

// データベースの初期化
fn init_db() -> Result<Connection, rusqlite::Error> {
    let conn = Connection::open("clipboard_history.db")?;
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
    Ok(conn)
}

// 指定IDの 1 行削除
#[tauri::command]
fn delete_history_item(id: i64, state: State<'_, AppState>) -> Result<(), String> {
    // DB から削除
    let conn = init_db().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM history WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;

    // RAM（RwLock）からも該当 ID を削除
    let mut mem = state.history.write().unwrap();
    mem.retain(|item| item.id != id);

    Ok(())
}

// 全件削除
#[tauri::command]
fn clear_all_history(state: State<'_, AppState>) -> Result<(), String> {
    // DB を全件削除 (DELETE OR TRUNCATE)
    let conn = init_db().map_err(|e| e.to_string())?;
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
            .map(|item| SearchResult {
                id: item.id,
                content: item.content.clone(),
                score: 0,
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
    let mut buf = Vec::new();

    for item in history.iter() {
        let utf32 = Utf32Str::new(&item.content, &mut buf);

        if let Some(score) = atom.score(utf32, &mut matcher) {
            matches.push(SearchResult {
                id: item.id,
                content: item.content.clone(),
                score: score as u32,
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
async fn select_and_paste(
    content: String,
    app_handle: AppHandle,
    window: WebviewWindow,
) -> Result<(), String> {
    app_handle
        .clipboard()
        .write_text(content)
        .map_err(|e| e.to_string())?;

    window.hide().map_err(|e| e.to_string())?;

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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let (db_tx, mut db_rx) = tokio::sync::mpsc::unbounded_channel::<String>();

    let history = Arc::new(RwLock::new(VecDeque::<HistoryItem>::with_capacity(100)));

    // アプリ起動時に DB から (id, content) を読み出す
    if let Ok(conn) = init_db() {
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
                let mut mem = history.write().unwrap();
                for item in rows.flatten() {
                    mem.push_back(item);
                }
            }
        }
    }

    // 1. SQLite 書き込み専用スレッド
    let history_for_db_thread = Arc::clone(&history);
    thread::spawn(move || {
        let conn = match init_db() {
            Ok(c) => c,
            Err(e) => {
                log::error!("Failed to open DB: {}", e);
                return;
            }
        };

        while let Some(text) = db_rx.blocking_recv() {
            // INSERT または UPDATE 実行
            let res = conn.execute(
                "INSERT
                    INTO history(content)
                    VALUES (?1)
                        ON CONFLICT(content) DO UPDATE
                    SET
                        created_at = CURRENT_TIMESTAMP",
                params![text],
            );

            // DB に保存/更新された行の id を取得し、RAM 上の HistoryItem の id を同期・更新
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

    let history_clone = Arc::clone(&history);

    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(
            tauri_plugin_log::Builder::new()
                .level(log::LevelFilter::Trace)
                .build(),
        )
        .plugin(tauri_plugin_clipboard_manager::init())
        .manage(AppState {
            history: Arc::clone(&history),
            db_tx,
        })
        .setup(move |app| {
            let handle = app.handle().clone();

            let toggle_shortcut = Shortcut::new(Some(Modifiers::ALT), Code::KeyV);

            app.global_shortcut().on_shortcut(
                toggle_shortcut,
                move |app_handle, shortcut, event| {
                    if shortcut == &toggle_shortcut && event.state() == ShortcutState::Pressed {
                        toggle_window(app_handle);
                    }
                },
            )?;

            // 2. クリップボード監視スレッド
            thread::spawn(move || {
                let mut last_text = String::new();

                loop {
                    if let Ok(current_text) = handle.clipboard().read_text() {
                        if !current_text.is_empty() && current_text != last_text {
                            last_text = current_text.clone();
                            log::debug!("changed-clipboard {}", current_text);

                            // --- 1. SQLite へ保存 & 発行された id を取得 ---
                            if let Ok(conn) = init_db() {
                                // RETURNING id を使って、INSERT/UPDATE された行の id を直接取得
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

                            let _ = handle.emit("clipboard-updated", &current_text);
                        }
                    }

                    thread::sleep(Duration::from_millis(500));
                }
            });

            Ok(())
        })
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            search_history,
            select_and_paste,
            delete_history_item,
            clear_all_history
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
