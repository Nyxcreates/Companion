@echo off
setlocal

REM ============================================================
REM  Companion — Launch Floating Nikki as a standalone Windows overlay
REM
REM  Nikki will float above Chrome, VS Code and all other windows.
REM  She stays visible even when the Companion website is closed.
REM  Right-click the system tray icon to show/hide or exit.
REM ============================================================

REM Clear the ELECTRON_RUN_AS_NODE variable if it was set by another tool
set "ELECTRON_RUN_AS_NODE="

REM Kill any stale Electron instances first (optional safety)
taskkill /IM electron.exe /F >nul 2>&1
timeout /t 1 /nobreak >nul

REM Auto-detect URL: prefer local dev server, fall back to production
set "COMPANION_URL=https://companion-app-pi-seven.vercel.app"
curl -s --max-time 2 http://localhost:3000/api/health >nul 2>&1
if %errorlevel% == 0 (
  set "COMPANION_URL=http://localhost:3000"
  echo [Nikki] Using local server: http://localhost:3000
) else (
  echo [Nikki] Using production: https://companion-app-pi-seven.vercel.app
)

echo.
echo  Starting Floating Nikki...
echo  Nikki will appear in the bottom-right corner of your screen.
echo  Right-click the system tray icon to show/hide or exit.
echo.

REM Change to the desktop folder (same directory as this .bat)
cd /d "%~dp0"

REM Launch Electron in background (detached so this window can close)
start "" /B "node_modules\electron\dist\electron.exe" . --hidden

echo  Nikki launched! You can close this window.
timeout /t 3 /nobreak >nul

endlocal
