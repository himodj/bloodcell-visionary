
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
  
  console.log('Starting Electron app in development mode...');
  // Start the Electron app in development mode
  const electronProcess = exec('npm run dev', (error, stdout, stderr) => {
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
