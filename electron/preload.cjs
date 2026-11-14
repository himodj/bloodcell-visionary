// Safe bridge between the UI and the main process. No Node.js access leaks into the page.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  isElectron: true,

  // --- application
  getAppInfo: () => ipcRenderer.invoke('app:info'),
  openLogFile: () => ipcRenderer.invoke('app:open-log'),
  openReportsDir: () => ipcRenderer.invoke('app:open-reports-dir'),
  log: (level, message) => ipcRenderer.send('app:log', level, message),
  getSetting: (key) => ipcRenderer.invoke('settings:get', key),
  setSetting: (key, value) => ipcRenderer.invoke('settings:set', key, value),

  // --- model
  loadModelFile: () => ipcRenderer.invoke('model:load'),
  browseForModel: () => ipcRenderer.invoke('model:browse'),
  resetModel: () => ipcRenderer.invoke('model:reset'),
  getSelfTestSamples: () => ipcRenderer.invoke('model:selftest-samples'),

  // --- report archive
  archiveAllocate: () => ipcRenderer.invoke('archive:allocate'),
  archiveSave: (payload) => ipcRenderer.invoke('archive:save', payload),
  archiveList: () => ipcRenderer.invoke('archive:list'),
  archiveLoad: (folderPath) => ipcRenderer.invoke('archive:load', folderPath),
  archiveDelete: (folderPath) => ipcRenderer.invoke('archive:delete', folderPath),
  archiveOpenFolder: (folderPath) => ipcRenderer.invoke('archive:open-folder', folderPath),

  // --- printing
  printReport: (payload) => ipcRenderer.invoke('report:print', payload),
  // File menu / keyboard shortcuts: 'print' (Ctrl+P), 'pdf' (Ctrl+Shift+P), 'save' (Ctrl+S)
  onMenuCommand: (callback) => {
    const listener = (_event, command) => callback(command);
    ipcRenderer.on('menu:command', listener);
    return () => ipcRenderer.removeListener('menu:command', listener);
  },
  exportReportPdf: (payload) => ipcRenderer.invoke('report:pdf', payload),
});
