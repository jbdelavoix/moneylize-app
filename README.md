# Moneylize

Desktop client for [Moneylize](https://moneylize.com), built with [Electron](https://www.electronjs.org/).

The user-facing app name is **Moneylize** (`productName` in [`package.json`](package.json)). The npm package name for this repository is **`moneylize-app`**.

## Features

- **Cross-platform** desktop shell (macOS, Windows, Linux) around the Moneylize web app.
- **Offline-capable** packaging — the app loads `https://moneylize.com` in a hardened Chromium window.
- **Native file dialogs** for `.mnyl` projects (open / save via IPC).
- **Frameless window** with custom title-bar controls (`minimize`, `maximize`, `close`) bridged from the web UI.
- **Internationalization** of native menus: `en`, `de`, `fr`, `es` under [`src/locales/`](src/locales/). Detection uses Electron’s **`getPreferredSystemLanguages()`** plus **`app.getLocale()`**, with **English fallback**.
- **Appearance preference** persisted in `preferences.json` (user-data folder) and applied to native chrome via `nativeTheme`.
- **macOS**: red-close hides the window; real quit via **Cmd+Q** or the app menu. In **development** (`npm start`), **`build/icon.png`** (fallback **`build/icon.icns`**) is used for the window and Dock — packaged `.app` bundles rely on **`Assets.car`** / **`.icon`** when available.

## Requirements

- [Node.js](https://nodejs.org/) **20+** (LTS recommended; see `engines` in [`package.json`](package.json))
- npm

The repository includes a committed **`package-lock.json`**. For reproducible installs in CI or on a clean machine, prefer **`npm ci`** after clone.

## Development

```bash
npm install
npm test
npm start
```

| Path | Role |
|------|------|
| [`src/main.js`](src/main.js) | Main process (window, menus, IPC) |
| [`src/preload.js`](src/preload.js) | Preload bridge (`contextBridge` + legacy `window.require`) |
| [`src/i18n.js`](src/i18n.js), [`src/locales/`](src/locales/) | Menu translations |
| [`src/preferences.js`](src/preferences.js) | Persisted user preferences |

### Legacy bridge for moneylize.com

The Angular app on moneylize.com predates **`contextIsolation`**. The preload exposes:

- **`window.require('electron')`** → `{ ipcRenderer }` (event-based file / window IPC)
- **`window.require('process')`** and **`window.process`** → platform / `versions.electron`
- **`window.electronAPI`** → modern promise-based helpers (optional)

Keeping **`nodeIntegration: false`** + **`contextIsolation: true`** is intentional.

## Building for distribution

Scripts use [electron-builder](https://www.electron.build/). Configuration lives in [`electron-builder.js`](electron-builder.js) at the repo root (not in `package.json`).

| Script | Purpose |
| --- | --- |
| **`npm run dist`** | macOS + Windows + Linux artifacts (`--publish=never`) |

Bundled branding assets live under [`build/`](build/). For macOS packaging:

- If **`build/icon.icon`** exists **and** `xcrun actool --version` reports **major ≥ 26** (Xcode 26+), it is used as **`mac.icon`** so electron-builder can compile **`Assets.car`**. On older toolchains (e.g. current GitHub `macos-latest`), **`mac.icon`** automatically falls back to **`build/icon.icns`**.
- If there is no **`build/icon.icon`** directory, **`mac.icon`** is **`build/icon.icns`**.

The **`dmg`** volume icon stays **`build/icon.icns`** (electron-builder does not inherit `.icon` for DMG artwork).

In development, [`src/main.js`](src/main.js) loads **`build/icon.png`** (fallback **`build/icon.icns`** on macOS) for the window and Dock only when **`!app.isPackaged`**.

**Code signing** is disabled in [`electron-builder.js`](electron-builder.js) (`identity: null`, unsigned DMG / Windows executable). Enable signing and notarization when you ship signed installers.

Regenerate **`build/icon.icns`** from **`build/icon.png`** manually when the master PNG changes (macOS only; do **not** overwrite **`build/icon.icon/Assets/`** — that layer is managed in Icon Composer).

## Security notes

The renderer loads **third-party web content** from moneylize.com. Treat credentials and local `.mnyl` files like any other desktop finance app (disk encryption, screen lock, trusted networks).

For reporting security issues, see [`SECURITY.md`](SECURITY.md).

## Releases & CI

Pushing a **git tag** runs [`.github/workflows/release.yml`](.github/workflows/release.yml): **`npm ci`**, **`npm test`**, **`npm run dist`** on a macOS runner, then upload artifacts to a **[GitHub Release](https://github.com/jbdelavoix/moneylize-app/releases)** for that tag.

## Downloads

Artifacts appear on **[Releases — latest](https://github.com/jbdelavoix/moneylize-app/releases/latest)**.

## Testing

Automated **`node:test`** files live under [`test/`](test/) as **`*.test.js`**. Run:

```bash
npm test
```

## License

**MIT** — see [`LICENSE`](LICENSE).

## Maintainer

- [jbdelavoix](https://github.com/jbdelavoix)
