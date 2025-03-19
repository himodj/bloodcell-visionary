const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const url = require('url');
const { spawn } = require('child_process');
const isDev = process.env.NODE_ENV === 'development';

let mainWindow;
let pythonProcess = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: true,
    },
    title: "BloodCell Analyzer",
    icon: path.join(__dirname, 'icon.ico')
  });

  mainWindow.webContents.session.setPermissionRequestHandler((webContents, permission, callback) => {
    if (permission === 'media') {
      return callback(true);
    }
    
    callback(false);
  });

  const startUrl = isDev
    ? 'http://localhost:8080'
    : url.format({
        pathname: path.join(__dirname, '../dist/index.html'),
        protocol: 'file:',
        slashes: true,
      });

  console.log('Loading URL:', startUrl);
  console.log('Environment:', process.env.NODE_ENV);
  console.log('App path:', app.getAppPath());
  
  if (isDev) {
    try {
      console.log('Installing DevTools in development mode');
      const { default: installExtension, REACT_DEVELOPER_TOOLS } = require('electron-devtools-installer');
      installExtension(REACT_DEVELOPER_TOOLS)
        .then((name) => console.log(`Added Extension: ${name}`))
        .catch((err) => console.log('An error occurred: ', err));
    } catch (e) {
      console.error('Failed to install developer tools:', e);
    }
  }
  
  mainWindow.loadURL(startUrl);

  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function startPythonServer() {
  const pythonCommand = process.platform === 'win32' ? 'python' : 'python3';
  
  const env = Object.assign({}, process.env);
  env.MODEL_PATH = getModelPath();
  
  const scriptPath = path.join(app.getAppPath(), 'python', 'model_server.py');
  console.log('Python script path:', scriptPath);
  
  if (!fs.existsSync(scriptPath)) {
    console.error(`Python script not found at ${scriptPath}`);
    
    if (mainWindow) {
      dialog.showMessageBox(mainWindow, {
        type: 'error',
        title: 'Server Error',
        message: `Python script not found at ${scriptPath}. The application may not work correctly.`,
        buttons: ['OK']
      });
    }
    return;
  }
  
  console.log('Starting Python model server...');
  try {
    pythonProcess = spawn(pythonCommand, [scriptPath], {
      env: env,
      stdio: 'pipe'
    });
    
    pythonProcess.stdout.on('data', (data) => {
      console.log(`Python server: ${data}`);
    });
    
    pythonProcess.stderr.on('data', (data) => {
      console.error(`Python server error: ${data}`);
    });
    
    pythonProcess.on('close', (code) => {
      console.log(`Python server exited with code ${code}`);
      pythonProcess = null;
      
      if (code !== 0 && mainWindow) {
        dialog.showMessageBox(mainWindow, {
          type: 'warning',
          title: 'Server Error',
          message: `Python server exited unexpectedly with code ${code}. Image analysis may not work correctly.`,
          buttons: ['OK']
        });
      }
    });
    
    if (pythonProcess.pid) {
      console.log(`Python server started with PID ${pythonProcess.pid}`);
    } else {
      console.error('Failed to start Python server - no PID assigned');
    }
  } catch (error) {
    console.error('Error starting Python server:', error);
    
    if (mainWindow) {
      dialog.showMessageBox(mainWindow, {
        type: 'error',
        title: 'Server Error',
        message: `Failed to start Python server: ${error.message}`,
        buttons: ['OK']
      });
    }
  }
}

app.on('ready', () => {
  createWindow();
  startPythonServer();
});

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

app.on('will-quit', () => {
  if (pythonProcess) {
    console.log('Shutting down Python server...');
    if (process.platform === 'win32') {
      spawn('taskkill', ['/pid', pythonProcess.pid, '/f', '/t']);
    } else {
      pythonProcess.kill();
    }
  }
});

