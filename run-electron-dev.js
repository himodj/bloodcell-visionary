
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('Checking electron directory...');
if (!fs.existsSync(path.join(__dirname, 'electron'))) {
  console.error('Electron directory not found. Make sure you are in the project root.');
  process.exit(1);
}

console.log('Starting Electron app in development mode...');

// Start Vite development server
console.log('Starting Vite development server...');
const viteProcess = spawn('npx', ['vite', '--port', '8080'], {
  stdio: 'inherit',
  shell: true
});

viteProcess.on('error', (err) => {
  console.error('Failed to start Vite:', err);
});

// Once Vite is running, we start the Electron app
let electronProcess = null;

setTimeout(() => {
  console.log('Starting Electron app...');
  electronProcess = spawn('npm', ['run', 'dev'], {
    cwd: path.join(__dirname, 'electron'),
    stdio: 'inherit',
    shell: true
  });

  electronProcess.on('error', (err) => {
    console.error('Failed to start Electron app:', err);
  });
}, 2000); // Give Vite 2 seconds to start

// Handle process termination
process.on('SIGINT', () => {
  console.log('Shutting down...');
  if (viteProcess) viteProcess.kill();
  if (electronProcess) electronProcess.kill();
  process.exit(0);
});
