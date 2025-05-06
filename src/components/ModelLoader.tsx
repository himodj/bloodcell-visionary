import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Database, Check, RefreshCw, Download, FileWarning, Activity, AlertTriangle } from 'lucide-react';
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
  const [modelCheckStatus, setModelCheckStatus] = useState<'unchecked' | 'checking' | 'success' | 'error' | 'fallback'>('unchecked');
  const [pythonServerRunning, setPythonServerRunning] = useState<boolean | null>(null);
  const [lastCheckTime, setLastCheckTime] = useState(0);
  
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
        console.log('Electron environment detected, checking Python server status...');
        checkPythonServerStatus();
        
        setTimeout(() => {
          loadDefaultModel();
        }, 1000);
      }

      // Set up a periodic check for model state
      const interval = setInterval(async () => {
        const modelInitialized = isModelInitialized();
        console.log('Model initialized check:', modelInitialized);
        setIsModelLoaded(modelInitialized);
        
        // If model is initialized and more than 10 seconds have passed since last check, check server status
        const now = Date.now();
        if (modelInitialized && window.electron && now - lastCheckTime > 10000) {
          setLastCheckTime(now); // Update last check time
          try {
            const serverRunning = await window.electron.isPythonServerRunning();
            setPythonServerRunning(serverRunning);
            
            if (!serverRunning) {
              setModelCheckStatus('fallback');
              console.log('Python server not running, using fallback mode');
            } else {
              const status = await checkPythonModelStatus();
              if (!status.loaded && status.usedFallback) {
                setModelCheckStatus('fallback');
              } else if (!status.loaded) {
                setModelCheckStatus('error');
              } else {
                setModelCheckStatus('success');
              }
            }
          } catch (err) {
            console.error('Error checking Python server status:', err);
            setPythonServerRunning(false);
            setModelCheckStatus('fallback');
          }
        }
      }, 2000);

      return () => clearInterval(interval);
    } catch (err) {
      console.error('Error in ModelLoader useEffect:', err);
    }
  }, [lastCheckTime]);

  // Check if Python server is running
  const checkPythonServerStatus = async () => {
    if (!window.electron) {
      setPythonServerRunning(false);
      return false;
    }
    
    try {
      const serverRunning = await window.electron.isPythonServerRunning();
      setPythonServerRunning(serverRunning);
      return serverRunning;
    } catch (err) {
      console.error('Error checking Python server status:', err);
      setPythonServerRunning(false);
      return false;
    }
  };

  // Function to check Python model status
  const checkPythonModelStatus = async () => {
    if (!window.electron) {
      return { loaded: false, error: 'Electron not available', usedFallback: true };
    }
    
    setModelCheckStatus('checking');
    try {
      // If model path is available, try to reload it
      const path = modelPath || await window.electron.getDefaultModelPath();
      
      if (path) {
        // First check if Python server is running
        const serverRunning = await window.electron.isPythonServerRunning();
        
        if (!serverRunning) {
          setModelCheckStatus('fallback');
          return { loaded: false, error: 'Python server not running', usedFallback: true };
        }
        
        console.log("Checking Python model status for path:", path);
        const result = await window.electron.reloadPythonModel(path);
        console.log("Python model status result:", result);
        
        if (result.usedFallback) {
          setModelCheckStatus('fallback');
        } else if (result.loaded) {
          setModelCheckStatus('success');
        } else {
          setModelCheckStatus('error');
        }
        
        return result;
      }
      
      setModelCheckStatus('error');
      return { loaded: false, error: 'No model path', usedFallback: false };
    } catch (err) {
      console.error('Error checking Python model status:', err);
      setModelCheckStatus('fallback');
      return { loaded: false, error: String(err), usedFallback: true };
    }
  };

  // Function to check environment diagnostics
  const checkEnvironment = async () => {
    if (!window.electron) {
      toast.error('Environment check requires the desktop application');
      return;
    }
    
    setIsCheckingEnv(true);
    
    try {
      // First check if Python server is running
      const serverRunning = await window.electron.isPythonServerRunning();
      setPythonServerRunning(serverRunning);
      
      if (!serverRunning) {
        toast.error('Python server is not running. Environment details unavailable.');
        setEnvironmentInfo({
          error: 'Python server is not running',
          python_version: 'Unknown',
          platform: 'Unknown',
          modules: {
            tensorflow: { installed: false },
            keras: { installed: false },
            h5py: { installed: false },
            numpy: { installed: false }
          }
        });
        setIsCheckingEnv(false);
        return;
      }
      
      const envInfo = await window.electron.getPythonEnvironmentInfo();
      console.log("Environment info received:", envInfo);
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
        
        // First check if Python server is running
        const serverRunning = await window.electron.isPythonServerRunning();
        setPythonServerRunning(serverRunning);
        
        // Always initialize the model in our front-end
        const frontendInitSuccess = await initializeModel(modelPath);
        
        if (!frontendInitSuccess) {
          setLoadError('Failed to initialize model in frontend.');
          return;
        }
        
        // Now try to load in Python backend if server is running
        if (serverRunning) {
          console.log('Python server is running, loading model...');
          const pythonReloadResult = await window.electron.reloadPythonModel(modelPath);
          console.log('Python model reload result:', pythonReloadResult);
          
          if (pythonReloadResult.error) {
            console.error('Error from Python model reload:', pythonReloadResult.error);
            
            // Show more detailed error message
            let errorMsg = `Error loading model: ${pythonReloadResult.error}`;
            setLoadError(errorMsg);
            
            // Still mark as loaded but in fallback mode
            setIsModelLoaded(true);
            toast.warning('Model loaded in fallback mode. Some features will be simulated.');
            setModelCheckStatus('fallback');
            
            // Based on environment info, try to provide more guidance
            try {
              const envInfo = await window.electron.getPythonEnvironmentInfo();
              setEnvironmentInfo(envInfo);
              
              if (envInfo && envInfo.modules) {
                // Provide version compatibility information if available
                if (envInfo.modules.tensorflow && envInfo.modules.keras) {
                  setLoadError((prevError) => `${prevError}\n\nTensorFlow version: ${envInfo.modules.tensorflow.version || 'unknown'}\nKeras version: ${envInfo.modules.keras.version || 'unknown'}`);
                }
              }
            } catch (envError) {
              console.error('Failed to get environment info:', envError);
            }
            
            return;
          }
          
          if (pythonReloadResult.loaded) {
            setIsModelLoaded(true);
            toast.success(`Model loaded successfully from: ${modelPath}`);
            setModelCheckStatus('success');
          } else {
            // Mark as loaded in fallback mode
            setIsModelLoaded(true);
            toast.warning('Model loaded in fallback mode. Some features will be simulated.');
            setModelCheckStatus('fallback');
          }
        } else {
          // Python server not running, using fallback mode
          console.log('Python server not running, using fallback mode');
          setIsModelLoaded(true);
          toast.warning('Python server not running. Model loaded in fallback mode.');
          setModelCheckStatus('fallback');
        }
      } else {
        const errorMsg = 'No model.h5 found. Please place model.h5 in the same folder as the application.';
        console.warn(errorMsg);
        setLoadError(errorMsg);
        toast.warning(errorMsg);
        setModelCheckStatus('error');
      }
    } catch (error) {
      console.error('Error loading default model:', error);
      const errorMessage = typeof error === 'string' ? error : error instanceof Error ? error.message : 'Failed to load default model';
      setLoadError(errorMessage);
      toast.error(errorMessage);
      
      // Set fallback mode
      setIsModelLoaded(true);
      toast.warning('Using fallback mode due to error.');
      setModelCheckStatus('fallback');
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
      // First check if Python server is running
      const serverRunning = await window.electron.isPythonServerRunning();
      setPythonServerRunning(serverRunning);
      
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
        
        // Now try to load in Python backend if server is running
        if (serverRunning) {
          console.log('Loading model in Python backend...');
          const pythonReloadResult = await window.electron.reloadPythonModel(selectedPath);
          
          if (pythonReloadResult.error) {
            console.error('Error from Python model reload:', pythonReloadResult.error);
            
            // Show more detailed error message
            const errorMsg = `Error loading model: ${pythonReloadResult.error}`;
            setLoadError(errorMsg);
            
            // Still mark as loaded but in fallback mode
            setIsModelLoaded(true);
            toast.warning('Model loaded in fallback mode. Some features will be simulated.');
            setModelCheckStatus('fallback');
            return;
          }
          
          if (pythonReloadResult.loaded) {
            setIsModelLoaded(true);
            toast.success(`Model loaded successfully from: ${selectedPath}`);
            setModelCheckStatus('success');
          } else {
            // Mark as loaded in fallback mode
            setIsModelLoaded(true);
            toast.warning('Model loaded in fallback mode. Some features will be simulated.');
            setModelCheckStatus('fallback');
          }
        } else {
          // Python server not running, using fallback mode
          console.log('Python server not running, using fallback mode');
          setIsModelLoaded(true);
          toast.warning('Python server not running. Model loaded in fallback mode.');
          setModelCheckStatus('fallback');
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
      
      // Set fallback mode
      setIsModelLoaded(true);
      toast.warning('Using fallback mode due to error.');
      setModelCheckStatus('fallback');
    } finally {
      setIsLoading(false);
    }
  };

  // Function to handle model reload
  const handleReloadModel = async () => {
    if (!window.electron || !modelPath) return;
    
    setIsLoading(true);
    setLoadAttempts(prev => prev + 1);
    
    try {
      // First check if Python server is running
      const serverRunning = await window.electron.isPythonServerRunning();
      setPythonServerRunning(serverRunning);
      
      // Always reinitialize in frontend
      await initializeModel(modelPath, true);
      
      // Then reload in Python backend if server is running
      if (serverRunning) {
        const pythonReloadResult = await window.electron.reloadPythonModel(modelPath);
        console.log('Model reload result:', pythonReloadResult);
        
        if (pythonReloadResult.error) {
          console.error('Error from Python model reload:', pythonReloadResult.error);
          setLoadError(`Error from Python server: ${pythonReloadResult.error}`);
          
          // Still mark as loaded but in fallback mode
          setIsModelLoaded(true);
          toast.warning('Model loaded in fallback mode. Some features will be simulated.');
          setModelCheckStatus('fallback');
        } else if (pythonReloadResult.loaded) {
          setIsModelLoaded(true);
          toast.success('Model reloaded successfully in both frontend and Python backend');
          setModelCheckStatus('success');
        } else {
          // Mark as loaded in fallback mode
          setIsModelLoaded(true);
          toast.warning('Model loaded in fallback mode. Some features will be simulated.');
          setModelCheckStatus('fallback');
        }
      } else {
        // Python server not running, using fallback mode
        console.log('Python server not running, using fallback mode');
        setIsModelLoaded(true);
        toast.warning('Python server not running. Model loaded in fallback mode.');
        setModelCheckStatus('fallback');
      }
    } catch (error) {
      console.error('Error reloading model:', error);
      toast.error('Failed to reload model');
      
      // Set fallback mode
      setIsModelLoaded(true);
      toast.warning('Using fallback mode due to error.');
      setModelCheckStatus('fallback');
    } finally {
      setIsLoading(false);
    }
  };

  const renderStatusBadge = () => {
    if (!isModelLoaded) return null;
    
    switch (modelCheckStatus) {
      case 'success':
        return (
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
        );
      case 'fallback':
        return (
          <div className="flex items-center">
            <div className="w-2 h-2 rounded-full bg-amber-500 mr-2"></div>
            <span className="text-sm text-amber-600 flex items-center">
              <AlertTriangle size={14} className="mr-1" />
              Fallback mode (simulated results)
              {modelPath && (
                <span className="text-xs text-gray-500 ml-2 truncate max-w-[200px]" title={modelPath}>
                  ({modelPath})
                </span>
              )}
            </span>
          </div>
        );
      case 'error':
        return (
          <div className="flex items-center">
            <div className="w-2 h-2 rounded-full bg-red-500 mr-2"></div>
            <span className="text-sm text-red-600">Model load failed</span>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <>
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-6">
        <Button 
          onClick={handleLoadModel}
          disabled={isLoading || !electronAvailable}
          className={`${isModelLoaded ? (modelCheckStatus === 'success' ? 'bg-green-500' : 'bg-amber-500') : 'bg-medical-blue'} text-white hover:opacity-90 transition-all`}
        >
          {isLoading ? (
            <>
              <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
              Loading Model...
            </>
          ) : (
            <>
              {isModelLoaded ? <Check size={16} className="mr-2" /> : <Database size={16} className="mr-2" />}
              {isModelLoaded ? (modelCheckStatus === 'fallback' ? 'Model Loaded (Fallback)' : 'Model Loaded') : 'Load Model'}
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
        
        {renderStatusBadge()}
        
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

      {modelCheckStatus === 'fallback' && pythonServerRunning === false && (
        <Alert className="mb-6 bg-amber-50 border-amber-200">
          <AlertTriangle className="h-4 w-4 text-amber-700" />
          <AlertTitle className="text-amber-700">Python Server Not Running</AlertTitle>
          <AlertDescription>
            <p>The Python backend server is not responding. Analysis will use simulated results.</p>
            <ul className="list-disc pl-6 mt-2 text-sm">
              <li>Check that the server is running in your terminal/console</li>
              <li>Ensure that port 5000 is not blocked by a firewall</li>
              <li>Try restarting the application</li>
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {Object.keys(environmentInfo).length > 0 && (
        <Accordion type="single" collapsible className="mb-6">
          <AccordionItem value="environment">
            <AccordionTrigger className="text-sm font-medium">
              Python Environment Diagnostics
            </AccordionTrigger>
            <AccordionContent>
              <div className="text-sm bg-gray-50 p-3 rounded-md">
                {environmentInfo.error ? (
                  <div className="text-red-600 mb-2">Error: {environmentInfo.error}</div>
                ) : (
                  <>
                    <div className="mb-2">
                      <span className="font-semibold">Python Version:</span> {environmentInfo.python_version || 'Unknown'}
                    </div>
                    <div className="mb-2">
                      <span className="font-semibold">Platform:</span> {environmentInfo.platform || 'Unknown'}
                    </div>
                    <div className="mb-2">
                      <span className="font-semibold">Modules:</span>
                      <ul className="list-disc pl-6 mt-1">
                        {environmentInfo.modules && Object.entries(environmentInfo.modules).map(([name, info]: [string, any]) => (
                          <li key={name}>
                            {name}: {info.installed ? 
                              <span className="text-green-600">Installed (v{info.version || 'unknown'})</span> : 
                              <span className="text-red-600">Not installed</span>
                            }
                          </li>
                        ))}
                      </ul>
                    </div>
                  </>
                )}
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
                    pip install tensorflow==2.10.0 keras==2.10.0 h5py==3.1.0
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
