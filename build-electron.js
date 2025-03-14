
const { exec } = require('child_process');
const path = require('path');

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
  });

  // Forward stdout and stderr to console
  buildProcess.stdout.on('data', (data) => {
    console.log(data);
  });

  buildProcess.stderr.on('data', (data) => {
    console.error(data);
  });
});
