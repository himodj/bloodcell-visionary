
const { contextBridge, ipcRenderer } = require('electron');

// Initialize API object with a default error handler for the analyzeWithH5Model function
let electronAPI = {
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
  
  // Fallback implementation if axios is missing
  analyzeWithH5Model: async () => ({
    error: 'Python backend communication is not available. Missing axios dependency.',
    stack: 'Module not found: axios'
  })
};

// Try to load axios and set up the proper analyzeWithH5Model function
try {
  const axios = require('axios');
  console.log('Axios loaded successfully');
  
  // Override the default implementation with the actual one
  electronAPI.analyzeWithH5Model = async (modelPath, imageDataUrl) => {
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
  };
} catch (error) {
  console.error('Failed to load axios:', error.message);
  // We'll use the fallback implementation defined above
}

// Expose the API to the renderer process
contextBridge.exposeInMainWorld('electron', electronAPI);
