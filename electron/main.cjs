// BloodCellVision - Electron main process.
//
// There is no Python, TensorFlow or Keras at runtime. The trained network ships as an
// ONNX file and runs inside the app with ONNX Runtime (WebAssembly), so the app behaves
// the same on every Windows PC and needs nothing else installed.

const { app, BrowserWindow, ipcMain, dialog, protocol, shell, Menu, session } = require('electron');
const path = require('path');
const fs = require('fs');
const fsp = fs.promises;
const crypto = require('crypto');

const DEV_URL = process.env.BCV_DEV_URL || null; // e.g. http://localhost:8080 while developing
const SELFTEST = process.argv.includes('--selftest');
const APP_ORIGIN = 'app://bundle';
const CHROME_MAJOR = parseInt(process.versions.chrome, 10) || 0;
const REPORTS_DIR_NAME = 'BloodCellVision Reports';

let mainWindow = null;
let splashWindow = null;

// ----------------------------------------------------------------------------- logging
const logPath = path.join(app.getPath('userData'), 'app-debug.log');
function writeLog(message) {
  const line = `[${new Date().toISOString()}] ${message}\n`;
  try {
    // keep the log from growing without bound
    if (fs.existsSync(logPath) && fs.statSync(logPath).size > 2 * 1024 * 1024) {
      fs.renameSync(logPath, logPath + '.old');
    }
    fs.appendFileSync(logPath, line);
  } catch (_) { /* logging must never crash the app */ }
  if (!app.isPackaged) console.log(line.trim());
}

process.on('uncaughtException', (err) => writeLog(`UNCAUGHT EXCEPTION: ${err && err.stack || err}`));
process.on('unhandledRejection', (err) => writeLog(`UNHANDLED REJECTION: ${err && err.stack || err}`));

// ----------------------------------------------------------------------------- paths
function distDir() {
  return path.join(__dirname, '..', 'dist');
}
function bundledModelDir() {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'model')
    : path.join(__dirname, '..', 'resources', 'model');
}
function reportsDir() {
  return path.join(app.getPath('documents'), REPORTS_DIR_NAME);
}
const settingsPath = path.join(app.getPath('userData'), 'settings.json');
function readSettings() {
  try { return JSON.parse(fs.readFileSync(settingsPath, 'utf8')); } catch (_) { return {}; }
}
function writeSettings(s) {
  try { fs.writeFileSync(settingsPath, JSON.stringify(s, null, 2)); } catch (e) { writeLog(`settings write failed: ${e.message}`); }
}

// ----------------------------------------------------------------------------- app:// protocol
// The UI is served from app://bundle/ instead of file:// so that WebAssembly, workers and
// fetch() behave like on a normal secure web origin, and so the page can be cross-origin
// isolated (which enables multi-threaded inference).
protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } },
]);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.wasm': 'application/wasm',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json',
};
const ISOLATION_HEADERS = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
  'Cross-Origin-Resource-Policy': 'same-origin',
};

