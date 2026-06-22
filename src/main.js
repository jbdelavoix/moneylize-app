const {
  app,
  dialog,
  ipcMain,
  BrowserWindow,
  Menu,
  nativeImage,
  nativeTheme,
  shell,
} = require("electron");
const fs = require("fs");
const path = require("path");

const PACKAGE = require("../package.json");

const WEBSITE_URL = "https://moneylize.com";

const HOMEPAGE =
  typeof PACKAGE.homepage === "string"
    ? PACKAGE.homepage
    : "https://github.com/jbdelavoix/moneylize-app";

const {
  resolvePreferredLocale,
  loadMessages,
  lookup,
  SUPPORTED,
} = require("./i18n");
const { loadPrefs, savePrefs } = require("./preferences");

let resolvedLocale = "en";
let uiMessages = loadMessages("en");
let englishMessages = uiMessages;

function tl(key) {
  return lookup(uiMessages, key) ?? lookup(englishMessages, key) ?? key;
}

function applyResolvedLocale(locale) {
  resolvedLocale = locale;
  uiMessages = loadMessages(resolvedLocale);
  englishMessages =
    resolvedLocale === "en" ? uiMessages : loadMessages("en");
}

function effectiveUiLocale(app, preference) {
  const mode =
    preference === undefined || preference === null
      ? "system"
      : String(preference);
  if (mode !== "system" && SUPPORTED.has(mode)) return mode;
  return resolvePreferredLocale(app);
}

ipcMain.on("i18n:get-bundle", (event) => {
  event.returnValue = {
    locale: resolvedLocale,
    messages: uiMessages,
    fallback: resolvedLocale === "en" ? null : englishMessages,
  };
});

let mainWindow = null;

/** macOS: distinguish red-close (hide) from real quit (Cmd+Q / menu Quit). */
let isAppQuitting = false;

app.on("before-quit", () => {
  isAppQuitting = true;
});

const BUILD_ASSETS = path.join(__dirname, "..", "build");

/**
 * Window / Dock raster used only in development (`electron .`).
 * Packaged apps rely on `CFBundleIconName` / Assets.car — avoid overriding Dock.
 */
function loadDevIconImage() {
  const candidates = [
    path.join(BUILD_ASSETS, "icon.png"),
    process.platform === "darwin" ? path.join(BUILD_ASSETS, "icon.icns") : null,
    process.platform === "win32" ? path.join(BUILD_ASSETS, "icon.ico") : null,
  ].filter((p) => typeof p === "string");

  for (const p of candidates) {
    if (!fs.existsSync(p)) continue;
    try {
      const img = nativeImage.createFromPath(p);
      if (!img.isEmpty()) return img;
    } catch {
      // ignore
    }
  }
  return null;
}

function addMenu(platform) {
  const menu = Menu.buildFromTemplate([
    { role: "appMenu" },
    { role: "editMenu" },
    { role: "viewMenu" },
    { role: "windowMenu" },
    {
      role: "help",
      submenu: [
        {
          label: tl("menu.learnMore"),
          click: () => shell.openExternal(HOMEPAGE).catch(() => {}),
        },
      ],
    },
  ]);

  if (platform === "darwin") {
    Menu.setApplicationMenu(menu);
  } else {
    Menu.setApplicationMenu(null);
  }
}

function normalizeAppearancePreference(raw) {
  const s = raw === undefined || raw === null ? "system" : String(raw);
  if (s === "light" || s === "dark" || s === "system") return s;
  return "system";
}

function syncNativeAppearance(mode) {
  const normalized = normalizeAppearancePreference(mode);
  try {
    if (normalized === "dark") nativeTheme.themeSource = "dark";
    else if (normalized === "light") nativeTheme.themeSource = "light";
    else nativeTheme.themeSource = "system";
  } catch {
    // ignore
  }
}

