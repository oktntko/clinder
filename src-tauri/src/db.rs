use rusqlite::{
    Connection, Result, params, params_from_iter,
    types::{FromSql, FromSqlError, FromSqlResult, ToSql, ToSqlOutput, ValueRef},
};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

pub fn ensure_db(app_handle: &AppHandle) -> Result<Connection, Box<dyn std::error::Error>> {
    let db_path: PathBuf = get_db_path(app_handle)?;
    let existed = db_path.exists(); // コネクションを作るとファイルも作られるので、コネクションを作る前に存在チェックする
    let conn = Connection::open(&db_path)?;

    if !existed {
        execute_ddl(&conn)?;
    }

    Ok(conn)
}

fn get_db_path(app_handle: &AppHandle) -> Result<PathBuf, Box<dyn std::error::Error>> {
    // %USERPROFILE%\AppData\Local\oktntko.clinder
    let app_data_dir = app_handle.path().app_local_data_dir()?;

    if !app_data_dir.exists() {
        fs::create_dir_all(&app_data_dir)?;
    }

    Ok(app_data_dir.join("clinder.db"))
}

fn execute_ddl(conn: &Connection) -> Result<(), rusqlite::Error> {
    /*
    | Copy From        | Plain Text | Image | File/Folder | Rich Text | Html |                     |
    | ---------------- | ---------- | ----- | ----------- | --------- | ---- | ------------------- |
    | Excel(cell copy) | YES        | YES   |             | YES       |      |                     |
    | Excel(edit copy) | YES        |       |             | YES       |      |                     |
    | Word             | YES        |       |             | YES       |      |                     |
    | Browser          | YES        |       |             |           | YES  |                     |
    | Image            |            | YES   |             |           |      |                     |
    | File/Folder      |            |       | YES         |           |      |                     |
    Rich Text と HTML は対応しない

    Plain Text & Image(hash=path)
    Plain Text
    Image
    File/Folder
     */
    const DDL: &str = "
CREATE TABLE IF NOT EXISTS clip(
    id              INTEGER PRIMARY KEY AUTOINCREMENT
  , content_type    TEXT NOT NULL CHECK(content_type IN ('text', 'image', 'files'))
  , plain_text      TEXT NOT NULL
  , image_hash      TEXT NOT NULL
  , files           TEXT NOT NULL
  , bookmark        BOOLEAN NOT NULL CHECK (bookmark IN (0, 1)) DEFAULT 0
  , updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP
  , UNIQUE(plain_text, image_hash, files)
);

CREATE INDEX IF NOT EXISTS idx_clip_updated_at ON clip(updated_at DESC);
";

    conn.execute_batch(DDL)?;

    Ok(())
}

#[derive(Clone, serde::Serialize)]
pub struct Clip {
    pub id: i64,
    pub content_type: ContentType,
    pub plain_text: String,
    pub image_hash: String,
    pub files: Vec<String>,
    pub bookmark: bool,
    pub updated_at: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ContentType {
    Text,
    Image,
    Files,
}

impl ToSql for ContentType {
    fn to_sql(&self) -> Result<ToSqlOutput<'_>> {
        let val = match self {
            ContentType::Text => "text",
            ContentType::Image => "image",
            ContentType::Files => "files",
        };
        Ok(ToSqlOutput::from(val))
    }
}

impl FromSql for ContentType {
    fn column_result(value: ValueRef<'_>) -> FromSqlResult<Self> {
        let text = value.as_str()?;
        match text {
            "text" => Ok(ContentType::Text),
            "image" => Ok(ContentType::Image),
            "files" => Ok(ContentType::Files),
            _ => Err(FromSqlError::Other(
                format!("Invalid content_type: {}", text).into(),
            )),
        }
    }
}

pub fn find_many_clip(
    app_handle: &AppHandle,
    param_content_type: Vec<ContentType>,
    param_bookmark: Vec<bool>,
) -> Result<Vec<Clip>, String> {
    let conn = ensure_db(app_handle).map_err(|e| e.to_string())?;

    let default_content_type = vec![ContentType::Text, ContentType::Image, ContentType::Files];
    let default_bookmark = vec![true, false];

    let content_type = if param_content_type.is_empty() {
        default_content_type
    } else {
        param_content_type
    };
    let bookmark = if param_bookmark.is_empty() {
        default_bookmark
    } else {
        param_bookmark
    };

    let sql = format!(
        "
SELECT
    id
  , content_type
  , plain_text
  , image_hash
  , files
  , bookmark
  , updated_at
FROM
  clip
WHERE
  content_type IN ({})
  AND bookmark IN ({})
ORDER BY
  updated_at DESC
  , id DESC",
        std::iter::repeat("?")
            .take(content_type.len())
            .collect::<Vec<_>>()
            .join(", "),
        std::iter::repeat("?")
            .take(bookmark.len())
            .collect::<Vec<_>>()
            .join(", ")
    );

    let all_params = std::iter::empty::<&dyn ToSql>()
        .chain(content_type.iter().map(|x| x as &dyn ToSql))
        .chain(bookmark.iter().map(|x| x as &dyn ToSql));

    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map(params_from_iter(all_params), row_to_clip)
        .map_err(|e| e.to_string())?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())
}