// Resolves an app:// URL to a file inside dist/ and reads it.
async function readBundleFile(requestUrl) {
  const root = distDir();
  const url = new URL(requestUrl);
  let rel = decodeURIComponent(url.pathname);
  if (rel === '/' || rel === '') rel = '/index.html';
  const filePath = path.normalize(path.join(root, rel));
  if (!filePath.startsWith(root)) return { status: 403 };
  const data = await fsp.readFile(filePath);
  return { status: 200, data, type: MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream' };
}

function registerAppProtocol() {
  if (typeof protocol.handle === 'function') {
    protocol.handle('app', async (request) => {
      try {
        const file = await readBundleFile(request.url);
        if (file.status !== 200) return new Response('Forbidden', { status: 403 });
        return new Response(file.data, {
          status: 200,
          headers: { 'Content-Type': file.type, 'Cache-Control': 'no-cache', ...ISOLATION_HEADERS },
        });
      } catch (err) {
        writeLog(`app:// request failed for ${request.url}: ${err.message}`);
        return new Response('Not found', { status: 404, headers: ISOLATION_HEADERS });
      }
    });
    return;
  }
  // Electron 22 (the Windows 7 / 8 build) has the older protocol API.
  protocol.registerBufferProtocol('app', (request, callback) => {
    readBundleFile(request.url)
      .then((file) => {
        if (file.status !== 200) {
          callback({ statusCode: 403, data: Buffer.from('Forbidden'), mimeType: 'text/plain' });
          return;
        }
        callback({
          statusCode: 200,
          data: file.data,
          mimeType: file.type.split(';')[0],
          charset: /charset=utf-8/.test(file.type) ? 'utf-8' : undefined,
          headers: { 'Content-Type': file.type, 'Cache-Control': 'no-cache', ...ISOLATION_HEADERS },
        });
      })
      .catch((err) => {
        writeLog(`app:// request failed for ${request.url}: ${err.message}`);
        callback({ statusCode: 404, data: Buffer.from('Not found'), mimeType: 'text/plain', headers: ISOLATION_HEADERS });
      });
  });
}

// ----------------------------------------------------------------------------- windows
function createSplashWindow() {
  splashWindow = new BrowserWindow({
    width: 500,
    height: 400,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    webPreferences: { nodeIntegration: false, contextIsolation: true },
  });
  splashWindow.loadFile(path.join(__dirname, 'loading.html')).catch(() => {});
  splashWindow.center();
  splashWindow.on('closed', () => { splashWindow = null; });
}

function closeSplash() {
  if (splashWindow && !splashWindow.isDestroyed()) splashWindow.close();
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 900,
    minHeight: 600,
    show: false,
    title: 'BloodCellVision - AI-Powered Blood Cell Analysis',
    icon: path.join(__dirname, 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
  });

  mainWindow.webContents.on('did-fail-load', (_e, code, desc, validatedURL, isMainFrame) => {
    if (!isMainFrame) return;
    writeLog(`FAILED TO LOAD: ${desc} (code ${code}) url=${validatedURL}`);
    closeSplash();
    dialog.showErrorBox(
      'BloodCellVision could not start',
      `The application window failed to load.\n\n${desc} (${code})\n\nLog file:\n${logPath}`
    );
  });
  mainWindow.webContents.on('render-process-gone', (_e, details) => {
    writeLog(`RENDERER GONE: ${details.reason} (exit code ${details.exitCode})`);
  });
  mainWindow.webContents.on('console-message', (event, level, message) => {
    // newer Electron passes one event object, older versions pass (event, level, message)
    const isError = typeof level === 'number' ? level >= 3 : event.level === 'error';
    if (isError) writeLog(`renderer error: ${typeof message === 'string' ? message : event.message}`);
  });

  // External links open in the default browser, never inside the app window.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (e, url) => {
    const allowed = url.startsWith(APP_ORIGIN) || (DEV_URL && url.startsWith(DEV_URL));
    if (!allowed) e.preventDefault();
  });

  mainWindow.once('ready-to-show', () => {
    if (SELFTEST) return;
    closeSplash();
    mainWindow.show();
    mainWindow.focus();
  });
  mainWindow.on('closed', () => { mainWindow = null; });

  const target = DEV_URL || `${APP_ORIGIN}/index.html`;
  writeLog(`Loading UI from ${target}`);
  mainWindow.loadURL(target).catch((err) => writeLog(`loadURL error: ${err.message}`));
}

function buildMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        { label: 'Print Report...', accelerator: 'CmdOrCtrl+P', click: () => mainWindow && mainWindow.webContents.send('menu:command', 'print') },
        { label: 'Save Report as PDF', accelerator: 'CmdOrCtrl+Shift+P', click: () => mainWindow && mainWindow.webContents.send('menu:command', 'pdf') },
        { label: 'Save Report', accelerator: 'CmdOrCtrl+S', click: () => mainWindow && mainWindow.webContents.send('menu:command', 'save') },
        { type: 'separator' },
        { label: 'Open Reports Folder', click: () => openReportsFolder() },
        { label: 'Open Log File', click: () => shell.openPath(logPath) },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    { label: 'Edit', submenu: [{ role: 'undo' }, { role: 'redo' }, { type: 'separator' }, { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }] },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

async function openReportsFolder() {
  const dir = reportsDir();
  await fsp.mkdir(dir, { recursive: true });
  await shell.openPath(dir);
}

// ----------------------------------------------------------------------------- app lifecycle
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    writeLog(`=== BloodCellVision ${app.getVersion()} starting (electron ${process.versions.electron}, ${process.platform} ${process.arch}, packaged=${app.isPackaged}) ===`);
    registerAppProtocol();

    // Camera capture is the only permission the UI needs.
    session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => {
      callback(permission === 'media');
    });

    buildMenu();
    if (!SELFTEST) createSplashWindow();
    createWindow();
    if (SELFTEST) runSelfTestAndExit();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}

// ----------------------------------------------------------------------------- model
const DEFAULT_MODEL_FILE = 'bloodcell.onnx';
const HDF5_MAGIC = Buffer.from([0x89, 0x48, 0x44, 0x46]);

