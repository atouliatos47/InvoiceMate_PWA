@echo off
title InvoiceMate - Local Dev
color 0B
cls

echo.
echo  ==========================================
echo   InvoiceMate - Local Development Server
echo  ==========================================
echo.

:: ── Set paths ─────────────────────────────────────────────
SET NODE_CMD=%~dp0node-v24.14.0-win-x64\node.exe
cd /d "%~dp0"

:: ── Check Node ────────────────────────────────────────────
IF NOT EXIST "%NODE_CMD%" (
    echo  [!] node.exe not found in node-v24.14.0-win-x64 folder!
    pause
    exit /b
)
echo  [+] Node found OK

:: ── Check .env ────────────────────────────────────────────
IF NOT EXIST ".env" (
    COPY ".env.example" ".env" >nul
    echo  [!] Edit .env and add your DATABASE_URL, then run again.
    pause
    start notepad ".env"
    exit /b
)
echo  [+] .env found OK

:: ── Install node_modules via npx if missing ──────────────
IF NOT EXIST "node_modules" (
    echo  [~] node_modules missing - downloading via npx...
    echo      This requires internet access and may take a minute.
    echo.
    :: Use the system npx or try to find it
    WHERE npx >nul 2>&1
    IF %ERRORLEVEL% EQU 0 (
        npx --yes npm install
    ) ELSE (
        echo  [!] Cannot auto-install. Please run this manually:
        echo.
        echo      1. Open PowerShell as Administrator
        echo      2. Run: npm install
        echo         in: %~dp0
        echo.
        echo  Or copy node_modules from another machine.
        pause
        exit /b
    )
)
echo  [+] node_modules OK

:: ── Start server directly with Node ──────────────────────
start /min cmd /c "timeout /t 2 >nul && start http://localhost:3006"

echo  [+] Starting on http://localhost:3006
echo  [+] Ctrl+C to stop
echo  ==========================================
echo.

"%NODE_CMD%" server.js

pause
