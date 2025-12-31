const { app, BrowserWindow, globalShortcut, ipcMain } = require("electron");
const path = require("path");

let mainWindow;
let hotkeyDebounce = {}; // Debounce tracker for hotkeys

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: path.join(__dirname, "icon.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
    },
  });

  // Load file HTML
  mainWindow.loadFile("index.html");

  // Debug: Uncomment to open DevTools
  // mainWindow.webContents.openDevTools();

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.on("ready", () => {
  createWindow();

  // Setup global hotkeys
  setupGlobalHotkeys();
});

/**
 * Debounce helper - prevent hotkey triggers too quickly
 */
function debounceHotkey(key, callback, delayMs = 300) {
  const now = Date.now();
  if (!hotkeyDebounce[key] || now - hotkeyDebounce[key] >= delayMs) {
    hotkeyDebounce[key] = now;
    callback();
  }
}

/**
 * Setup global hotkeys using Electron globalShortcut (Mac native)
 */
function setupGlobalHotkeys() {
  try {
    console.log("🎯 Registering global hotkeys...");

    // Register G key for toggle start/stop recording
    const retStart = globalShortcut.register("g", () => {
      debounceHotkey(
        "g-toggle",
        () => {
          console.log("🎤 G pressed - Toggle recording");
          mainWindow?.webContents.send("hotkey-pressed", { key: "G", action: "toggle" });
        },
        300
      );
    });

    if (!retStart) {
      console.warn("⚠️ G shortcut registration failed");
    } else {
      console.log("✓ G shortcut registered successfully (Toggle)");
    }
  } catch (error) {
    console.error("❌ Failed to setup global shortcuts:", error);
  }
}

// IPC: Nhận từ renderer process
ipcMain.on("app-event", (event, arg) => {
  console.log("📨 App event:", arg);
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
  globalShortcut.unregisterAll();
});

app.on("activate", () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// Unregister shortcuts before quit
app.on("before-quit", () => {
  globalShortcut.unregisterAll();
});