function defaultModelPath() {
  return path.join(bundledModelDir(), DEFAULT_MODEL_FILE);
}

function readModelMeta(modelPath) {
  // A model may ship with a sidecar "<name>.json" describing labels and preprocessing.
  // Without one, the built-in model's description is used.
  const candidates = [
    modelPath.replace(/\.onnx$/i, '.json'),
    path.join(bundledModelDir(), DEFAULT_MODEL_FILE.replace(/\.onnx$/i, '.json')),
  ];
  for (const c of candidates) {
    try {
      const meta = JSON.parse(fs.readFileSync(c, 'utf8'));
      if (Array.isArray(meta.labels) && meta.labels.length > 0) return { ...meta, metaPath: c };
    } catch (_) { /* try next */ }
  }
  throw new Error('Model description file (bloodcell.json) is missing or invalid.');
}

function resolveModelPath() {
  const custom = readSettings().customModelPath;
  if (custom && fs.existsSync(custom)) return { modelPath: custom, isDefault: false };
  return { modelPath: defaultModelPath(), isDefault: true };
}

function validateModelFile(modelPath) {
  if (!fs.existsSync(modelPath)) {
    throw new Error(`Model file not found:\n${modelPath}\n\nReinstalling BloodCellVision restores the built-in model.`);
  }
  const stats = fs.statSync(modelPath);
  if (stats.size < 1024) throw new Error('Model file is too small to be a valid model.');
  const fd = fs.openSync(modelPath, 'r');
  const head = Buffer.alloc(8);
  fs.readSync(fd, head, 0, 8, 0);
  fs.closeSync(fd);
  if (head.subarray(0, 4).equals(HDF5_MAGIC) || /\.(h5|hdf5|keras)$/i.test(modelPath)) {
    throw new Error(
      'This is a Keras model file (.h5/.keras). BloodCellVision runs ONNX models.\n' +
      'Convert it once with tools/convert_h5_to_onnx.py (see README) and select the resulting .onnx file.'
    );
  }
  return stats;
}

ipcMain.handle('model:load', async () => {
  const { modelPath, isDefault } = resolveModelPath();
  try {
    const stats = validateModelFile(modelPath);
    const meta = readModelMeta(modelPath);
    const bytes = await fsp.readFile(modelPath);
    const sha256 = crypto.createHash('sha256').update(bytes).digest('hex');
    writeLog(`Model read: ${modelPath} (${stats.size} bytes, sha256 ${sha256.slice(0, 16)}..., default=${isDefault})`);
    return {
      success: true,
      // Uint8Array view; structured clone copies it to the renderer
      bytes: new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength),
      meta,
      path: modelPath,
      fileName: path.basename(modelPath),
      isDefault,
      size: stats.size,
      sha256,
    };
  } catch (err) {
    writeLog(`Model load failed (${modelPath}): ${err.message}`);
    return { success: false, error: err.message, path: modelPath, isDefault };
  }
});

ipcMain.handle('model:browse', async () => {
  if (!mainWindow) return { success: false, canceled: true };
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Select an ONNX model',
    properties: ['openFile'],
    filters: [
      { name: 'ONNX models', extensions: ['onnx'] },
      { name: 'All files', extensions: ['*'] },
    ],
  });
  if (result.canceled || result.filePaths.length === 0) return { success: false, canceled: true };
  const selected = result.filePaths[0];
  try {
    validateModelFile(selected);
  } catch (err) {
    return { success: false, error: err.message };
  }
  writeSettings({ ...readSettings(), customModelPath: selected });
  writeLog(`Custom model selected: ${selected}`);
  return { success: true, path: selected };
});

ipcMain.handle('model:reset', async () => {
  const s = readSettings();
  delete s.customModelPath;
  writeSettings(s);
  writeLog('Model reset to built-in default');
  return { success: true };
});

ipcMain.handle('model:selftest-samples', async () => {
  // A handful of labelled reference images shipped with the app. Classifying them proves
  // that the model, the runtime and the image pipeline all work on this computer.
  try {
    const dir = path.join(bundledModelDir(), 'selftest');
    const manifest = JSON.parse(await fsp.readFile(path.join(dir, 'expected.json'), 'utf8'));
    const samples = [];
    for (const item of manifest.samples) {
      const data = await fsp.readFile(path.join(dir, item.file));
      samples.push({ name: item.file, expected: item.label, dataUrl: `data:image/jpeg;base64,${data.toString('base64')}` });
    }
    return { success: true, samples, source: manifest.source };
  } catch (err) {
    return { success: false, error: err.message, samples: [] };
  }
});

