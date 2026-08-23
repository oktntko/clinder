use sha2::{Digest, Sha256};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};
use tauri_plugin_log::log;

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

pub fn get_filename(image_hash: String) -> String {
    format!("{}.png", &image_hash)
}

pub fn get_full_path(
    app_handle: &AppHandle,
    image_hash: String,
) -> Result<PathBuf, Box<dyn std::error::Error>> {
    get_clipboard_image_dir(&app_handle)
        .and_then(|image_dir| Ok(image_dir.join(get_filename(image_hash))))
}

pub fn delete_image(app_handle: &AppHandle, image_hash: String) {
    get_full_path(&app_handle, image_hash).ok().map(|path| {
        if let Err(e) = std::fs::remove_file(&path) {
            log::warn!("Failed to delete image file {:?}: {}", path, e);
        }
    });
}
