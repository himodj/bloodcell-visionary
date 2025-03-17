
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
        
        const formatCheck = await window.electron.checkModelFormat(selectedModelPath);
        if (formatCheck.error) {
          toast.error(`Model format check failed: ${formatCheck.error}`);
          return false;
        }
        
        if (formatCheck.format === 'h5') {
          // For H5 files, we'll use the mock analysis functionality
          toast.info('H5 format detected. Using mock analysis functionality.');
          
          try {
            // We still initialize the model to set the path, but we'll use mock functionality
            await initializeModel(selectedModelPath);
            toast.success('Model path registered successfully');
            console.log('Model path registered successfully');
            return true;
          } catch (error) {
            console.warn('Using mock analysis with H5 model:', error);
            // Even if there's an error loading the actual model, we return true
            // since we'll use the mock analysis functionality
            return true;
          }
        }
        
        await initializeModel(selectedModelPath);
        console.log('Model initialized successfully');
        return true;
      } else {
        console.log('No model selected or found');
        return false;
      }
    } catch (error) {
      console.error('Failed to load model:', error);
      toast.error('Failed to load model: ' + (error instanceof Error ? error.message : String(error)));
      throw error;
    }
  } else {
    console.warn('Model loading is only available in Electron environment');
    return false;
  }
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
