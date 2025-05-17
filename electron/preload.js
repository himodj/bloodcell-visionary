
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
    
    // Default implementations that will throw errors if not overridden
    analyzeWithH5Model: async () => {
      throw new Error('Python backend communication is not available.');
    },
    
    // Force reload the model on the Python server
    reloadPythonModel: async () => {
      throw new Error('Python backend communication is not available.');
    },
    
    // Get environment information from the Python server
    getPythonEnvironmentInfo: async () => {
      throw new Error('Python backend communication is not available.');
    },

    // Check if Python server is running
    isPythonServerRunning: async () => {
      throw new Error('Python backend communication is not available.');
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
    console.log('Axios is available, setting up API methods with actual implementation');
    
    // Configure axios with a reduced timeout that won't freeze the UI for too long
    const axiosConfig = {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      // Reduce timeout to avoid UI freezing for too long
      timeout: 10000 // 10 seconds
    };

    // Add isPythonServerRunning implementation
    electronAPI.isPythonServerRunning = async () => {
      try {
        console.log('Checking if Python server is running...');
        const response = await axios.get('http://localhost:5000/health', {
          ...axiosConfig,
          timeout: 2000 // Even shorter timeout for quick health check
        });
        return response.data && response.data.status === 'ok';
      } catch (error) {
        console.error('Python server health check failed:', error.message);
        return false;
      }
    };
    
    // Add getPythonEnvironmentInfo implementation
    electronAPI.getPythonEnvironmentInfo = async () => {
      try {
        console.log('Getting Python environment info...');
        const serverRunning = await electronAPI.isPythonServerRunning();
        
        if (!serverRunning) {
          return {
            error: 'Python server is not running',
            modules: {
              tensorflow: { installed: false },
              keras: { installed: false },
              h5py: { installed: false },
              numpy: { installed: false }
            }
          };
        }
        
        const response = await axios.get('http://localhost:5000/environment', axiosConfig);
        console.log('Environment info response:', response.status);
        return response.data;
      } catch (error) {
        console.error('Error getting Python environment info:', error);
        
        let details = '';
        if (error.code === 'ECONNREFUSED') {
          details = 'The Python backend server is not running or is not accessible.';
        } else if (error.code === 'ECONNABORTED') {
          details = 'Connection to Python server timed out. The server may be overloaded or not responding.';
        } else if (error.response) {
          details = `Server responded with status code ${error.response.status}. ${error.response.data?.error || ''}`;
        } else {
          details = 'This may be a network issue or a problem with the Python server.';
        }
        
        return {
          error: `Failed to get environment info: ${error.message}`,
          stack: error.stack,
          details
        };
      }
    };
    
    // Add reloadPythonModel implementation
    electronAPI.reloadPythonModel = async (modelPath) => {
      try {
        console.log('Attempting to reload Python model at path:', modelPath);
        
        // First check if Python server is running
        const serverRunning = await electronAPI.isPythonServerRunning();
        
        if (!serverRunning) {
          console.warn('Python server is not running or not accessible');
          return {
            error: 'Python server is not running',
            details: 'The Python Flask server is not accessible. Please check if the server is running.'
          };
        }
        
        // Now try to load the model
        const response = await axios.post('http://localhost:5000/load_model', {
          model_path: modelPath
        }, axiosConfig);
        
        console.log('Model reload response:', response.data);
        
        // Enhance error reporting
        if (response.data && !response.data.success) {
          return {
            ...response.data,
            error: response.data.error || 'Unknown error loading model',
            details: 'The Python server reported a failure loading the model. This may be due to compatibility issues or a corrupt model file.'
          };
        }
        
        return response.data;
      } catch (error) {
        console.error('Error reloading Python model:', error);
        
        let details = '';
        if (error.code === 'ECONNREFUSED') {
          details = 'The Python backend server is not running or is not accessible.';
        } else if (error.code === 'ECONNABORTED') {
          details = 'Connection to Python server timed out. The server may be overloaded or not responding.';
        } else if (error.response) {
          details = `Server responded with status code ${error.response.status}. ${error.response.data?.error || ''}`;
        } else {
          details = 'This may be a network issue or a problem with the Python server.';
        }
        
        return {
          error: `Failed to reload model: ${error.message}`,
          stack: error.stack,
          details
        };
      }
    };
    
    // Add the actual implementation
    electronAPI.analyzeWithH5Model = async (modelPath, imageDataUrl) => {
      try {
        console.log('Sending image to Python backend for analysis with model path:', modelPath);
        
        // First check if Python server is running
        const serverRunning = await electronAPI.isPythonServerRunning();
        
        if (!serverRunning) {
          console.warn('Python server is not running or not accessible');
          return {
            error: 'Python server is not running',
            details: 'The Python Flask server is not accessible. Please restart the application.'
          };
        }
        
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
        let details = '';
        
        // Check for specific error types to provide better error messages
        if (error.code === 'ECONNREFUSED') {
          errorMessage = 'Python server is not running or not accessible';
          errorDetails = 'Make sure the Python server is running on port 5000';
          details = 'The application couldn\'t connect to the Python backend server. This could be because the server failed to start or there\'s a network issue.';
        } else if (error.code === 'ECONNABORTED') {
          errorMessage = 'Connection to Python server timed out';
          errorDetails = 'The server may be overloaded or not responding';
          details = 'The Python server took too long to respond. This could be due to the model size or server load.';
        } else if (error.code === 'ERR_NETWORK') {
          errorMessage = 'Network error communicating with Python server';
          errorDetails = 'Check that the server is running and port 5000 is not blocked';
          details = 'A network error occurred when trying to communicate with the Python server. This could be due to firewall settings or the server being offline.';
        } else if (error.response) {
          // The server responded with a status code outside the 2xx range
          errorMessage = `Server error (${error.response.status})`;
          errorDetails = error.response.data.error || error.response.statusText;
          
          if (error.response.status === 500 && error.response.data.error === 'Model not loaded') {
            details = 'The model needs to be loaded before making predictions. Try reloading the model from the UI.';
          } else {
            details = 'The Python server encountered an error while processing the request. Check the server logs for more information.';
          }
        } else {
          details = 'An unexpected error occurred during communication with the Python backend.';
        }
        
        return {
          error: `${errorMessage}: ${errorDetails}`,
          stack: error.stack,
          details
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
      analyzeWithH5Model: () => Promise.resolve({ error: 'Not in Electron environment' }),
      reloadPythonModel: () => Promise.resolve({ error: 'Not in Electron environment' }),
      getPythonEnvironmentInfo: () => Promise.resolve({ error: 'Not in Electron environment' }),
      isPythonServerRunning: () => Promise.resolve(false)
    };
    console.log('Created browser fallback for electron API');
  } catch (fallbackError) {
    console.error('Could not create browser fallback:', fallbackError);
  }
}
