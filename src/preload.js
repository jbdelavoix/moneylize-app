const { contextBridge, ipcRenderer } = require("electron");

function pathLookup(root, dottedPath) {
  if (!root || !dottedPath) return undefined;
  let cur = root;
  for (const segment of dottedPath.split(".")) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = cur[segment];
  }
  return typeof cur === "string" ? cur : undefined;
}

function applyReplacements(str, replacements) {
  if (replacements == null || typeof replacements !== "object") return str;
  let out = str;
  for (const key of Object.keys(replacements)) {
    out = out.split(`{${key}}`).join(String(replacements[key]));
  }
  return out;
}

const bundle = ipcRenderer.sendSync("i18n:get-bundle");

function translate(pathKey, replacements) {
  let resolved = pathLookup(bundle.messages, pathKey);
  if (typeof resolved !== "string") {
    resolved = bundle.fallback
      ? pathLookup(bundle.fallback, pathKey)
      : undefined;
  }
  if (typeof resolved !== "string") resolved = pathKey;
  return applyReplacements(resolved, replacements);
}

/** Legacy event listeners for moneylize.com (pre-contextIsolation API). */
const legacyListeners = new Map();

function legacyEmit(channel, ...args) {
  const set = legacyListeners.get(channel);
  if (!set) return;
  const fakeEvent = { sender: { send: () => {} } };
  for (const listener of set) {
    try {
      listener(fakeEvent, ...args);
    } catch (err) {
      console.error(err);
    }
  }
}

function legacyOn(channel, listener) {
  if (!legacyListeners.has(channel)) legacyListeners.set(channel, new Set());
  legacyListeners.get(channel).add(listener);
}

/**
 * Shim ipcRenderer matching the old nodeIntegration event-based API.
 * @type {import("electron").IpcRenderer}
 */
const legacyIpcRenderer = {
  send(channel, ...args) {
    switch (channel) {
      case "file:open":
        ipcRenderer.invoke("file:open").then((result) => {
          if (!result.ok) {
            if (result.reason === "no-filename") {
              legacyEmit("file:open-no-filename");
            } else {
              legacyEmit("file:open-error", result.filepath);
            }
          } else {
            legacyEmit("file:open-success", {
              filepath: result.filepath,
              data: result.data,
            });
          }
        });
        return;
      case "file:save":
        ipcRenderer.invoke("file:save", args[0]).then((result) => {
          if (!result.ok) {
            legacyEmit("file:save-error", result.filepath);
          } else {
            legacyEmit("file:save-success", result.filepath);
          }
        });
        return;
      default:
        ipcRenderer.send(channel, ...args);
    }
  },

  on(channel, listener) {
    legacyOn(channel, listener);
    return this;
  },

  once(channel, listener) {
    const wrapper = (event, ...args) => {
      this.removeListener(channel, wrapper);
      listener(event, ...args);
    };
    return this.on(channel, wrapper);
  },

  removeListener(channel, listener) {
    legacyListeners.get(channel)?.delete(listener);
    return this;
  },

  removeAllListeners(channel) {
    if (channel) legacyListeners.delete(channel);
    else legacyListeners.clear();
    return this;
  },

  invoke(channel, ...args) {
    return ipcRenderer.invoke(channel, ...args);
  },

  sendSync(channel, ...args) {
    return ipcRenderer.sendSync(channel, ...args);
  },
};

/** Subset of Node `process` exposed to moneylize.com (Electron detection, platform). */
const processShim = {
  platform: process.platform,
  arch: process.arch,
  type: "renderer",
  versions: { ...process.versions },
  env: { ...process.env },
};

contextBridge.exposeInMainWorld("electronAPI", {
  locale: bundle.locale,

  /** Win32 | darwin | linux */
  platform: process.platform,

  t(pathKey, replacements) {
    return translate(pathKey, replacements);
  },

  getUiLocalePreference() {
    return ipcRenderer.invoke("prefs:getUiLocale");
  },

  setUiLocalePreference(mode) {
    return ipcRenderer.invoke("prefs:setUiLocale", mode);
  },

  getAppearancePreference() {
    return ipcRenderer.invoke("prefs:getAppearance");
  },

  setAppearancePreference(mode) {
    return ipcRenderer.invoke("prefs:setAppearance", mode);
  },

  openContextMenu(x, y) {
    ipcRenderer.send("contextmenu:open", x, y);
  },

  minimize() {
    ipcRenderer.send("app:minimize");
  },

  maximize() {
    ipcRenderer.send("app:maximize");
  },

  unmaximize() {
    ipcRenderer.send("app:unmaximize");
  },

  close() {
    ipcRenderer.send("app:close");
  },

  openFile() {
    return ipcRenderer.invoke("file:open");
  },

  saveFile(file) {
    return ipcRenderer.invoke("file:save", file);
  },
});

contextBridge.exposeInMainWorld("process", processShim);

/** moneylize.com uses `window.require("electron"|"process")` from the Angular app. */
contextBridge.exposeInMainWorld("require", (moduleName) => {
  if (moduleName === "electron") {
    return { ipcRenderer: legacyIpcRenderer };
  }
  if (moduleName === "process") {
    return processShim;
  }
  throw new Error(`Cannot find module '${moduleName}'`);
});

window.addEventListener(
  "contextmenu",
  (e) => {
    e.preventDefault();
    ipcRenderer.send("contextmenu:open", e.x, e.y);
  },
  false,
);
