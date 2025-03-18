
const { contextBridge, ipcRenderer } = require('electron');

// Expose specific Electron APIs to the renderer process
contextBridge.exposeInMainWorld('electron', {
  // Set a flag so the renderer process can check if it's running in Electron
  isElectron: true,
  
  // Select a model file
  selectModel: () => ipcRenderer.invoke('select-model'),
  
  // Get the default model path
  getDefaultModelPath: () => ipcRenderer.invoke('get-default-model-path'),
  
  // Read a model file (for validation)
  readModelFile: (path) => ipcRenderer.invoke('read-model-file', path),
  
  // Get the directory of a model
  getModelDir: (modelJsonPath) => ipcRenderer.invoke('get-model-dir', modelJsonPath),
  
  // Check model format
  checkModelFormat: (modelPath) => ipcRenderer.invoke('check-model-format', modelPath),
  
  // Read files in a directory
  readModelDir: (dirPath) => ipcRenderer.invoke('read-model-dir', dirPath),
  
  // NEW: Analyze image with H5 model
  analyzeWithH5Model: (modelPath, imageDataUrl) => ipcRenderer.invoke('analyze-with-h5-model', modelPath, imageDataUrl),
});
