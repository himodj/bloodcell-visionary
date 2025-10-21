const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const url = require('url');
const { spawn } = require('child_process');
const isDev = process.env.NODE_ENV === 'development';
const http = require('http');

let mainWindow;
let pythonProcess = null;
let loadAttempts = 0;
const MAX_LOAD_ATTEMPTS = 30; // Maximum number of retries

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
      webSecurity: false,
      sandbox: false,
      enableRemoteModule: false,
      allowRunningInsecureContent: false,
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

  if (isDev) {
    loadDevServer();
  } else {
    const startUrl = url.format({
      pathname: path.join(__dirname, '../dist/index.html'),
      protocol: 'file:',
      slashes: true,
    });
    console.log('Loading production URL:', startUrl);
    mainWindow.loadURL(startUrl);
  }

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

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function checkDevServer(callback) {
  http.get('http://localhost:8080', (response) => {
    if (response.statusCode === 200) {
      callback(true);
    } else {
      callback(false);
    }
  }).on('error', () => {
    callback(false);
  });
}

function loadDevServer() {
  const startUrl = 'http://localhost:8080';
  console.log(`Attempt ${loadAttempts + 1}/${MAX_LOAD_ATTEMPTS} to connect to dev server...`);
  
  checkDevServer((available) => {
    if (available) {
      console.log('Dev server is available, loading URL:', startUrl);
      mainWindow.loadURL(startUrl).catch(err => {
        console.error('Error loading URL:', err);
      });
    } else {
      loadAttempts++;
      if (loadAttempts < MAX_LOAD_ATTEMPTS) {
        console.log(`Dev server not available yet. Retrying in 1 second...`);
        setTimeout(loadDevServer, 1000);
      } else {
        console.error('Failed to connect to dev server after maximum attempts');
        dialog.showMessageBox(mainWindow, {
          type: 'error',
          title: 'Connection Error',
          message: 'Failed to connect to development server at http://localhost:8080',
          detail: 'Please ensure the Vite server is running before starting Electron.',
          buttons: ['OK']
        });
      }
    }
  });
}

