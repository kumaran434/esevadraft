// =========================================================================
// eSevaDraft Desktop App — Hardened Preload Script (Context Isolation)
// =========================================================================
const { contextBridge, ipcRenderer } = require('electron');

// Only expose strictly whitelisted and validated functions to renderer
contextBridge.exposeInMainWorld('esevaDesktopBridge', {
    isDesktopApp: true,
    platform: process.platform,
    version: '1.1.1',
    
    // Window Controls for Frameless Desktop Experience
    minimizeWindow: () => ipcRenderer.send('window-minimize'),
    maximizeWindow: () => ipcRenderer.send('window-maximize'),
    closeWindow: () => ipcRenderer.send('window-close'),
    isWindowMaximized: () => ipcRenderer.invoke('window-is-maximized'),
    onMaximizeChanged: (callback) => {
        ipcRenderer.on('window-maximize-changed', (_event, isMax) => callback(isMax));
    },

    // Start local visual browser automation
    startLiveAutomation: (data) => ipcRenderer.invoke('start-live-automation', data),
    
    // Stop running local visual browser automation
    stopLiveAutomation: (payload) => ipcRenderer.invoke('stop-live-automation', payload),
    
    // Get local automation status
    getAutomationStatus: () => ipcRenderer.invoke('get-automation-status'),
    
    // Scan document from local flatbed USB scanner
    scanDocumentDirect: () => ipcRenderer.invoke('scan-document-direct'),
    
    // Operator approval for final submit (Step 48)
    approveFinalSubmit: (payload) => ipcRenderer.invoke('approve-final-submit', payload),

    // Provide OTP to running local browser automation
    provideLiveOtp: (otp) => ipcRenderer.invoke('provide-live-otp', otp),

    // Download TNPDS Application PDF by Reference Number
    downloadTnpdsPdf: (refNo) => ipcRenderer.invoke('download-tnpds-pdf', refNo),

    // Direct Native File Saver (for Tools, Photos, and Base64 downloads)
    saveFileDirect: (payload) => ipcRenderer.invoke('save-file-direct', payload),

    // Listen for download completion event
    onDownloadCompleted: (callback) => {
        ipcRenderer.on('download-completed', (_event, info) => callback(info));
    },

    // Restore WebContents input focus after dialogs or transitions
    restoreFocus: () => ipcRenderer.invoke('restore-focus'),

    // Listen for real-time automation events
    onAutomationUpdate: (callback) => {
        ipcRenderer.on('automation-step-update', (_event, value) => callback(value));
    },

    // Listen for final automation result
    onAutomationFinished: (callback) => {
        ipcRenderer.on('automation-finished', (_event, res) => callback(res));
    }
});

