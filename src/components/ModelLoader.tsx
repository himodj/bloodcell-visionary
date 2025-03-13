
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Database } from 'lucide-react';

const ModelLoader: React.FC = () => {
  const [isModelLoaded, setIsModelLoaded] = useState(false);

  const handleLoadModel = async () => {
    try {
      // Call the global function we defined in main.tsx
      const success = await (window as any).loadModel();
      if (success) {
        setIsModelLoaded(true);
        toast.success('Model loaded successfully');
      }
    } catch (error) {
      console.error('Error loading model:', error);
      toast.error('Failed to load model');
    }
  };

  return (
    <div className="flex items-center gap-4 mb-6">
      <Button 
        onClick={handleLoadModel}
        className={`${isModelLoaded ? 'bg-green-500' : 'bg-medical-blue'} text-white hover:opacity-90`}
      >
        <Database size={16} className="mr-2" />
        {isModelLoaded ? 'Model Loaded' : 'Load H5 Model'}
      </Button>
      
      {isModelLoaded && (
        <span className="text-sm text-green-600 flex items-center">
          <div className="w-2 h-2 rounded-full bg-green-500 mr-2"></div>
          Model ready for analysis
        </span>
      )}
    </div>
  );
};

export default ModelLoader;