pub fn delete_clip(app_handle: &AppHandle, id: i64) -> Result<(), String> {
    let conn = ensure_db(app_handle).map_err(|e| e.to_string())?;

    const SQL: &str = "
DELETE
FROM
  clip
WHERE
  id = ?1";

    conn.execute(SQL, params![id]).map_err(|e| e.to_string())?;

    Ok(())
}

pub fn delete_all_clip(app_handle: &AppHandle) -> Result<(), String> {
    let conn = ensure_db(app_handle).map_err(|e| e.to_string())?;

    const SQL: &str = "
DELETE
FROM
  clip";

    conn.execute(SQL, []).map_err(|e| e.to_string())?;

    Ok(())
}

pub fn delete_many_clip_offset(
    app_handle: &AppHandle,
    history_size: i64,
) -> Result<Vec<Clip>, String> {
    let conn = ensure_db(app_handle).map_err(|e| e.to_string())?;

    const SQL: &str = "
DELETE 
FROM
  clip 
WHERE
  id NOT IN (
    SELECT
        id
    FROM
      clip
    ORDER BY
      updated_at DESC
    LIMIT
      ?1
  )
  AND bookmark = FALSE
RETURNING
    id
  , content_type
  , plain_text
  , image_hash
  , files
  , bookmark
  , updated_at";

    let mut stmt = conn.prepare(SQL).map_err(|e| e.to_string())?;

    let deleted_clipboard = stmt
        .query_map(params![history_size], row_to_clip)
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<Clip>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(deleted_clipboard)
}

pub fn upsert_clip(
    app_handle: &AppHandle,
    content_type: ContentType,
    plain_text: String,
    image_hash: String,
    files: Vec<String>,
    bookmark: bool,
) -> Result<Clip, String> {
    let conn = ensure_db(app_handle).map_err(|e| e.to_string())?;

    const SQL: &str = "
INSERT
INTO clip(content_type, plain_text, image_hash, files, bookmark)
VALUES (?1, ?2, ?3, ?4, ?5)
ON CONFLICT(plain_text, image_hash, files) DO
UPDATE 
SET
    plain_text = ?2
  , image_hash = ?3
  , files      = ?4
  , bookmark   = ?5
  , updated_at = CURRENT_TIMESTAMP
RETURNING
    id
  , content_type
  , plain_text
  , image_hash
  , files
  , bookmark
  , updated_at";

    conn.query_row(
        SQL,
        params![
            content_type,
            plain_text,
            image_hash,
            serde_json::to_string(&files).unwrap_or_default(),
            bookmark
        ],
        row_to_clip,
    )
    .map_err(|e| e.to_string())
}

pub fn update_clip_bookmark(
    app_handle: &AppHandle,
    bookmark: bool,
    id: i64,
) -> Result<Clip, String> {
    let conn = ensure_db(app_handle).map_err(|e| e.to_string())?;

    const SQL: &str = "
UPDATE clip
SET
  bookmark = ?1
  , updated_at = CURRENT_TIMESTAMP
WHERE
    id = ?2
RETURNING
    id
  , content_type
  , plain_text
  , image_hash
  , files
  , bookmark
  , updated_at";

    conn.query_row(SQL, params![bookmark, id], row_to_clip)
        .map_err(|e| e.to_string())
}

pub fn update_clip_text(
    app_handle: &AppHandle,
    plain_text: String,
    id: i64,
) -> Result<Clip, String> {
    let conn = ensure_db(app_handle).map_err(|e| e.to_string())?;

    const SQL: &str = "
UPDATE clip
SET
  plain_text = ?1
WHERE
    id = ?2
RETURNING
    id
  , content_type
  , plain_text
  , image_hash
  , files
  , bookmark
  , updated_at";

    conn.query_row(SQL, params![plain_text, id], row_to_clip)
        .map_err(|e| e.to_string())
}

fn row_to_clip(row: &rusqlite::Row<'_>) -> rusqlite::Result<Clip> {
    Ok(Clip {
        id: row.get(0)?,
        content_type: row.get(1)?,
        plain_text: row.get(2)?,
        image_hash: row.get(3)?,
        files: row
            .get::<_, Option<String>>(4)?
            .filter(|text| !text.trim().is_empty())
            .and_then(|text| serde_json::from_str(&text).ok())
            .unwrap_or_default(),
        bookmark: row.get(5)?,
        updated_at: row.get(6)?,
    })
}
