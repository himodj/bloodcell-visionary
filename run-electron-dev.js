
import { exec } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

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

// Main function
async function main() {
  try {
    // First, ensure all dependencies are installed in the root directory
    console.log('Installing root dependencies...');
    await runCommand('npm install', __dirname);
    
    // Install vite locally to ensure it's available
    console.log('Installing vite locally...');
    await runCommand('npm install vite --save-dev', __dirname);
    
    // Now handle electron directory dependencies
    const electronDir = path.join(__dirname, 'electron');
    console.log('Installing electron dependencies...');
    
    // Ensure electron directory exists
    if (!fs.existsSync(electronDir)) {
      console.log('Creating electron directory...');
      fs.mkdirSync(electronDir, { recursive: true });
    }
    
    // Change to electron directory and install dependencies
    await runCommand('npm install', electronDir);
    
    // Specifically ensure axios is installed in electron directory
    console.log('Installing axios@1.8.3 in electron directory...');
    await runCommand('npm install axios@1.8.3 --save', electronDir);
    
    console.log('Starting Electron app in development mode...');
    
    // Start Vite development server directly using npx to ensure it's found
    console.log('Starting Vite development server...');
    const viteProcess = exec('npx vite', { 
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
    
    // Wait a bit for Vite to start
    await new Promise(resolve => setTimeout(resolve, 3000));
    
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