function getModelPath() {
  console.log('Looking for model.h5 file in various locations...');
  
  const userSpecifiedPath = 'C:\\Users\\H\\Desktop\\app\\model.h5';
  console.log('Checking user-specified model path:', userSpecifiedPath);
  if (fs.existsSync(userSpecifiedPath)) {
    console.log('✅ Found model at user-specified path:', userSpecifiedPath);
    return userSpecifiedPath;
  }
  
  if (isDev) {
    const devModelPath = path.join(__dirname, '..', 'model.h5');
    console.log('Checking development model path:', devModelPath);
    if (fs.existsSync(devModelPath)) {
      console.log('✅ Found model at', devModelPath);
      return devModelPath;
    }
  }
  
  const prodModelPath = path.join(process.resourcesPath, 'model.h5');
  console.log('Checking production model path:', prodModelPath);
  if (fs.existsSync(prodModelPath)) {
    console.log('✅ Found model at', prodModelPath);
    return prodModelPath;
  }

  const appModelPath = path.join(app.getAppPath(), 'model.h5');
  console.log('Checking app model path:', appModelPath);
  if (fs.existsSync(appModelPath)) {
    console.log('✅ Found model at', appModelPath);
    return appModelPath;
  }
  
  const packagedAppPath = path.join(app.getAppPath(), '..', 'model.h5');
  console.log('Checking packaged app path:', packagedAppPath);
  if (fs.existsSync(packagedAppPath)) {
    console.log('✅ Found model at', packagedAppPath);
    return packagedAppPath;
  }
  
  console.log('❌ Model not found in any location, returning user-specified path as fallback');
  return userSpecifiedPath;
}

ipcMain.handle('select-model', async () => {
  try {
    const modelPath = getModelPath();
  
    if (modelPath) {
      console.log('Model found at:', modelPath);
      
      try {
        const firstBytes = fs.readFileSync(modelPath, { encoding: null, flag: 'r', length: 8 });
        const isH5 = firstBytes[0] === 137 && 
                    firstBytes[1] === 72 && 
                    firstBytes[2] === 68 && 
                    firstBytes[3] === 70;
                    
        if (!isH5) {
          console.warn('File exists but doesn\'t appear to be a valid H5 file');
          if (mainWindow) {
            dialog.showMessageBox(mainWindow, {
              type: 'warning',
              title: 'Invalid Model Format',
              message: 'The file exists but doesn\'t appear to be a valid H5 model file. Please ensure you\'re using the correct model format.',
              buttons: ['OK']
            });
          }
        } else {
          console.log('Valid H5 file signature detected');
        }
      } catch (err) {
        console.error('Error validating H5 file:', err);
      }
      
      return modelPath;
    } else {
      console.log('Model not found automatically, letting user know to add model.h5');
      
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

ipcMain.handle('get-model-dir', async (event, modelJsonPath) => {
  const modelDir = path.dirname(modelJsonPath);
  return modelDir;
});

ipcMain.handle('check-model-format', async (event, modelPath) => {
  try {
    if (modelPath.endsWith('.h5')) {
      try {
        const buffer = fs.readFileSync(modelPath, { encoding: null, flag: 'r', length: 8 });
        
        const isH5 = buffer[0] === 137 && 
                    buffer[1] === 72 && 
                    buffer[2] === 68 && 
                    buffer[3] === 70;
        
        if (!isH5) {
          return { error: 'File has .h5 extension but invalid H5 format signature' };
        }
        
        const stats = fs.statSync(modelPath);
        if (stats.size < 1000) {
          return { error: 'H5 file is too small to be a valid model' };
        }
        
        console.log(`Valid H5 file detected (${stats.size} bytes)`);
        return { format: 'h5', path: modelPath, size: stats.size };
      } catch (err) {
        return { error: `Error validating H5 file: ${err.message}` };
      }
    }
    
    if (modelPath.endsWith('.json')) {
      try {
        const content = fs.readFileSync(modelPath, 'utf8');
        const json = JSON.parse(content);
        if (json.format === 'layers-model' || json.modelTopology) {
          return { format: 'tfjs', path: modelPath };
        }
      } catch (e) {
        return { error: 'Not a valid TensorFlow.js model JSON file' };
      }
    }
    
    return { error: 'Unsupported model format' };
  } catch (error) {
    return { error: error.message };
  }
});

ipcMain.handle('read-model-file', async (event, filePath) => {
  try {
    if (filePath.endsWith('.h5')) {
      if (!fs.existsSync(filePath)) {
        return { success: false, error: 'H5 file not found' };
      }
      
      const stats = fs.statSync(filePath);
      if (stats.size < 1000) {
        return { success: false, error: 'H5 file is too small to be a valid model' };
      }
      
      return { 
        success: true, 
        format: 'h5',
        size: stats.size,
        message: 'H5 model validated successfully'
      };
    }
    
    const content = fs.readFileSync(filePath);
    return { success: true, data: content.toString('base64') };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('read-model-dir', async (event, dirPath) => {
  try {
    const files = fs.readdirSync(dirPath);
    return files.map(file => path.join(dirPath, file));
  } catch (error) {
    return { error: error.message };
  }
});

ipcMain.handle('test-axios', async () => {
  try {
    const axios = require('axios');
    return { available: true, message: 'Axios is available in the main process' };
  } catch (error) {
    return { available: false, error: error.message };
  }
});
