
const { contextBridge, ipcRenderer } = require('electron');
const axios = require('axios');

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
  
  // Analyze image with H5 model through Python backend
  analyzeWithH5Model: async (modelPath, imageDataUrl) => {
    try {
      console.log('Sending image to Python backend for analysis');
      
      // Send the image to the Python server
      const response = await axios.post('http://localhost:5000/predict', {
        image: imageDataUrl
      });
      
      console.log('Received prediction:', response.data);
      
      // Return the prediction result
      return response.data;
    } catch (error) {
      console.error('Error communicating with Python backend:', error);
      return {
        error: `Failed to analyze image: ${error.message}`,
        stack: error.stack
      };
    }
  }
});
