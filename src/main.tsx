import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { initializeModel } from './utils/analysisUtils';
import { toast } from 'sonner';

// Check if we're running in Electron
const isElectron = typeof window !== 'undefined' && window.electron?.isElectron === true;

// Keep track of loaded model state globally
let globalModelLoaded = false;

// Define a global function to check if model is loaded
(window as any).isModelLoaded = () => {
  return globalModelLoaded;
};

// Define a global function to load model that can be called from UI
(window as any).loadModel = async (modelPath?: string) => {
  if (isElectron && window.electron) {
    try {
      let selectedModelPath = modelPath;
      
      // If no model path was provided, get the default model path
      if (!selectedModelPath) {
        selectedModelPath = await window.electron.getDefaultModelPath();
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
          toast.success('Model loaded successfully and ready for analysis');
          globalModelLoaded = true;
          return true;
        } catch (error) {
          console.error('Error registering H5 model:', error);
          toast.error('Error loading H5 model: ' + (error instanceof Error ? error.message : String(error)));
          globalModelLoaded = false;
          return false;
        }
      }
      
      // Regular TensorFlow.js models (non-H5)
      try {
        await initializeModel(selectedModelPath);
        console.log('Model initialized successfully');
        globalModelLoaded = true;
        return true;
      } catch (error) {
        console.error('Failed to load model:', error);
        toast.error('Failed to load model: ' + (error instanceof Error ? error.message : String(error)));
        globalModelLoaded = false;
        return false;
      }
    } catch (error) {
      console.error('Failed to load model:', error);
      toast.error('Failed to load model: ' + (error instanceof Error ? error.message : String(error)));
      globalModelLoaded = false;
      return false;
    }
  } else {
    console.warn('Model loading is only available in Electron environment');
    toast.error('Model loading is only available in desktop application');
    globalModelLoaded = false;
    return false;
  }
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
