; eSevaDraft Desktop NSIS Custom Hooks (build/installer.nsh)
; Ensures smooth auto-updates and manual upgrades by cleanly releasing all running
; eSevaDraft Desktop / Chromium child processes before file extraction so NSIS updates
; never abort halfway due to locked files or open HTTP keep-alive handles.

!macro customCheckAppRunning
  DetailPrint "Closing running eSevaDraft Desktop instances before update..."
  ; Give autoUpdater's app.quit() a brief head start when invoked via --updated
  ${if} ${isUpdated}
    Sleep 800
  ${endif}

  ; Attempt graceful close first, then force-terminate any lingering Electron/Chromium child processes
  nsExec::Exec '"$SYSDIR\taskkill.exe" /IM "${APP_EXECUTABLE_FILENAME}" /T'
  Pop $0
  Sleep 800

  nsExec::Exec '"$SYSDIR\taskkill.exe" /F /IM "${APP_EXECUTABLE_FILENAME}" /T'
  Pop $0
  Sleep 800
!macroend
