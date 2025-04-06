
import { exec } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

// Get the current file's directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Change directory to electron folder
const electronDir = path.join(__dirname, 'electron');
process.chdir(electronDir);

console.log('Current directory:', process.cwd());

// Function to run a command and return a promise
function runCommand(command) {
  console.log(`Running command: ${command}`);
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
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
    process.chdir(path.join(__dirname));
    await runCommand('npm install');
    
    // Now return to electron directory and install its dependencies
    process.chdir(electronDir);
    console.log('Installing electron dependencies...');
    await runCommand('npm install');
    
    // Specifically ensure axios is installed
    console.log('Installing axios@1.8.3...');
    await runCommand('npm install axios@1.8.3 --save');
    
    console.log('Starting Electron app in development mode...');
    
    // Set NODE_ENV environment variable before running the command
    const env = Object.assign({}, process.env);
    env.NODE_ENV = 'development';
    
    // Start the Electron app in development mode with environment variable set
    const electronProcess = exec('npm run dev', { env }, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error starting Electron app: ${error}`);
        return;
      }
    });

    // Forward stdout and stderr to console
    electronProcess.stdout.on('data', (data) => {
      console.log(data);
    });

    electronProcess.stderr.on('data', (data) => {
      console.error(data);
    });
  } catch (error) {
    console.error('Error in development setup:', error);
  }
}

// Run the main function
main();
