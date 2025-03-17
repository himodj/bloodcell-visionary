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
      // Enable camera access in the WebContents
      webSecurity: true,
    },
    title: "BloodCell Analyzer",
    icon: path.join(__dirname, 'icon.ico')
  });

  // Request permission for camera access
  mainWindow.webContents.session.setPermissionRequestHandler((webContents, permission, callback) => {
    if (permission === 'media') {
      // Allow camera access
      return callback(true);
    }
    
    // Deny other permissions
    callback(false);
  });

  // Determine the appropriate URL to load
  const startUrl = isDev
    ? 'http://localhost:8080' // Vite dev server
    : url.format({
        pathname: path.join(__dirname, '../dist/index.html'),
        protocol: 'file:',
        slashes: true,
      });

  console.log('Loading URL:', startUrl);
  console.log('Environment:', process.env.NODE_ENV);
  console.log('App path:', app.getAppPath());
  
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

// Helper function to determine model path in different environments
function getModelPath() {
  console.log('Looking for model.h5 file in various locations...');
  
  // In development, look in the project root (one level up from the electron directory)
  if (isDev) {
    const devModelPath = path.join(__dirname, '..', 'model.h5');
    console.log('Checking development model path:', devModelPath);
    if (fs.existsSync(devModelPath)) {
      console.log('✅ Found model at', devModelPath);
      return devModelPath;
    }
  }
  
  // In production, look relative to the app's resources directory
  const prodModelPath = path.join(process.resourcesPath, 'model.h5');
  console.log('Checking production model path:', prodModelPath);
  if (fs.existsSync(prodModelPath)) {
    console.log('✅ Found model at', prodModelPath);
    return prodModelPath;
  }

  // Fallback to app directory
  const appModelPath = path.join(app.getAppPath(), 'model.h5');
  console.log('Checking app model path:', appModelPath);
  if (fs.existsSync(appModelPath)) {
    console.log('✅ Found model at', appModelPath);
    return appModelPath;
  }
  
  // One more fallback for packaged apps - look one level up
  const packagedAppPath = path.join(app.getAppPath(), '..', 'model.h5');
  console.log('Checking packaged app path:', packagedAppPath);
  if (fs.existsSync(packagedAppPath)) {
    console.log('✅ Found model at', packagedAppPath);
    return packagedAppPath;
  }
  
  console.log('❌ Model not found in any location');
  return null;
}

// Handle model loading
ipcMain.handle('select-model', async () => {
  try {
    const modelPath = getModelPath();
  
    if (modelPath) {
      console.log('Model found at:', modelPath);
      return modelPath;
    } else {
      console.log('Model not found automatically, letting user know to add model.h5');
      
      // Show dialog to inform user
      if (mainWindow) {
        dialog.showMessageBox(mainWindow, {
          type: 'warning',
          title: 'Model Not Found',
          message: 'model.h5 file is required but not found. Please place the model.h5 file in the application directory and restart the application.',
          buttons: ['OK']
        });
      }
      
      return null;
    }
  } catch (error) {
    console.error('Error selecting model:', error);
    if (mainWindow) {
      dialog.showMessageBox(mainWindow, {
        type: 'error',
        title: 'Error Loading Model',
        message: `Failed to load model: ${error.message}`,
        buttons: ['OK']
      });
    }
    return null;
  }
});

// Get default model path without user selection
ipcMain.handle('get-default-model-path', async () => {
  try {
    const modelPath = getModelPath();
    
    if (modelPath) {
      console.log('Model found at:', modelPath);
      return modelPath;
    } else {
      console.log('Model file not found in any of the expected locations');
      return null;
    }
  } catch (error) {
    console.error('Error getting default model path:', error);
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
      try {
        const content = fs.readFileSync(modelPath, 'utf8');
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