function setupPreferencesIpc() {
  ipcMain.handle("prefs:getUiLocale", () => {
    const p = loadPrefs(app);
    const raw = p.uiLocale;
    if (raw === undefined || raw === null) return "system";
    const s = String(raw);
    if (s === "system" || SUPPORTED.has(s)) return s;
    return "system";
  });

  ipcMain.handle("prefs:getAppearance", () => {
    return normalizeAppearancePreference(loadPrefs(app).uiAppearance);
  });

  ipcMain.handle("prefs:setAppearance", async (_event, requested) => {
    const normalized = normalizeAppearancePreference(requested);
    savePrefs(app, { ...loadPrefs(app), uiAppearance: normalized });
    syncNativeAppearance(normalized);
    return { saved: normalized };
  });

  ipcMain.handle("prefs:setUiLocale", async (_event, requested) => {
    const normalized =
      requested === "system"
        ? "system"
        : SUPPORTED.has(requested)
          ? requested
          : "system";
    savePrefs(app, { ...loadPrefs(app), uiLocale: normalized });

    applyResolvedLocale(effectiveUiLocale(app, normalized));
    addMenu(process.platform);

    for (const win of BrowserWindow.getAllWindows()) {
      if (typeof win.webContents.reloadIgnoringCache === "function") {
        win.webContents.reloadIgnoringCache();
      } else {
        win.webContents.reload();
      }
    }

    return { saved: normalized };
  });
}

function setupFileIpc() {
  ipcMain.handle("file:open", async () => {
    const result = await dialog.showOpenDialog(mainWindow);
    const filenames = result.filePaths;
    if (!filenames || !filenames.length) {
      return { ok: false, reason: "no-filename" };
    }

    const filepath = filenames[0];
    try {
      const data = await fs.promises.readFile(filepath);
      return { ok: true, filepath, data };
    } catch {
      return { ok: false, reason: "error", filepath };
    }
  });

  ipcMain.handle("file:save", async (_event, file) => {
    const saveTo = async (filepath) => {
      try {
        await fs.promises.writeFile(filepath, file.data);
        return { ok: true, filepath };
      } catch {
        return { ok: false, reason: "error", filepath };
      }
    };

    if (file.filepath) {
      try {
        await fs.promises.access(file.filepath);
        return saveTo(file.filepath);
      } catch {
        // fall through to save dialog
      }
    }

    const result = await dialog.showSaveDialog({
      defaultPath: "*/" + file.filename,
    });
    let filepath = result.filePath;
    if (!filepath) {
      return { ok: false, reason: "error", filepath: null };
    }
    if (!filepath.endsWith(".mnyl")) filepath = filepath + ".mnyl";
    return saveTo(filepath);
  });
}

function setupWindowIpc() {
  ipcMain.on("app:minimize", () => {
    mainWindow?.minimize();
  });

  ipcMain.on("app:maximize", () => {
    mainWindow?.maximize();
  });

  ipcMain.on("app:unmaximize", () => {
    mainWindow?.unmaximize();
  });

  ipcMain.on("app:close", () => {
    mainWindow?.close();
  });
}

function setupContextMenuIpc() {
  ipcMain.on("contextmenu:open", (_event, x, y) => {
    const advancedSubmenu = [{ role: "reload" }];
    if (!app.isPackaged) {
      advancedSubmenu.push({ role: "toggleDevTools" });
    }
    const ctx = Menu.buildFromTemplate([
      { role: "undo" },
      { role: "redo" },
      { type: "separator" },
      { role: "cut" },
      { role: "copy" },
      { role: "paste" },
      { type: "separator" },
      {
        label: tl("menu.advanced"),
        submenu: advancedSubmenu,
      },
    ]);
    ctx.popup({
      window: mainWindow ?? undefined,
      x,
      y,
    });
  });
}

function createWindow() {
  const devIcon = app.isPackaged ? null : loadDevIconImage();

  const darwinChrome =
    process.platform === "darwin" ? { titleBarStyle: "hiddenInset" } : {};

  mainWindow = new BrowserWindow({
    title:
      typeof PACKAGE.productName === "string"
        ? PACKAGE.productName
        : "Moneylize",
    width: 1600,
    height: 900,
    frame: false,
    ...darwinChrome,
    icon: devIcon ?? undefined,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (!app.isPackaged && process.platform === "darwin" && app.dock && devIcon) {
    try {
      app.dock.setIcon(devIcon);
    } catch {
      // ignore
    }
  }

  mainWindow.loadURL(WEBSITE_URL);

  mainWindow.on("close", (event) => {
    if (process.platform === "darwin" && !isAppQuitting) {
      event.preventDefault();
      mainWindow.hide();
      return;
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  const prefsData = loadPrefs(app);
  applyResolvedLocale(effectiveUiLocale(app, prefsData.uiLocale));
  syncNativeAppearance(prefsData.uiAppearance);

  setupPreferencesIpc();
  setupFileIpc();
  setupWindowIpc();
  setupContextMenuIpc();

  addMenu(process.platform);

  createWindow();

  app.on("activate", () => {
    if (mainWindow === null) {
      createWindow();
    } else {
      mainWindow.show();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
