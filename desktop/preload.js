// =========================================================================
// eSevaDraft Desktop App — Hardened Preload Script (Context Isolation)
// =========================================================================
const { contextBridge, ipcRenderer } = require('electron');

// Only expose strictly whitelisted and validated functions to renderer
contextBridge.exposeInMainWorld('esevaDesktopBridge', {
    isDesktopApp: true,
    platform: process.platform,
    version: '1.0.0',
    
    // Start local visual browser automation
    startLiveAutomation: (data) => ipcRenderer.invoke('start-live-automation', data),
    
    // Get local automation status
    getAutomationStatus: () => ipcRenderer.invoke('get-automation-status'),
    
    // Scan document from local flatbed USB scanner
    scanDocumentDirect: () => ipcRenderer.invoke('scan-document-direct'),
    
    // Listen for real-time automation events
    onAutomationUpdate: (callback) => {
        ipcRenderer.on('automation-step-update', (_event, value) => callback(value));
    }
});
