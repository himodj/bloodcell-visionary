
const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electron', {
  selectModel: () => ipcRenderer.invoke('select-model'),
  getDefaultModelPath: () => ipcRenderer.invoke('get-default-model-path'),
  getModelDir: (modelJsonPath) => ipcRenderer.invoke('get-model-dir', modelJsonPath),
  checkModelFormat: (modelPath) => ipcRenderer.invoke('check-model-format', modelPath),
  readModelFile: (filePath) => ipcRenderer.invoke('read-model-file', filePath),
  readModelDir: (dirPath) => ipcRenderer.invoke('read-model-dir', dirPath),
  isElectron: true
});
