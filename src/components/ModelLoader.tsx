
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Database, Check, RefreshCw, Download, FileWarning, Activity } from 'lucide-react';
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { isModelInitialized, initializeModel } from "../utils/analysisUtils";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const ModelLoader: React.FC = () => {
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isElectron, setIsElectron] = useState(false);
  const [modelPath, setModelPath] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [electronAvailable, setElectronAvailable] = useState(false);
  const [loadAttempts, setLoadAttempts] = useState(0);
  const [showAdvancedHelp, setShowAdvancedHelp] = useState(false);
  const [environmentInfo, setEnvironmentInfo] = useState<Record<string, any>>({});
  const [isCheckingEnv, setIsCheckingEnv] = useState(false);
  
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

  // Function to check environment diagnostics
  const checkEnvironment = async () => {
    if (!window.electron) {
      toast.error('Environment check requires the desktop application');
      return;
    }
    
    setIsCheckingEnv(true);
    
    try {
      const envInfo = await window.electron.getPythonEnvironmentInfo();
      setEnvironmentInfo(envInfo);
      
      if (envInfo.error) {
        toast.error(`Could not retrieve environment info: ${envInfo.error}`);
      } else {
        toast.success('Environment diagnostics retrieved successfully');
      }
    } catch (error) {
      console.error('Error checking environment:', error);
      toast.error('Failed to check environment');
    } finally {
      setIsCheckingEnv(false);
    }
  };

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
      setLoadAttempts(prev => prev + 1);
      
      console.log('Requesting default model path from Electron...');
      const modelPath = await window.electron.getDefaultModelPath();
      console.log('Received model path:', modelPath);
      
      if (modelPath) {
        console.log('Default model found at:', modelPath);
        setModelPath(modelPath);
        
        // First, let's check the environment
        let envInfo = null;
        try {
          envInfo = await window.electron.getPythonEnvironmentInfo();
          setEnvironmentInfo(envInfo);
          
          if (envInfo.error) {
            console.warn('Environment check warning:', envInfo.error);
          } else {
            console.log('Environment info:', envInfo);
            
            // Check for TensorFlow and Keras modules
            const hasTensorflow = envInfo.modules?.tensorflow?.installed;
            const hasKeras = envInfo.modules?.keras?.installed;
            
            if (!hasTensorflow && !hasKeras) {
              setLoadError('Neither TensorFlow nor Keras is installed properly in your Python environment.');
              toast.error('TensorFlow and Keras are missing or not properly installed');
              return;
            }
          }
        } catch (envError) {
          console.error('Error checking environment:', envError);
        }
        
        // First initialize the model in our front-end
        const frontendInitSuccess = await initializeModel(modelPath);
        
        if (!frontendInitSuccess) {
          setLoadError('Failed to initialize model in frontend.');
          return;
        }
        
        // Now ensure the Python backend also has the model loaded
        console.log('Ensuring Python backend has model loaded...');
        const pythonReloadResult = await window.electron.reloadPythonModel(modelPath);
        
        if (pythonReloadResult.error) {
          console.error('Error from Python model reload:', pythonReloadResult.error);
          
          // Show more detailed error message
          let errorMsg = `Error loading model: ${pythonReloadResult.error}`;
          setLoadError(errorMsg);
          toast.error('Model loading failed. Check console for details.');
          setShowAdvancedHelp(true);
          
          // Based on environment info, give more specific guidance
          if (envInfo) {
            if (envInfo.modules?.tensorflow?.version !== envInfo.modules?.keras?.version) {
              setLoadError(
                `TensorFlow (${envInfo.modules?.tensorflow?.version}) and Keras (${envInfo.modules?.keras?.version}) versions are mismatched. ` +
                'Try running these commands in your command prompt:' +
                '\n\n1. pip install tensorflow==2.12.0 keras==2.12.0 h5py==3.8.0' +
                '\n2. Restart the application'
              );
            }
          }
          
          return;
        }
        
        if (pythonReloadResult.success) {
          setIsModelLoaded(true);
          toast.success(`Model loaded successfully from: ${modelPath}`);
        } else {
          setLoadError('Failed to load model in Python backend.');
          toast.error('Found model but failed to load in Python backend. Check console for details.');
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
    setLoadAttempts(prev => prev + 1);
    
    try {
      // Try first to use browseForModel to let user pick the file
      console.log('Opening file dialog to browse for model...');
      const selectedPath = await window.electron.browseForModel();
      
      if (selectedPath) {
        console.log('User selected model at:', selectedPath);
        setModelPath(selectedPath);
        
        // Initialize model in frontend
        const frontendInitSuccess = await initializeModel(selectedPath);
        
        if (!frontendInitSuccess) {
          setLoadError('Failed to initialize model in frontend.');
          return;
        }
        
        // Now ensure the Python backend also has the model loaded
        console.log('Loading model in Python backend...');
        const pythonReloadResult = await window.electron.reloadPythonModel(selectedPath);
        
        if (pythonReloadResult.error) {
          console.error('Error from Python model reload:', pythonReloadResult.error);
          
          // Show more detailed error message
          const errorMsg = `Error loading model: ${pythonReloadResult.error}`;
          setLoadError(errorMsg);
          toast.error('Model loading failed. Check console for details.');
          setShowAdvancedHelp(true);
          return;
        }
        
        if (pythonReloadResult.success) {
          setIsModelLoaded(true);
          toast.success(`Model loaded successfully from: ${selectedPath}`);
        } else {
          setLoadError('Selected model failed to load in Python backend.');
          toast.error('Selected model failed to load in Python backend. Check console for details.');
        }
      } else {
        // Fall back to auto-detection
        await loadDefaultModel();
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
    if (!window.electron || !modelPath) return;
    
    setIsLoading(true);
    setLoadAttempts(prev => prev + 1);
    
    try {
      // First reinitialize in frontend
      await initializeModel(modelPath, true);
      
      // Then reload in Python backend
      const pythonReloadResult = await window.electron.reloadPythonModel(modelPath);
      
      if (pythonReloadResult.error) {
        console.error('Error from Python model reload:', pythonReloadResult.error);
        setLoadError(`Error from Python server: ${pythonReloadResult.error}`);
        toast.error('Failed to reload model in Python backend. Check console for details.');
        setShowAdvancedHelp(true);
      } else if (pythonReloadResult.success) {
        setIsModelLoaded(true);
        toast.success('Model reloaded successfully in both frontend and Python backend');
      } else {
        setLoadError('Failed to reload model in Python backend.');
        toast.error('Failed to reload model in Python backend. Check server logs for details.');
      }
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
        
        <Button
          variant="outline"
          size="sm"
          className="h-10"
          onClick={checkEnvironment}
          disabled={isCheckingEnv || !electronAvailable}
          title="Check Python environment"
        >
          <Activity size={16} className={isCheckingEnv ? "animate-pulse mr-2" : "mr-2"} />
          Environment
        </Button>
        
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

      {Object.keys(environmentInfo).length > 0 && !environmentInfo.error && (
        <Accordion type="single" collapsible className="mb-6">
          <AccordionItem value="environment">
            <AccordionTrigger className="text-sm font-medium">
              Python Environment Diagnostics
            </AccordionTrigger>
            <AccordionContent>
              <div className="text-sm bg-gray-50 p-3 rounded-md">
                <div className="mb-2">
                  <span className="font-semibold">Python Version:</span> {environmentInfo.python_version}
                </div>
                <div className="mb-2">
                  <span className="font-semibold">Platform:</span> {environmentInfo.platform}
                </div>
                <div className="mb-2">
                  <span className="font-semibold">Modules:</span>
                  <ul className="list-disc pl-6 mt-1">
                    {environmentInfo.modules && Object.entries(environmentInfo.modules).map(([name, info]: [string, any]) => (
                      <li key={name}>
                        {name}: {info.installed ? 
                          <span className="text-green-600">Installed (v{info.version})</span> : 
                          <span className="text-red-600">Not installed</span>
                        }
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      )}

      {loadError && !isModelLoaded && (
        <Alert variant="destructive" className="mb-6">
          <AlertTitle>Error Loading Model</AlertTitle>
          <AlertDescription>
            <div className="whitespace-pre-line">{loadError}</div>
            <div className="mt-2">
              {loadAttempts > 1 ? (
                <p>Multiple load attempts have failed. Please check your Python environment configuration.</p>
              ) : (
                <p>Please make sure the file 'model.h5' exists in the same folder as the application.</p>
              )}
            </div>
            {showAdvancedHelp && (
              <div className="mt-4 p-3 bg-gray-100 rounded text-sm">
                <p className="font-bold mb-2">Advanced Troubleshooting:</p>
                <ol className="list-decimal list-inside">
                  <li>Verify you have Python 3.8-3.10 installed</li>
                  <li>Try reinstalling TensorFlow and Keras with specific versions:</li>
                  <code className="block bg-black text-white p-2 mt-1 mb-2">
                    pip install tensorflow==2.12.0 keras==2.12.0 h5py==3.8.0
                  </code>
                  <li>Make sure your model.h5 file is a valid TensorFlow/Keras model</li>
                  <li>Restart the application after making changes</li>
                  <li>Run the Environment diagnostics to check your Python setup</li>
                </ol>
                <Button 
                  onClick={checkEnvironment} 
                  variant="outline" 
                  size="sm" 
                  className="mt-2" 
                  disabled={isCheckingEnv || !electronAvailable}
                >
                  <Activity size={14} className="mr-1" /> 
                  Run Environment Diagnostics
                </Button>
              </div>
            )}
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
