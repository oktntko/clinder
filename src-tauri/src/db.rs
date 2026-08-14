use rusqlite::{
    params, params_from_iter,
    types::{FromSql, FromSqlError, FromSqlResult, ToSql, ToSqlOutput, ValueRef},
    Connection, Result,
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
    const DDL: &str = "
CREATE TABLE IF NOT EXISTS clip(
    id              INTEGER PRIMARY KEY AUTOINCREMENT
  , content_type    TEXT NOT NULL CHECK(content_type IN ('text', 'image'))
  , content         TEXT NOT NULL
  , description     TEXT NOT NULL
  , bookmark        BOOLEAN NOT NULL CHECK (bookmark IN (0, 1)) DEFAULT 0
  , updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP
  , UNIQUE(content_type, content)
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
    pub content: String,
    pub description: String,
    pub bookmark: bool,
    pub updated_at: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ContentType {
    Text,
    Image,
}

impl ToSql for ContentType {
    fn to_sql(&self) -> Result<ToSqlOutput<'_>> {
        let val = match self {
            ContentType::Text => "text",
            ContentType::Image => "image",
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

    let default_content_type = vec![ContentType::Text, ContentType::Image];
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
  , content
  , description
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
        .query_map(params_from_iter(all_params), |row| {
            Ok(Clip {
                id: row.get(0)?,
                content_type: row.get(1)?,
                content: row.get(2)?,
                description: row.get(3)?,
                bookmark: row.get(4)?,
                updated_at: row.get(5)?,
            })
        })
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
RETURNING
    id
  , content_type
  , content
  , description
  , bookmark
  , updated_at";

    let mut stmt = conn.prepare(SQL).map_err(|e| e.to_string())?;

    let deleted_clipboard = stmt
        .query_map(params![history_size], |row| {
            Ok(Clip {
                id: row.get(0)?,
                content_type: row.get(1)?,
                content: row.get(2)?,
                description: row.get(3)?,
                bookmark: row.get(4)?,
                updated_at: row.get(5)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<Clip>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(deleted_clipboard)
}

pub fn upsert_clip(
    app_handle: &AppHandle,
    content_type: ContentType,
    content: String,
    description: String,
    bookmark: bool,
) -> Result<Clip, String> {
    let conn = ensure_db(app_handle).map_err(|e| e.to_string())?;

    const SQL: &str = "
INSERT
INTO clip(content_type, content, description, bookmark)
VALUES (?1, ?2, ?3, ?4)
ON CONFLICT(content_type, content) DO
UPDATE 
SET
  description = ?3
  , bookmark = ?4
  , updated_at = CURRENT_TIMESTAMP
RETURNING
    id
  , content_type
  , content
  , description
  , bookmark
  , updated_at";

    conn.query_row(
        SQL,
        params![content_type, content, description, bookmark],
        |row| {
            Ok(Clip {
                id: row.get(0)?,
                content_type: row.get(1)?,
                content: row.get(2)?,
                description: row.get(3)?,
                bookmark: row.get(4)?,
                updated_at: row.get(5)?,
            })
        },
    )
    .map_err(|e| e.to_string())
}

pub fn update_clip(app_handle: &AppHandle, bookmark: bool, id: i64) -> Result<Clip, String> {
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
  , content
  , description
  , bookmark
  , updated_at";

    conn.query_row(SQL, params![bookmark, id], |row| {
        Ok(Clip {
            id: row.get(0)?,
            content_type: row.get(1)?,
            content: row.get(2)?,
            description: row.get(3)?,
            bookmark: row.get(4)?,
            updated_at: row.get(5)?,
        })
    })
    .map_err(|e| e.to_string())
}
