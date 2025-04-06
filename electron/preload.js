
// Import required Node.js modules
const { contextBridge, ipcRenderer } = require('electron');
const path = require('path');
const fs = require('fs');

// Log the current directory
console.log('Current directory:', process.cwd());

// Function to check if a module exists at a specific path
function checkModuleExists(modulePath) {
  try {
    return fs.existsSync(modulePath) || 
           fs.existsSync(modulePath + '.js') || 
           fs.existsSync(path.join(modulePath, 'index.js')) ||
           fs.existsSync(modulePath + '.node');
  } catch (e) {
    console.error('Error checking if module exists:', e);
    return false;
  }
}

// Initialize API object
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
  
  // Default implementation that will be replaced if axios loads
  analyzeWithH5Model: async (modelPath, imageDataUrl) => {
    console.log('Using fallback analyzeWithH5Model implementation - axios not loaded');
    return {
      error: 'Python backend communication is not available. Could not load axios module.',
      stack: 'Module not found: axios'
    };
  }
};

// Try to load axios
let axios;
try {
  axios = require('axios');
  console.log('Successfully loaded axios directly');
} catch (err) {
  console.error('Error loading axios directly:', err.message);
  
  // Try alternative paths
  const possiblePaths = [
    path.join(process.cwd(), 'node_modules', 'axios'),
    path.join(process.cwd(), '..', 'node_modules', 'axios')
  ];
  
  for (const axiosPath of possiblePaths) {
    try {
      console.log(`Attempting to load axios from: ${axiosPath}`);
      if (checkModuleExists(axiosPath)) {
        axios = require(axiosPath);
        console.log(`Successfully loaded axios from ${axiosPath}`);
        break;
      } else {
        console.log(`Axios not found at ${axiosPath}`);
      }
    } catch (err) {
      console.error(`Error loading axios from ${axiosPath}:`, err.message);
    }
  }
}

// Check if we successfully loaded axios
if (axios) {
  console.log('Axios is available, setting up analyzeWithH5Model with actual implementation');
  
  // Override the default implementation with the actual one
  electronAPI.analyzeWithH5Model = async (modelPath, imageDataUrl) => {
    try {
      console.log('Sending image to Python backend for analysis');
      
      // Send the image to the Python server
      const response = await axios.post('http://localhost:5000/predict', {
        image: imageDataUrl
      });
      
      console.log('Received prediction from Python backend');
      
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
} else {
  console.error('Failed to load axios. The application will use the fallback implementation');
}

// Expose the API to the renderer process
contextBridge.exposeInMainWorld('electron', electronAPI);
