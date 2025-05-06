
import { exec } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import http from 'http';

// Get the current file's directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Function to run a command and return a promise
function runCommand(command, cwd = null) {
  const options = cwd ? { cwd } : undefined;
  console.log(`Running command${cwd ? ` in ${cwd}` : ''}: ${command}`);
  
  return new Promise((resolve, reject) => {
    exec(command, options, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error executing command: ${error.message}`);
        console.error(stderr);
        reject(error);
        return;
      }
      console.log(stdout);
      resolve(stdout);
    });
  });
}

// Function to check if Vite server is responding
function isViteServerReady() {
  return new Promise((resolve) => {
    http.get('http://localhost:8080', (response) => {
      resolve(response.statusCode === 200);
    }).on('error', () => {
      resolve(false);
    });
  });
}

// Wait for Vite server to be ready
async function waitForViteServer(maxAttempts = 30, interval = 1000) {
  console.log('Waiting for Vite server to be ready...');
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const ready = await isViteServerReady();
    if (ready) {
      console.log(`Vite server is ready after ${attempt} attempt(s)`);
      return true;
    }
    
    console.log(`Waiting for Vite server (attempt ${attempt}/${maxAttempts})...`);
    await new Promise(resolve => setTimeout(resolve, interval));
  }
  
  console.error('Vite server did not become ready within the timeout period');
  return false;
}

// Main function
async function main() {
  try {
    // Now handle electron directory dependencies
    const electronDir = path.join(__dirname, 'electron');
    console.log('Checking electron directory...');
    
    // Ensure electron directory exists
    if (!fs.existsSync(electronDir)) {
      console.log('Creating electron directory...');
      fs.mkdirSync(electronDir, { recursive: true });
    }
    
    // Check if model.h5 file exists in various locations
    const modelPath = path.join(__dirname, 'model.h5');
    const userModelPath = 'C:\\Users\\H\\Desktop\\app\\model.h5';
    
    if (fs.existsSync(modelPath)) {
      console.log('Model found at:', modelPath);
    } else if (fs.existsSync(userModelPath)) {
      console.log('Model found at:', userModelPath);
    } else {
      console.log('Model not found. You will need to browse for it in the application.');
    }
    
    console.log('Starting Electron app in development mode...');
    
    // Use npm run dev to ensure we use the correct Vite command from package.json
    console.log('Starting Vite development server...');
    const viteProcess = exec('npm run dev -- --port 8080', { 
      cwd: __dirname,
      env: process.env
    });
    
    // Forward stdout and stderr to console
    viteProcess.stdout.on('data', (data) => {
      console.log(`[Vite] ${data}`);
    });
    
    viteProcess.stderr.on('data', (data) => {
      console.error(`[Vite Error] ${data}`);
    });
    
    // Wait for Vite server to be fully ready before starting Electron
    const isReady = await waitForViteServer();
    if (!isReady) {
      console.error('Timed out waiting for Vite server to be ready. Electron may fail to connect.');
    }
    
    // Start the Electron app in development mode
    const env = Object.assign({}, process.env);
    env.NODE_ENV = 'development';
    
    // Run npm run dev in electron directory
    const electronProcess = exec('npm run dev', { 
      cwd: electronDir,
      env 
    });

    // Forward stdout and stderr to console
    electronProcess.stdout.on('data', (data) => {
      console.log(`[Electron] ${data}`);
    });

    electronProcess.stderr.on('data', (data) => {
      console.error(`[Electron Error] ${data}`);
    });
  } catch (error) {
    console.error('Error in development setup:', error);
  }
}

// Run the main function
main();
