#!/usr/bin/env node
/**
 * Bundle Python Backend with PyInstaller
 * This script creates a standalone Python executable with all dependencies bundled.
 * Run this before building the Electron app.
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const PYTHON_DIR = path.join(__dirname, 'python');
const BUILD_DIR = path.join(__dirname, 'python-bundle');
const DIST_DIR = path.join(BUILD_DIR, 'dist');

console.log('\n🐍 Python Backend Bundling Process\n');
console.log('=' .repeat(60));

// Step 1: Check if Python is available
console.log('\n📋 Step 1: Checking Python installation...');
try {
  const pythonVersion = execSync('python --version', { encoding: 'utf8' });
  console.log('✅ Python found:', pythonVersion.trim());
} catch (error) {
  console.error('❌ Python not found! Please install Python 3.10 or 3.11');
  console.error('   Download from: https://www.python.org/downloads/');
  process.exit(1);
}

// Step 2: Install required packages
console.log('\n📦 Step 2: Installing required Python packages...');
const requirements = [
  'flask>=3.0.0',
  'flask-cors>=4.0.0',
  'tensorflow>=2.15.0',
  'keras>=3.0.0',
  'pillow>=10.0.0',
  'numpy>=1.24.0',
  'h5py>=3.8.0',
  'pyinstaller>=6.0.0'
];

try {
  console.log('Installing packages (this may take several minutes)...');
  execSync(`python -m pip install ${requirements.join(' ')}`, {
    stdio: 'inherit'
  });
  console.log('✅ All packages installed successfully');
} catch (error) {
  console.error('❌ Failed to install Python packages');
  console.error('   Error:', error.message);
  process.exit(1);
}

// Step 3: Create PyInstaller spec file
console.log('\n📝 Step 3: Creating PyInstaller configuration...');
const specContent = `# -*- mode: python ; coding: utf-8 -*-

import sys
from PyInstaller.utils.hooks import collect_data_files, collect_submodules

block_cipher = None

# Collect TensorFlow and Keras data files
tensorflow_datas = collect_data_files('tensorflow')
keras_datas = collect_data_files('keras')

# Collect all necessary submodules
hiddenimports = [
    'flask',
    'flask_cors',
    'werkzeug',
    'werkzeug.serving',
    'werkzeug.middleware.proxy_fix',
    'click',
    'itsdangerous',
    'jinja2',
    'markupsafe',
    'PIL',
    'PIL._imaging',
    'numpy',
    'h5py',
    'h5py._hl',
    'h5py.defs',
    'h5py.utils',
    'h5py.h5ac',
    'tensorflow',
    'tensorflow._api',
    'tensorflow.python',
    'keras',
    'keras.api',
    'keras.api._v2',
]

# Add all TensorFlow submodules
hiddenimports.extend(collect_submodules('tensorflow'))
hiddenimports.extend(collect_submodules('keras'))

a = Analysis(
    ['${path.join(PYTHON_DIR, 'model_server.py').replace(/\\/g, '\\\\')}'],
    pathex=[],
    binaries=[],
    datas=tensorflow_datas + keras_datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        'matplotlib',
        'scipy',
        'pandas',
        'sklearn',
        'pytest',
        'tk',
        'tcl',
        '_tkinter'
    ],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='model_server',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name='model_server',
)
`;

const specPath = path.join(__dirname, 'model_server.spec');
fs.writeFileSync(specPath, specContent);
console.log('✅ PyInstaller spec file created');

// Step 4: Run PyInstaller
console.log('\n🔨 Step 4: Building standalone Python executable...');
console.log('   This may take 10-15 minutes. Please be patient...');

try {
  // Clean previous builds
  if (fs.existsSync(BUILD_DIR)) {
    fs.rmSync(BUILD_DIR, { recursive: true });
  }
  if (fs.existsSync(path.join(__dirname, 'build'))) {
    fs.rmSync(path.join(__dirname, 'build'), { recursive: true });
  }

  // Run PyInstaller
  execSync(`pyinstaller --clean --distpath "${DIST_DIR}" --workpath "${path.join(BUILD_DIR, 'build')}" "${specPath}"`, {
    stdio: 'inherit'
  });

  console.log('✅ Python backend bundled successfully!');
  
  // Verify the executable exists
  const platform = process.platform;
  const exeName = platform === 'win32' ? 'model_server.exe' : 'model_server';
  const exePath = path.join(DIST_DIR, 'model_server', exeName);
  
  if (fs.existsSync(exePath)) {
    const stats = fs.statSync(exePath);
    const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
    console.log(`   Executable: ${exePath}`);
    console.log(`   Size: ${sizeMB} MB`);
  } else {
    console.error('⚠️  Warning: Executable not found at expected location');
  }
  
} catch (error) {
  console.error('❌ Failed to build Python backend');
  console.error('   Error:', error.message);
  process.exit(1);
} finally {
  // Clean up spec file and build directory
  if (fs.existsSync(specPath)) {
    fs.unlinkSync(specPath);
  }
  if (fs.existsSync(path.join(__dirname, 'build'))) {
    fs.rmSync(path.join(__dirname, 'build'), { recursive: true });
  }
}

console.log('\n' + '='.repeat(60));
console.log('✅ Python bundling complete!');
console.log('   The bundled Python backend is ready for Electron packaging.');
console.log('=' .repeat(60) + '\n');
