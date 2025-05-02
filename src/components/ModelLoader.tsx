
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Database, Check, RefreshCw, Download, FileWarning } from 'lucide-react';
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { isModelInitialized } from "../utils/analysisUtils";

const ModelLoader: React.FC = () => {
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isElectron, setIsElectron] = useState(false);
  const [modelPath, setModelPath] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [electronAvailable, setElectronAvailable] = useState(false);
  
  // Check if we're in Electron on component mount and periodically check model state
  useEffect(() => {
    try {
      // Check if window.electron exists and isElectron is true
      const electronEnv = typeof window !== 'undefined' && window.electron && window.electron.isElectron === true;
      setIsElectron(electronEnv);
      setElectronAvailable(!!window.electron);
      
      console.log('Electron environment check:', electronEnv);
      console.log('Electron API available:', !!window.electron);
      
      // Try to auto-load the model if we're in Electron
      if (electronEnv) {
        console.log('Electron environment detected, auto-loading model...');
        setTimeout(() => {
          loadDefaultModel();
        }, 1000);
      }

      // Set up a periodic check for model state
      const interval = setInterval(() => {
        const modelInitialized = isModelInitialized();
        console.log('Model initialized check:', modelInitialized);
        setIsModelLoaded(modelInitialized);
      }, 2000);

      return () => clearInterval(interval);
    } catch (err) {
      console.error('Error in ModelLoader useEffect:', err);
    }
  }, []);

  // Function to load default model
  const loadDefaultModel = async () => {
    if (!window.electron) {
      console.error('Electron API not available');
      setLoadError('Electron API not available. This feature requires the desktop application.');
      return;
    }
    
    try {
      setIsLoading(true);
      setLoadError(null);
      
      console.log('Requesting default model path from Electron...');
      const modelPath = await window.electron.getDefaultModelPath();
      console.log('Received model path:', modelPath);
      
      if (modelPath) {
        console.log('Default model found at:', modelPath);
        setModelPath(modelPath);
        
        // Call the global function we defined in main.tsx to load the model
        console.log('Calling loadModel function...');
        const success = await (window as any).loadModel(modelPath);
        
        if (success) {
          setIsModelLoaded(true);
          toast.success(`Model loaded successfully from: ${modelPath}`);
        } else {
          setLoadError('Found model but failed to load. Check console for details.');
          toast.error('Found model but failed to load. Check console for details.');
        }
      } else {
        const errorMsg = 'No model.h5 found. Please place model.h5 in the same folder as the application.';
        console.warn(errorMsg);
        setLoadError(errorMsg);
        toast.warning(errorMsg);
      }
    } catch (error) {
      console.error('Error loading default model:', error);
      const errorMessage = typeof error === 'string' ? error : error instanceof Error ? error.message : 'Failed to load default model';
      setLoadError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Function to handle custom model loading
  const handleLoadModel = async () => {
    if (!window.electron) {
      toast.error("This feature is only available in the desktop app");
      console.warn("Model loading is only available in Electron environment");
      return;
    }

    setIsLoading(true);
    setLoadError(null);
    
    try {
      // Try first to use browseForModel to let user pick the file
      console.log('Opening file dialog to browse for model...');
      const selectedPath = await window.electron.browseForModel();
      
      if (selectedPath) {
        console.log('User selected model at:', selectedPath);
        setModelPath(selectedPath);
        
        // Call the global function we defined in main.tsx to load the model
        console.log('Loading user-selected model...');
        const success = await (window as any).loadModel(selectedPath);
        
        if (success) {
          setIsModelLoaded(true);
          toast.success(`Model loaded successfully from: ${selectedPath}`);
        } else {
          setLoadError('Selected model failed to load. Check console for details.');
          toast.error('Selected model failed to load. Check console for details.');
        }
      } else {
        // Fall back to auto-detection if user cancels browsing
        console.log('Attempting to load model from default location...');
        const success = await (window as any).loadModel();
        
        if (success) {
          setIsModelLoaded(true);
          toast.success('Model loaded successfully');
        } else {
          setLoadError('Could not find model.h5. Please place model.h5 in the application directory.');
          toast.error('Could not find model.h5. Please place model.h5 in the application directory.');
        }
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

  const handleReloadModel = async () => {
    if (!window.electron) return;
    
    setIsLoading(true);
    
    try {
      await loadDefaultModel();
      toast.success('Model reloaded');
    } catch (error) {
      console.error('Error reloading model:', error);
      toast.error('Failed to reload model');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-6">
        <Button 
          onClick={handleLoadModel}
          disabled={isLoading || !electronAvailable}
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
              {isModelLoaded ? 'Model Loaded' : 'Load Model'}
            </>
          )}
        </Button>
        
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
        
        {isModelLoaded && (
          <div className="flex items-center">
            <div className="w-2 h-2 rounded-full bg-green-500 mr-2"></div>
            <span className="text-sm text-green-600 flex items-center">
              Model loaded successfully
              {modelPath && (
                <span className="text-xs text-gray-500 ml-2 truncate max-w-[200px]" title={modelPath}>
                  ({modelPath})
                </span>
              )}
            </span>
          </div>
        )}
        
        {!electronAvailable && (
          <div className="text-sm flex flex-col sm:flex-row items-start sm:items-center p-2 bg-amber-50 rounded border border-amber-200">
            <FileWarning size={16} className="text-amber-600 mr-2" />
            <span className="text-amber-600 mr-2">Model loading requires desktop app.</span>
            <a 
              href="https://github.com/yourusername/bloodcell-analyzer/releases" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-600 flex items-center hover:underline"
            >
              <Download size={14} className="mr-1" />
              Download
            </a>
          </div>
        )}
      </div>

      {loadError && !isModelLoaded && (
        <Alert variant="destructive" className="mb-6">
          <AlertTitle>Error Loading Model</AlertTitle>
          <AlertDescription>
            {loadError}
            <p className="mt-2">
              Please make sure the file "model.h5" exists in the same folder as the application.
            </p>
          </AlertDescription>
        </Alert>
      )}
      
      {!isModelLoaded && electronAvailable && !loadError && (
        <Alert className="mb-6">
          <AlertTitle>Model Required</AlertTitle>
          <AlertDescription>
            <p>To use this application, you need to load a compatible model.h5 file.</p>
            <p className="mt-2">
              Click "Load Model" above to either browse for a model file or load one from the default location.
            </p>
          </AlertDescription>
        </Alert>
      )}
    </>
  );
};

export default ModelLoader;
