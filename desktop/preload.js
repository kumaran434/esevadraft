// =========================================================================
// eSevaDraft Desktop App — Hardened Preload Script (Context Isolation)
// =========================================================================
const { contextBridge, ipcRenderer } = require('electron');

// Only expose strictly whitelisted and validated functions to renderer
contextBridge.exposeInMainWorld('esevaDesktopBridge', {
    isDesktopApp: true,
    platform: process.platform,
    version: '1.1.1',
    
    // Start local visual browser automation
    startLiveAutomation: (data) => ipcRenderer.invoke('start-live-automation', data),
    
    // Stop running local visual browser automation
    stopLiveAutomation: () => ipcRenderer.invoke('stop-live-automation'),
    
    // Get local automation status
    getAutomationStatus: () => ipcRenderer.invoke('get-automation-status'),
    
    // Scan document from local flatbed USB scanner
    scanDocumentDirect: () => ipcRenderer.invoke('scan-document-direct'),
    
    // Operator approval for final submit (Step 48)
    approveFinalSubmit: () => ipcRenderer.invoke('approve-final-submit'),

    // Download TNPDS Application PDF by Reference Number
    downloadTnpdsPdf: (refNo) => ipcRenderer.invoke('download-tnpds-pdf', refNo),

    // Listen for real-time automation events
    onAutomationUpdate: (callback) => {
        ipcRenderer.on('automation-step-update', (_event, value) => callback(value));
    },

    // Listen for final automation result
    onAutomationFinished: (callback) => {
        ipcRenderer.on('automation-finished', (_event, res) => callback(res));
    }
});
