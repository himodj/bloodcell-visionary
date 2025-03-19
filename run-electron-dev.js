
import { exec } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the current file's directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Change directory to electron folder
process.chdir(path.join(__dirname, 'electron'));

// First, ensure axios is installed specifically
console.log('Ensuring axios is installed correctly...');
exec('npm install axios@1.8.3 --save', (error, stdout, stderr) => {
  if (error) {
    console.error(`Error installing axios: ${error}`);
    console.error(stderr);
    return;
  }
  
  console.log(stdout);
  console.log('Axios installed successfully.');
  
  // Now install other dependencies
  console.log('Installing other dependencies...');
  exec('npm install', (error, stdout, stderr) => {
    if (error) {
      console.error(`Error installing dependencies: ${error}`);
      return;
    }
    
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
  });
});
