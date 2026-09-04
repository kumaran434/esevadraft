@echo off
title e-Sevai AI Service Recorder
color 0A
cls

:: Create recordings folder if not exists
if not exist "recordings" mkdir recordings

:: Generate clean timestamp for output
set TIMESTAMP=%date:~-4%%date:~3,2%%date:~0,2%_%time:~0,2%%time:~3,2%%time:~6,2%
set TIMESTAMP=%TIMESTAMP: =0%
set OUTPUT_FILE=recordings\workflow_%TIMESTAMP%.js

echo ===================================================================
echo             e-Sevai AI Government Service Recorder
echo ===================================================================
echo.
echo  Starting Google Chrome Recorder...
echo  - Fill any government form normally.
echo  - Everything you click and type is automatically recorded!
echo  - Saved to: %OUTPUT_FILE%
echo.
echo ===================================================================

npx playwright codegen --channel=chrome --output %OUTPUT_FILE% https://tnpds.gov.in/pages/newsmartcard

copy /Y %OUTPUT_FILE% recorded_workflow.js >nul 2>&1

echo.
echo ===================================================================
echo  Recording Saved Successfully!
echo ===================================================================
pause
