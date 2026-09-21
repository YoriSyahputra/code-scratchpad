use serde::Serialize;
use std::process::Command;
use which::which;

#[derive(Debug, Serialize)]
pub struct LanguageStatus {
    pub language: String,
    pub is_available: bool,
    pub version: Option<String>,
    pub binary_path: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct SystemToolchainStatus {
    pub c: LanguageStatus,
    pub python: LanguageStatus,
    pub java: LanguageStatus,
}

fn check_c() -> LanguageStatus {
    match which("gcc") {
        Ok(path) => {
            let ver = Command::new("gcc")
                .arg("--version")
                .output()
                .ok()
                .and_then(|out| {
                    let text = String::from_utf8_lossy(&out.stdout).to_string();
                    text.lines().next().map(|s| s.to_string())
                });

            LanguageStatus {
                language: "c".into(),
                is_available: true,
                version: ver,
                binary_path: Some(path.to_string_lossy().to_string()),
            }
        }
        Err(_) => LanguageStatus {
            language: "c".into(),
            is_available: false,
            version: None,
            binary_path: None,
        },
    }
}

fn check_python() -> LanguageStatus {
    let binary = if cfg!(target_os = "windows") { "python" } else { "python3" };
    match which(binary) {
        Ok(path) => {
            let ver = Command::new(binary)
                .arg("--version")
                .output()
                .ok()
                .map(|out| String::from_utf8_lossy(&out.stdout).trim().to_string());

            LanguageStatus {
                language: "python".into(),
                is_available: true,
                version: ver,
                binary_path: Some(path.to_string_lossy().to_string()),
            }
        }
        Err(_) => LanguageStatus {
            language: "python".into(),
            is_available: false,
            version: None,
            binary_path: None,
        },
    }
}

fn check_java() -> LanguageStatus {
    match which("java") {
        Ok(path) => {
            let ver = Command::new("java")
                .arg("-version")
                .output()
                .ok()
                .map(|out| {
                    let text = String::from_utf8_lossy(&out.stderr).to_string();
                    text.lines().next().unwrap_or("Java detected").to_string()
                });

            LanguageStatus {
                language: "java".into(),
                is_available: true,
                version: ver,
                binary_path: Some(path.to_string_lossy().to_string()),
            }
        }
        Err(_) => LanguageStatus {
            language: "java".into(),
            is_available: false,
            version: None,
            binary_path: None,
        },
    }
}

#[tauri::command]
pub fn check_toolchains() -> SystemToolchainStatus {
    SystemToolchainStatus {
        c: check_c(),
        python: check_python(),
        java: check_java(),
    }
}
