// Electron main process. Plain CommonJS on purpose — this is glue code (spawn the
// existing Next.js standalone server, load it in a window), not app logic, so it
// doesn't need the TypeScript/React toolchain the rest of the app uses.
const { app, BrowserWindow, dialog, utilityProcess } = require("electron");
const { execFileSync } = require("node:child_process");
const net = require("node:net");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const CONFIG_ENV_TEMPLATE = `# Optional settings for Mindmap. Uncomment and fill in any of these, then quit and
# reopen the app, to enable the matching feature. Leave everything commented to run
# fully solo/offline, exactly as it does by default.

# Real-time collaboration (Liveblocks) — get a secret key from
# https://liveblocks.io/dashboard/apikeys
# LIVEBLOCKS_SECRET_KEY=

# Send real "forgot password" emails via SMTP. Without this, the reset link has
# nowhere to go — a packaged app has no visible console to log a dev-mode fallback
# link to, unlike running the project with \`npm run dev\`.
# SMTP_HOST=
# SMTP_PORT=587
# SMTP_USER=
# SMTP_PASSWORD=
# EMAIL_FROM=Mindmap <noreply@example.com>
`;

// Electron otherwise derives app.getPath("userData") from package.json's "name"
// field ("mindmap-app"), not the "Mindmap" product name — set explicitly so the
// on-disk folder (~/Library/Application Support/Mindmap) matches what's documented.
app.setName("Mindmap");

let serverProcess = null;
let mainWindow = null;

function getResourcesRoot() {
  // Packaged: electron-builder's extraResources land in Contents/Resources. Running
  // from source (`electron .`, before packaging): the same layout exists relative to
  // the project root once `npm run build` + the template-db script have run, which
  // lets the full first-run flow be tested without building a .dmg every time.
  return app.isPackaged ? process.resourcesPath : path.join(__dirname, "..");
}

function getStandaloneTarPath() {
  return app.isPackaged
    ? path.join(getResourcesRoot(), "standalone.tar.gz")
    : path.join(getResourcesRoot(), ".next", "standalone.tar.gz");
}

function getTemplateDbPath() {
  return app.isPackaged
    ? path.join(getResourcesRoot(), "template.db")
    : path.join(getResourcesRoot(), "prisma", "template.db");
}

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

// Hand-rolled on purpose — a handful of `key=value` lines doesn't need the `dotenv`
// package, and this only ever reads a file this same app wrote the template for.
function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const result = {};
  for (const line of fs.readFileSync(filePath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (key) result[key] = value;
  }
  return result;
}

// Copies the bundled pre-migrated template database into place on first launch,
// generates+persists a NEXTAUTH_SECRET so sessions survive app restarts, and
// extracts the bundled server code. Returns the paths/values startServer() needs to
// spawn the Next.js server correctly.
function ensureFirstRunSetup(userDataDir) {
  fs.mkdirSync(userDataDir, { recursive: true });

  const dbPath = path.join(userDataDir, "mindmap.db");
  if (!fs.existsSync(dbPath)) {
    fs.copyFileSync(getTemplateDbPath(), dbPath);
  }

  const configPath = path.join(userDataDir, "config.json");
  let config = {};
  if (fs.existsSync(configPath)) {
    config = JSON.parse(fs.readFileSync(configPath, "utf8"));
  }
  if (!config.nextAuthSecret) {
    config.nextAuthSecret = crypto.randomBytes(32).toString("base64");
  }

  const envPath = path.join(userDataDir, "config.env");
  if (!fs.existsSync(envPath)) {
    fs.writeFileSync(envPath, CONFIG_ENV_TEMPLATE);
  }

  // The server code is re-extracted whenever the installed app version changes (a
  // fresh install, or the user replaced the .app with a newer .dmg) so an update
  // actually takes effect — the db/config/env above persist across that untouched.
  const appDir = path.join(userDataDir, "app");
  if (config.extractedVersion !== app.getVersion() || !fs.existsSync(path.join(appDir, "server.js"))) {
    fs.rmSync(appDir, { recursive: true, force: true });
    fs.mkdirSync(appDir, { recursive: true });
    execFileSync("tar", ["-xzf", getStandaloneTarPath(), "-C", appDir]);
    config.extractedVersion = app.getVersion();
  }

  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

  return { dbPath, nextAuthSecret: config.nextAuthSecret, envPath, serverPath: path.join(appDir, "server.js") };
}

