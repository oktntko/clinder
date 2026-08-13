use rusqlite::{
    params,
    types::{FromSql, FromSqlError, FromSqlResult, ToSql, ToSqlOutput, ValueRef},
    Connection, Result,
};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

pub fn ensure_db(app_handle: &AppHandle) -> Result<Connection, Box<dyn std::error::Error>> {
    let db_path: PathBuf = get_db_path(app_handle)?;
    let existed = db_path.exists();
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

pub fn find_many_clip(app_handle: &AppHandle) -> Result<Vec<Clip>, String> {
    let conn = ensure_db(app_handle).map_err(|e| e.to_string())?;

    const SQL: &str = "
SELECT
    id
  , content_type
  , content
  , updated_at
FROM
  clip
ORDER BY
  updated_at DESC
  , id DESC
LIMIT
  1000";

    let mut stmt = conn.prepare(SQL).map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| {
            Ok(Clip {
                id: row.get(0)?,
                content_type: row.get(1)?,
                content: row.get(2)?,
                updated_at: row.get(3)?,
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

pub fn delete_many_clip(app_handle: &AppHandle) -> Result<(), String> {
    let conn = ensure_db(app_handle).map_err(|e| e.to_string())?;

    const SQL: &str = "
DELETE
FROM
  clip";

    conn.execute(SQL, []).map_err(|e| e.to_string())?;

    Ok(())
}

pub fn upsert_clip(
    app_handle: &AppHandle,
    content_type: ContentType,
    content: String,
) -> Result<Clip, String> {
    let conn = ensure_db(app_handle).map_err(|e| e.to_string())?;

    const SQL: &str = "
INSERT
INTO clip(content_type, content)
VALUES (?1, ?2)
ON CONFLICT(content_type, content) DO
UPDATE 
SET
  updated_at = CURRENT_TIMESTAMP
RETURNING
    id
  , content_type
  , content
  , updated_at";

    conn.query_row(SQL, params![content_type, content], |row| {
        Ok(Clip {
            id: row.get(0)?,
            content_type: row.get(1)?,
            content: row.get(2)?,
            updated_at: row.get(3)?,
        })
    })
    .map_err(|e| e.to_string())
}
