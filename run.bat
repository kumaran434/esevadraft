@echo off
cd /d "%~dp0"
title eSevaDraft Government Form Automation Server
echo ========================================================
echo Cleaning old background processes on port 3000...
for /f "tokens=5" %%a in ('netstat -aon ^| find ":3000" ^| find "LISTENING"') do taskkill /f /pid %%a >nul 2>&1
echo ========================================================
echo Starting eSevaDraft Government Form Automation Server...
echo ========================================================
start http://localhost:3000/index.html
node server.js
pause
