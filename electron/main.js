
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const url = require('url');
const isDev = process.env.NODE_ENV === 'development';

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  // Determine the appropriate URL to load
  const startUrl = isDev
    ? 'http://localhost:8080' // Vite dev server (updated port to 8080)
    : url.format({
        pathname: path.join(__dirname, '../dist/index.html'),
        protocol: 'file:',
        slashes: true,
      });

  console.log('Loading URL:', startUrl);
  console.log('Environment:', process.env.NODE_ENV);
  
  mainWindow.loadURL(startUrl);

  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.on('ready', createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// Handle model loading
ipcMain.handle('select-model', async () => {
  // Instead of showing a dialog, use the fixed model path
  const modelPath = path.join(app.getAppPath(), 'model.h5');
  
  // Check if the model file exists
  if (fs.existsSync(modelPath)) {
    return modelPath;
  } else {
    // Log the path being checked for debugging
    console.error(`Model file not found at: ${modelPath}`);
    console.log(`Current app path: ${app.getAppPath()}`);
    return null;
  }
});

// Get default model path without user selection
ipcMain.handle('get-default-model-path', async () => {
  const modelPath = path.join(app.getAppPath(), 'model.h5');
  
  // Check if the model file exists
  if (fs.existsSync(modelPath)) {
    return modelPath;
  } else {
    console.error(`Model file not found at: ${modelPath}`);
    return null;
  }
});

// Handle opening the model directory
ipcMain.handle('get-model-dir', async (event, modelJsonPath) => {
  const modelDir = path.dirname(modelJsonPath);
  return modelDir;
});

// New handler for TensorFlow.js model format checking
ipcMain.handle('check-model-format', async (event, modelPath) => {
  try {
    // Check if it's a .h5 file
    if (modelPath.endsWith('.h5')) {
      return { format: 'h5', path: modelPath };
    }
    
    // Check if it's a model.json file
    if (modelPath.endsWith('.json')) {
      const content = fs.readFileSync(modelPath, 'utf8');
      try {
        const json = JSON.parse(content);
        if (json.format === 'layers-model' || json.modelTopology) {
          // It's a valid TensorFlow.js model JSON
          return { format: 'tfjs', path: modelPath };
        }
      } catch (e) {
        // Invalid JSON or not a TensorFlow.js model
        return { error: 'Not a valid TensorFlow.js model JSON file' };
      }
    }
    
    return { error: 'Unsupported model format' };
  } catch (error) {
    return { error: error.message };
  }
});

// Handler to load model file contents
ipcMain.handle('read-model-file', async (event, filePath) => {
  try {
    const content = fs.readFileSync(filePath);
    return { success: true, data: content.toString('base64') };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Handler to read files in directory
ipcMain.handle('read-model-dir', async (event, dirPath) => {
  try {
    const files = fs.readdirSync(dirPath);
    return files.map(file => path.join(dirPath, file));
  } catch (error) {
    return { error: error.message };
  }
});
