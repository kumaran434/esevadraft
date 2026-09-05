@echo off
title eSevaDraft Developer Studio
color 0A
cls

echo ===================================================================
echo             eSevaDraft Developer Studio (டெவலப்பர் மையம்)
echo     Visual Service Trainer, Error Inspector, Test Simulator & Live
echo ===================================================================
echo.
echo [1/2] Checking port 3000 and starting Local Server...
echo [2/2] Opening Developer Studio in your default browser...
echo.

cd /d "%~dp0"

:: Clear any stale process on port 3000
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3000 ^| findstr LISTENING') do (
    taskkill /f /pid %%a >nul 2>&1
)

:: Open Developer Studio Web Portal in default browser after 1.5 seconds
start "" powershell -command "Start-Sleep -Milliseconds 1500; Start-Process 'http://localhost:3000/dev'"

:: Start the local Node.js server
node server.js

pause
