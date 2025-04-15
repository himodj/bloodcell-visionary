
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Database, Check, AlertCircle, Download, HelpCircle, FileCheck, RefreshCw, FolderOpen, ShieldAlert } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { isModelInitialized } from "../utils/analysisUtils";

const ModelLoader: React.FC = () => {
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isElectron, setIsElectron] = useState(false);
  const [showModelHelp, setShowModelHelp] = useState(false);
  const [modelPath, setModelPath] = useState<string | null>(null);
  const [isH5Model, setIsH5Model] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [modelFormat, setModelFormat] = useState<string | null>(null);
  const [customModelPath, setCustomModelPath] = useState<string>('');
  const [showManualPathInput, setShowManualPathInput] = useState(false);
  const [showTroubleshooting, setShowTroubleshooting] = useState(false);

  // Check if we're in Electron on component mount and periodically check model state
  useEffect(() => {
    const isElectronEnv = !!window.electron?.isElectron;
    setIsElectron(isElectronEnv);
    
    // Try to auto-load the model if we're in Electron
    if (isElectronEnv) {
      console.log('Electron environment detected, auto-loading model...');
      setTimeout(() => {
        loadDefaultModel();
      }, 1000);
    }

    // Set up a periodic check for model state
    const interval = setInterval(() => {
      setIsModelLoaded(isModelInitialized());
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  // Function to load default model
  const loadDefaultModel = async () => {
    if (!window.electron) {
      console.error('Electron API not available');
      return;
    }
    
    try {
      setIsLoading(true);
      setLoadError(null);
      const modelPath = await window.electron.getDefaultModelPath();
      
      if (modelPath) {
        console.log('Default model found at:', modelPath);
        setModelPath(modelPath);
        
        // Check model format
        const modelFormat = await window.electron.checkModelFormat(modelPath);
        if (modelFormat.error) {
          throw new Error(`Model validation failed: ${modelFormat.error}`);
        }
        
        setModelFormat(modelFormat.format);
        
        // Set H5 flag if it's an H5 model
        if (modelPath.toLowerCase().endsWith('.h5') || modelFormat.format === 'h5') {
          setIsH5Model(true);
          console.log('H5 model format detected');
        }
        
        // Call the global function we defined in main.tsx to load the model
        const success = await (window as any).loadModel(modelPath);
        if (success) {
          setIsModelLoaded(true);
          toast.success(`Model loaded successfully from: ${modelPath}`);
        } else {
          setLoadError('Found model but failed to load. Check console for details.');
          toast.error('Found model but failed to load. Check console for details.');
        }
      } else {
        const errorMsg = 'No model.h5 found. Please select a model file manually.';
        console.warn(errorMsg);
        setLoadError(errorMsg);
        toast.warning('Model not found. Please use the Browse or Manual Path options below.');
        setShowManualPathInput(true);
      }
    } catch (error) {
      console.error('Error loading default model:', error);
      const errorMessage = typeof error === 'string' ? error : error instanceof Error ? error.message : 'Failed to load default model';
      setLoadError(errorMessage);
      toast.error(errorMessage);
      setShowManualPathInput(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoadModel = async () => {
    // Check if we're in Electron environment
    if (!isElectron) {
      toast.error("This feature is only available in the desktop app");
      setShowModelHelp(true);
      console.warn("Model loading is only available in Electron environment");
      return;
    }

    setIsLoading(true);
    setLoadError(null);
    
    try {
      // Call the global function we defined in main.tsx
      const success = await (window as any).loadModel();
      if (success) {
        setIsModelLoaded(true);
        toast.success('Model loaded successfully');
      } else {
        setLoadError('No model was selected or model failed to load');
        toast.error('No model was selected or model failed to load');
        setShowManualPathInput(true);
      }
    } catch (error) {
      console.error('Error loading model:', error);
      const errorMessage = typeof error === 'string' ? error : error instanceof Error ? error.message : 'Failed to load model';
      setLoadError(errorMessage);
      toast.error(errorMessage);
      setShowManualPathInput(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReloadModel = async () => {
    if (!isElectron) return;
    
    setIsLoading(true);
    
    try {
      await loadDefaultModel();
      toast.success('Model reloaded');
    } catch (error) {
      console.error('Error reloading model:', error);
      toast.error('Failed to reload model');
      setShowManualPathInput(true);
    } finally {
      setIsLoading(false);
    }
  };

  // New function to handle the "Browse" button click
  const handleBrowseForModel = async () => {
    if (!window.electron) {
      toast.error("This feature is only available in the desktop app");
      return;
    }
    
    setIsLoading(true);
    setLoadError(null);
    
    try {
      // Use the new browseForModel method from Electron
      const selectedPath = await window.electron.browseForModel();
      
      if (!selectedPath) {
        toast.info('No file selected');
        setIsLoading(false);
        return;
      }
      
      console.log('User selected model path:', selectedPath);
      setModelPath(selectedPath);
      
      // Check model format
      const modelFormat = await window.electron.checkModelFormat(selectedPath);
      if (modelFormat.error) {
        throw new Error(`Model validation failed: ${modelFormat.error}`);
      }
      
      setModelFormat(modelFormat.format);
      
      // Set H5 flag if it's an H5 model
      if (selectedPath.toLowerCase().endsWith('.h5') || modelFormat.format === 'h5') {
        setIsH5Model(true);
        console.log('H5 model format detected');
      }
      
      // Load the model using the selected path
      const success = await (window as any).loadModel(selectedPath);
      
      if (success) {
        setIsModelLoaded(true);
        toast.success(`Model loaded successfully from: ${selectedPath}`);
        setShowManualPathInput(false);
      } else {
        throw new Error('Failed to load the selected model');
      }
    } catch (error) {
      console.error('Error loading model:', error);
      const errorMessage = typeof error === 'string' ? error : error instanceof Error ? error.message : 'Failed to load model';
      setLoadError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // New function to handle manual path input
  const handleManualPathChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCustomModelPath(e.target.value);
  };

  // New function to load model from manual path
  const handleLoadFromManualPath = async () => {
    if (!customModelPath.trim() || !window.electron) {
      toast.error("Please enter a valid file path");
      return;
    }
    
    setIsLoading(true);
    setLoadError(null);
    
    try {
      // Check if the file exists
      const fileExists = await window.electron.checkFileExists(customModelPath);
      
      if (!fileExists) {
        throw new Error(`File not found at path: ${customModelPath}`);
      }
      
      console.log('Loading model from manual path:', customModelPath);
      setModelPath(customModelPath);
      
      // Check model format
      const modelFormat = await window.electron.checkModelFormat(customModelPath);
      if (modelFormat.error) {
        throw new Error(`Model validation failed: ${modelFormat.error}`);
      }
      
      setModelFormat(modelFormat.format);
      
      // Set H5 flag if it's an H5 model
      if (customModelPath.toLowerCase().endsWith('.h5') || modelFormat.format === 'h5') {
        setIsH5Model(true);
        console.log('H5 model format detected');
      }
      
      // Load the model using the manual path
      const success = await (window as any).loadModel(customModelPath);
      
      if (success) {
        setIsModelLoaded(true);
        toast.success(`Model loaded successfully from: ${customModelPath}`);
        setShowManualPathInput(false);
      } else {
        throw new Error('Failed to load the model from the specified path');
      }
    } catch (error) {
      console.error('Error loading model from manual path:', error);
      const errorMessage = typeof error === 'string' ? error : error instanceof Error ? error.message : 'Failed to load model';
      setLoadError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleManualPathInput = () => {
    setShowManualPathInput(!showManualPathInput);
  };

  const toggleTroubleshooting = () => {
    setShowTroubleshooting(!showTroubleshooting);
  };

  return (
    <>
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-6">
        <Button 
          onClick={handleLoadModel}
          disabled={isLoading || !isElectron}
          className={`${isModelLoaded ? 'bg-green-500' : 'bg-medical-blue'} text-white hover:opacity-90 transition-all`}
        >
          {isLoading ? (
            <>
              <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
              Loading Model...
            </>
          ) : (
            <>
              {isModelLoaded ? <Check size={16} className="mr-2" /> : <Database size={16} className="mr-2" />}
              {isModelLoaded ? 'Model Loaded' : isH5Model ? 'Load H5 Model' : 'Load Model'}
            </>
          )}
        </Button>
        
        {isElectron && (
          <Button
            onClick={handleBrowseForModel}
            disabled={isLoading}
            variant="outline"
            className="flex items-center"
          >
            <FolderOpen size={16} className="mr-2" />
            Browse for Model
          </Button>
        )}
        
        {isModelLoaded && (
          <Button
            variant="outline"
            size="icon"
            className="h-10 w-10"
            onClick={handleReloadModel}
            disabled={isLoading}
            title="Reload model"
          >
            <RefreshCw size={16} className={isLoading ? "animate-spin" : ""} />
          </Button>
        )}
        
        <Button 
          variant="outline" 
          size="icon" 
          className="h-10 w-10" 
          onClick={() => setShowModelHelp(true)}
        >
          <HelpCircle size={16} />
        </Button>
        
        {!isModelLoaded && (
          <Button 
            variant="outline" 
            size="icon" 
            className="h-10 w-10 text-amber-600" 
            onClick={toggleTroubleshooting}
            title="Model Troubleshooting"
          >
            <ShieldAlert size={16} />
          </Button>
        )}
        
        {isModelLoaded && (
          <div className="flex items-center">
            <div className="w-2 h-2 rounded-full bg-green-500 mr-2"></div>
            <span className="text-sm text-green-600 flex items-center">
              {isH5Model ? (
                <span className="flex items-center">
                  <FileCheck size={14} className="mr-1" />
                  H5 Model loaded and ready (360x360 input)
                </span>
              ) : (
                'Model ready for analysis'
              )}
              {modelPath && (
                <span className="text-xs text-gray-500 ml-2 truncate max-w-[200px]" title={modelPath}>
                  ({modelPath})
                </span>
              )}
            </span>
          </div>
        )}
        
        {!isElectron && (
          <div className="text-sm text-amber-600 flex items-center p-2 bg-amber-50 rounded border border-amber-200">
            <AlertCircle size={14} className="mr-2 flex-shrink-0" />
            <span>
              Model loading requires desktop app. 
              <a 
                href="https://github.com/yourusername/blood-cell-analyzer/releases" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="text-blue-600 hover:underline ml-1 inline-flex items-center"
              >
                <Download size={12} className="mr-1" />
                Download
              </a>
            </span>
          </div>
        )}
      </div>

      {loadError && !isModelLoaded && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error Loading Model</AlertTitle>
          <AlertDescription>
            {loadError}
            {(loadError.includes('not found') || loadError.includes('failed')) && (
              <p className="mt-2">
                Please use the "Browse for Model" button to select your model.h5 file directly, or specify the model path manually below.
              </p>
            )}
          </AlertDescription>
        </Alert>
      )}

      {showManualPathInput && isElectron && (
        <div className="mb-6 p-4 border border-gray-200 rounded-lg bg-gray-50">
          <h3 className="text-sm font-medium mb-3">Manual Model Path</h3>
          <div className="flex flex-col sm:flex-row gap-3">
            <Input
              placeholder="Enter full path to model.h5 file"
              value={customModelPath}
              onChange={handleManualPathChange}
              className="flex-1"
            />
            <Button 
              onClick={handleLoadFromManualPath} 
              disabled={isLoading || !customModelPath.trim()}
              size="sm"
            >
              Load from Path
            </Button>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Example: C:\Users\YourName\Desktop\model.h5
          </p>
        </div>
      )}

      {!showManualPathInput && isElectron && !isModelLoaded && (
        <Button 
          variant="link" 
          onClick={toggleManualPathInput} 
          className="px-0 text-sm text-gray-500 hover:text-gray-700"
        >
          + Specify model path manually
        </Button>
      )}

      <Dialog open={showModelHelp} onOpenChange={setShowModelHelp}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Using CNN Model for Blood Cell Analysis</DialogTitle>
            <DialogDescription>
              Instructions for using the H5 model in the desktop application
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <h3 className="font-medium">Model Requirements</h3>
            <p className="text-sm text-muted-foreground">
              This application requires a trained CNN model (model.h5) that:
            </p>
            <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
              <li>Is trained on <strong>360x360 pixel</strong> blood cell images</li>
              <li>Can identify specific cell types (Basophil, Neutrophil, etc.)</li>
              <li>Is saved in H5 format</li>
            </ol>
            
            <h3 className="font-medium">Image Processing</h3>
            <p className="text-sm text-muted-foreground">
              All images are automatically:
            </p>
            <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
              <li>Center-cropped to maintain aspect ratio (creating a 1:1 square)</li>
              <li>Resized to exactly 360x360 pixels</li>
              <li>Normalized before analysis</li>
            </ol>
            
            <h3 className="font-medium">Model Installation</h3>
            <p className="text-sm text-muted-foreground">
              To use your CNN model:
            </p>
            <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
              <li>Click "Browse for Model" to select your model.h5 file directly</li>
              <li>Alternatively, place <code>model.h5</code> in the project root directory</li>
              <li>If "Model Loaded" appears in green, your model is ready for use</li>
            </ol>
          </div>
          
          <DialogFooter>
            <Button onClick={() => setShowModelHelp(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showTroubleshooting} onOpenChange={setShowTroubleshooting}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Model Loading Troubleshooting</DialogTitle>
            <DialogDescription>
              Common issues and solutions for model loading problems
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <h3 className="font-medium">Common Issues</h3>
            
            <div className="space-y-3 text-sm">
              <div className="border border-gray-200 rounded-lg p-3">
                <h4 className="font-medium">Model Not Found</h4>
                <p className="text-muted-foreground">The application cannot locate your model.h5 file.</p>
                <div className="mt-2 bg-gray-50 p-2 rounded">
                  <strong>Solution:</strong> Use the "Browse for Model" button to manually select your model.h5 file.
                </div>
              </div>
              
              <div className="border border-gray-200 rounded-lg p-3">
                <h4 className="font-medium">Invalid Model Format</h4>
                <p className="text-muted-foreground">The file exists but isn't recognized as a valid H5 model.</p>
                <div className="mt-2 bg-gray-50 p-2 rounded">
                  <strong>Solution:</strong> Ensure you're using a properly trained and saved Keras/TensorFlow H5 model.
                </div>
              </div>
              
              <div className="border border-gray-200 rounded-lg p-3">
                <h4 className="font-medium">Python Backend Not Running</h4>
                <p className="text-muted-foreground">The Python server required for H5 models is not running.</p>
                <div className="mt-2 bg-gray-50 p-2 rounded">
                  <strong>Solution:</strong> Restart the application. Check if Python and required libraries are installed.
                </div>
              </div>
              
              <div className="border border-gray-200 rounded-lg p-3">
                <h4 className="font-medium">Permission Issues</h4>
                <p className="text-muted-foreground">The application cannot access the model file due to permissions.</p>
                <div className="mt-2 bg-gray-50 p-2 rounded">
                  <strong>Solution:</strong> Copy the model to a location with proper read permissions (e.g., Desktop).
                </div>
              </div>
            </div>
            
            <Alert className="bg-blue-50 border-blue-200">
              <AlertTitle className="text-blue-700">Need to train a model?</AlertTitle>
              <AlertDescription className="text-blue-600">
                If you don't have a model.h5 file, you'll need to train one using TensorFlow/Keras or download a pre-trained model compatible with blood cell classification.
              </AlertDescription>
            </Alert>
          </div>
          
          <DialogFooter>
            <Button onClick={() => setShowTroubleshooting(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ModelLoader;
