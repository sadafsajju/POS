// POS Desktop - Tauri Backend
// Handles hardware integration, local database, and native features

mod hardware;

use tauri::Manager;

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! Welcome to POS System.", name)
}

#[tauri::command]
async fn get_system_info() -> Result<serde_json::Value, String> {
    Ok(serde_json::json!({
        "os": std::env::consts::OS,
        "arch": std::env::consts::ARCH,
        "version": env!("CARGO_PKG_VERSION"),
    }))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_sql::Builder::new().build())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            get_system_info,
            hardware::printer::print_receipt,
            hardware::printer::print_kot,
            hardware::printer::get_printers,
            hardware::scanner::start_scanner,
            hardware::scanner::stop_scanner,
        ])
        .setup(|app| {
            // Initialize the app
            let window = app.get_webview_window("main").unwrap();

            #[cfg(debug_assertions)]
            {
                window.open_devtools();
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
