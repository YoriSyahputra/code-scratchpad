<div align="center">

# ⚡ Code Scratchpad

**A blazing-fast, lightweight, and modern multi-language code scratchpad for your desktop.**

Execute **Python**, **C**, and **Java** snippets instantly with unbuffered live PTY streaming, modal Vim editing, and zero IDE bloat.

[![Release](https://img.shields.io/github/v/release/YoriSyahputra/code-scratchpad?style=flat-square&color=3b82f6)](https://github.com/YoriSyahputra/code-scratchpad/releases)
[![Build Status](https://img.shields.io/github/actions/workflow/status/YoriSyahputra/code-scratchpad/release.yml?style=flat-square&label=build)](https://github.com/YoriSyahputra/code-scratchpad/actions)
[![Platform](https://img.shields.io/badge/platform-Linux%20%7C%20Windows-3b82f6?style=flat-square&logo=linux&logoColor=white)](#-downloads--installation-v010)
[![Framework](https://img.shields.io/badge/framework-Tauri%20v2-24C8DB?style=flat-square&logo=tauri&logoColor=white)](https://tauri.app)
[![License: MIT](https://img.shields.io/badge/license-MIT-brightgreen?style=flat-square)](LICENSE)

<br/>

<img src="assets/demo.gif" alt="Code Scratchpad Demo" width="850"/>

</div>

<br/>

## 📚 Table of Contents

- [🧭 Overview](#-overview)
- [✨ Key Features](#-key-features)
- [📥 Downloads & Installation (v0.1.0)](#-downloads--installation-v010)
- [⚙️ Prerequisites](#️-prerequisites)
- [⌨️ Keyboard Shortcuts](#️-keyboard-shortcuts)
- [🏗️ Architecture & Tech Stack](#️-architecture--tech-stack)
- [🛠️ Local Development Setup](#️-local-development-setup)
- [🤝 Contributing](#-contributing)
- [📄 License](#-license)

---

## 🧭 Overview

**Code Scratchpad** is designed for developers, students, and competitive programmers who want an instant, distraction-free environment to test algorithms, debug logic, or run small utility scripts — without waiting for a heavy IDE to launch or setting up throwaway project files.

Built on **Tauri v2** and **Rust**, it combines the responsiveness of a native desktop application with a modern, sleek, developer-centric interface.

> 🪶 **Native. Instant. Distraction-free.**
> No IDE bloat, no boilerplate projects — just open it, write code, and run.

---

## ✨ Key Features

| Feature                                 | Description                                                                                                                                                                                                                                    |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ⚡ **Blazing Fast & Ultra-Lightweight** | Minimal idle memory footprint (**~40–80 MB RAM**), completely outperforming Electron-based alternatives.                                                                                                                                       |
| 🖥️ **Native PTY Unbuffered Streaming**  | Direct terminal emulation powered by `portable-pty` and `Xterm.js`, supporting interactive terminal input (stdin), ANSI color escapes, and complex terminal animations (e.g., spinning donut).                                                 |
| 🛡️ **Robust Process Control & Safety**  | Live execution status with pulsating indicators, dedicated **Kill / Stop** process triggers (<kbd>Ctrl</kbd>+<kbd>C</kbd> or UI button) to terminate infinite loops instantly, and automatic isolation/cleanup of temporary build directories. |
| 🧩 **Multi-Language Ready**             | See language matrix below 👇                                                                                                                                                                                                                   |
| ⌨️ **Modal Editing (Vim Mode)**         | Switch seamlessly between standard editor controls and Vim keybindings via `@replit/codemirror-vim`.                                                                                                                                           |
| 🔀 **Adaptive Workspace Split**         | Horizontal & Vertical split orientation toggle, smooth draggable divider with boundary locking, and collapsible terminal panel.                                                                                                                |
| 🎨 **Modern Sleek Aesthetics**          | Carefully tuned dark theme, subtle glassmorphism borders, status bar with live cursor tracking (Ln / Col), and terminal state indicators.                                                                                                      |

#### 🧩 Multi-Language Support Matrix

| Language        | Execution Detail                                                                    |
| --------------- | ----------------------------------------------------------------------------------- |
| 🐍 **Python 3** | Immediate execution with unbuffered stdout (`-u`)                                   |
| ⚙️ **C (GCC)**  | Automated compilation with `-O2` optimization and full math library linkage (`-lm`) |
| ☕ **Java**     | Automated public class detection and direct single-file runtime compilation         |

---

## 📥 Downloads & Installation (v0.1.0)

| OS / Distro                                                                                    | Format        | Install Command                                                       |
| ---------------------------------------------------------------------------------------------- | ------------- | --------------------------------------------------------------------- |
| 🐧 **All Linux Distros** <br/>_(Universal: Arch, Kali, Fedora, Ubuntu, openSUSE, Debian, dll)_ | `.AppImage`   | `chmod +x code-scratchpad_*.AppImage && ./code-scratchpad_*.AppImage` |
| 🟠 **Ubuntu / Debian / Mint / Pop!\_OS**                                                       | `.deb`        | `sudo dpkg -i code-scratchpad_*_amd64.deb`                            |
| 🔴 **Fedora / CentOS / RHEL / openSUSE**                                                       | `.rpm`        | `sudo rpm -i code-scratchpad-*.x86_64.rpm`                            |
| 🪟 **Windows 10 & 11 (64-bit)**                                                                | `.exe` (NSIS) | Unduh dan jalankan `code-scratchpad_*_x64-setup.exe`                  |

> ℹ️ **Catatan AppImage:** Runtime environment variable otomatis dibersihkan (`PYTHONHOME`, `PYTHONPATH`, `LD_LIBRARY_PATH`) agar subproses memakai compiler host secara native.

---

## ⚙️ Prerequisites

| Language   | Requirement                                       |
| ---------- | ------------------------------------------------- |
| 🐍 Python  | `3.10+` (`python3` di Linux, `python` di Windows) |
| ⚙️ C (GCC) | `GCC 9+` (MinGW di Windows)                       |
| ☕ Java    | `OpenJDK` / `Oracle JDK 11+`                      |

> ✅ Aplikasi otomatis mendiagnosis status compiler saat startup.

---

## ⌨️ Keyboard Shortcuts

| Shortcut                                                                      | Action                             | Context                        |
| ----------------------------------------------------------------------------- | ---------------------------------- | ------------------------------ |
| <kbd>Ctrl</kbd> + <kbd>Enter</kbd> _(atau <kbd>Cmd</kbd> + <kbd>Enter</kbd>)_ | Run Code / Stop Process            | Global                         |
| <kbd>Ctrl</kbd> + <kbd>C</kbd>                                                | Send `SIGINT` / Terminate Process  | Terminal / Global              |
| <kbd>Esc</kbd> → <kbd>i</kbd> / <kbd>a</kbd> / <kbd>v</kbd> / <kbd>:</kbd>    | Normal / Insert / Visual / Command | Editor _(saat Vim Mode aktif)_ |

---

## 🏗️ Architecture & Tech Stack

| Layer           | Stack                                                              |
| --------------- | ------------------------------------------------------------------ |
| 🎨 **Frontend** | TypeScript, Vite, CodeMirror 6, `@xterm/xterm`, `@xterm/addon-fit` |
| 🦀 **Backend**  | Tauri v2, Rust (`portable-pty`, `tempfile`, `serde`, `tokio`)      |
| 🔁 **CI/CD**    | GitHub Actions multi-platform release workflow                     |

#### 🔄 Execution Flow

```
┌───────────────────────┐        ┌──────────────┐        ┌───────────────────────────────┐        ┌────────────────────────┐
│        UI Layer         │        │   Tauri IPC    │        │         Rust Backend            │        │    Subprocess Host       │
│  (CodeMirror / Xterm)   │ ─────▶ │     Bridge     │ ─────▶ │  (Process Controller +          │ ─────▶ │        System            │
│                          │        │                │        │   portable-pty)                 │        │  (python / gcc / java)   │
│                          │ ◀───── │                │ ◀───── │                                  │ ◀───── │                          │
└───────────────────────┘        └──────────────┘        └───────────────────────────────┘        └────────────────────────┘
```

---

## 🛠️ Local Development Setup

**1. Clone repo**

```bash
git clone https://github.com/YoriSyahputra/code-scratchpad.git && cd code-scratchpad
```

**2. Dependencies Linux**

```bash
sudo apt-get install -y libwebkit2gtk-4.1-dev build-essential curl wget file libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev
```

**3. Install Node dependencies**

```bash
npm install
```

**4. Development run**

```bash
npm run tauri dev
```

**5. Production build**

```bash
npm run tauri build
```

> 📦 Output berada di `src-tauri/target/release/bundle/`

---

## 🤝 Contributing

> Contributions, bug reports, and feature suggestions are always welcome! 🎉

1. Fork the Project
2. Create your Feature Branch

```bash
   git checkout -b feature/AmazingFeature
```

3. Commit your Changes

```bash
   git commit -m "feat: add some amazing feature"
```

4. Push to the Branch

```bash
   git push origin feature/AmazingFeature
```

5. Open a **Pull Request**

---

## 📄 License

Distributed under the **MIT License**. See [`LICENSE`](LICENSE) for more information.

<br/>

<div align="center">

Crafted with ❤️ using **Rust** & **Tauri**.

</div>
