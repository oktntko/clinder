use rusqlite::{params, Connection};
use std::collections::VecDeque;
use std::sync::{Arc, RwLock};
use std::thread;
use std::time::Duration;
use tauri::State;
use tauri_plugin_clipboard_manager::ClipboardExt;
use tauri_plugin_log::log;

// アプリ全体で共有する State
pub struct AppState {
    // RAM 上の履歴（直近 N 件を保持）
    pub history: Arc<RwLock<VecDeque<String>>>,
    // DB への書き込みキュー（非同期処理用）
    pub db_tx: tokio::sync::mpsc::UnboundedSender<String>,
}

// データベースの初期化
fn init_db() -> Result<Connection, rusqlite::Error> {
    // アプリデータディレクトリ等に保存する場合は PathResolver を使いますが、
    // テスト用にカレント/ローカル DB ファイル名で初期化
    let conn = Connection::open("clipboard_history.db")?;
    conn.execute(
        "CREATE TABLE IF NOT EXISTS history(
                id INTEGER PRIMARY KEY AUTOINCREMENT
                , content TEXT NOT NULL UNIQUE
                , created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )",
        [],
    )?;

    // 高速ソート用インデックス作成（追記しておくと安心）
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_history_created_at 
                ON history(created_at DESC)",
        [],
    )?;
    Ok(conn)
}

// UIから最初に RAM 上の履歴一覧を取得するためのコマンド（後で使います）
#[tauri::command]
fn get_history(state: State<'_, AppState>) -> Vec<String> {
    let history = state.history.read().unwrap();
    history.iter().cloned().collect()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // SQLite チャンネル作成
    let (db_tx, mut db_rx) = tokio::sync::mpsc::unbounded_channel::<String>();

    // メモリ上の履歴初期化 (最大100件保存と仮定)
    let history = Arc::new(RwLock::new(VecDeque::with_capacity(100)));

    // アプリ起動時に DB から最新履歴を RAM にキャッシュロードしておく処理
    if let Ok(conn) = init_db() {
        if let Ok(mut stmt) = conn.prepare(
            "SELECT
                    content
                FROM
                    history
                ORDER BY
                    created_at DESC
                    , id DESC
                LIMIT
                    100",
        ) {
            if let Ok(rows) = stmt.query_map([], |row| row.get::<_, String>(0)) {
                let mut mem = history.write().unwrap();
                for content in rows.flatten() {
                    mem.push_back(content);
                }
            }
        }
    }

    // 1. SQLite 専用のバックグラウンドタスク（書き込み専用スレッド）
    thread::spawn(move || {
        let conn = match init_db() {
            Ok(c) => c,
            Err(e) => {
                log::error!("Failed to open DB: {}", e);
                return;
            }
        };

        while let Some(text) = db_rx.blocking_recv() {
            // 重複があれば最新に更新、なければ INSERT
            let _ = conn.execute(
                "INSERT
                    INTO history(content)
                    VALUES (?1)
                        ON CONFLICT(content) DO UPDATE
                    SET
                        created_at = CURRENT_TIMESTAMP",
                params![text],
            );
        }
    });

    let history_clone = Arc::clone(&history);
    let db_tx_clone = db_tx.clone();

    tauri::Builder::default()
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

            // 2. クリップボード監視スレッド
            thread::spawn(move || {
                let mut last_text = String::new();

                loop {
                    if let Ok(current_text) = handle.clipboard().read_text() {
                        if !current_text.is_empty() && current_text != last_text {
                            last_text = current_text.clone();
                            log::debug!("changed-clipboard {}", current_text);

                            // A. メモリ（RAM）の先頭に追加 ＆ 重複削除
                            {
                                let mut mem = history_clone.write().unwrap();
                                // 既に同じ文字列があれば除去して先頭に移動
                                mem.retain(|x| x != &current_text);
                                mem.push_front(current_text.clone());

                                // メモリ上限 (例: 100件)
                                if mem.len() > 100 {
                                    mem.pop_back();
                                }
                            }

                            // B. 非同期で SQLite INSERT タスクへ送信
                            let _ = db_tx_clone.send(current_text);
                        }
                    }

                    thread::sleep(Duration::from_millis(500));
                }
            });

            Ok(())
        })
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![get_history])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
