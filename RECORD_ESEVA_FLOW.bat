@echo off
title eSevaDraft Recorder
cd /d "D:\downloads\ai assitant 2"
echo.
echo Opening Chrome... Please wait...
echo.
"C:\Program Files\nodejs\node.exe" tools\record_flow.js
echo.
echo Done! Check data\recorded_flows\ folder.
echo.
pause
