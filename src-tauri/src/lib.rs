mod runner;
mod toolchain;

use runner::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(AppState::default())
        .invoke_handler(tauri::generate_handler![
            toolchain::check_toolchains,
            runner::run_code,
            runner::pty_write,
            runner::kill_process,
            runner::pty_resize
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