async function startServer(userDataDir) {
  const { dbPath, nextAuthSecret, envPath, serverPath } = ensureFirstRunSetup(userDataDir);
  const port = await getFreePort();
  const userEnv = parseEnvFile(envPath);

  // utilityProcess.fork (not child_process.spawn of the Electron binary with
  // ELECTRON_RUN_AS_NODE) is Electron's supported way to run a Node script inside a
  // packaged app: it uses the bundled Node runtime (the target Mac isn't guaranteed
  // to have Node at all) and, unlike re-exec'ing the .app binary, macOS doesn't
  // surface it in the Dock as a second app named "exec".
  const child = utilityProcess.fork(serverPath, [], {
    serviceName: "mindmap-server",
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      ...userEnv,
      PORT: String(port),
      HOSTNAME: "127.0.0.1",
      DATABASE_URL: `file:${dbPath}`,
      NEXTAUTH_SECRET: nextAuthSecret,
      NEXTAUTH_URL: `http://127.0.0.1:${port}`,
      // Auth.js v5 only auto-trusts the request Host header when AUTH_URL/
      // AUTH_TRUST_HOST is set or NODE_ENV isn't "production" (see
      // @auth/core/lib/utils/env.js) — none of which hold here otherwise, since this
      // runs on a random loopback port with NODE_ENV=production. Safe to trust
      // unconditionally: the server only ever binds 127.0.0.1, so no external request
      // could spoof the Host header in the first place.
      AUTH_TRUST_HOST: "true",
      ATTACHMENT_STORAGE_PATH: path.join(userDataDir, "attachments"),
      NODE_ENV: "production",
    },
  });

  // Server output goes to a log file (truncated each launch, not appended — this is
  // a long-lived personal app, an ever-growing log would be a slow disk-space leak)
  // rather than being discarded, so a startup problem is diagnosable after the fact.
  // `end: false` on both pipes: whichever stream closes first must not end the
  // shared file stream out from under the other.
  const serverLog = fs.createWriteStream(path.join(userDataDir, "server.log"));
  child.stdout.pipe(serverLog, { end: false });
  child.stderr.pipe(serverLog, { end: false });

  serverProcess = child;
  return port;
}

function waitForServer(port, { attempts = 40, intervalMs = 250 } = {}) {
  return new Promise((resolve, reject) => {
    let tries = 0;
    const tryOnce = () => {
      tries += 1;
      const req = net.connect({ host: "127.0.0.1", port }, () => {
        req.end();
        resolve();
      });
      req.on("error", () => {
        req.destroy();
        if (tries >= attempts) reject(new Error("Server did not start in time"));
        else setTimeout(tryOnce, intervalMs);
      });
    };
    tryOnce();
  });
}

async function createWindow() {
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

  try {
    const startUrl = process.env.ELECTRON_START_URL;
    if (startUrl) {
      // electron:dev — point at an already-running `npm run dev` server instead of
      // spawning the standalone build, for a fast main-process/window testing loop.
      await mainWindow.loadURL(startUrl);
      return;
    }

    const port = await startServer(app.getPath("userData"));
    await waitForServer(port);
    await mainWindow.loadURL(`http://127.0.0.1:${port}`);
  } catch (err) {
    dialog.showErrorBox(
      "Mindmap couldn't start",
      `Something went wrong starting the local server:\n\n${err.message}`,
    );
    app.quit();
  }
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

  app.on("before-quit", () => {
    if (serverProcess) serverProcess.kill();
  });
}
