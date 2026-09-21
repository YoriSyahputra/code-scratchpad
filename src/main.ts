import { EditorView, basicSetup } from "codemirror";
import { EditorState, Compartment } from "@codemirror/state";
import { oneDark } from "@codemirror/theme-one-dark";
import { python } from "@codemirror/lang-python";
import { cpp } from "@codemirror/lang-cpp";
import { java } from "@codemirror/lang-java";
import { vim } from "@replit/codemirror-vim";

import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";

import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

interface SystemToolchainStatus {
  c: { is_available: boolean; version?: string };
  python: { is_available: boolean; version?: string };
  java: { is_available: boolean; version?: string };
}

interface LayoutState {
  isVertical: boolean;
  splitRatio: number;
  isTerminalVisible: boolean;
  isDragging: boolean;
  isRunning: boolean;
}

const SNIPPETS: Record<string, string> = {
  python: `# Scratchpad Python\ndef main():\n    name = input("Enter your name: ")\n    print(f"Hello, {name}!")\n\nmain()`,
  c: `// Scratchpad C\n#include <stdio.h>\n\nint main() {\n    printf("Hello from C!\\n");\n    return 0;\n}`,
  java: `// Scratchpad Java\npublic class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello from Java!");\n    }\n}`,
};

const elements = {
  workspace: document.getElementById("workspace") as HTMLElement,
  editorContainer: document.getElementById("editor-container") as HTMLElement,
  terminalWrapper: document.getElementById("terminal-wrapper") as HTMLElement,
  terminalContainer: document.getElementById(
    "terminal-container",
  ) as HTMLElement,
  divider: document.getElementById("divider") as HTMLElement,
  langSelect: document.getElementById("lang-select") as HTMLSelectElement,
  btnToggleLayout: document.getElementById(
    "btn-toggle-layout",
  ) as HTMLButtonElement,
  btnToggleTerminal: document.getElementById(
    "btn-toggle-terminal",
  ) as HTMLButtonElement,
  btnRun: document.getElementById("btn-run") as HTMLButtonElement,
  btnClear: document.getElementById("btn-clear") as HTMLButtonElement,
  checkVim: document.getElementById("check-vim") as HTMLInputElement,
  statusDot: document.getElementById("status-dot") as HTMLElement,
  editorPos: document.getElementById("editor-pos") as HTMLElement,
  statusLang: document.getElementById("status-lang") as HTMLElement,
};

const layoutState: LayoutState = {
  isVertical: false,
  splitRatio: 0.55,
  isTerminalVisible: true,
  isDragging: false,
  isRunning: false,
};

const languageCompartment = new Compartment();
const vimCompartment = new Compartment();

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

function updateCursorPosition(editor: EditorView) {
  const pos = editor.state.selection.main.head;
  const line = editor.state.doc.lineAt(pos);
  const col = pos - line.from + 1;
  elements.editorPos.textContent = `Ln ${line.number}, Col ${col}`;
}

function initializeEditor(): EditorView {
  const editor = new EditorView({
    state: EditorState.create({
      doc: SNIPPETS.python,
      extensions: [
        basicSetup,
        oneDark,
        languageCompartment.of(python()),
        vimCompartment.of([]),
        EditorView.updateListener.of((update) => {
          if (update.selectionSet || update.docChanged) {
            updateCursorPosition(editor);
          }
        }),
      ],
    }),
    parent: elements.editorContainer,
  });
  return editor;
}

function initializeTerminal(): { term: Terminal; fitAddon: FitAddon } {
  const term = new Terminal({
    theme: {
      background: "#0a0b0d",
      foreground: "#d4d4d4",
      cursor: "#3b82f6",
      selectionBackground: "#1e293b",
    },
    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
    fontSize: 13,
    lineHeight: 1.25,
    cursorBlink: true,
  });

  const fitAddon = new FitAddon();
  term.loadAddon(fitAddon);
  term.open(elements.terminalContainer);

  return { term, fitAddon };
}

