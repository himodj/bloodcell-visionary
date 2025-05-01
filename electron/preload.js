// Import required Node.js modules
try {
  const { contextBridge, ipcRenderer } = require('electron');
  
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
    
    // New: Browse for model file with dialog
    browseForModel: () => ipcRenderer.invoke('browse-for-model'),
    
    // New: Check if a file exists
    checkFileExists: (filePath) => ipcRenderer.invoke('check-file-exists', filePath),
    
    // Default implementation that will be replaced if axios loads
    analyzeWithH5Model: async (modelPath, imageDataUrl) => {
      console.log('Using fallback analyzeWithH5Model implementation - axios not loaded');
      return {
        error: 'Python backend communication is not available. Could not load axios module.',
        stack: 'Module not found: axios'
      };
    }
  };

  // Try to load axios directly with require
  let axios;
  try {
    // Look for axios in the electron directory node_modules first
    axios = require('axios');
    console.log('Successfully loaded axios with normal require');
  } catch (err) {
    console.error('Error loading axios:', err.message);
    try {
      axios = require('./node_modules/axios');
      console.log('Successfully loaded axios from ./node_modules/axios');
    } catch (err2) {
      console.error('Error loading axios from ./node_modules/axios:', err2.message);
    }
  }

  // Check if we successfully loaded axios
  if (axios) {
    console.log('Axios is available, setting up analyzeWithH5Model with actual implementation');
    
    // Override the default implementation with the actual one
    electronAPI.analyzeWithH5Model = async (modelPath, imageDataUrl) => {
      try {
        console.log('Sending image to Python backend for analysis with model path:', modelPath);
        
        // Configure axios without the Access-Control-Allow-Origin header
        const axiosConfig = {
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          // Increase timeout to allow for model loading/processing
          timeout: 60000 
        };
        
        // Send the image to the Python server
        const response = await axios.post('http://localhost:5000/predict', {
          image: imageDataUrl
        }, axiosConfig);
        
        console.log('Received prediction from Python backend:', response.status);
        
        // Return the prediction result
        return response.data;
      } catch (error) {
        console.error('Error communicating with Python backend:', error);
        
        let errorMessage = 'Failed to analyze image';
        let errorDetails = error.message;
        
        // Check for specific error types to provide better error messages
        if (error.code === 'ECONNREFUSED') {
          errorMessage = 'Python server is not running or not accessible';
          errorDetails = 'Make sure the Python server is running on port 5000';
        } else if (error.code === 'ERR_NETWORK') {
          errorMessage = 'Network error communicating with Python server';
          errorDetails = 'Check that the server is running and port 5000 is not blocked';
        } else if (error.response) {
          // The server responded with a status code outside the 2xx range
          errorMessage = `Server error (${error.response.status})`;
          errorDetails = error.response.data.error || error.response.statusText;
        }
        
        return {
          error: `${errorMessage}: ${errorDetails}`,
          stack: error.stack
        };
      }
    };
  } else {
    console.error('Failed to load axios. The application will use the fallback implementation');
  }

  // Expose the API to the renderer process
  contextBridge.exposeInMainWorld('electron', electronAPI);
  console.log('Electron API exposed successfully via contextBridge');
  
} catch (error) {
  console.error('Failed to initialize preload script:', error);
  // If we can't access electron APIs, we're probably running in a browser
  try {
    // Use window object directly if contextBridge isn't available
    window.electron = {
      isElectron: false,
      selectModel: () => Promise.resolve(null),
      getDefaultModelPath: () => Promise.resolve(null),
      readModelFile: () => Promise.resolve({ success: false, error: 'Not in Electron environment' }),
      getModelDir: () => Promise.resolve(''),
      checkModelFormat: () => Promise.resolve({ error: 'Not in Electron environment' }),
      readModelDir: () => Promise.resolve([]),
      browseForModel: () => Promise.resolve(null),
      checkFileExists: () => Promise.resolve(false),
      analyzeWithH5Model: () => Promise.resolve({ error: 'Not in Electron environment' })
    };
    console.log('Created browser fallback for electron API');
  } catch (fallbackError) {
    console.error('Could not create browser fallback:', fallbackError);
  }
}
