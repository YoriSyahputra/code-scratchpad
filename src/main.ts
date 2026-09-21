import { EditorView, basicSetup } from "codemirror";
import { EditorState, Compartment } from "@codemirror/state";
import { oneDark } from "@codemirror/theme-one-dark";
import { python } from "@codemirror/lang-python";
import { cpp } from "@codemirror/lang-cpp";
import { java } from "@codemirror/lang-java";

import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";

import { invoke } from '@tauri-apps/api/core';

// --- 1. STATE & DOM ELEMENTS ---
const workspace = document.getElementById("workspace") as HTMLElement;
const editorContainer = document.getElementById(
  "editor-container",
) as HTMLElement;
const terminalContainer = document.getElementById(
  "terminal-container",
) as HTMLElement;
const divider = document.getElementById("divider") as HTMLElement;
const langSelect = document.getElementById("lang-select") as HTMLSelectElement;
const btnToggleLayout = document.getElementById(
  "btn-toggle-layout",
) as HTMLButtonElement;
const btnToggleTerminal = document.getElementById(
  "btn-toggle-terminal",
) as HTMLButtonElement;
const btnRun = document.getElementById("btn-run") as HTMLButtonElement;

let isVertical = false;
let splitRatio = 0.6; // Default: Editor 60%, Terminal 40%
let isTerminalVisible = true;
let isDragging = false;

// --- 2. SETUP CODEMIRROR 6 ---
const languageCompartment = new Compartment();

const initialSnippets: Record<string, string> = {
  python: `# Scratchpad Python\ndef main():\n    name = input("Masukkan nama: ")\n    print(f"Halo, {name}!")\n\nmain()`,
  c: `// Scratchpad C\n#include <stdio.h>\n\nint main() {\n    printf("Halo dari C!\\n");\n    return 0;\n}`,
  java: `// Scratchpad Java\nimport java.util.Scanner;\n\npublic class Main {\n    public static void main(String[] args) {\n        System.out.println("Halo dari Java!");\n    }\n}`,
};

function getLanguageExtension(lang: string) {
  switch (lang) {
    case "c":
      return cpp();
    case "java":
      return java();
    default:
      return python();
  }
}

const editor = new EditorView({
  state: EditorState.create({
    doc: initialSnippets.python,
    extensions: [basicSetup, oneDark, languageCompartment.of(python())],
  }),
  parent: editorContainer,
});

// Ganti bahasa secara dinamis
langSelect.addEventListener("change", () => {
  const lang = langSelect.value;
  editor.dispatch({
    effects: languageCompartment.reconfigure(getLanguageExtension(lang)),
    changes: {
      from: 0,
      to: editor.state.doc.length,
      insert: initialSnippets[lang] || "",
    },
  });
});

// --- 3. SETUP XTERM.JS ---
const term = new Terminal({
  theme: {
    background: "#141414",
    foreground: "#d4d4d4",
    cursor: "#ffffff",
  },
  fontFamily: "monospace",
  fontSize: 13,
  cursorBlink: true,
});

const fitAddon = new FitAddon();
term.loadAddon(fitAddon);
term.open(terminalContainer);
fitAddon.fit();

term.writeln("\x1b[36m=== Code Scratchpad Ready ===\x1b[0m");
term.writeln('Klik "Run" atau tekan Ctrl+Enter untuk mengeksekusi.');

// --- 4. LAYOUT & RESIZING LOGIC ---
function applyDimensions() {
  if (!isTerminalVisible) {
    if (isVertical) {
      editorContainer.style.height = "100%";
      editorContainer.style.width = "100%";
      terminalContainer.style.display = "none";
      divider.style.display = "none";
    } else {
      editorContainer.style.width = "100%";
      editorContainer.style.height = "100%";
      terminalContainer.style.display = "none";
      divider.style.display = "none";
    }
    return;
  }

  terminalContainer.style.display = "block";
  divider.style.display = "block";

  if (isVertical) {
    editorContainer.style.width = "100%";
    terminalContainer.style.width = "100%";
    editorContainer.style.height = `${splitRatio * 100}%`;
    terminalContainer.style.height = `${(1 - splitRatio) * 100}%`;
  } else {
    editorContainer.style.height = "100%";
    terminalContainer.style.height = "100%";
    editorContainer.style.width = `${splitRatio * 100}%`;
    terminalContainer.style.width = `${(1 - splitRatio) * 100}%`;
  }

  // Refresh ukuran terminal saat dimensi berubah
  requestAnimationFrame(() => fitAddon.fit());
}

// Event Divider Dragging
divider.addEventListener("mousedown", (e) => {
  isDragging = true;
  divider.classList.add("dragging");
  document.body.style.userSelect = "none";
  e.preventDefault();
});

window.addEventListener("mousemove", (e) => {
  if (!isDragging) return;

  const rect = workspace.getBoundingClientRect();

  if (isVertical) {
    const newRatio = (e.clientY - rect.top) / rect.height;
    if (newRatio >= 0.15 && newRatio <= 0.85) {
      splitRatio = newRatio;
      applyDimensions();
    }
  } else {
    const newRatio = (e.clientX - rect.left) / rect.width;
    if (newRatio >= 0.15 && newRatio <= 0.85) {
      splitRatio = newRatio;
      applyDimensions();
    }
  }
});

window.addEventListener("mouseup", () => {
  if (isDragging) {
    isDragging = false;
    divider.classList.remove("dragging");
    document.body.style.userSelect = "auto";
    fitAddon.fit();
  }
});

window.addEventListener("resize", () => {
  applyDimensions();
});

// --- 5. TOGGLE BUTTONS ---
btnToggleLayout.addEventListener("click", () => {
  isVertical = !isVertical;
  workspace.className = isVertical ? "layout-vertical" : "layout-horizontal";
  applyDimensions();
});

btnToggleTerminal.addEventListener("click", () => {
  isTerminalVisible = !isTerminalVisible;
  applyDimensions();
});

// --- 6. TRIGGER EKSEKUSI (DUMMY/DEMO) ---
function triggerRun() {
  if (!isTerminalVisible) {
    isTerminalVisible = true;
    applyDimensions();
  }
  const code = editor.state.doc.toString();
  const lang = langSelect.value;

  term.writeln(`\r\n\x1b[33m[Running ${lang.toUpperCase()}...]\x1b[0m`);
  // Nanti di sini kita panggil invoke() ke Rust Backend
}

btnRun.addEventListener("click", triggerRun);

// Shortcut Keyboard: Ctrl+Enter untuk Run
window.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
    e.preventDefault();
    triggerRun();
  }
});

// Inisialisasi awal dimensi layout
applyDimensions();

interface LanguageStatus {
  language: string;
  is_available: boolean;
  version?: string;
  binary_path?: string;
}

interface SystemToolchainStatus {
  c: LanguageStatus;
  python: LanguageStatus;
  java: LanguageStatus;
}

async function verifyToolchains() {
  try {
    const status = await invoke<SystemToolchainStatus>('check_toolchains');
    term.writeln('\r\n\x1b[32m[Toolchain Status]\x1b[0m');
    term.writeln(`  Python: ${status.python.is_available ? status.python.version : '\x1b[31mNot Found\x1b[0m'}`);
    term.writeln(`  C (GCC): ${status.c.is_available ? status.c.version : '\x1b[31mNot Found\x1b[0m'}`);
    term.writeln(`  Java: ${status.java.is_available ? status.java.version : '\x1b[31mNot Found\x1b[0m'}`);
  } catch (err) {
    term.writeln(`\x1b[31mGagal memeriksa toolchain: ${err}\x1b[0m`);
  }
}

verifyToolchains();
