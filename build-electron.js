
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

// Check if model.h5 exists
const modelPath = path.join(__dirname, 'model.h5');
if (!fs.existsSync(modelPath)) {
  console.warn('\x1b[33m%s\x1b[0m', 'Warning: model.h5 file not found in project root!');
  console.warn('\x1b[33m%s\x1b[0m', 'The application requires model.h5 file to be present in the root directory.');
  console.warn('\x1b[33m%s\x1b[0m', 'Please add model.h5 to the project root before distribution.');
  console.warn('\x1b[33m%s\x1b[0m', 'Continuing with build process...\n');
}

// Change directory to electron folder
process.chdir(path.join(__dirname, 'electron'));

// Install dependencies if needed
console.log('Installing dependencies...');
exec('npm install', (error, stdout, stderr) => {
  if (error) {
    console.error(`Error installing dependencies: ${error}`);
    return;
  }
  
  console.log('Building Electron app...');
  // Build the Electron app
  const buildProcess = exec('npm run build', (error, stdout, stderr) => {
    if (error) {
      console.error(`Error building Electron app: ${error}`);
      return;
    }
    
    console.log('\x1b[32m%s\x1b[0m', '\nBuild completed successfully!');
    console.log('\x1b[32m%s\x1b[0m', 'The packaged application is in the electron-dist folder.');
    console.log('\x1b[32m%s\x1b[0m', 'You can distribute this package to other computers.');
  });

  // Forward stdout and stderr to console
  buildProcess.stdout.on('data', (data) => {
    console.log(data);
  });

  buildProcess.stderr.on('data', (data) => {
    console.error(data);
  });
});