function syncPtySize(term: Terminal): void {
  if (term.rows > 0 && term.cols > 0) {
    invoke("pty_resize", { rows: term.rows, cols: term.cols }).catch(() => {});
  }
}

function updateDimensions(fitAddon: FitAddon, term?: Terminal): void {
  const { isTerminalVisible, isVertical, splitRatio } = layoutState;
  const { editorContainer, terminalWrapper, divider } = elements;

  if (!isTerminalVisible) {
    editorContainer.style.width = "100%";
    editorContainer.style.height = "100%";
    terminalWrapper.style.display = "none";
    divider.style.display = "none";
    return;
  }

  terminalWrapper.style.display = "flex";
  divider.style.display = "block";

  if (isVertical) {
    editorContainer.style.width = "100%";
    editorContainer.style.height = `${splitRatio * 100}%`;
    terminalWrapper.style.width = "100%";
    terminalWrapper.style.height = "";
  } else {
    editorContainer.style.height = "100%";
    editorContainer.style.width = `${splitRatio * 100}%`;
    terminalWrapper.style.height = "100%";
    terminalWrapper.style.width = "";
  }

  requestAnimationFrame(() => {
    fitAddon.fit();
    if (term) syncPtySize(term);
  });
}

function setRunningState(running: boolean): void {
  layoutState.isRunning = running;
  const label = elements.btnRun.querySelector(".btn-label");
  const icon = elements.btnRun.querySelector(".btn-icon");

  if (running) {
    if (label) label.textContent = "Stop";
    if (icon) icon.textContent = "⏹";
    elements.btnRun.classList.add("running");
    elements.statusDot.className = "dot running";
  } else {
    if (label) label.textContent = "Run";
    if (icon) icon.textContent = "▶";
    elements.btnRun.classList.remove("running");
    elements.statusDot.className = "dot idle";
  }
}

function switchLanguage(editor: EditorView, targetLanguage: string): void {
  editor.dispatch({
    effects: languageCompartment.reconfigure(
      getLanguageExtension(targetLanguage),
    ),
    changes: {
      from: 0,
      to: editor.state.doc.length,
      insert: SNIPPETS[targetLanguage] || "",
    },
  });
  elements.statusLang.textContent =
    targetLanguage.charAt(0).toUpperCase() + targetLanguage.slice(1);
}

async function verifyToolchains(term: Terminal): Promise<void> {
  try {
    const status = await invoke<SystemToolchainStatus>("check_toolchains");
    term.writeln("\x1b[32m[Toolchain Status]\x1b[0m");
    term.writeln(
      `  Python: ${status.python.is_available ? status.python.version : "\x1b[31mNot Found\x1b[0m"}`,
    );
    term.writeln(
      `  C (GCC): ${status.c.is_available ? status.c.version : "\x1b[31mNot Found\x1b[0m"}`,
    );
    term.writeln(
      `  Java: ${status.java.is_available ? status.java.version : "\x1b[31mNot Found\x1b[0m"}\r\n`,
    );
  } catch (err) {
    term.writeln(`\x1b[31mFailed to check toolchains: ${err}\x1b[0m\r\n`);
  }
}

async function stopProcess(term: Terminal): Promise<void> {
  try {
    await invoke("kill_process");
    setRunningState(false);
    term.writeln("\r\n\x1b[31m[Process terminated by user]\x1b[0m\r\n");
  } catch (err) {
    console.error(err);
  }
}

async function executeCode(
  editor: EditorView,
  term: Terminal,
  fitAddon: FitAddon,
): Promise<void> {
  if (layoutState.isRunning) {
    await stopProcess(term);
    return;
  }

  if (!layoutState.isTerminalVisible) {
    layoutState.isTerminalVisible = true;
    updateDimensions(fitAddon, term);
  }

  term.clear();
  const code = editor.state.doc.toString();
  const language = elements.langSelect.value;

  setRunningState(true);
  term.writeln(`\x1b[33m[Launching ${language.toUpperCase()}...]\x1b[0m\r\n`);

  try {
    await invoke("run_code", {
      payload: {
        language,
        code,
        rows: term.rows || 24,
        cols: term.cols || 80,
      },
    });
  } catch (err) {
    setRunningState(false);
    term.writeln(`\r\n\x1b[31m[Execution Error]: ${err}\x1b[0m\r\n`);
  }
}

