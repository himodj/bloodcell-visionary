
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { initializeModel } from './utils/analysisUtils';
import { toast } from 'sonner';

// Check if we're running in Electron - make sure this works correctly
const isElectron = typeof window !== 'undefined' && window.electron?.isElectron === true;

// Define a global function to load model that can be called from UI
(window as any).loadModel = async () => {
  if (isElectron && window.electron) {
    try {
      const modelPath = await window.electron.selectModel();
      if (modelPath) {
        console.log('Selected model path:', modelPath);
        await initializeModel(modelPath);
        console.log('Model initialized successfully');
        return true;
      } else {
        console.log('No model selected by user');
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
