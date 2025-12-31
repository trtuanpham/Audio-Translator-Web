const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  // Nhận global hotkey events
  onHotkey: (callback) => {
    ipcRenderer.on("hotkey-pressed", (event, data) => {
      callback(data);
    });
  },

  // Gửi events tới main process
  sendEvent: (channel, data) => {
    ipcRenderer.send(channel, data);
  },

  // Remove listener
  offHotkey: () => {
    ipcRenderer.removeAllListeners("hotkey-pressed");
  },
});
