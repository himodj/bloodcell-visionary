
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Database, Check, RefreshCw } from 'lucide-react';
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { isModelInitialized } from "../utils/analysisUtils";

const ModelLoader: React.FC = () => {
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isElectron, setIsElectron] = useState(false);
  const [modelPath, setModelPath] = useState<string | null>(null);
  const [isH5Model, setIsH5Model] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

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
        setIsH5Model(true);
        
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
        const errorMsg = 'No model.h5 found in application directory. Please ensure model.h5 exists in the same folder as the application.';
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

  const handleLoadModel = async () => {
    if (!isElectron) {
      toast.error("This feature is only available in the desktop app");
      console.warn("Model loading is only available in Electron environment");
      return;
    }

    setIsLoading(true);
    setLoadError(null);
    
    try {
      // Call the global function we defined in main.tsx with no parameter
      // to trigger a search for model.h5 in the default locations
      const success = await (window as any).loadModel();
      if (success) {
        setIsModelLoaded(true);
        toast.success('Model loaded successfully');
      } else {
        setLoadError('Could not find model.h5 in application directory.');
        toast.error('Could not find model.h5 in application directory.');
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
    if (!isElectron) return;
    
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
        
        {!isElectron && (
          <div className="text-sm text-amber-600 flex items-center p-2 bg-amber-50 rounded border border-amber-200">
            <span>Model loading requires desktop application. This app must be run in Electron mode.</span>
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
    </>
  );
};

export default ModelLoader;