// ----------------------------------------------------------------------------- misc IPC
ipcMain.handle('app:info', async () => ({
  version: app.getVersion(),
  electron: process.versions.electron,
  chrome: process.versions.chrome,
  node: process.versions.node,
  platform: process.platform,
  arch: process.arch,
  osVersion: process.getSystemVersion ? process.getSystemVersion() : '',
  logPath,
  reportsDir: reportsDir(),
  packaged: app.isPackaged,
}));
ipcMain.handle('app:open-log', async () => { await shell.openPath(logPath); });
ipcMain.handle('app:open-reports-dir', async () => { await openReportsFolder(); });
ipcMain.on('app:log', (_e, level, message) => {
  writeLog(`ui ${String(level)}: ${String(message).slice(0, 4000)}`);
});

// ----------------------------------------------------------------------------- settings shared with the UI
const SETTING_KEYS = new Set(['labConfiguration', 'reportTemplateConfig']);
ipcMain.handle('settings:get', async (_e, key) => {
  if (!SETTING_KEYS.has(key)) return null;
  const value = readSettings()[key];
  return value === undefined ? null : value;
});
ipcMain.handle('settings:set', async (_e, key, value) => {
  if (!SETTING_KEYS.has(key)) return { success: false };
  const s = readSettings();
  if (value === null || value === undefined) delete s[key];
  else s[key] = value;
  writeSettings(s);
  return { success: true };
});

// ----------------------------------------------------------------------------- report archive
// Documents\BloodCellVision Reports\<ReportNo>_<Patient>\
//     report.json     everything needed to reopen and edit the analysis (schema below)
//     original.*      the microscope image exactly as analysed
//     annotated.png   the image with labelled boxes
//     Report.html     the printable report (self-contained)
//     Report.pdf      written when the user exports a PDF
const SCHEMA_VERSION = 2;
const CELL_TYPES = [
  'IG Immature White Cell', 'Basophil', 'Eosinophil', 'Erythroblast',
  'Lymphocyte', 'Monocyte', 'Neutrophil', 'Platelet',
];

function safeName(value, fallback) {
  const clean = String(value || '').replace(/[<>:"/\\|?*\x00-\x1f]/g, ' ').replace(/\s+/g, ' ').trim().replace(/[. ]+$/, '');
  return (clean || fallback).slice(0, 60);
}

async function writeFileAtomic(filePath, data, encoding) {
  const tmp = `${filePath}.tmp`;
  await fsp.writeFile(tmp, data, encoding);
  await fsp.rename(tmp, filePath);
}

function decodeDataUrl(dataUrl) {
  const match = /^data:image\/([a-zA-Z0-9.+-]+);base64,(.+)$/s.exec(dataUrl || '');
  if (!match) return null;
  const ext = match[1] === 'jpeg' ? 'jpg' : match[1].replace(/[^a-z0-9]/gi, '').toLowerCase() || 'png';
  return { ext, buffer: Buffer.from(match[2], 'base64') };
}

async function readImageAsDataUrl(filePath) {
  const ext = path.extname(filePath).slice(1).toLowerCase();
  const data = await fsp.readFile(filePath);
  return `data:image/${ext === 'jpg' ? 'jpeg' : ext};base64,${data.toString('base64')}`;
}

// Only folders inside the archive may be read, written or deleted through IPC.
function resolveReportFolder(folderPath) {
  const base = reportsDir();
  let resolved = path.isAbsolute(folderPath) ? folderPath : path.join(base, folderPath);
  resolved = path.normalize(resolved);
  if (/\.html?$/i.test(resolved)) resolved = path.dirname(resolved);
  const rel = path.relative(base, resolved);
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error('Report folder is outside the BloodCellVision Reports directory.');
  }
  return resolved;
}

// Report numbers look like BCV-20261111-003: date of the analysis plus a running number for that day.
async function allocateReportId() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const prefix = `BCV-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-`;
  let max = 0;
  try {
    for (const name of await fsp.readdir(reportsDir())) {
      if (name.startsWith(prefix)) {
        const n = parseInt(name.slice(prefix.length), 10);
        if (Number.isFinite(n) && n > max) max = n;
      }
    }
  } catch (_) { /* archive folder does not exist yet */ }
  max = Math.max(max, allocateReportId.lastByPrefix[prefix] || 0) + 1;
  allocateReportId.lastByPrefix[prefix] = max;
  return { reportId: `${prefix}${String(max).padStart(3, '0')}`, createdAt: now.toISOString() };
}
allocateReportId.lastByPrefix = {};

