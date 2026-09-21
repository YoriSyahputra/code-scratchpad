use portable_pty::{native_pty_system, CommandBuilder, MasterPty, PtyPair, PtySize};
use serde::Deserialize;
use std::fs;
use std::io::{Read, Write};
use std::path::PathBuf;
use std::process::Command;
use std::sync::{Arc, Mutex};
use std::thread;
use tauri::{AppHandle, Emitter};
use tempfile::Builder;

#[derive(Default)]
pub struct AppState {
    pub pty_master: Arc<Mutex<Option<Box<dyn MasterPty + Send>>>>,
    pub pty_writer: Arc<Mutex<Option<Box<dyn Write + Send>>>>,
    pub child_killer: Arc<Mutex<Option<Box<dyn portable_pty::Child + Send + Sync>>>>,
    pub active_temp_dir: Arc<Mutex<Option<PathBuf>>>,
}

#[derive(Debug, Deserialize)]
pub struct RunPayload {
    pub language: String,
    pub code: String,
    pub rows: u16,
    pub cols: u16,
}

#[tauri::command]
pub fn pty_resize(rows: u16, cols: u16, state: tauri::State<'_, AppState>) -> Result<(), String> {
    if let Some(ref mut master) = *state.pty_master.lock().unwrap() {
        master
            .resize(PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn pty_write(data: String, state: tauri::State<'_, AppState>) -> Result<(), String> {
    if let Some(ref mut writer) = *state.pty_writer.lock().unwrap() {
        writer.write_all(data.as_bytes()).map_err(|e| e.to_string())?;
        writer.flush().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn kill_process(state: tauri::State<'_, AppState>) -> Result<(), String> {
    if let Some(mut child) = state.child_killer.lock().unwrap().take() {
        let _ = child.kill();
    }
    *state.pty_writer.lock().unwrap() = None;
    *state.pty_master.lock().unwrap() = None;

    if let Some(path) = state.active_temp_dir.lock().unwrap().take() {
        let _ = fs::remove_dir_all(path);
    }

    Ok(())
}

#[tauri::command]
pub async fn run_code(
    app: AppHandle,
    payload: RunPayload,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    let _ = kill_process(state.clone());

    let temp_dir = Builder::new()
        .prefix("scratchpad_")
        .tempdir()
        .map_err(|e| e.to_string())?;

    let temp_path = temp_dir.path().to_path_buf();

    let pty_system = native_pty_system();
    let pair: PtyPair = pty_system
        .openpty(PtySize {
            rows: payload.rows.max(1),
            cols: payload.cols.max(1),
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| e.to_string())?;

    let app_handle = app.clone();
    let mut reader = pair.master.try_clone_reader().map_err(|e| e.to_string())?;
    let writer = pair.master.take_writer().map_err(|e| e.to_string())?;

    *state.pty_writer.lock().unwrap() = Some(writer);
    *state.pty_master.lock().unwrap() = Some(pair.master);

    thread::spawn(move || {
        let mut buffer = [0u8; 1024];
        while let Ok(n) = reader.read(&mut buffer) {
            if n == 0 {
                break;
            }
            let text = String::from_utf8_lossy(&buffer[..n]).to_string();
            let _ = app_handle.emit("pty-output", text);
        }
        let _ = app_handle.emit("pty-exit", ());
    });

    let cmd_builder = match payload.language.as_str() {
        "python" => {
            let file_path = temp_path.join("main.py");
            fs::write(&file_path, &payload.code).map_err(|e| e.to_string())?;

            let binary = if cfg!(target_os = "windows") { "python" } else { "python3" };
            let mut cmd = CommandBuilder::new(binary);
            cmd.env_remove("PYTHONHOME");
            cmd.env_remove("PYTHONPATH");
            cmd.arg("-u");
            cmd.arg(&file_path);
            cmd.cwd(&temp_path);
            cmd
        }
        "c" => {
            let file_path = temp_path.join("main.c");
            fs::write(&file_path, &payload.code).map_err(|e| e.to_string())?;

            let binary_out = if cfg!(target_os = "windows") {
                temp_path.join("app.exe")
            } else {
                temp_path.join("app")
            };

            let _ = app.emit("pty-output", "\r\n\x1b[33m[Compiling with GCC...]\x1b[0m\r\n");
            let compile = Command::new("gcc")
                .env_remove("LD_LIBRARY_PATH")
                .arg(&file_path)
                .arg("-O2")
                .arg("-lm")
                .arg("-o")
                .arg(&binary_out)
                .output()
                .map_err(|e| e.to_string())?;

            if !compile.status.success() {
                let err_msg = String::from_utf8_lossy(&compile.stderr).to_string();
                let _ = app.emit(
                    "pty-output",
                    format!("\r\n\x1b[31m[Compilation Error]\x1b[0m\r\n{}", err_msg),
                );
                return Ok(());
            }

            let mut cmd = CommandBuilder::new(&binary_out);
            cmd.env_remove("LD_LIBRARY_PATH");
            cmd.cwd(&temp_path);
            cmd
        }
        "java" => {
            let re = regex::Regex::new(r"(?:public\s+)?class\s+([A-Za-z0-9_$]+)").unwrap();
            let class_name = re
                .captures(&payload.code)
                .and_then(|cap| cap.get(1))
                .map(|m| m.as_str())
                .unwrap_or("Main");

            let file_name = format!("{}.java", class_name);
            let file_path = temp_path.join(&file_name);
            fs::write(&file_path, &payload.code).map_err(|e| e.to_string())?;

            let mut cmd = CommandBuilder::new("java");
            cmd.env_remove("LD_LIBRARY_PATH");
            cmd.arg(&file_name);
            cmd.cwd(&temp_path);
            cmd
        }
        _ => return Err("Unsupported language".into()),
    };

    let child = pair.slave.spawn_command(cmd_builder).map_err(|e| e.to_string())?;
    *state.child_killer.lock().unwrap() = Some(child);

    let kept_path = temp_dir.keep();
    *state.active_temp_dir.lock().unwrap() = Some(kept_path);

    Ok(())
}
