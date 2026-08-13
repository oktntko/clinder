use sha2::{Digest, Sha256};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

pub fn calculate_hash(bytes: &[u8]) -> String {
    let digest = Sha256::digest(bytes);
    hex::encode(digest)
}

// アプリのデータ保存ディレクトリを取得
pub fn get_clipboard_image_dir(
    app_handle: &AppHandle,
) -> Result<PathBuf, Box<dyn std::error::Error>> {
    let image_dir = app_handle
        .path()
        .app_local_data_dir()?
        .join("clipboard_image");

    if !image_dir.exists() {
        fs::create_dir_all(&image_dir)?;
    }

    Ok(image_dir)
}
