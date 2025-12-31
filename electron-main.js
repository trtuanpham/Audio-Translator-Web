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
      sandbox: false, // Disable sandbox to allow audio capture
    },
  });

  // Load file HTML
  mainWindow.loadFile("index.html");

  // Set CSP headers for secure connections
  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        "Content-Security-Policy": [
          "default-src 'self'; " +
            "connect-src 'self' https://*.google.com https://www.google.com https://api.mymemory.translated.net https://dns.google; " +
            "script-src 'self' 'unsafe-inline'; " +
            "style-src 'self' 'unsafe-inline'; " +
            "media-src *; " +
            "img-src 'self' data:;",
        ],
      },
    });
  });

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

// Grant audio/microphone permissions automatically
app.whenReady().then(() => {
  const { session } = require("electron");

  // Set permission request handler for all sessions
  session.defaultSession?.setPermissionRequestHandler((webContents, permission, callback) => {
    // Auto-approve microphone/audio permissions
    if (permission === "microphone" || permission === "audio" || permission === "media") {
      console.log(`✓ Auto-approving ${permission} permission`);
      callback(true);
    } else {
      console.log(`⚠️ Denying permission: ${permission}`);
      callback(false);
    }
  });

  console.log("✓ Permission handler registered");
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