ipcMain.handle('archive:allocate', async () => allocateReportId());

ipcMain.handle('archive:save', async (_event, payload) => {
  try {
    const { record, html, images } = payload;
    if (!record || !record.reportId) throw new Error('Report number is missing.');
    const archiveDir = reportsDir();
    await fsp.mkdir(archiveDir, { recursive: true });

    let folder;
    if (payload.folderPath) {
      folder = resolveReportFolder(payload.folderPath);
    } else {
      const id = safeName(record.reportId, 'Report');
      folder = path.join(archiveDir, `${id}_${safeName(record.patientInfo && record.patientInfo.name, 'Unnamed')}`);
      // never write into a folder that belongs to another report
      for (let i = 2; fs.existsSync(folder); i++) folder = path.join(archiveDir, `${id}_${i}`);
    }
    await fsp.mkdir(folder, { recursive: true });

    // keep what an earlier save recorded about the files in this folder
    let previous = {};
    try { previous = JSON.parse(await fsp.readFile(path.join(folder, 'report.json'), 'utf8')); } catch (_) { /* first save */ }
    const files = { ...(previous.files || {}) };

    if (images && images.original) {
      const decoded = decodeDataUrl(images.original);
      if (decoded) {
        files.original = `original.${decoded.ext}`;
        await writeFileAtomic(path.join(folder, files.original), decoded.buffer);
      }
    }
    if (images && images.annotated) {
      const decoded = decodeDataUrl(images.annotated);
      if (decoded) {
        files.annotated = `annotated.${decoded.ext}`;
        await writeFileAtomic(path.join(folder, files.annotated), decoded.buffer);
      }
    }
    if (typeof html === 'string' && html.length > 0) {
      files.html = 'Report.html';
      await writeFileAtomic(path.join(folder, files.html), html, 'utf8');
    }
    // a PDF exported before this edit no longer matches the report
    if (files.pdf) {
      await fsp.rm(path.join(folder, files.pdf), { force: true });
      delete files.pdf;
    }

    const updatedAt = new Date().toISOString();
    const stored = {
      schemaVersion: SCHEMA_VERSION,
      app: 'BloodCellVision',
      appVersion: app.getVersion(),
      reportId: record.reportId,
      createdAt: record.createdAt || previous.createdAt || updatedAt,
      updatedAt,
      patientInfo: record.patientInfo || {},
      lab: record.lab || {},
      analysis: record.analysis || {},
      files,
    };
    await writeFileAtomic(path.join(folder, 'report.json'), JSON.stringify(stored, null, 2), 'utf8');
    return { success: true, folderPath: folder, updatedAt };
  } catch (error) {
    writeLog(`Archive save failed: ${error.stack || error}`);
    return { success: false, error: error.message };
  }
});

// Reports written by versions 1.x / 2.0 (analysis_data.json) are read as the current schema.
function fromLegacy(data, folderName, files) {
  let perType = data.cellCounts && data.cellCounts.detectedCells;
  while (perType && perType.detectedCells && typeof perType.detectedCells === 'object') perType = perType.detectedCells;
  const reportFile = files.find((f) => f.startsWith('Report_') && f.endsWith('.html'));
  const reportId = (data.report && data.report.reportId)
    || (reportFile ? reportFile.replace('Report_', '').replace('.html', '') : folderName.slice(0, 40));
  const cells = (data.detectedCells || []).filter((c) => c && CELL_TYPES.includes(c.type)).map((c, i) => ({
    id: i + 1,
    type: c.type,
    aiType: c.type,
    confidence: Number(c.confidence) || 0,
    probabilities: i === 0 ? data.probabilities : undefined,
    // old reports stored a dummy box; the whole image is the cell
  }));
  const created = data.analysisDate && !Number.isNaN(new Date(data.analysisDate).getTime())
    ? new Date(data.analysisDate).toISOString() : null;
  return {
    schemaVersion: 1,
    legacy: true,
    reportId,
    createdAt: created,
    updatedAt: created,
    patientInfo: data.patientInfo || {},
    lab: (data.report && data.report.labConfig) || {},
    analysis: {
      analysisDate: created,
      analysisMode: 'single',
      detectedCells: cells,
      recommendations: data.recommendations || [],
      possibleConditions: data.possibleConditions || [],
      doctorNotes: data.doctorNotes || '',
      notes: data.notes,
      inferenceMs: data.inferenceMs,
      modelInfo: data.modelInfo,
      probabilities: data.probabilities,
    },
    files: {},
    legacyImage: typeof data.image === 'string' && data.image.startsWith('data:image/') ? data.image : null,
  };
}

