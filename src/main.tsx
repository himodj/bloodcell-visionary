
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { initializeModel } from './utils/analysisUtils';
import { toast } from 'sonner';

// Check if we're running in Electron - make sure this works correctly
const isElectron = typeof window !== 'undefined' && window.electron?.isElectron === true;

// Define a global function to load model that can be called from UI
(window as any).loadModel = async (modelPath?: string) => {
  if (isElectron && window.electron) {
    try {
      let selectedModelPath = modelPath;
      
      // If no model path was provided, prompt user to select one
      if (!selectedModelPath) {
        selectedModelPath = await window.electron.selectModel();
      }
      
      if (!selectedModelPath) {
        console.error('No model path selected or found');
        toast.error('No model selected or found. Please ensure model.h5 is in the project directory.');
        return false;
      }
      
      console.log('Selected model path:', selectedModelPath);
      
      // For H5 models, we need special handling
      if (selectedModelPath.toLowerCase().endsWith('.h5')) {
        toast.success('H5 model detected. Loading specialized analysis engine.');
        console.log('Loading H5 model:', selectedModelPath);
        
        try {
          // Validate the model file
          const modelCheck = await window.electron.checkModelFormat(selectedModelPath);
          
          if (modelCheck.error) {
            console.error('Model format check failed:', modelCheck.error);
            toast.error(`Model validation failed: ${modelCheck.error}`);
            return false;
          }
          
          // Register the H5 model for specialized analysis
          await initializeModel(selectedModelPath, true); // Using the forceH5 flag
          console.log('H5 Model registered successfully for analysis');
          toast.success('Model loaded successfully and ready for analysis');
          return true;
        } catch (error) {
          console.error('Error registering H5 model:', error);
          toast.error('Error loading H5 model: ' + (error instanceof Error ? error.message : String(error)));
          return false;
        }
      }
      
      // Regular TensorFlow.js models (non-H5)
      try {
        await initializeModel(selectedModelPath);
        console.log('Model initialized successfully');
        return true;
      } catch (error) {
        console.error('Failed to load model:', error);
        toast.error('Failed to load model: ' + (error instanceof Error ? error.message : String(error)));
        return false;
      }
    } catch (error) {
      console.error('Failed to load model:', error);
      toast.error('Failed to load model: ' + (error instanceof Error ? error.message : String(error)));
      return false;
    }
  } else {
    console.warn('Model loading is only available in Electron environment');
    toast.error('Model loading is only available in desktop application');
    return false;
  }
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
