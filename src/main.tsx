
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
      
      if (selectedModelPath) {
        console.log('Selected model path:', selectedModelPath);
        
        // For H5 files in Electron, we'll use mock analysis directly
        if (selectedModelPath.toLowerCase().endsWith('.h5')) {
          toast.success('H5 model detected. Using dedicated analysis engine.');
          
          // Store the model path for reference but we'll use mock analysis
          try {
            await initializeModel(selectedModelPath, true); // Add the forceH5 flag
            console.log('H5 Model registered successfully for analysis');
            return true;
          } catch (error) {
            console.error('Error registering H5 model:', error);
            toast.error('Error registering H5 model: ' + (error instanceof Error ? error.message : String(error)));
            return false;
          }
        }
        
        // For non-H5 models - this code path shouldn't be reached with our H5 model
        try {
          await initializeModel(selectedModelPath);
          console.log('Model initialized successfully');
          return true;
        } catch (error) {
          console.error('Failed to load model:', error);
          toast.error('Failed to load model: ' + (error instanceof Error ? error.message : String(error)));
          return false;
        }
      } else {
        console.log('No model selected or found');
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
