
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Database, Check, AlertCircle, Download, HelpCircle, FileCheck } from 'lucide-react';
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

  // Check if we're in Electron on component mount
  useEffect(() => {
    const isElectronEnv = !!window.electron?.isElectron;
    setIsElectron(isElectronEnv);
    
    // Try to auto-load the model if we're in Electron
    if (isElectronEnv) {
      loadDefaultModel();
    }
  }, []);

  // New function to load default model
  const loadDefaultModel = async () => {
    if (!window.electron) return;
    
    try {
      setIsLoading(true);
      setLoadError(null);
      const modelPath = await window.electron.getDefaultModelPath();
      
      if (modelPath) {
        console.log('Default model found at:', modelPath);
        setModelPath(modelPath);
        
        // Set H5 flag if it's an H5 model
        if (modelPath.toLowerCase().endsWith('.h5')) {
          setIsH5Model(true);
        }
        
        // Call the global function we defined in main.tsx to load the model
        const success = await (window as any).loadModel(modelPath);
        if (success) {
          setIsModelLoaded(true);
          toast.success('Model loaded successfully from: ' + modelPath);
        } else {
          setLoadError('Found model but failed to load. Check console for details.');
          toast.error('Found model but failed to load. Check console for details.');
        }
      } else {
        const errorMsg = 'No model.h5 found. Please check model.h5 exists in project root.';
        console.warn(errorMsg);
        setLoadError(errorMsg);
        toast.warning('Model not found. Place model.h5 in the root directory of the application.');
      }
    } catch (error) {
      console.error('Error loading default model:', error);
      const errorMessage = typeof error === 'string' ? error : 'Failed to load default model';
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
      const errorMessage = typeof error === 'string' ? error : 'Failed to load model';
      setLoadError(errorMessage);
      toast.error(errorMessage);
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
                  H5 Model loaded and ready
                </span>
              ) : (
                'Model ready for analysis'
              )}
              {modelPath && (
                <span className="ml-2 text-xs text-gray-500">({modelPath.split('/').pop() || modelPath.split('\\').pop()})</span>
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
                Please make sure model.h5 exists in the project root directory. The app expects to find a file named "model.h5".
              </p>
            )}
          </AlertDescription>
        </Alert>
      )}

      <Dialog open={showModelHelp} onOpenChange={setShowModelHelp}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Using BloodCellVision as a Desktop App</DialogTitle>
            <DialogDescription>
              Instructions for using the H5 model in the desktop application
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <h3 className="font-medium">Standalone Application</h3>
            <p className="text-sm text-muted-foreground">
              BloodCellVision works as a standalone desktop application that doesn't require a browser.
            </p>
            
            <h3 className="font-medium">Model File Requirements</h3>
            <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
              <li>The application requires a <strong>model.h5</strong> file to be present</li>
              <li>For development: Place the model.h5 file in the project root directory</li>
              <li>For distribution: The model.h5 file is automatically packaged with the application</li>
            </ol>
            
            <h3 className="font-medium">H5 Model Support</h3>
            <p className="text-sm text-muted-foreground">
              The application now supports H5 models directly, without requiring conversion to TensorFlow.js format.
            </p>
            
            <h3 className="font-medium">Distributing the Application</h3>
            <p className="text-sm text-muted-foreground">
              To distribute the application to other computers:
            </p>
            <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
              <li>Ensure <code>model.h5</code> is in the project root directory</li>
              <li>Run <code>node build-electron.js</code> in the main directory</li>
              <li>The packaged application will be in the <code>electron-dist</code> folder</li>
              <li>Users can install and run the application without any setup</li>
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
