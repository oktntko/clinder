use image;
use ocr_rs::{OcrEngine, OcrResult_};
use std::fs;
use std::fs::File;
use std::io::Write;
use std::path;
use tauri::{AppHandle, Manager};

pub async fn read_text(
    app_handle: AppHandle,
    image_path: &std::path::Path,
) -> Result<String, String> {
    let models_dir = models_dir(app_handle)?;

    let det_model = models_dir.join(MODELS.det_model.name);
    let rec_model = models_dir.join(MODELS.rec_model.name);
    let charset = models_dir.join(MODELS.charset.name);

    let engine = OcrEngine::new(det_model, rec_model, charset, None).map_err(|e| e.to_string())?;

    let image = image::open(image_path).map_err(|e| e.to_string())?;
    let results = engine.recognize(&image).map_err(|e| e.to_string())?;

    let text: Vec<String> = sort_ocr_results(results)
        .iter()
        .map(|x| x.text.to_string())
        .collect();

    Ok(text.join("\n"))
}

fn models_dir(app_handle: AppHandle) -> Result<path::PathBuf, String> {
    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?;
    let models_dir = app_data_dir.join("models");

    if !models_dir.exists() {
        fs::create_dir_all(&models_dir).map_err(|e| e.to_string())?;
    }

    Ok(models_dir)
}

/// OCR結果を読順（上→下、同じ行内は左→右）にソートする
pub fn sort_ocr_results(mut results: Vec<OcrResult_>) -> Vec<OcrResult_> {
    if results.is_empty() {
        return results;
    }

    // 1. 全要素の平均高さを計算し、同じ行とみなす Y 座標の許容誤差（閾値）を算出
    let total_height: u32 = results.iter().map(|res| res.bbox.rect.height()).sum();
    let avg_height = (total_height as f32) / (results.len() as f32);
    let y_threshold = (avg_height * 0.5) as i32; // 高さの半分以下なら同じ行と判定

    // 2. 一旦 Y 座標（top）で全体を昇順ソート
    results.sort_by(|a, b| a.bbox.rect.top().cmp(&b.bbox.rect.top()));

    // 3. 同じ行ごとにグループ分けし、行内で X 座標（left）順にソート
    let mut sorted_results = Vec::with_capacity(results.len());
    let mut current_line: Vec<OcrResult_> = Vec::new();

    for item in results {
        if current_line.is_empty() {
            current_line.push(item);
        } else {
            let line_top = current_line[0].bbox.rect.top();
            let item_top = item.bbox.rect.top();

            // 行の先頭要素からの Y 差分が閾値以内なら「同じ行」
            if (item_top - line_top).abs() <= y_threshold {
                current_line.push(item);
            } else {
                // 行が変わったため、これまでの行を left (X座標) で昇順ソートして確定
                current_line.sort_by(|a, b| a.bbox.rect.left().cmp(&b.bbox.rect.left()));
                sorted_results.append(&mut current_line);

                current_line.push(item);
            }
        }
    }

    // 最後の行のソートと追加
    if !current_line.is_empty() {
        current_line.sort_by(|a, b| a.bbox.rect.left().cmp(&b.bbox.rect.left()));
        sorted_results.append(&mut current_line);
    }

    sorted_results
}

pub async fn download_ocr_files(app_handle: AppHandle) -> Result<(), String> {
    let models_dir = models_dir(app_handle)?;

    for model in vec![MODELS.det_model, MODELS.rec_model, MODELS.charset] {
        let file_path = models_dir.join(model.name);

        if file_path.exists() {
            let file_path = file_path.clone();
            let metadata = fs::metadata(&file_path).map_err(|e| e.to_string())?;

            if metadata.is_file() {
                fs::remove_file(file_path).map_err(|e| e.to_string())?;
            } else if metadata.is_dir() {
                fs::remove_dir_all(file_path).map_err(|e| e.to_string())?;
            }
        }

        let bytes = reqwest::get(model.url)
            .await
            .map_err(|e| e.to_string())?
            .bytes()
            .await
            .map_err(|e| e.to_string())?;

        let mut file = File::create(&file_path).map_err(|e| e.to_string())?;
        file.write_all(&bytes).map_err(|e| e.to_string())?;
    }

    Ok(())
}

struct Model {
    name: &'static str,
    url: &'static str,
}
struct Models {
    det_model: Model,
    rec_model: Model,
    charset: Model,
}

const MODELS: Models = Models {
    det_model: Model {
        name: "PP-OCRv6_medium_det.mnn",
        url: "https://github.com/oktntko/rust-paddle-ocr/raw/refs/heads/clinder/models/PP-OCRv6_medium_det.mnn",
    },
    rec_model: Model {
        name: "PP-OCRv6_medium_rec.mnn",
        url: "https://github.com/oktntko/rust-paddle-ocr/raw/refs/heads/clinder/models/PP-OCRv6_medium_rec.mnn",
    },
    charset: Model {
        name: "ppocr_keys_v6_medium.txt",
        url: "https://github.com/oktntko/rust-paddle-ocr/raw/refs/heads/clinder/models/ppocr_keys_v6_medium.txt",
    },
};
