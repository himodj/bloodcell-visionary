
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

// Create a package.json backup
function backupPackageJson() {
  const packageJsonPath = path.join(process.cwd(), 'package.json');
  const backupPath = path.join(process.cwd(), 'package.json.backup');
  
  try {
    if (fs.existsSync(packageJsonPath)) {
      fs.copyFileSync(packageJsonPath, backupPath);
      console.log('Created package.json backup');
    }
  } catch (err) {
    console.error('Error creating package.json backup:', err);
  }
}

// Main function
async function main() {
  try {
    // Create backup
    backupPackageJson();
    
    // First, ensure axios is installed with the exact version
    console.log('Installing axios@1.8.3...');
    await runCommand('npm install axios@1.8.3 --save');
    console.log('Axios installed successfully.');
    
    // Check if axios is actually in node_modules
    const axiosPath = path.join(process.cwd(), 'node_modules', 'axios');
    if (fs.existsSync(axiosPath)) {
      console.log('Verified axios is installed in:', axiosPath);
    } else {
      console.error('WARNING: axios not found in node_modules after installation!');
      // Try installing with force
      await runCommand('npm install axios@1.8.3 --save --force');
      if (fs.existsSync(axiosPath)) {
        console.log('Forced installation successful, axios is now present');
      } else {
        console.error('ERROR: axios installation failed even with --force');
      }
    }
    
    // Install other dependencies
    console.log('Installing other dependencies...');
    await runCommand('npm install');
    
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
