# Companion Desktop (Floating Nikki)

Electron desktop wrapper for **Floating Nikki** on Windows.

## Requirements

- Windows 10 / 11
- Node.js 18+ and npm

## Run on Windows

From the `desktop` folder (`Companion_App/desktop`):

```powershell
cd desktop
npm install
npm start
```

### Custom Backend URL

By default, the app loads `https://companion-app-pied-chi.vercel.app` (or `http://localhost:3000` if the production health check fails and a local dev server is running). To override the URL explicitly:

```powershell
$env:COMPANION_URL="https://companion-app-pied-chi.vercel.app"
npm start
```

Or in Command Prompt (`cmd.exe`):

```bat
set COMPANION_URL=https://companion-app-pied-chi.vercel.app
npm start
```

## Features

- Frameless, transparent, always-on-top, draggable Floating Nikki window positioned at the bottom-right of the primary display (no taskbar entry).
- System tray icon with **Open Companion**, **Show Nikki / Hide Nikki**, **Pause / Resume Nikki**, **Do Not Disturb**, **Launch at login**, and **Exit Companion**.
- Single-instance lock so launching again focuses the existing instance.
- Automatic retry page if the remote app fails to load.
- Secure Electron settings (`contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`).