async function readReportFolder(folder) {
  const files = await fsp.readdir(folder);
  let record = null;
  if (files.includes('report.json')) {
    record = JSON.parse(await fsp.readFile(path.join(folder, 'report.json'), 'utf8'));
  } else if (files.includes('analysis_data.json')) {
    record = fromLegacy(JSON.parse(await fsp.readFile(path.join(folder, 'analysis_data.json'), 'utf8')), path.basename(folder), files);
  }
  return { record, files };
}

ipcMain.handle('archive:list', async () => {
  try {
    const archiveDir = reportsDir();
    if (!fs.existsSync(archiveDir)) return { success: true, reports: [], archiveDir };
    const reports = [];
    for (const name of await fsp.readdir(archiveDir)) {
      const folder = path.join(archiveDir, name);
      try {
        const stat = await fsp.stat(folder);
        if (!stat.isDirectory()) continue;
        const { record } = await readReportFolder(folder);
        if (!record) continue;
        const cells = (record.analysis && record.analysis.detectedCells) || [];
        const counts = {};
        for (const c of cells) counts[c.type] = (counts[c.type] || 0) + 1;
        const ordered = Object.entries(counts).sort((a, b) => b[1] - a[1]);
        const created = record.createdAt || stat.birthtime.toISOString();
        reports.push({
          id: name,
          folderPath: folder,
          reportId: record.reportId || name,
          patientName: (record.patientInfo && record.patientInfo.name) || '',
          patientId: (record.patientInfo && record.patientInfo.patientId) || '',
          age: (record.patientInfo && record.patientInfo.age) || '',
          gender: (record.patientInfo && record.patientInfo.gender) || '',
          createdAt: created,
          updatedAt: record.updatedAt || created,
          cellCount: cells.length,
          cellType: ordered.length ? ordered[0][0] : '',
          summary: cells.length <= 1
            ? (ordered.length ? ordered[0][0] : 'No cell')
            : ordered.map(([t, n]) => `${t} ${n}`).join(', '),
          legacy: !!record.legacy,
        });
      } catch (err) {
        writeLog(`Archive: skipped "${name}": ${err.message}`);
      }
    }
    reports.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return { success: true, reports, archiveDir };
  } catch (error) {
    writeLog(`Archive list failed: ${error.stack || error}`);
    return { success: false, reports: [], error: error.message };
  }
});

