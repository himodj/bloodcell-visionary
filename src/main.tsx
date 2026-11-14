import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import '@fontsource-variable/inter';
import './index.css';
import { loadModel } from './inference/engine';
import { syncSettingsWithDisk } from './report/settings';

// Forward unexpected UI errors to the application log file (File > Open Log File).
window.addEventListener('error', (event) => {
  window.electron?.log('error', `${event.message} (${event.filename}:${event.lineno})`);
});
window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason instanceof Error ? event.reason.stack || event.reason.message : String(event.reason);
  window.electron?.log('error', `Unhandled promise rejection: ${reason}`);
});

// The model is loaded automatically at start-up; the Model panel shows its status.
if (window.electron?.isElectron) {
  void loadModel();
}

// Lab details and the report template are restored from disk before the first screen is drawn.
void syncSettingsWithDisk().finally(() => {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
});