function startPythonServer() {
  const pythonCommand = process.platform === 'win32' ? 'python' : 'python3';
  
  // Install necessary packages first
  try {
    console.log('Checking required Python packages (skip downloads if up-to-date)...');

    const required = {
      'flask': '3.0.0',
      'flask-cors': '4.0.0',
      'tensorflow': '2.15.0',
      'keras': '3.0.0',
      'pillow': '10.0.0',
      'numpy': '1.24.0',
      'h5py': '3.8.0'
    };

    const spawnSync = require('child_process').spawnSync;

    const getInstalledVersion = (pkg) => {
      try {
        const res = spawnSync(pythonCommand, ['-m', 'pip', 'show', pkg], { encoding: 'utf8' });
        if (res.status !== 0) return null;
        const match = /Version:\s*([^\r\n]+)/.exec(res.stdout || '');
        return match ? match[1].trim() : null;
      } catch (e) {
        return null;
      }
    };

    const cmp = (a, b) => {
      const pa = (a || '').split('.').map(x => parseInt(x, 10) || 0);
      const pb = (b || '').split('.').map(x => parseInt(x, 10) || 0);
      const len = Math.max(pa.length, pb.length);
      for (let i = 0; i < len; i++) {
        const ai = pa[i] || 0;
        const bi = pb[i] || 0;
        if (ai > bi) return 1;
        if (ai < bi) return -1;
      }
      return 0;
    };

    const needUpgrade = [];
    for (const [pkg, minV] of Object.entries(required)) {
      const curV = getInstalledVersion(pkg);
      if (!curV || cmp(curV, minV) < 0) {
        needUpgrade.push(`${pkg}>=${minV}`);
        console.log(`Package ${pkg} ${curV || '(not installed)'} -> requires >= ${minV}`);
      }
    }

    if (needUpgrade.length === 0) {
      console.log('All required Python packages are up to date. Skipping pip install.');
      startActualPythonServer();
      return;
    }

    console.log('Installing/upgrading Python packages:', needUpgrade.join(', '));
    const pipInstall = spawn(pythonCommand, ['-m', 'pip', 'install', '--upgrade', ...needUpgrade]);

    pipInstall.stdout.on('data', (data) => {
      console.log(`pip install output: ${data}`);
    });

    pipInstall.stderr.on('data', (data) => {
      console.log(`pip install error: ${data}`);
    });

    pipInstall.on('close', (code) => {
      console.log(`pip install exited with code ${code}`);
      startActualPythonServer();
    });
  } catch (error) {
    console.error('Error checking/installing Python packages:', error);
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

// Cache for model path to avoid repeated file system searches
let cachedModelPath = null;
let modelPathSearched = false;

function getModelPath() {
  // Return cached path if already found
  if (cachedModelPath) {
    return cachedModelPath;
  }
  
  // If we've already searched and found nothing, don't search again
  if (modelPathSearched && !cachedModelPath) {
    return null;
  }
  
  console.log('Looking for model.h5 file in application directory...');
  modelPathSearched = true;
  
  // First check the current directory where the app is running
  const currentDirModelPath = path.join(process.cwd(), 'model.h5');
  console.log('Checking current directory:', currentDirModelPath);
  if (fs.existsSync(currentDirModelPath)) {
    console.log('✅ Found model in current directory:', currentDirModelPath);
    cachedModelPath = currentDirModelPath;
    return cachedModelPath;
  }
  
  // Check the app root directory (top priority)
  const appRootModelPath = path.join(app.getAppPath(), 'model.h5');
  console.log('Checking app root directory:', appRootModelPath);
  if (fs.existsSync(appRootModelPath)) {
    console.log('✅ Found model at application root:', appRootModelPath);
    cachedModelPath = appRootModelPath;
    return cachedModelPath;
  }
  
  // Check the directory where the executable is located
  const execDir = path.dirname(app.getPath('exe'));
  const execDirModelPath = path.join(execDir, 'model.h5');
  console.log('Checking executable directory:', execDirModelPath);
  if (fs.existsSync(execDirModelPath)) {
    console.log('✅ Found model in executable directory:', execDirModelPath);
    cachedModelPath = execDirModelPath;
    return cachedModelPath;
  }
  
  // Then check one level up from app path
  const parentDirModelPath = path.join(app.getAppPath(), '..', 'model.h5');
  console.log('Checking parent directory:', parentDirModelPath);
  if (fs.existsSync(parentDirModelPath)) {
    console.log('✅ Found model in parent directory:', parentDirModelPath);
    cachedModelPath = parentDirModelPath;
    return cachedModelPath;
  }
  
  if (isDev) {
    const devModelPath = path.join(__dirname, '..', 'model.h5');
    console.log('Checking development model path:', devModelPath);
    if (fs.existsSync(devModelPath)) {
      console.log('✅ Found model at', devModelPath);
      cachedModelPath = devModelPath;
      return cachedModelPath;
    }
  }
  
  const prodModelPath = path.join(process.resourcesPath, 'model.h5');
  console.log('Checking production model path:', prodModelPath);
  if (fs.existsSync(prodModelPath)) {
    console.log('✅ Found model at', prodModelPath);
    cachedModelPath = prodModelPath;
    return cachedModelPath;
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

ipcMain.handle('save-report', async (event, reportData) => {
  try {
    const fs = require('fs').promises;
    const pathModule = require('path');
    
    // Create test archive folder in the same directory as the application
    const appDir = process.cwd();
    const testArchiveDir = pathModule.join(appDir, 'test archive');
    
    // Create directory if it doesn't exist
    try {
      await fs.access(testArchiveDir);
    } catch {
      await fs.mkdir(testArchiveDir, { recursive: true });
    }
    
    // Generate unique folder name for this patient/test
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const cellType = reportData.analysisResult?.detectedCells?.[0]?.type || 'Unknown_Cell';
    const patientName = reportData.patientInfo.name || 'Unknown';
    const testFolderName = `${cellType}_${patientName}_${reportData.reportId}_${timestamp}`.replace(/[<>:"/\\|?*]/g, '_');
    const testFolder = pathModule.join(testArchiveDir, testFolderName);
    
    await fs.mkdir(testFolder, { recursive: true });
    
    // Save the analyzed image
    let imagePath = null;
    if (reportData.analysisResult.processedImage || reportData.analysisResult.image) {
      const imageUrl = reportData.analysisResult.processedImage || reportData.analysisResult.image;
      
      if (imageUrl.startsWith('data:image/')) {
        // Handle base64 images
        const base64Data = imageUrl.split(',')[1];
        const imageExtension = imageUrl.split(';')[0].split('/')[1] || 'png';
        imagePath = pathModule.join(testFolder, `analyzed_image.${imageExtension}`);
        await fs.writeFile(imagePath, base64Data, 'base64');
      }
    }
    
    // Create comprehensive HTML report content
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <title>Lab Report ${reportData.reportId}</title>
    <meta charset="UTF-8">
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; color: #333; }
        .header { border-bottom: 3px solid #1e40af; padding-bottom: 20px; margin-bottom: 30px; }
        .lab-title { font-size: 24px; font-weight: bold; color: #1e40af; margin-bottom: 8px; }
        .lab-subtitle { font-size: 14px; color: #374151; margin-bottom: 3px; }
        .patient-box { border: 2px solid #1e40af; padding: 20px; margin: 25px 0; background: #f8fafc; }
        .patient-title { font-size: 18px; font-weight: bold; color: #1e40af; margin-bottom: 15px; text-align: center; }
        .patient-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-bottom: 15px; }
        .field-label { font-weight: bold; color: #374151; margin-bottom: 3px; }
        .field-value { color: #111827; border-bottom: 1px solid #d1d5db; padding-bottom: 3px; min-height: 18px; }
        .image-section { text-align: center; margin: 25px 0; }
        .section-title { font-size: 18px; font-weight: bold; color: #1e40af; margin-bottom: 15px; border-bottom: 2px solid #cbd5e1; padding-bottom: 5px; }
        .analysis-image { max-width: 400px; border: 2px solid #d1d5db; border-radius: 8px; }
        .results-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin: 25px 0; }
        .result-item { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e5e7eb; }
        .result-label { font-weight: bold; }
        .findings-section { background: #fef3c7; border: 2px solid #f59e0b; border-radius: 8px; padding: 20px; margin: 25px 0; }
        .findings-title { font-size: 16px; font-weight: bold; color: #92400e; margin-bottom: 12px; }
        .findings-list { margin: 10px 0; padding-left: 20px; }
        .findings-list li { margin-bottom: 8px; }
        .signature-section { display: flex; justify-content: space-between; margin-top: 40px; padding-top: 20px; border-top: 1px solid #d1d5db; }
        .signature-box { width: 200px; text-align: center; }
        .signature-line { border-bottom: 2px solid #374151; margin-bottom: 8px; height: 40px; }
        .program-footer { text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; }
        .report-info { display: flex; justify-content: space-between; margin-bottom: 25px; color: #6b7280; }
    </style>
</head>
<body>
    <div class="header">
        <div class="lab-title">${reportData.labConfig.labName || 'CLINICAL LABORATORY'}</div>
        <div class="lab-subtitle">Hematology Department</div>
        <div class="lab-subtitle">${reportData.labConfig.address || ''}</div>
        <div class="lab-subtitle">Phone: ${reportData.labConfig.phone || ''}</div>
        <div class="lab-subtitle">License: ${reportData.labConfig.licenseNumber || ''}</div>
        ${reportData.labConfig.hematologyDoctorName ? `<div class="lab-subtitle">Dr. ${reportData.labConfig.hematologyDoctorName}</div>` : ''}
    </div>
    
    <div class="report-info">
        <div>
            <strong>Report ID:</strong> ${reportData.reportId}<br>
            <strong>Analysis Date:</strong> ${reportData.reportDate}
        </div>
        <div>
            <strong>Report Type:</strong> Blood Cell Analysis<br>
            <strong>Method:</strong> AI-Powered Analysis
        </div>
    </div>
    
    <div class="patient-box">
        <div class="patient-title">PATIENT INFORMATION</div>
        <div class="patient-grid">
            <div>
                <div class="field-label">Patient Name:</div>
                <div class="field-value">${reportData.patientInfo.name || 'Not specified'}</div>
            </div>
            <div>
                <div class="field-label">Age:</div>
                <div class="field-value">${reportData.patientInfo.age || 'Not specified'}</div>
            </div>
            <div>
                <div class="field-label">Gender:</div>
                <div class="field-value">${reportData.patientInfo.gender || 'Not specified'}</div>
            </div>
            <div>
                <div class="field-label">Sample Type:</div>
                <div class="field-value">${reportData.patientInfo.sampleType || 'Blood Sample'}</div>
            </div>
            <div>
                <div class="field-label">Collection Date:</div>
                <div class="field-value">${reportData.reportDate}</div>
            </div>
            <div>
                <div class="field-label">Report Date:</div>
                <div class="field-value">${reportData.reportDate}</div>
            </div>
        </div>
        ${reportData.patientInfo.clinicalNotes ? `
        <div style="margin-top: 15px;">
            <div class="field-label">Clinical Notes:</div>
            <div class="field-value">${reportData.patientInfo.clinicalNotes}</div>
        </div>
        ` : ''}
    </div>
    
    <div class="image-section">
        <div class="section-title">MICROSCOPIC EXAMINATION</div>
        ${imagePath ? `<img src="analyzed_image.${imagePath.split('.').pop()}" alt="Blood Sample Analysis" class="analysis-image">` : ''}
        <div style="font-size: 12px; margin-top: 10px; font-style: italic;">
            Blood cell sample with AI-powered detection overlay
        </div>
    </div>
    
    <div class="results-grid">
        <div>
            <div class="section-title">ANALYSIS RESULTS</div>
            ${reportData.analysisResult.detectedCells.length > 0 ? `
            <div class="result-item">
                <span class="result-label">Detected Cell Type:</span>
                <span>${reportData.analysisResult.detectedCells[0].type}</span>
            </div>
            <div class="result-item">
                <span class="result-label">Confidence Level:</span>
                <span>${(reportData.analysisResult.detectedCells[0].confidence * 100).toFixed(1)}%</span>
            </div>
            <div class="result-item">
                <span class="result-label">Analysis Method:</span>
                <span>Neural Network</span>
            </div>
            <div class="result-item">
                <span class="result-label">Processing Time:</span>
                <span>&lt; 1 second</span>
            </div>
            ` : '<p>No cells detected</p>'}
        </div>
        <div>
            <div class="section-title">QUALITY METRICS</div>
            <div class="result-item">
                <span class="result-label">Image Quality:</span>
                <span>Good</span>
            </div>
            <div class="result-item">
                <span class="result-label">Model Version:</span>
                <span>v1.0</span>
            </div>
            <div class="result-item">
                <span class="result-label">Analysis Status:</span>
                <span>Complete</span>
            </div>
            <div class="result-item">
                <span class="result-label">Evaluated By:</span>
                <span>AI System with Doctor Review</span>
            </div>
        </div>
    </div>
    
    ${reportData.analysisResult.possibleConditions?.length > 0 || reportData.analysisResult.recommendations?.length > 0 ? `
    <div class="findings-section">
        <div class="findings-title">CLINICAL FINDINGS & RECOMMENDATIONS</div>
        ${reportData.analysisResult.possibleConditions?.length > 0 ? `
        <div>
            <strong>Possible Conditions:</strong>
            <ul class="findings-list">
                ${reportData.analysisResult.possibleConditions.map(condition => `<li>${condition}</li>`).join('')}
            </ul>
        </div>
        ` : ''}
        ${reportData.analysisResult.recommendations?.length > 0 ? `
        <div>
            <strong>Recommendations:</strong>
            <ul class="findings-list">
                ${reportData.analysisResult.recommendations.map(rec => `<li>${rec}</li>`).join('')}
            </ul>
        </div>
        ` : ''}
    </div>
    ` : ''}
    
    ${reportData.analysisResult.notes ? `
    <div style="margin: 25px 0;">
        <div class="section-title">ADDITIONAL NOTES</div>
        <div style="padding: 15px; border: 1px solid #d1d5db; border-radius: 8px;">
            ${reportData.analysisResult.notes}
        </div>
    </div>
    ` : ''}
    
    <div class="signature-section">
        <div class="signature-box">
            <div class="signature-line"></div>
            <div>Laboratory Technician<br>Date: ___________</div>
        </div>
        <div class="signature-box">
            <div class="signature-line"></div>
            <div>${reportData.labConfig.hematologyDoctorName ? `Dr. ${reportData.labConfig.hematologyDoctorName}` : 'Reviewing Pathologist'}<br>Date: ___________</div>
        </div>
    </div>
    
    <div class="program-footer">
        <div><strong>BloodCellVision</strong></div>
        <div style="font-size: 10px; margin-top: 3px;">
            Report ID: ${reportData.reportId} | Generated: ${reportData.reportDate}
        </div>
    </div>
</body>
</html>
    `;
    
    // Save the HTML report
    const reportPath = pathModule.join(testFolder, `Report_${reportData.reportId}.html`);
    await fs.writeFile(reportPath, htmlContent);
    
    // Save the analysis data as JSON for reopening later
    const analysisDataPath = pathModule.join(testFolder, 'analysis_data.json');
    const originalCellCounts = reportData.analysisResult.cellCounts || {};
    const totalCells = Object.values(originalCellCounts).reduce((sum, count) => sum + count, 0);
    const abnormalCells = Math.floor((reportData.analysisResult.abnormalityRate || 0) * totalCells);
    
    const analysisData = {
      image: reportData.analysisResult.image,
      processedImage: reportData.analysisResult.processedImage || reportData.analysisResult.image,
      analysisDate: new Date(),
      cellCounts: {
        totalCells: totalCells,
        normalCells: totalCells - abnormalCells,
        abnormalCells: abnormalCells,
        detectedCells: originalCellCounts
      },
      detectedCells: reportData.analysisResult.detectedCells || [],
      abnormalityRate: reportData.analysisResult.abnormalityRate || 0,
      recommendations: reportData.analysisResult.recommendations || [],
      possibleConditions: reportData.analysisResult.possibleConditions || reportData.analysisResult.conditions || [],
      doctorNotes: reportData.analysisResult.doctorNotes || '',
      patientInfo: reportData.patientInfo
    };
    await fs.writeFile(analysisDataPath, JSON.stringify(analysisData, null, 2));
    
    // Save the processed image for reopening
    if (reportData.analysisResult.processedImage || reportData.analysisResult.image) {
      const imageDataUrl = reportData.analysisResult.processedImage || reportData.analysisResult.image;
      if (imageDataUrl.startsWith('data:image/png;base64,')) {
        const base64Data = imageDataUrl.replace(/^data:image\/png;base64,/, '');
        const imagePath = pathModule.join(testFolder, 'analyzed_image.png');
        await fs.writeFile(imagePath, base64Data, 'base64');
      }
    }
    
    return { 
      success: true, 
      filePath: reportPath,
      folder: testFolder
    };
    
  } catch (error) {
    console.error('Error saving report:', error);
    return { success: false, error: error.message };
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

ipcMain.handle('get-patient-reports', async () => {
  try {
    const pathModule = require('path');
    const appDir = process.cwd();
    const testArchiveDir = pathModule.join(appDir, 'test archive');
    
    if (!fs.existsSync(testArchiveDir)) {
      return { success: true, reports: [] };
    }
    
    const folders = fs.readdirSync(testArchiveDir);
    const reports = [];
    
    for (const folder of folders) {
      const folderPath = pathModule.join(testArchiveDir, folder);
      const stat = fs.statSync(folderPath);
      
      if (stat.isDirectory()) {
        try {
          // Try to read analysis_data.json first for accurate patient info
          const analysisDataPath = pathModule.join(folderPath, 'analysis_data.json');
          let patientName = 'Unknown Patient';
          let cellType = 'Blood Sample';
          let age = '';
          let gender = '';
          let reportDate = stat.ctime.toISOString().split('T')[0]; // Default to file creation date
          
          if (fs.existsSync(analysisDataPath)) {
            try {
              const analysisData = JSON.parse(fs.readFileSync(analysisDataPath, 'utf8'));
              
              // Get patient info from analysis data
              if (analysisData.patientInfo) {
                patientName = analysisData.patientInfo.name || 'Unknown Patient';
                age = analysisData.patientInfo.age || '';
                gender = analysisData.patientInfo.gender || '';
              }
              
              // Get cell type from detected cells
              if (analysisData.detectedCells && analysisData.detectedCells.length > 0) {
                cellType = analysisData.detectedCells[0].type || 'Blood Sample';
              }
              
              // Use the original analysis date
              if (analysisData.analysisDate) {
                reportDate = new Date(analysisData.analysisDate).toISOString().split('T')[0];
              }
            } catch (parseErr) {
              console.error('Error parsing analysis data:', parseErr);
              // Fall back to parsing folder name
              const parts = folder.split('_');
              if (parts.length >= 5) {
                // Format: Blood_Sample_CellType_PatientName_ReportID_Timestamp
                cellType = parts[2] || 'Blood Sample';
                patientName = parts.slice(3, -2).join(' ') || 'Unknown Patient';
              }
            }
          } else {
            // Fall back to parsing folder name if no analysis data
            const parts = folder.split('_');
            if (parts.length >= 5) {
              // Format: Blood_Sample_CellType_PatientName_ReportID_Timestamp
              cellType = parts[2] || 'Blood Sample';
              patientName = parts.slice(3, -2).join(' ') || 'Unknown Patient';
            }
          }
          
          reports.push({
            id: folder,
            patientName: patientName,
            cellType: cellType,
            reportDate: reportDate,
            folderPath: folderPath,
            age: age,
            gender: gender
          });
        } catch (err) {
          console.error('Error processing folder:', folder, err);
        }
      }
    }
    
    // Sort by date, newest first
    reports.sort((a, b) => new Date(b.reportDate) - new Date(a.reportDate));
    
    return { success: true, reports };
  } catch (error) {
    console.error('Error getting patient reports:', error);
    return { success: false, reports: [] };
  }
});

ipcMain.handle('open-report-folder', async (event, folderPath) => {
  try {
    const { shell } = require('electron');
    await shell.openPath(folderPath);
  } catch (error) {
    console.error('Error opening report folder:', error);
    throw error;
  }
});

ipcMain.handle('load-analysis-from-report', async (event, folderPath) => {
  try {
    const pathModule = require('path');
    const analysisDataPath = pathModule.join(folderPath, 'analysis_data.json');
    
    if (!fs.existsSync(analysisDataPath)) {
      return { success: false, error: 'Analysis data not found' };
    }
    
    const analysisData = JSON.parse(fs.readFileSync(analysisDataPath, 'utf8'));
    
    // Also load the image if it exists
    const imagePath = pathModule.join(folderPath, 'analyzed_image.png');
    if (fs.existsSync(imagePath)) {
      const imageData = fs.readFileSync(imagePath);
      analysisData.imageDataUrl = `data:image/png;base64,${imageData.toString('base64')}`;
    }
    
    // Load original report data for updating
    const reportFiles = fs.readdirSync(folderPath).filter(file => file.startsWith('Report_') && file.endsWith('.html'));
    let originalData = null;
    if (reportFiles.length > 0) {
      const reportId = reportFiles[0].replace('Report_', '').replace('.html', '');
      originalData = {
        reportId,
        reportDate: analysisData.analysisDate,
        labConfig: {
          name: "AI Pathology Laboratory",
          address: "123 Medical Center Drive",
          contact: "Phone: (555) 123-4567 | Email: lab@example.com",
          logo: ""
        }
      };
    }
    
    return { success: true, analysis: analysisData, originalData };
  } catch (error) {
    console.error('Error loading analysis from report:', error);
    return { success: false, error: error.message };
  }
});

// Add update existing report function
ipcMain.handle('update-existing-report', async (event, folderPath, reportData) => {
  try {
    const fs = require('fs').promises;
    const pathModule = require('path');
    
    // Ensure the folderPath is absolute
    const absoluteFolderPath = pathModule.isAbsolute(folderPath) 
      ? folderPath 
      : pathModule.join(process.cwd(), folderPath);
    
    // Check if the folder exists
    try {
      await fs.access(absoluteFolderPath);
    } catch (error) {
      console.error('Folder not found:', absoluteFolderPath);
      return { success: false, error: `Folder not found: ${absoluteFolderPath}` };
    }
    
    // Parse the folder name to extract components
    const folderName = pathModule.basename(absoluteFolderPath);
    const parts = folderName.split('_');
    
    // Don't rename the folder - preserve original timestamp and report ID
    // Only update the data files inside
    let needsRename = false;
    let newFolderName = folderName;
    
    // Update the analysis data JSON
    const analysisDataPath = pathModule.join(absoluteFolderPath, 'analysis_data.json');
    const originalCellCounts = reportData.analysisResult.cellCounts || {};
    const totalCells = Object.values(originalCellCounts).reduce((sum, count) => sum + count, 0);
    const abnormalCells = Math.floor((reportData.analysisResult.abnormalityRate || 0) * totalCells);
    
    const analysisData = {
      image: reportData.analysisResult.image,
      processedImage: reportData.analysisResult.processedImage || reportData.analysisResult.image,
      analysisDate: reportData.analysisResult.analysisDate,
      cellCounts: {
        totalCells: totalCells,
        normalCells: totalCells - abnormalCells,
        abnormalCells: abnormalCells,
        detectedCells: originalCellCounts
      },
      detectedCells: reportData.analysisResult.detectedCells || [],
      abnormalityRate: reportData.analysisResult.abnormalityRate || 0,
      recommendations: reportData.analysisResult.recommendations || [],
      possibleConditions: reportData.analysisResult.possibleConditions || reportData.analysisResult.conditions || [],
      doctorNotes: reportData.analysisResult.doctorNotes || '',
      patientInfo: reportData.patientInfo
    };
    
    await fs.writeFile(analysisDataPath, JSON.stringify(analysisData, null, 2));
    
    // Return success without renaming folder - preserve original report metadata
    return { success: true, newFolderPath: absoluteFolderPath };
  } catch (error) {
    console.error('Error updating existing report:', error);
    return { success: false, error: error.message };
  }
});
