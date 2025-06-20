import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { initializeModel } from './utils/analysisUtils';
import { toast } from 'sonner';
import { AnalysisProvider } from './contexts/AnalysisContext';

// Check if we're running in Electron
const isElectron = typeof window !== 'undefined' && window.electron?.isElectron === true;

// Log the Electron status for debugging
console.log('Electron environment detected:', isElectron);
if (!isElectron) {
  console.warn('Electron API not available. Running in browser mode - model loading functionality will be limited.');
}

// Keep track of loaded model state globally
let globalModelLoaded = false;

// Define a global function to check if model is loaded
(window as any).isModelLoaded = () => {
  return globalModelLoaded;
};

// Define a global function to check Python server status
(window as any).isPythonServerRunning = async () => {
  if (!window.electron) return false;
  try {
    return await window.electron.isPythonServerRunning();
  } catch (err) {
    console.error('Error checking Python server:', err);
    return false;
  }
};

// Define a global function to load model that can be called from UI
(window as any).loadModel = async (modelPath?: string) => {
  try {
    if (!window.electron) {
      console.warn('Electron API not available. Running in browser mode.');
      toast.error('Model loading requires the desktop application');
      globalModelLoaded = false;
      return false;
    }
    
    // Check if Python server is running
    let pythonServerRunning = false;
    try {
      pythonServerRunning = await window.electron.isPythonServerRunning();
      console.log('Python server running:', pythonServerRunning);
    } catch (err) {
      console.error('Error checking Python server status:', err);
    }
    
    // If Python server is not running, alert the user
    if (!pythonServerRunning) {
      console.log('Python server not running');
      toast.error('Python server is not running. Please restart the application.');
      globalModelLoaded = false;
      return false;
    }
    
    let selectedModelPath = modelPath;
    
    // If no model path was provided, get the default model path
    if (!selectedModelPath) {
      console.log('Requesting default model path from Electron...');
      selectedModelPath = await window.electron.getDefaultModelPath();
      console.log('Received default model path:', selectedModelPath);
    }
    
    if (!selectedModelPath) {
      console.error('No model.h5 found in application directory');
      toast.error('No model.h5 found. Please place model.h5 in the application directory.');
      globalModelLoaded = false;
      return false;
    }
    
    console.log('Loading model from path:', selectedModelPath);
    
    // For H5 models, we need special handling
    if (selectedModelPath.toLowerCase().endsWith('.h5')) {
      console.log('Loading H5 model:', selectedModelPath);
      
      try {
        // Validate the model file
        const modelCheck = await window.electron.checkModelFormat(selectedModelPath);
        
        if (modelCheck.error) {
          console.error('Model format check failed:', modelCheck.error);
          toast.error(`Model validation failed: ${modelCheck.error}`);
          globalModelLoaded = false;
          return false;
        }
        
        // Register the H5 model for specialized analysis
        await initializeModel(selectedModelPath);
        console.log('H5 Model registered successfully for frontend analysis');
        
        // Try to load the model on the Python server (only if not already loaded)
        console.log('Loading model on Python server...');
        try {
          const pythonServerLoaded = await window.electron.reloadPythonModel(selectedModelPath);
          console.log('Python server model loading response:', pythonServerLoaded);
          
          if (!pythonServerLoaded.success) {
            console.warn('Python server could not load the model');
            
            // Only show error if it's not already loaded
            if (!pythonServerLoaded.message?.includes('already loaded')) {
              toast.error('Failed to load model on Python server. Please check your Python environment.');
              
              // Try to get environment info to help diagnose
              try {
                const envInfo = await window.electron.getPythonEnvironmentInfo();
                console.log('Python environment info:', envInfo);
                
                // Check specifically for common issues
                if (envInfo.modules) {
                  if (!envInfo.modules.keras.installed) {
                    toast.error('Keras module not detected. Please install it using: pip install keras==2.10.0');
                  }
                  if (!envInfo.modules.tensorflow.installed) {
                    toast.error('TensorFlow module not detected. Please install it using: pip install tensorflow==2.10.0');
                  }
                }
              } catch (envError) {
                console.error('Failed to get environment info:', envError);
              }
              
              globalModelLoaded = false;
              return false;
            } else {
              // Model already loaded, that's fine
              console.log('Model already loaded on Python server');
              toast.success('Model ready for analysis');
              globalModelLoaded = true;
              return true;
            }
          }
          
          toast.success('Model loaded successfully and ready for analysis');
          globalModelLoaded = true;
          return true;
        } catch (error) {
          console.error('Error communicating with Python server:', error);
          toast.error('Failed to communicate with Python server. Please restart the application.');
          globalModelLoaded = false;
          return false;
        }
      } catch (error) {
        console.error('Error registering H5 model:', error);
        toast.error('Error loading H5 model: ' + (error instanceof Error ? error.message : String(error)));
        globalModelLoaded = false;
        return false;
      }
    } else {
      // Handle non-H5 models (if needed in the future)
      toast.error('Only H5 model files are supported');
      globalModelLoaded = false;
      return false;
    }
  } catch (error) {
    console.error('Failed to load model:', error);
    toast.error('Failed to load model: ' + (error instanceof Error ? error.message : String(error)));
    globalModelLoaded = false;
    return false;
  }
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AnalysisProvider>
      <App />
    </AnalysisProvider>
  </React.StrictMode>,
);
