use std::thread;
use std::time::Duration;
use tauri::Emitter;
use tauri_plugin_clipboard_manager::ClipboardExt;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_clipboard_manager::init())
        .setup(|app| {
            let handle = app.handle().clone();

            thread::spawn(move || {
                let mut last_text = String::new();

                loop {
                    if let Ok(current_text) = handle.clipboard().read_text() {
                        if !current_text.is_empty() && current_text != last_text {
                            last_text = current_text.clone();

                            println!("changed-clipboard {}", current_text);

                            let _ = handle.emit("changed-clipboard", current_text);
                        }
                    }

                    thread::sleep(Duration::from_millis(500));
                }
            });

            Ok(())
        })
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![greet])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
