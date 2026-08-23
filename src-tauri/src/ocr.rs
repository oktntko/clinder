use tauri_plugin_log::log;
#[cfg(target_os = "windows")]
use windows::Globalization::Language;

#[cfg(target_os = "windows")]
pub fn get_ocr_language() -> Result<Language, String> {
    use windows::Globalization::ApplicationLanguages;
    use windows::Media::Ocr::OcrEngine;

    // 1. インストールされている OCR 対応言語の一覧を取得
    let available_languages = OcrEngine::AvailableRecognizerLanguages()
        .map_err(|e| format!("Failed to get OCR languages: {}", e))?;

    let language_count = available_languages.Size().unwrap_or(0);
    if language_count == 0 {
        return Err("OCR 対応の言語パックが Windows に 1 つもインストールされていません。".into());
    }

    // 利用可能な OCR 言語のタグ一覧（例: ["ja-JP", "en-US"]）
    let mut available_tags = Vec::new();
    for i in 0..language_count {
        if let Ok(lang) = available_languages.GetAt(i) {
            if let Ok(tag) = lang.LanguageTag() {
                available_tags.push(tag.to_string_lossy().to_string());
            }
        }
    }

    log::debug!("available_tags {:?}", available_tags);

    // 2. OSの優先言語リストを取得（例: ["ja-JP", "en-US"]）
    let user_languages = ApplicationLanguages::Languages().ok().and_then(|langs| {
        let mut tags = Vec::new();
        for i in 0..langs.Size().unwrap_or(0) {
            if let Ok(hstr) = langs.GetAt(i) {
                tags.push(hstr.to_string_lossy().to_string());
            }
        }
        if tags.is_empty() { None } else { Some(tags) }
    });
    log::debug!("user_languages {:?}", user_languages);

    // 3. 使用する言語の決定
    // 優先順位:
    // ① OSの優先言語（User/OS Priority）の中で、OCRがサポートされているもの
    // ② なければ "ja" (日本語)
    // ③ それも無ければ、利用可能な OCR 言語の先頭 (GetAt(0))
    let selected_index: usize = user_languages
        .as_ref()
        .and_then(|user_tags| {
            // OSの優先言語とOCR利用可能言語をマッチング
            user_tags.iter().find_map(|u_tag| {
                available_tags.iter().position(|a_tag| {
                    // "ja-JP" 完全一致、または "ja" 前方一致
                    a_tag.eq_ignore_ascii_case(u_tag)
                        || u_tag.starts_with(a_tag)
                        || a_tag.starts_with(u_tag)
                })
            })
        })
        .unwrap_or(0); // ③ なければ 0 番目

    available_languages
        .GetAt(selected_index as u32)
        .map_err(|e| format!("Failed to get selected language: {}", e))
}

#[cfg(target_os = "windows")]
pub async fn ocr_windows_dynamic(image_path: &std::path::Path) -> Result<String, String> {
    use windows::Graphics::Imaging::BitmapDecoder;
    use windows::Media::Ocr::OcrEngine;
    use windows::Storage::StorageFile;

    let selected_language = get_ocr_language()?;

    log::debug!(
        "Selected OCR Language: {}",
        selected_language
            .LanguageTag()
            .unwrap_or_default()
            .to_string_lossy()
    );

    // 4. OcrEngine の作成
    let engine = OcrEngine::TryCreateFromLanguage(&selected_language)
        .map_err(|e| format!("Failed to create OcrEngine: {}", e))?;

    // 5. 画像読み込み & OCR 実行
    let file = StorageFile::GetFileFromPathAsync(&windows::core::HSTRING::from(
        image_path.to_str().ok_or("Invalid path encoding")?,
    ))
    .map_err(|e| e.to_string())?
    .await
    .map_err(|e| e.to_string())?;

    let stream = file
        .OpenReadAsync()
        .map_err(|e| e.to_string())?
        .await
        .map_err(|e| e.to_string())?;
    let decoder = BitmapDecoder::CreateAsync(&stream)
        .map_err(|e| e.to_string())?
        .await
        .map_err(|e| e.to_string())?;
    let software_bitmap = decoder
        .GetSoftwareBitmapAsync()
        .map_err(|e| e.to_string())?
        .await
        .map_err(|e| e.to_string())?;

    let result = engine
        .RecognizeAsync(&software_bitmap)
        .map_err(|e| e.to_string())?
        .await
        .map_err(|e| e.to_string())?;

    let text = result
        .Text()
        .map_err(|e| e.to_string())?
        .to_string_lossy()
        .to_string();

    let clean_text: String = clean_ocr_text(&text);

    Ok(clean_text)
}

/// CJK（日本語・中国語・韓国語など）および全角記号の判定
#[cfg(target_os = "windows")]
fn is_cjk(c: char) -> bool {
    matches!(c,
        // ひらがな・カタカナ・注音符号
        '\u{3040}'..='\u{309F}' | '\u{30A0}'..='\u{30FF}' | '\u{3100}'..='\u{312F}' |
        // 漢字（CJK統合漢字・拡張）
        '\u{4E00}'..='\u{9FFF}' | '\u{3400}'..='\u{4DBF}' |
        // 全角記号・句読点（「」など）
        '\u{3000}'..='\u{303F}' | '\u{FF01}'..='\u{FF60}'
    )
}

/// Windows OCR 特有の無駄なスペースを取り除く後処理（標準ライブラリのみ）
#[cfg(target_os = "windows")]
fn clean_ocr_text(input: &str) -> String {
    // 1. 特殊表記ぶれの簡易置換（必要に応じて）
    let text = input.replace('—', "-");

    let chars: Vec<char> = text.chars().collect();
    let mut result = String::with_capacity(text.len());

    let len = chars.len();
    for i in 0..len {
        let current = chars[i];

        // 半角スペースの場合、前後が共に CJK 文字ならスキップ（＝削除）
        if current == ' ' {
            let prev_is_cjk = i > 0 && is_cjk(chars[i - 1]);
            let next_is_cjk = i + 1 < len && is_cjk(chars[i + 1]);

            if prev_is_cjk && next_is_cjk {
                continue; // スケップして文字を追加しない
            }
        }

        result.push(current);
    }

    // 2. 行末・行頭の余分なスペースをトリムして整形
    result
        .lines()
        .map(|line| line.trim())
        .collect::<Vec<&str>>()
        .join("\n")
}
