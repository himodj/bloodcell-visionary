// Builds release/BloodCellVision-Setup-<version>.exe from release/win-unpacked.
//
// Uses NSIS directly (the copy electron-builder distributes), so the installer can be built
// on Windows, macOS or Linux without Wine and without administrator rights.
import { execFileSync } from 'node:child_process';
import { createWriteStream, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync, chmodSync } from 'node:fs';
import { homedir, platform, tmpdir } from 'node:os';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Readable } from 'node:stream';
import { finished } from 'node:stream/promises';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
// BCV_APP_DIR / BCV_OUT_SUFFIX select another packaged folder, e.g. the Windows 7 builds.
const appDir = join(root, 'release', process.env.BCV_APP_DIR || 'win-unpacked');
const outFile = join(root, 'release', `BloodCellVision-Setup-${pkg.version}${process.env.BCV_OUT_SUFFIX || ''}.exe`);
const NSIS_VERSION = '3.0.4.1';
const NSIS_URL = `https://github.com/electron-userland/electron-builder-binaries/releases/download/nsis-${NSIS_VERSION}/nsis-${NSIS_VERSION}.7z`;

if (!existsSync(join(appDir, 'BloodCellVision.exe'))) {
  console.error(appDir + ' is missing. Run "npm run dist" (it packages the app first).');
  process.exit(1);
}

function cacheDir() {
  if (process.env.ELECTRON_BUILDER_CACHE) return process.env.ELECTRON_BUILDER_CACHE;
  if (platform() === 'win32') return join(process.env.LOCALAPPDATA || join(homedir(), 'AppData', 'Local'), 'electron-builder', 'Cache');
  if (platform() === 'darwin') return join(homedir(), 'Library', 'Caches', 'electron-builder');
  return join(process.env.XDG_CACHE_HOME || join(homedir(), '.cache'), 'electron-builder');
}

async function ensureNsis() {
  const dir = join(cacheDir(), 'nsis', `nsis-${NSIS_VERSION}`);
  if (!existsSync(join(dir, 'Include', 'MUI2.nsh'))) {
    console.log(`Downloading NSIS ${NSIS_VERSION}...`);
    mkdirSync(dir, { recursive: true });
    const archive = join(tmpdir(), `nsis-${NSIS_VERSION}-${Date.now()}.7z`);
    const res = await fetch(NSIS_URL);
    if (!res.ok || !res.body) throw new Error(`NSIS download failed: HTTP ${res.status}`);
    await finished(Readable.fromWeb(res.body).pipe(createWriteStream(archive)));
    const { path7za } = require('7zip-bin');
    if (platform() !== 'win32') chmodSync(path7za, 0o755);
    execFileSync(path7za, ['x', '-y', `-o${dir}`, archive], { stdio: 'ignore' });
  }
  const exe = platform() === 'win32' ? join(dir, 'Bin', 'makensis.exe')
    : platform() === 'darwin' ? join(dir, 'mac', 'makensis')
    : join(dir, 'linux', 'makensis');
  if (platform() !== 'win32') chmodSync(exe, 0o755);
  return { exe, dir };
}

// --- file lists: explicit, so the uninstaller only ever deletes what was installed
function walk(dir) {
  const files = [];
  const dirs = [];
  for (const name of readdirSync(dir).sort()) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      dirs.push(full);
      const sub = walk(full);
      files.push(...sub.files);
      dirs.push(...sub.dirs);
    } else {
      files.push(full);
    }
  }
  return { files, dirs };
}
const win = (p) => p.split(sep).join('\\');
const { files, dirs } = walk(appDir);
const skip = new Set(['app-update.yml']); // auto-update metadata is not used
const kept = files.filter((f) => !skip.has(f.split(sep).pop()));

let install = '';
let lastDir = null;
for (const f of kept) {
  const relDir = win(relative(appDir, dirname(f)));
  if (relDir !== lastDir) {
    install += `SetOutPath "$INSTDIR${relDir ? '\\' + relDir : ''}"\n`;
    lastDir = relDir;
  }
  install += `File "${f}"\n`;
}
let uninstall = '';
for (const f of kept) uninstall += `Delete "$INSTDIR\\${win(relative(appDir, f))}"\n`;
for (const d of dirs.sort((a, b) => b.length - a.length)) uninstall += `RMDir "$INSTDIR\\${win(relative(appDir, d))}"\n`;

const work = join(root, 'release', '.nsis');
mkdirSync(work, { recursive: true });
writeFileSync(join(work, 'files-install.nsh'), install);
writeFileSync(join(work, 'files-uninstall.nsh'), uninstall);

const { exe, dir } = await ensureNsis();
const define = platform() === 'win32' ? '/D' : '-D';
const args = [
  platform() === 'win32' ? '/V2' : '-V2',
  `${define}APP_VERSION=${pkg.version}`,
  `${define}OUT_FILE=${outFile}`,
  `${define}ICON_FILE=${join(root, 'build', 'icon.ico')}`,
  `${define}LICENSE_FILE=${join(root, 'LICENSE.txt')}`,
  `${define}FILES_INSTALL=${join(work, 'files-install.nsh')}`,
  `${define}FILES_UNINSTALL=${join(work, 'files-uninstall.nsh')}`,
  join(root, 'build', 'installer.nsi'),
];
console.log(`Building installer with NSIS (${kept.length} files)... this takes a minute.`);
execFileSync(exe, args, { stdio: 'inherit', env: { ...process.env, NSISDIR: dir } });
const mb = (statSync(outFile).size / 1048576).toFixed(1);
console.log(`\nInstaller ready: ${outFile} (${mb} MB)`);
