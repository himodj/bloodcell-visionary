
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { initializeModel } from './utils/analysisUtils';

// Check if we're running in Electron
const isElectron = window.electron !== undefined;

// Define a global function to load model that can be called from UI
(window as any).loadModel = async () => {
  if (isElectron) {
    try {
      const modelPath = await window.electron.selectModel();
      if (modelPath) {
        await initializeModel(modelPath);
        return true;
      }
    } catch (error) {
      console.error('Failed to load model:', error);
    }
  } else {
    console.warn('Model loading is only available in Electron environment');
  }
  return false;
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
