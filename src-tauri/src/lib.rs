mod toolchain;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init()) // jika plugin opener bawaan ada
        .invoke_handler(tauri::generate_handler![
            toolchain::check_toolchains
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