function attachTerminalStreams(term: Terminal): void {
  listen<string>("pty-output", (event) => term.write(event.payload));
  listen("pty-exit", () => {
    setRunningState(false);
    term.writeln("\r\n\x1b[90m[Process finished]\x1b[0m\r\n");
  });

  term.onData((data) => {
    if (data === "\x03" && layoutState.isRunning) {
      stopProcess(term);
      return;
    }
    invoke("pty_write", { data }).catch(console.error);
  });
}

function bindEventListeners(
  editor: EditorView,
  term: Terminal,
  fitAddon: FitAddon,
): void {
  elements.langSelect.addEventListener("change", () =>
    switchLanguage(editor, elements.langSelect.value),
  );

  elements.btnToggleLayout.addEventListener("click", () => {
    layoutState.isVertical = !layoutState.isVertical;
    elements.workspace.className = layoutState.isVertical
      ? "layout-vertical"
      : "layout-horizontal";
    updateDimensions(fitAddon, term);
  });

  elements.btnToggleTerminal.addEventListener("click", () => {
    layoutState.isTerminalVisible = !layoutState.isTerminalVisible;
    updateDimensions(fitAddon, term);
  });

  elements.btnClear.addEventListener("click", () => term.clear());

  elements.checkVim.addEventListener("change", () => {
    editor.dispatch({
      effects: vimCompartment.reconfigure(
        elements.checkVim.checked ? vim() : [],
      ),
    });
  });

  elements.btnRun.addEventListener("click", () =>
    executeCode(editor, term, fitAddon),
  );

  window.addEventListener("keydown", (e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      executeCode(editor, term, fitAddon);
    }
  });

  elements.divider.addEventListener("mousedown", (e: MouseEvent) => {
    layoutState.isDragging = true;
    elements.divider.classList.add("dragging");
    document.body.style.userSelect = "none";
    e.preventDefault();
  });

  window.addEventListener("mousemove", (e: MouseEvent) => {
    if (!layoutState.isDragging) return;
    const rect = elements.workspace.getBoundingClientRect();
    const ratio = layoutState.isVertical
      ? (e.clientY - rect.top) / rect.height
      : (e.clientX - rect.left) / rect.width;

    if (ratio >= 0.2 && ratio <= 0.8) {
      layoutState.splitRatio = ratio;
      updateDimensions(fitAddon, term);
    }
  });

  window.addEventListener("mouseup", () => {
    if (!layoutState.isDragging) return;
    layoutState.isDragging = false;
    elements.divider.classList.remove("dragging");
    document.body.style.userSelect = "auto";
    fitAddon.fit();
    syncPtySize(term);
  });

  window.addEventListener("resize", () => updateDimensions(fitAddon, term));
}

function bootstrap(): void {
  const editor = initializeEditor();
  const { term, fitAddon } = initializeTerminal();

  // 1. Terapkan dimensi CSS terlebih dahulu
  updateDimensions(fitAddon, term);
  attachTerminalStreams(term);
  bindEventListeners(editor, term, fitAddon);

  // 2. Beri jeda 50ms agar DOM selesai render dan FitAddon membaca ukuran kontainer asli
  setTimeout(() => {
    fitAddon.fit();
    syncPtySize(term);
    term.writeln("\x1b[36m=== Code Scratchpad Ready ===\x1b[0m");
    term.writeln('Click "Run" or press Ctrl+Enter to execute.\r\n');
    verifyToolchains(term);
  }, 50);
}

bootstrap();
