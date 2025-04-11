
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Database, Check, AlertCircle, Download, HelpCircle, FileCheck, RefreshCw } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";

const ModelLoader: React.FC = () => {
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isElectron, setIsElectron] = useState(false);
  const [showModelHelp, setShowModelHelp] = useState(false);
  const [modelPath, setModelPath] = useState<string | null>(null);
  const [isH5Model, setIsH5Model] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [modelFormat, setModelFormat] = useState<string | null>(null);

  // Check if we're in Electron on component mount
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
        const errorMsg = 'No model.h5 found. Check if C:\\Users\\H\\Desktop\\app\\model.h5 exists.';
        console.warn(errorMsg);
        setLoadError(errorMsg);
        toast.warning('Model not found. Please check if the specified path is correct: C:\\Users\\H\\Desktop\\app\\model.h5');
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
              {isModelLoaded ? 'Model Loaded' : isH5Model ? 'Load H5 Model' : 'Load Model'}
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
        
        <Button 
          variant="outline" 
          size="icon" 
          className="h-10 w-10" 
          onClick={() => setShowModelHelp(true)}
        >
          <HelpCircle size={16} />
        </Button>
        
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
            {loadError.includes('not found') && (
              <p className="mt-2">
                Please make sure model.h5 exists at C:\Users\H\Desktop\app\model.h5 or in the project root directory.
              </p>
            )}
          </AlertDescription>
        </Alert>
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
              <li>Place <code>model.h5</code> in the project root directory</li>
              <li>The application will automatically locate and load it</li>
              <li>If "Model Loaded" appears in green, your model is ready for use</li>
            </ol>
          </div>
          
          <DialogFooter>
            <Button onClick={() => setShowModelHelp(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ModelLoader;
