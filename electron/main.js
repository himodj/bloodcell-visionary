const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const url = require('url');
const { spawn } = require('child_process');
const isDev = process.env.NODE_ENV === 'development';

let mainWindow;
let pythonProcess = null;

function createWindow() {
  // Determine the correct preload script path - use absolute path
  const preloadPath = path.join(__dirname, 'preload.js');
  console.log('Using preload script at:', preloadPath);
  
  // Make sure the preload script exists
  if (!fs.existsSync(preloadPath)) {
    console.error(`ERROR: Preload script not found at: ${preloadPath}`);
    
    // Log directory contents for debugging
    try {
      const dirContents = fs.readdirSync(__dirname);
      console.log('Directory contents:', dirContents);
    } catch (err) {
      console.error('Could not read directory:', err);
    }
  }

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: preloadPath,
      webSecurity: true,
      sandbox: false, // Disable sandbox to allow Node.js modules in preload
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
  console.log('Current working directory:', process.cwd());
  
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
  
  // Install flask-cors if needed
  try {
    console.log('Installing required Python packages...');
    const pipInstall = spawn(pythonCommand, ['-m', 'pip', 'install', 'flask-cors']);
    
    pipInstall.stdout.on('data', (data) => {
      console.log(`pip install output: ${data}`);
    });
    
    pipInstall.stderr.on('data', (data) => {
      console.log(`pip install error: ${data}`);
    });
    
    pipInstall.on('close', (code) => {
      console.log(`pip install exited with code ${code}`);
      if (code === 0) {
        console.log('Successfully installed flask-cors');
        startActualPythonServer();
      } else {
        console.warn('Failed to install flask-cors, trying to start server anyway');
        startActualPythonServer();
      }
    });
  } catch (error) {
    console.error('Error installing flask-cors:', error);
    startActualPythonServer();
  }
}

function startActualPythonServer() {
  const pythonCommand = process.platform === 'win32' ? 'python' : 'python3';
  const env = Object.assign({}, process.env);
  env.MODEL_PATH = getModelPath();
  
  let scriptPath;
  if (isDev) {
    scriptPath = path.join(__dirname, '..', 'python', 'model_server.py');
  } else {
    scriptPath = path.join(process.resourcesPath, 'python', 'model_server.py');
  }
  
  console.log('Python script path:', scriptPath);
  
  const pythonDir = path.dirname(scriptPath);
  if (!fs.existsSync(pythonDir)) {
    try {
      fs.mkdirSync(pythonDir, { recursive: true });
    } catch (err) {
      console.error(`Could not create python directory: ${err.message}`);
    }
  }
  
  if (!fs.existsSync(scriptPath)) {
    const possibleSourcePaths = [
      path.join(app.getAppPath(), 'python', 'model_server.py'),
      path.join(__dirname, '..', 'python', 'model_server.py'),
      path.join(process.resourcesPath, 'app.asar', 'python', 'model_server.py')
    ];
    
    let sourceFile = null;
    for (const sourcePath of possibleSourcePaths) {
      if (fs.existsSync(sourcePath)) {
        sourceFile = sourcePath;
        console.log(`Found source Python script at: ${sourcePath}`);
        break;
      }
    }
    
    if (sourceFile) {
      fs.mkdirSync(path.dirname(scriptPath), { recursive: true });
      fs.copyFileSync(sourceFile, scriptPath);
      console.log(`Copied Python script from ${sourceFile} to ${scriptPath}`);
    } else {
      console.error(`Python script not found at any of the expected locations`);
      
      if (mainWindow) {
        dialog.showMessageBox(mainWindow, {
          type: 'error',
          title: 'Server Error',
          message: `Python script not found. The application may not work correctly.`,
          buttons: ['OK']
        });
      }
      return;
    }
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
  console.log('Looking for model.h5 file in application directory...');
  
  // First check the current directory where the app is running
  const currentDirModelPath = path.join(process.cwd(), 'model.h5');
  console.log('Checking current directory:', currentDirModelPath);
  if (fs.existsSync(currentDirModelPath)) {
    console.log('✅ Found model in current directory:', currentDirModelPath);
    return currentDirModelPath;
  }
  
  // Check the app root directory (top priority)
  const appRootModelPath = path.join(app.getAppPath(), 'model.h5');
  console.log('Checking app root directory:', appRootModelPath);
  if (fs.existsSync(appRootModelPath)) {
    console.log('✅ Found model at application root:', appRootModelPath);
    return appRootModelPath;
  }
  
  // Check the directory where the executable is located
  const execDir = path.dirname(app.getPath('exe'));
  const execDirModelPath = path.join(execDir, 'model.h5');
  console.log('Checking executable directory:', execDirModelPath);
  if (fs.existsSync(execDirModelPath)) {
    console.log('✅ Found model in executable directory:', execDirModelPath);
    return execDirModelPath;
  }
  
  // Then check one level up from app path
  const parentDirModelPath = path.join(app.getAppPath(), '..', 'model.h5');
  console.log('Checking parent directory:', parentDirModelPath);
  if (fs.existsSync(parentDirModelPath)) {
    console.log('✅ Found model in parent directory:', parentDirModelPath);
    return parentDirModelPath;
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

  console.log('❌ Model not found in any location');
  return null;
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
              message: 'The file exists but doesn\'t appear to be a valid H5 model file.',
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
      console.log('Model not found in application directory.');
      
      if (mainWindow) {
        dialog.showMessageBox(mainWindow, {
          type: 'warning',
          title: 'Model Not Found',
          message: 'model.h5 file is required but not found in the application directory.',
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

ipcMain.handle('browse-for-model', async () => {
  try {
    console.log('Opening file dialog to browse for model...');
    
    if (!mainWindow) {
      console.error('Main window not available');
      return null;
    }
    
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [
        { name: 'H5 Models', extensions: ['h5'] },
        { name: 'All Files', extensions: ['*'] }
      ],
      title: 'Select Model File'
    });
    
    if (result.canceled || result.filePaths.length === 0) {
      console.log('File selection was canceled');
      return null;
    }
    
    const selectedPath = result.filePaths[0];
    console.log('User selected model at:', selectedPath);
    
    // Try to validate the file
    try {
      if (selectedPath.toLowerCase().endsWith('.h5')) {
        const buffer = fs.readFileSync(selectedPath, { encoding: null, flag: 'r', length: 8 });
        
        const isH5 = buffer[0] === 137 && 
                    buffer[1] === 72 && 
                    buffer[2] === 68 && 
                    buffer[3] === 70;
        
        if (!isH5) {
          console.warn('File has .h5 extension but invalid H5 format signature');
          
          if (mainWindow) {
            const warningResult = await dialog.showMessageBox(mainWindow, {
              type: 'warning',
              title: 'Invalid Model Format',
              message: 'The file you selected does not appear to be a valid H5 model file. Do you want to try using it anyway?',
              buttons: ['Yes', 'No'],
              defaultId: 1
            });
            
            if (warningResult.response === 1) {
              return null;
            }
          }
        }
      }
    } catch (err) {
      console.error('Error validating selected file:', err);
    }
    
    return selectedPath;
  } catch (error) {
    console.error('Error browsing for model:', error);
    return null;
  }
});

ipcMain.handle('check-file-exists', async (event, filePath) => {
  try {
    console.log('Checking if file exists:', filePath);
    return fs.existsSync(filePath);
  } catch (error) {
    console.error('Error checking if file exists:', error);
    return false;
  }
});
