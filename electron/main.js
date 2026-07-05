// Electron main process. Plain CommonJS on purpose — this is glue code (open a
// window pointed at the hosted app), not application logic.
//
// The desktop app is a thin client: every account/mindmap lives on the hosted
// deployment at HOSTED_URL below, the same place a plain browser would reach — so
// logging in here and on any other device (another Mac, a browser, a phone) shares
// the same data. There's no local server and no local database to keep in sync.
const { app, BrowserWindow, dialog } = require("electron");
const path = require("node:path");

// Update this whenever the hosted deployment's URL changes (e.g. a custom domain).
const HOSTED_URL = "https://mindmap-app-ruby.vercel.app";

app.setName("Mindmap");

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: "Mindmap",
    backgroundColor: "#0a0a0a",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, "loading.html"));
  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  // electron:dev points at an already-running `npm run dev` server instead of the
  // hosted deployment, for testing main-process changes without a real deploy.
  const url = process.env.ELECTRON_START_URL || HOSTED_URL;
  mainWindow.loadURL(url).catch((err) => {
    dialog.showErrorBox("Mindmap couldn't load", `Couldn't reach ${url}:\n\n${err.message}`);
  });
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(createWindow);

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
}
