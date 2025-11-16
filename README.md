# BloodCellVision - AI-Powered Blood Cell Analysis System

## About

BloodCellVision is a professional desktop application for analyzing blood cell images using AI-powered machine learning models. The system provides accurate cell detection, classification, and comprehensive reporting capabilities for medical laboratories.

## Features

- **AI-Powered Analysis**: Advanced machine learning models for blood cell detection and classification
- **Patient Management**: Track and manage patient information and analysis history
- **Comprehensive Reporting**: Generate professional PDF reports with customizable templates
- **Laboratory Configuration**: Customize lab information, logos, and report templates
- **Data Archiving**: Automatic saving and retrieval of patient reports

## Technologies

This project is built with:

- **Electron**: Desktop application framework
- **React**: UI framework
- **TypeScript**: Type-safe development
- **Vite**: Fast build tool
- **TailwindCSS**: Utility-first styling
- **Python/TensorFlow**: AI model backend
- **shadcn-ui**: Component library

## Development

### Prerequisites

- Node.js & npm ([install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating))
- Python 3.x
- TensorFlow and required Python packages

### Setup

```sh
# Install dependencies
npm install

# Start development server
npm run dev

# Build Electron app
node build-electron.cjs
```

### Running in Development Mode

```sh
# Start web development server
npm run dev

# Run Electron in development
node run-electron-dev.js
```

## Building for Production

```sh
# Build the complete Electron application
node build-electron.cjs
```

The built application will be available in the `electron/dist` directory.

## Model Requirements

Place your trained `model.h5` file in the project root directory before building the application.

## Reports Storage

Patient reports are automatically saved to:
- **Windows**: `C:\Users\[YourUsername]\Documents\BloodCellVision Reports`
- **macOS/Linux**: `~/Documents/BloodCellVision Reports`

## License

BloodCellVision © 2025 - All Rights Reserved
