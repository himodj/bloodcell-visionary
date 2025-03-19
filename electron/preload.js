
const { contextBridge, ipcRenderer } = require('electron');
const path = require('path');

// Log the current directory and NODE_PATH to help debug module resolution
console.log('Current directory:', process.cwd());
console.log('NODE_PATH:', process.env.NODE_PATH);
console.log('Attempting to load axios...');

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
  analyzeWithH5Model: async () => {
    console.log('Using fallback analyzeWithH5Model implementation because axios is unavailable');
    return {
      error: 'Python backend communication is not available. Missing axios dependency.',
      stack: 'Module not found: axios'
    };
  }
};

// Try to load axios in multiple ways to handle different Electron environments
try {
  // First, try to require axios directly
  let axios;
  try {
    axios = require('axios');
    console.log('Axios loaded successfully via direct require');
  } catch (directError) {
    console.error('Failed to load axios directly:', directError.message);
    
    // Try to load from node_modules in the electron directory
    try {
      const electronDirPath = process.cwd();
      const axiosPath = path.join(electronDirPath, 'node_modules', 'axios');
      console.log('Trying to load axios from:', axiosPath);
      axios = require(axiosPath);
      console.log('Axios loaded successfully from electron/node_modules');
    } catch (localError) {
      console.error('Failed to load axios from local node_modules:', localError.message);
      
      // Try to load from parent directory's node_modules
      try {
        const parentDirPath = path.join(process.cwd(), '..');
        const axiosPath = path.join(parentDirPath, 'node_modules', 'axios');
        console.log('Trying to load axios from parent:', axiosPath);
        axios = require(axiosPath);
        console.log('Axios loaded successfully from parent node_modules');
      } catch (parentError) {
        console.error('Failed to load axios from parent node_modules:', parentError.message);
        throw new Error('Could not load axios from any location');
      }
    }
  }
  
  // If we got here, we have a valid axios instance
  console.log('Axios is available, setting up analyzeWithH5Model with actual implementation');
  
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
  console.error('All attempts to load axios failed:', error.message);
  console.error('The application will use the fallback implementation');
}

// Expose the API to the renderer process
contextBridge.exposeInMainWorld('electron', electronAPI);
