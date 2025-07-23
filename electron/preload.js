const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Export functionality
  exportImage: (options) => ipcRenderer.invoke('export-image', options),
  
  // Project management
  saveProject: (projectData) => ipcRenderer.invoke('save-project', projectData),
  loadProject: () => ipcRenderer.invoke('load-project'),
  
  // Printing
  printLabels: (items) => ipcRenderer.invoke('print-labels', items),
  
  // Platform info
  platform: process.platform,
  
  // Version info
  versions: {
    node: process.versions.node,
    chrome: process.versions.chrome,
    electron: process.versions.electron
  }
});

// DOM Content Loaded listener
window.addEventListener('DOMContentLoaded', () => {
  // Add any initialization code here if needed
  console.log('Electron preload script loaded');
});
