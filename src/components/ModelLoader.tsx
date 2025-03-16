
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Database, Check, AlertCircle, Download, HelpCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";

const ModelLoader: React.FC = () => {
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isElectron, setIsElectron] = useState(false);
  const [showModelHelp, setShowModelHelp] = useState(false);

  // Check if we're in Electron on component mount
  useEffect(() => {
    setIsElectron(!!window.electron?.isElectron);
  }, []);

  const handleLoadModel = async () => {
    // Check if we're in Electron environment
    if (!isElectron) {
      toast.error("This feature is only available in the desktop app");
      setShowModelHelp(true);
      console.warn("Model loading is only available in Electron environment");
      return;
    }

    setIsLoading(true);
    
    try {
      // Call the global function we defined in main.tsx
      const success = await (window as any).loadModel();
      if (success) {
        setIsModelLoaded(true);
        toast.success('Model loaded successfully');
      } else {
        toast.error('No model was selected');
      }
    } catch (error) {
      console.error('Error loading model:', error);
      toast.error(typeof error === 'string' ? error : 'Failed to load model');
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
              {isModelLoaded ? 'Model Loaded' : 'Load H5 Model'}
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
          <span className="text-sm text-green-600 flex items-center">
            <div className="w-2 h-2 rounded-full bg-green-500 mr-2"></div>
            Model ready for analysis
          </span>
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

      <Dialog open={showModelHelp} onOpenChange={setShowModelHelp}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>How to Load a Model</DialogTitle>
            <DialogDescription>
              Instructions for loading TensorFlow models in BloodCellVision
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <h3 className="font-medium">Browser Version Limitations</h3>
            <p className="text-sm text-muted-foreground">
              The browser version cannot load local models due to security restrictions. You need to run the desktop version to use this feature.
            </p>
            
            <h3 className="font-medium">Using the Desktop App</h3>
            <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
              <li>Download and install the desktop application</li>
              <li>Click the "Load H5 Model" button</li>
              <li>Select a valid TensorFlow model file (.h5)</li>
              <li>Wait for the model to load - you'll see a success message</li>
            </ol>
            
            <h3 className="font-medium">Running Locally</h3>
            <p className="text-sm text-muted-foreground">
              To run the desktop version locally from source code:
            </p>
            <pre className="bg-slate-100 p-2 rounded text-xs">
              <code>
                npm install
                node run-electron-dev.js
              </code>
            </pre>
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
