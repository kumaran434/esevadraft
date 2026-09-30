@echo off
cd /d "%~dp0"
title eSeva - Chrome Multi-Tab Automation Mode
echo ======================================================================
echo    eSeva - Google Chrome Multi-Tab Automation Mode
echo ======================================================================
echo.
echo Checking for Google Chrome...

set "CHROME_PATH="
if exist "C:\Program Files\Google\Chrome\Application\chrome.exe" (
    set "CHROME_PATH=C:\Program Files\Google\Chrome\Application\chrome.exe"
) else if exist "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" (
    set "CHROME_PATH=C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
) else if exist "%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe" (
    set "CHROME_PATH=%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"
)

if "%CHROME_PATH%"=="" (
    echo [ERROR] Google Chrome not found in standard directories.
    echo Please start Chrome manually with: chrome.exe --remote-debugging-port=9222
    pause
    exit /b 1
)

echo Starting Chrome with remote debugging on port 9222...
echo.
echo Note: Once opened, eSeva automation will automatically open a NEW TAB
echo inside this Chrome window instead of creating separate windows!
echo.

start "" "%CHROME_PATH%" --remote-debugging-port=9222 "https://www.tnpds.gov.in"
echo Chrome launched successfully!
timeout /t 3 >nul
exit /b 0
