
const { contextBridge, ipcRenderer } = require('electron');
const path = require('path');
const fs = require('fs');

// Log the current directory and NODE_PATH to help debug module resolution
console.log('Current directory:', process.cwd());
console.log('NODE_PATH:', process.env.NODE_PATH);
console.log('Attempting to load axios...');

// Check if a module exists at a specific path
function checkModuleExists(modulePath) {
  try {
    return fs.existsSync(modulePath) || 
           fs.existsSync(modulePath + '.js') || 
           fs.existsSync(path.join(modulePath, 'index.js')) ||
           fs.existsSync(modulePath + '.node');
  } catch (e) {
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
    console.log('Using fallback analyzeWithH5Model implementation');
    return {
      error: 'Python backend communication is not available. Could not load axios module.',
      stack: 'Module not found: axios'
    };
  }
};

// Try to load axios with multiple strategies
let axios = null;
const possiblePaths = [
  // Direct require
  { 
    path: 'axios', 
    description: 'direct require' 
  },
  // From electron directory node_modules
  { 
    path: path.join(process.cwd(), 'node_modules', 'axios'), 
    description: 'electron/node_modules' 
  },
  // From parent directory node_modules
  { 
    path: path.join(process.cwd(), '..', 'node_modules', 'axios'), 
    description: 'parent node_modules' 
  }
];

// Try each path in order
for (const pathObj of possiblePaths) {
  console.log(`Attempting to load axios from: ${pathObj.description} (${pathObj.path})`);
  
  if (checkModuleExists(pathObj.path)) {
    console.log(`Found axios module at: ${pathObj.path}`);
    
    try {
      axios = require(pathObj.path);
      console.log(`Successfully loaded axios from ${pathObj.description}`);
      break;
    } catch (err) {
      console.error(`Error requiring axios from ${pathObj.description}:`, err.message);
    }
  } else {
    console.log(`Axios not found at: ${pathObj.path}`);
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
} else {
  console.error('All attempts to load axios failed. The application will use the fallback implementation');
}

// Expose the API to the renderer process
contextBridge.exposeInMainWorld('electron', electronAPI);
