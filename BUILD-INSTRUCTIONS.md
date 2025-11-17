# Building BloodCellVision - Complete Guide

This guide explains how to build a **fully standalone** BloodCellVision application that bundles all dependencies (including Python, TensorFlow, and Keras) so users can install it on **any Windows, macOS, or Linux system** without installing Python separately.

## Prerequisites (Development Machine Only)

You only need these on the machine where you're **building** the app:

1. **Node.js 18+** - [Download](https://nodejs.org/)
2. **Python 3.10 or 3.11** - [Download](https://www.python.org/downloads/)
   - ⚠️ **Important**: During Python installation, check "Add Python to PATH"
3. **Git** (optional) - For version control

## Build Process Overview

The build process has 3 stages:

1. **Bundle Python Backend** - Creates a standalone Python executable with all AI dependencies
2. **Build React Frontend** - Compiles the web interface
3. **Package Electron App** - Wraps everything into a platform-specific installer

## Step-by-Step Build Instructions

### 1. Install Dependencies

```bash
# Install Node.js dependencies
npm install

# Install Python dependencies (required for bundling)
pip install flask flask-cors tensorflow keras pillow numpy h5py pyinstaller
```

### 2. Add the AI Model

Place your `model.h5` file in the project root directory:
```
BloodCellVision/
├── model.h5          ← Place your model here
├── package.json
├── ...
```

### 3. Build the Application

```bash
# This runs all build steps automatically:
# 1. Bundles Python backend (10-15 minutes first time)
# 2. Builds React frontend
# 3. Packages Electron app
npm run build:electron
```

**Expected build time:**
- First build: 15-20 minutes (Python bundling is slow)
- Subsequent builds: 5-10 minutes (if Python hasn't changed)

### 4. Find Your Installer

The installer will be in the `electron-dist` folder:

**Windows:**
- `BloodCellVision Setup 1.0.0.exe` (NSIS installer)

**macOS:**
- `BloodCellVision-1.0.0.dmg` (DMG image)
- `BloodCellVision-1.0.0-mac.zip` (ZIP archive)

**Linux:**
- `BloodCellVision-1.0.0.AppImage` (AppImage)
- `blood-cell-analyzer_1.0.0_amd64.deb` (Debian package)

## What Gets Bundled

The final installer includes **everything** needed to run:

✅ **Python Runtime** - Bundled as a standalone executable  
✅ **TensorFlow** - Full deep learning framework  
✅ **Keras** - Neural network library  
✅ **Flask** - Web server for AI backend  
✅ **All Python Dependencies** - NumPy, Pillow, h5py, etc.  
✅ **AI Model** - Your trained model.h5  
✅ **React Frontend** - Complete user interface  

**Result**: Users can install on any computer without installing Python or any dependencies!

## Troubleshooting

### Python Not Found Error

**Problem:**
```
❌ Python not found! Please install Python 3.10 or 3.11
```

**Solution:**
1. Install Python from [python.org](https://www.python.org/downloads/)
2. During installation, check "Add Python to PATH"
3. Restart your terminal/command prompt
4. Verify: `python --version`

### TensorFlow Installation Failed

**Problem:**
```
ERROR: Could not find a version that satisfies the requirement tensorflow
```

**Solution (Windows):**
```bash
# Use Python 3.10 or 3.11 (3.12 not fully supported by TensorFlow yet)
python --version

# Install with specific version
pip install tensorflow==2.15.0
```

**Solution (Mac M1/M2):**
```bash
# Use conda for Apple Silicon
conda install -c apple tensorflow-deps
pip install tensorflow-macos
```

### PyInstaller Build Failed

**Problem:**
```
Failed to build Python backend
```

**Solution:**
```bash
# Update PyInstaller
pip install --upgrade pyinstaller

# Clean and rebuild
rm -rf python-bundle build
node bundle-python.cjs
```

### Model File Missing

**Problem:**
```
⚠ Warning: model.h5 not found
```

**Solution:**
Place your trained `model.h5` file in the project root directory before building.

## Build for Specific Platform

To build only for your current platform:

```bash
# Build only for Windows (on Windows)
npm run build:electron

# Build only for macOS (on macOS)
npm run build:electron

# Build only for Linux (on Linux)
npm run build:electron
```

## Cross-Platform Builds

To build for multiple platforms, you need to run the build on each platform:

- **Windows installers** → Build on Windows
- **macOS installers** → Build on macOS
- **Linux installers** → Build on Linux

Or use a CI/CD service like GitHub Actions to build for all platforms automatically.

## File Size Expectations

The final installer will be **large** because it bundles the entire Python runtime and TensorFlow:

- **Windows**: ~500-700 MB
- **macOS**: ~600-800 MB  
- **Linux**: ~500-700 MB

This is normal and expected for AI applications.

## Development vs Production

**Development** (`npm run dev:electron`):
- Uses system Python
- Hot reload enabled
- DevTools open by default
- Faster startup

**Production** (built installer):
- Uses bundled Python executable
- No Python installation required on user's computer
- Optimized and compressed
- Ready for distribution

## Distribution

Once built, you can distribute the installer from `electron-dist/`:

1. Upload to your website
2. Share via cloud storage (Google Drive, Dropbox, etc.)
3. Distribute on a USB drive
4. Publish to app stores (if desired)

Users simply run the installer - **no technical knowledge required!**

## Support

If you encounter issues not covered here:

1. Check the build logs for specific error messages
2. Verify all prerequisites are correctly installed
3. Try cleaning and rebuilding: `rm -rf node_modules python-bundle && npm install && npm run build:electron`

---

**Built with ❤️ using Electron, React, Python, and TensorFlow**
