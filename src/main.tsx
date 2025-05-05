
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
let usingFallbackMode = false;

// Define a global function to check if model is loaded
(window as any).isModelLoaded = () => {
  return globalModelLoaded;
};

// Define flag for fallback mode
(window as any).isUsingFallbackMode = () => {
  return usingFallbackMode;
};

// Define a global function to load model that can be called from UI
(window as any).loadModel = async (modelPath?: string) => {
  try {
    if (!window.electron) {
      console.warn('Electron API not available. Running in browser mode.');
      toast.error('Model loading requires the desktop application');
      
      // In browser mode, we'll set up a mock model state for UI testing
      if (process.env.NODE_ENV === 'development') {
        console.log('Development environment detected - enabling mock model mode');
        globalModelLoaded = true;
        usingFallbackMode = true;
        toast.success('Development mode: Mock model enabled');
        return true;
      }
      
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
        await initializeModel(selectedModelPath, true); // Using the forceH5 flag
        console.log('H5 Model registered successfully for analysis');
        
        // Try to load the model on the Python server
        const pythonServerLoaded = await window.electron.reloadPythonModel(selectedModelPath);
        console.log('Python server model loading response:', pythonServerLoaded);
        
        if (!pythonServerLoaded.success) {
          console.warn('Python server could not load the model, but frontend initialization succeeded');
          toast.warning('Model partially loaded. Python server could not load the model, but frontend analysis will work in fallback mode.');
          
          // Set fallback mode but still consider model loaded for UI
          usingFallbackMode = true;
          globalModelLoaded = true;
          
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
          
          return true;
        }
        
        toast.success('Model loaded successfully and ready for analysis');
        globalModelLoaded = true;
        usingFallbackMode = false;
        return true;
      } catch (error) {
        console.error('Error registering H5 model:', error);
        toast.error('Error loading H5 model: ' + (error instanceof Error ? error.message : String(error)));
        
        // Set fallback mode to allow UI to function
        console.log('Enabling fallback mode after error');
        usingFallbackMode = true;
        globalModelLoaded = true;
        toast.warning('Using fallback mode for analysis - results will be simulated');
        
        return true; // Return true to allow UI to function in fallback mode
      }
    }
    
    // Regular TensorFlow.js models (non-H5)
    try {
      await initializeModel(selectedModelPath);
      console.log('Model initialized successfully');
      globalModelLoaded = true;
      usingFallbackMode = false;
      return true;
    } catch (error) {
      console.error('Failed to load model:', error);
      toast.error('Failed to load model: ' + (error instanceof Error ? error.message : String(error)));
      
      // Enable fallback mode
      console.log('Enabling fallback mode after frontend model initialization error');
      usingFallbackMode = true;
      globalModelLoaded = true;
      toast.warning('Using fallback mode for analysis - results will be simulated');
      
      return true; // Return true to allow UI to function in fallback mode
    }
  } catch (error) {
    console.error('Failed to load model:', error);
    toast.error('Failed to load model: ' + (error instanceof Error ? error.message : String(error)));
    
    // Enable fallback mode as last resort
    console.log('Enabling fallback mode after critical error');
    usingFallbackMode = true;
    globalModelLoaded = true;
    toast.warning('Using fallback mode for analysis - results will be simulated');
    
    return true; // Return true to allow UI to function in fallback mode
  }
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AnalysisProvider>
      <App />
    </AnalysisProvider>
  </React.StrictMode>,
);
