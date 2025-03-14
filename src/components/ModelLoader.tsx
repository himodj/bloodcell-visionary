
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Database, Check, AlertCircle } from 'lucide-react';

const ModelLoader: React.FC = () => {
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleLoadModel = async () => {
    // Check if we're in Electron environment
    if (!window.electron) {
      toast.error("This feature is only available in the desktop app");
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
    <div className="flex items-center gap-4 mb-6">
      <Button 
        onClick={handleLoadModel}
        disabled={isLoading}
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
      
      {isModelLoaded && (
        <span className="text-sm text-green-600 flex items-center">
          <div className="w-2 h-2 rounded-full bg-green-500 mr-2"></div>
          Model ready for analysis
        </span>
      )}
      
      {!window.electron && (
        <span className="text-sm text-amber-600 flex items-center">
          <AlertCircle size={14} className="mr-1" />
          Model loading requires desktop app
        </span>
      )}
    </div>
  );
};

export default ModelLoader;
