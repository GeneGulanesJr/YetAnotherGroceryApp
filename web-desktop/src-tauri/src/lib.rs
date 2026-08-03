/// Entry point invoked by `main.rs`. Registers the native plugins used by the
/// desktop build: local SQLite replica (`plugin-sql`), file exports/backup
/// (`plugin-fs`), and native save dialogs (`plugin-dialog`).
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