ipcMain.handle('archive:load', async (_event, folderPath) => {
  try {
    const folder = resolveReportFolder(folderPath);
    const { record, files } = await readReportFolder(folder);
    if (!record) return { success: false, error: 'This folder does not contain a BloodCellVision report.' };

    let image = null;
    let hasOriginal = false;
    const original = (record.files && record.files.original && files.includes(record.files.original))
      ? record.files.original
      : files.find((f) => /^original\.(png|jpe?g|webp)$/i.test(f));
    if (original) {
      image = await readImageAsDataUrl(path.join(folder, original));
      hasOriginal = true;
    } else if (record.legacyImage) {
      image = record.legacyImage;
    } else {
      const legacyFile = files.find((f) => /^analyzed_image\.(png|jpe?g|webp)$/i.test(f));
      if (legacyFile) image = await readImageAsDataUrl(path.join(folder, legacyFile));
    }
    delete record.legacyImage;
    if (!record.createdAt) record.createdAt = (await fsp.stat(folder)).birthtime.toISOString();
    return { success: true, record, image, hasOriginal, folderPath: folder };
  } catch (error) {
    writeLog(`Archive load failed: ${error.stack || error}`);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('archive:delete', async (_event, folderPath) => {
  try {
    const folder = resolveReportFolder(folderPath);
    // goes to the Recycle Bin, so a mistaken delete can be undone
    await shell.trashItem(folder);
    writeLog(`Report moved to the Recycle Bin: ${folder}`);
    return { success: true };
  } catch (error) {
    writeLog(`Archive delete failed: ${error.stack || error}`);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('archive:open-folder', async (_event, folderPath) => {
  const folder = resolveReportFolder(folderPath);
  const problem = await shell.openPath(folder);
  return { success: !problem, error: problem || undefined };
});

// ----------------------------------------------------------------------------- printing and PDF
// The report document is loaded in a hidden window so that what is printed is exactly the
// report, with its own page size and margins, and nothing of the application screen.
async function withReportWindow(html, task) {
  const tmpDir = path.join(app.getPath('userData'), 'print');
  await fsp.mkdir(tmpDir, { recursive: true });
  const tmpFile = path.join(tmpDir, `report-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.html`);
  await fsp.writeFile(tmpFile, html, 'utf8');
  const win = new BrowserWindow({
    show: false,
    width: 900,
    height: 1200,
    webPreferences: { javascript: false, nodeIntegration: false, contextIsolation: true, sandbox: true },
  });
  try {
    await win.loadFile(tmpFile);
    // give embedded images a moment to decode before the page is laid out for print
    await new Promise((r) => setTimeout(r, 250));
    return await task(win);
  } finally {
    if (!win.isDestroyed()) win.destroy();
    fsp.rm(tmpFile, { force: true }).catch(() => {});
  }
}

// Printing uses a visible preview window: Windows prints a window that is on screen
// reliably, whereas a hidden one can produce blank pages or no dialog at all.
let printWindow = null;
ipcMain.handle('report:print', async (_event, payload) => {
  const html = typeof payload === 'string' ? payload : payload.html;
  const options = typeof payload === 'string' ? {} : payload;
  let tmpFile = null;
  try {
    if (printWindow && !printWindow.isDestroyed()) printWindow.destroy();
    const tmpDir = path.join(app.getPath('userData'), 'print');
    await fsp.mkdir(tmpDir, { recursive: true });
    tmpFile = path.join(tmpDir, `report-${Date.now()}.html`);
    await fsp.writeFile(tmpFile, html, 'utf8');

    printWindow = new BrowserWindow({
      width: 900,
      height: 1000,
      title: 'Print Report',
      parent: mainWindow || undefined,
      autoHideMenuBar: true,
      show: false,
      backgroundColor: '#e5e7eb',
      webPreferences: { javascript: false, nodeIntegration: false, contextIsolation: true, sandbox: true },
    });
    const win = printWindow;
    win.setMenu(null);
    await win.loadFile(tmpFile);
    win.show();
    // let the page paint before the print dialog opens
    await new Promise((r) => setTimeout(r, 400));
    if (win.isDestroyed()) return { success: false, canceled: true };

    const result = await new Promise((resolve) => {
      let settled = false;
      const finish = (value) => { if (!settled) { settled = true; resolve(value); } };
      win.once('closed', () => finish({ success: false, canceled: true }));
      win.webContents.print(
        {
          silent: false,
          printBackground: true,
          landscape: options.landscape === true,
          pageSize: options.pageSize === 'Letter' ? 'Letter' : 'A4',
        },
        (success, failureReason) => {
          const reason = String(failureReason || '');
          finish({ success, canceled: !success && /cancel/i.test(reason), error: success ? undefined : reason || 'unknown error' });
        }
      );
    });
    writeLog(`Print result: ${JSON.stringify(result)}`);
    return result;
  } catch (error) {
    writeLog(`Print failed: ${error.stack || error}`);
    return { success: false, error: error.message };
  } finally {
    if (printWindow && !printWindow.isDestroyed()) printWindow.destroy();
    printWindow = null;
    if (tmpFile) fsp.rm(tmpFile, { force: true }).catch(() => {});
  }
});

ipcMain.handle('report:pdf', async (_event, payload) => {
  try {
    const { html, folderPath, fileName, open } = payload;
    const pdfOptions = { printBackground: true, preferCSSPageSize: true };
    if (CHROME_MAJOR < 131) {
      // Older Chromium (Windows 7 build) ignores the page-footer rules in the report's CSS,
      // so the footer with report number and page count is added here instead.
      const esc = (v) => String(v || '').replace(/[<>&"]/g, '');
      pdfOptions.displayHeaderFooter = true;
      pdfOptions.headerTemplate = '<span></span>';
      pdfOptions.footerTemplate =
        `<div style="width:100%;font-size:7.5px;color:#6b7280;font-family:Segoe UI,Arial,sans-serif;padding:0 12mm;display:flex;justify-content:space-between;">` +
        `<span>${esc(payload.footerText)}</span><span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span></div>`;
    }
    const pdf = await withReportWindow(html, (win) => win.webContents.printToPDF(pdfOptions));
    let target;
    if (folderPath) {
      const folder = resolveReportFolder(folderPath);
      target = path.join(folder, 'Report.pdf');
      await fsp.writeFile(target, pdf);
      try {
        const recordPath = path.join(folder, 'report.json');
        const record = JSON.parse(await fsp.readFile(recordPath, 'utf8'));
        record.files = { ...(record.files || {}), pdf: 'Report.pdf' };
        await writeFileAtomic(recordPath, JSON.stringify(record, null, 2), 'utf8');
      } catch (_) { /* legacy folder without report.json */ }
    } else {
      const choice = await dialog.showSaveDialog(mainWindow, {
        title: 'Save report as PDF',
        defaultPath: path.join(app.getPath('documents'), `${safeName(fileName, 'Report')}.pdf`),
        filters: [{ name: 'PDF', extensions: ['pdf'] }],
      });
      if (choice.canceled || !choice.filePath) return { success: false, canceled: true };
      target = choice.filePath;
      await fsp.writeFile(target, pdf);
    }
    if (open !== false && !process.env.BCV_NO_OPEN) shell.openPath(target);
    return { success: true, filePath: target };
  } catch (error) {
    writeLog(`PDF export failed: ${error.stack || error}`);
    return { success: false, error: error.message };
  }
});

// ----------------------------------------------------------------------------- self-test (developer / CI)
// "BloodCellVision.exe --selftest [--images <dir>] [--out <file.json>]"
// Loads the real UI in a hidden window, loads the model through the same code path the
// app uses, classifies labelled images and writes a JSON report, then exits.
function argValue(flag) {
  const i = process.argv.indexOf(flag);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : null;
}

async function runSelfTestAndExit() {
  const outPath = argValue('--out') || path.join(app.getPath('userData'), 'selftest-result.json');
  const imagesDir = argValue('--images');
  const limit = Number(argValue('--limit') || 0);
  let exitCode = 1;
  try {
    await new Promise((resolve, reject) => {
      mainWindow.webContents.once('did-finish-load', resolve);
      mainWindow.webContents.once('did-fail-load', (_e, code, desc) => reject(new Error(`load failed: ${desc}`)));
    });
    const wc = mainWindow.webContents;
    const waitFor = async (expr, timeoutMs) => {
      const start = Date.now();
      while (Date.now() - start < timeoutMs) {
        if (await wc.executeJavaScript(expr)) return true;
        await new Promise((r) => setTimeout(r, 200));
      }
      throw new Error(`timeout waiting for: ${expr}`);
    };
    await waitFor('typeof window.__bcv === "object"', 30000);
    const status = await wc.executeJavaScript('window.__bcv.loadModel()');
    if (!status.loaded) throw new Error(`model did not load: ${status.error}`);

    let result;
    if (imagesDir) {
      // Labels come from the file name prefix (e.g. "EO_123.jpg").
      const prefixMap = JSON.parse(await fsp.readFile(path.join(imagesDir, '..', 'prefix_map.json'), 'utf8').catch(() => '{}'));
      let files = (await fsp.readdir(imagesDir)).filter((f) => /\.(jpe?g|png|bmp)$/i.test(f)).sort();
      if (limit > 0) {
        // even spread over the sorted list so every class is represented
        const step = Math.max(1, Math.floor(files.length / limit));
        files = files.filter((_f, i) => i % step === 0).slice(0, limit);
      }
      const rows = [];
      for (const f of files) {
        const data = await fsp.readFile(path.join(imagesDir, f));
        const mime = /\.png$/i.test(f) ? 'png' : 'jpeg';
        const dataUrl = `data:image/${mime};base64,${data.toString('base64')}`;
        const r = await wc.executeJavaScript(`window.__bcv.classifyDataUrl(${JSON.stringify(dataUrl)})`);
        const prefix = f.split('_')[0];
        rows.push({ file: f, expected: prefixMap[prefix] || null, predicted: r.label, confidence: r.confidence, ms: r.inferenceMs });
      }
      const labelled = rows.filter((r) => r.expected);
      const correct = labelled.filter((r) => r.expected === r.predicted).length;
      result = { mode: 'directory', status, total: rows.length, labelled: labelled.length, correct, accuracy: labelled.length ? correct / labelled.length : null, rows };
    } else {
      const r = await wc.executeJavaScript('window.__bcv.runSelfTest()');
      result = { mode: 'bundled', status, ...r };
    }
    await fsp.writeFile(outPath, JSON.stringify(result, null, 2));
    writeLog(`Self-test finished: ${outPath}`);
    exitCode = result.mode === 'bundled' ? (result.passed ? 0 : 2) : 0;
  } catch (err) {
    writeLog(`Self-test failed: ${err.stack || err}`);
    try { await fsp.writeFile(outPath, JSON.stringify({ error: String(err && err.message || err) }, null, 2)); } catch (_) {}
  }
  app.exit(exitCode);
}
