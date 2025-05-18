
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Database, Check, RefreshCw, Download, FileWarning, Activity, AlertTriangle, PackageOpen } from 'lucide-react';
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { isModelInitialized, initializeModel } from "../utils/analysisUtils";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";

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
  const [modelCheckStatus, setModelCheckStatus] = useState<'unchecked' | 'checking' | 'success' | 'error'>('unchecked');
  const [pythonServerRunning, setPythonServerRunning] = useState<boolean | null>(null);
  const [lastCheckTime, setLastCheckTime] = useState(0);
  const [isInstallingRequirements, setIsInstallingRequirements] = useState(false);
  const [requirementsStatus, setRequirementsStatus] = useState<{
    all_ok: boolean;
    missing_packages: string[];
    incorrect_versions: string[];
  } | null>(null);
  const [backendModelLoaded, setBackendModelLoaded] = useState(false);

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

      // Set up a periodic check for model state and server status
      const interval = setInterval(async () => {
        // Check if model is initialized
        const modelInitialized = isModelInitialized();
        console.log('Model initialized check:', modelInitialized);
        setIsModelLoaded(modelInitialized && backendModelLoaded);
        
        // If more than 10 seconds have passed since last check, check server status
        const now = Date.now();
        if (window.electron && now - lastCheckTime > 10000) {
          setLastCheckTime(now); // Update last check time
          try {
            // Check if the Python server is running
            const serverRunning = await window.electron.isPythonServerRunning();
            setPythonServerRunning(serverRunning);
            
            if (!serverRunning) {
              setModelCheckStatus('error');
              setBackendModelLoaded(false);
              console.log('Python server not running');
              if (isModelLoaded) {
                // If model was previously loaded but server is now down
                setIsModelLoaded(false);
                toast.error('Python server is no longer running. Analysis will not work.');
              }
            } else if (serverRunning) {
              // If server is running, check if it has the model loaded
              // This uses the enhanced /health endpoint we added
              try {
                const response = await fetch('http://localhost:5000/health');
                const data = await response.json();
                
                if (response.status === 200 && data.model_loaded) {
                  setBackendModelLoaded(true);
                  if (modelInitialized) {
                    setModelCheckStatus('success');
                  }
                } else {
                  setBackendModelLoaded(false);
                  setModelCheckStatus('error');
                }
              } catch (err) {
                console.error('Error checking model status:', err);
                setBackendModelLoaded(false);
                setModelCheckStatus('error');
              }
            }
          } catch (err) {
            console.error('Error checking Python server status:', err);
            setPythonServerRunning(false);
            setModelCheckStatus('error');
          }
        }
      }, 2000);

      return () => clearInterval(interval);
    } catch (err) {
      console.error('Error in ModelLoader useEffect:', err);
    }
  }, [lastCheckTime, backendModelLoaded]);

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
      return { loaded: false, error: 'Electron not available' };
    }
    
    setModelCheckStatus('checking');
    try {
      // If model path is available, try to reload it
      const path = modelPath || await window.electron.getDefaultModelPath();
      
      if (path) {
        // First check if Python server is running
        const serverRunning = await window.electron.isPythonServerRunning();
        
        if (!serverRunning) {
          setModelCheckStatus('error');
          setBackendModelLoaded(false);
          return { loaded: false, error: 'Python server not running' };
        }
        
        console.log("Checking Python model status for path:", path);
        const result = await window.electron.reloadPythonModel(path);
        console.log("Python model status result:", result);
        
        if (result.success) {
          setModelCheckStatus('success');
          setBackendModelLoaded(true);
          return { loaded: true };
        } else {
          setModelCheckStatus('error');
          setBackendModelLoaded(false);
          return { loaded: false, error: result.error || 'Unknown error' };
        }
      }
      
      setModelCheckStatus('error');
      setBackendModelLoaded(false);
      return { loaded: false, error: 'No model path' };
    } catch (err) {
      console.error('Error checking Python model status:', err);
      setModelCheckStatus('error');
      setBackendModelLoaded(false);
      return { loaded: false, error: String(err) };
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
      
      // Update requirements status if available
      if (envInfo.requirements_check) {
        setRequirementsStatus(envInfo.requirements_check);
      }
      
      if (envInfo.error) {
        toast.error(`Could not retrieve environment info: ${envInfo.error}`);
      } else {
        toast.success('Environment diagnostics retrieved successfully');
        
        // Check for issues that would prevent model loading
        if (envInfo.modules) {
          const kerasIssue = !envInfo.modules.keras?.installed;
          const tensorflowIssue = !envInfo.modules.tensorflow?.installed;
          const h5pyIssue = !envInfo.modules.h5py?.installed;
          
          if (kerasIssue || tensorflowIssue || h5pyIssue) {
            setShowAdvancedHelp(true);
            toast.error('Missing required dependencies. Please check the environment details below.');
          }
        }
        
        // Check if the model is loaded in the backend
        setBackendModelLoaded(envInfo.default_model_loaded === true);
      }
    } catch (error) {
      console.error('Error checking environment:', error);
      toast.error('Failed to check environment');
    } finally {
      setIsCheckingEnv(false);
    }
  };

  // Function to install required packages
  const installRequiredPackages = async () => {
    if (!window.electron) {
      toast.error('Package installation requires the desktop application');
      return;
    }
    
    setIsInstallingRequirements(true);
    
    try {
      // First check if Python server is running
      const serverRunning = await window.electron.isPythonServerRunning();
      
      if (!serverRunning) {
        toast.error('Python server is not running. Cannot install packages.');
        setIsInstallingRequirements(false);
        return;
      }
      
      // Make a POST request to install packages
      const response = await fetch('http://localhost:5000/install_requirements', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });
      
      const result = await response.json();
      console.log("Installation result:", result);
      
      if (result.message) {
        toast.success(result.message);
        toast.info('Please restart the application after installation for changes to take effect.');
      } else {
        toast.error('Failed to install packages');
      }
      
      // Re-check environment after installation
      await checkEnvironment();
      
    } catch (error) {
      console.error('Error installing packages:', error);
      toast.error('Failed to install packages');
    } finally {
      setIsInstallingRequirements(false);
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
        
        if (!serverRunning) {
          setLoadError('Python server is not running. Please restart the application.');
          setIsModelLoaded(false);
          setBackendModelLoaded(false);
          setModelCheckStatus('error');
          toast.error('Python server not running. Please restart the application.');
          return;
        }
        
        // Initialize the model in our front-end
        const frontendInitSuccess = await initializeModel(modelPath);
        
        if (!frontendInitSuccess) {
          setLoadError('Failed to initialize model in frontend.');
          setIsModelLoaded(false);
          setBackendModelLoaded(false);
          setModelCheckStatus('error');
          return;
        }
        
        // Now try to load in Python backend
        console.log('Loading model in Python backend...');
        const pythonReloadResult = await window.electron.reloadPythonModel(modelPath);
        console.log('Python model reload result:', pythonReloadResult);
        
        if (pythonReloadResult.error) {
          console.error('Error from Python model reload:', pythonReloadResult.error);
          
          // Show more detailed error message
          let errorMsg = `Error loading model: ${pythonReloadResult.error}`;
          setLoadError(errorMsg);
          setIsModelLoaded(frontendInitSuccess); // Frontend might be ok but backend is not
          setBackendModelLoaded(false);
          setModelCheckStatus('error');
          
          // Based on environment info, try to provide more guidance
          try {
            const envInfo = await window.electron.getPythonEnvironmentInfo();
            setEnvironmentInfo(envInfo);
            
            if (envInfo && envInfo.modules) {
              // Provide version compatibility information if available
              if (envInfo.modules.tensorflow && envInfo.modules.keras) {
                setLoadError((prevError) => `${prevError}\n\nTensorFlow version: ${envInfo.modules.tensorflow.version || 'unknown'}\nKeras version: ${envInfo.modules.keras.version || 'unknown'}`);
              }
              
              // Show advanced help if we detect issues
              setShowAdvancedHelp(true);
              
              // Update requirements status if available
              if (envInfo.requirements_check) {
                setRequirementsStatus(envInfo.requirements_check);
              }
            }
          } catch (envError) {
            console.error('Failed to get environment info:', envError);
          }
          
          // Very important: let the user know they can't use analysis features
          toast.error('Backend model loading failed. Analysis features will not be available.');
          
          return;
        }
        
        if (pythonReloadResult.success) {
          setIsModelLoaded(frontendInitSuccess);
          setBackendModelLoaded(true);
          toast.success(`Model loaded successfully from: ${modelPath}`);
          setModelCheckStatus('success');
        } else {
          // Error loading model
          setIsModelLoaded(frontendInitSuccess);
          setBackendModelLoaded(false);
          toast.error('Failed to load model on Python server. Analysis features will not be available.');
          setModelCheckStatus('error');
          setShowAdvancedHelp(true);
        }
      } else {
        const errorMsg = 'No model.h5 found. Please place model.h5 in the same folder as the application.';
        console.warn(errorMsg);
        setLoadError(errorMsg);
        toast.warning(errorMsg);
        setModelCheckStatus('error');
        setIsModelLoaded(false);
        setBackendModelLoaded(false);
      }
    } catch (error) {
      console.error('Error loading default model:', error);
      const errorMessage = typeof error === 'string' ? error : error instanceof Error ? error.message : 'Failed to load default model';
      setLoadError(errorMessage);
      toast.error(errorMessage);
      setModelCheckStatus('error');
      setIsModelLoaded(false);
      setBackendModelLoaded(false);
      setShowAdvancedHelp(true);
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
      
      if (!serverRunning) {
        setLoadError('Python server is not running. Please restart the application.');
        setIsModelLoaded(false);
        setBackendModelLoaded(false);
        setModelCheckStatus('error');
        toast.error('Python server not running. Please restart the application.');
        setIsLoading(false);
        return;
      }
      
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
          setIsModelLoaded(false);
          setBackendModelLoaded(false);
          setModelCheckStatus('error');
          setIsLoading(false);
          return;
        }
        
        // Now try to load in Python backend
        console.log('Loading model in Python backend...');
        const pythonReloadResult = await window.electron.reloadPythonModel(selectedPath);
        
        if (pythonReloadResult.error) {
          console.error('Error from Python model reload:', pythonReloadResult.error);
          setLoadError(`Error loading model: ${pythonReloadResult.error}`);
          setIsModelLoaded(frontendInitSuccess);
          setBackendModelLoaded(false);
          setModelCheckStatus('error');
          setIsLoading(false);
          setShowAdvancedHelp(true);
          toast.error('Backend model loading failed. Analysis features will not be available.');
          return;
        }
        
        if (pythonReloadResult.success) {
          setIsModelLoaded(frontendInitSuccess);
          setBackendModelLoaded(true);
          setModelCheckStatus('success');
          toast.success(`Model loaded successfully from: ${selectedPath}`);
        } else {
          setIsModelLoaded(frontendInitSuccess);
          setBackendModelLoaded(false);
          setModelCheckStatus('error');
          toast.error('Failed to load model on Python server. Analysis features will not be available.');
          setShowAdvancedHelp(true);
        }
      } else {
        // User cancelled the selection
        console.log('User cancelled model selection');
        // Keep previous state
      }
    } catch (error) {
      console.error('Error during custom model loading:', error);
      const errorMessage = typeof error === 'string' ? error : error instanceof Error ? error.message : 'Unknown error during model loading';
      setLoadError(errorMessage);
      toast.error(errorMessage);
      setModelCheckStatus('error');
      setIsModelLoaded(false);
      setBackendModelLoaded(false);
      setShowAdvancedHelp(true);
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
      
      if (!serverRunning) {
        setLoadError('Python server is not running. Please restart the application.');
        setIsModelLoaded(false);
        setBackendModelLoaded(false);
        setModelCheckStatus('error');
        toast.error('Python server not running. Please restart the application.');
        setIsLoading(false);
        return;
      }
      
      // Always reinitialize in frontend
      const frontendInitSuccess = await initializeModel(modelPath);
      
      // Then reload in Python backend if server is running
      if (serverRunning) {
        const pythonReloadResult = await window.electron.reloadPythonModel(modelPath);
        console.log('Model reload result:', pythonReloadResult);
        
        if (pythonReloadResult.error) {
          console.error('Error from Python model reload:', pythonReloadResult.error);
          setLoadError(`Error from Python server: ${pythonReloadResult.error}`);
          setIsModelLoaded(frontendInitSuccess);
          setBackendModelLoaded(false);
          setModelCheckStatus('error');
        } else if (pythonReloadResult.success) {
          setIsModelLoaded(frontendInitSuccess);
          setBackendModelLoaded(true);
          toast.success('Model reloaded successfully in both frontend and Python backend');
          setModelCheckStatus('success');
        } else {
          setIsModelLoaded(frontendInitSuccess);
          setBackendModelLoaded(false);
          toast.error('Failed to reload model on Python server. Analysis features will not be available.');
          setModelCheckStatus('error');
        }
      } else {
        // Python server not running
        console.log('Python server not running');
        toast.error('Python server is not running. Please restart the application.');
        setIsModelLoaded(frontendInitSuccess);
        setBackendModelLoaded(false);
        setModelCheckStatus('error');
      }
    } catch (error) {
      console.error('Error reloading model:', error);
      toast.error('Failed to reload model');
      setIsModelLoaded(false);
      setBackendModelLoaded(false);
      setModelCheckStatus('error');
    } finally {
      setIsLoading(false);
    }
  };

  const renderStatusBadge = () => {
    if (!isModelLoaded) return null;
    
    if (backendModelLoaded && modelCheckStatus === 'success') {
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
    } else if (isModelLoaded && !backendModelLoaded) {
      return (
        <div className="flex items-center">
          <div className="w-2 h-2 rounded-full bg-amber-500 mr-2"></div>
          <span className="text-sm text-amber-600">Model partially loaded (frontend only, analysis unavailable)</span>
        </div>
      );
    } else {
      return (
        <div className="flex items-center">
          <div className="w-2 h-2 rounded-full bg-red-500 mr-2"></div>
          <span className="text-sm text-red-600">Model load failed</span>
        </div>
      );
    }
  };

  return (
    <>
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-6">
        <Button 
          onClick={handleLoadModel}
          disabled={isLoading || !electronAvailable}
          className={`${isModelLoaded && backendModelLoaded ? 'bg-green-500' : 'bg-medical-blue'} text-white hover:opacity-90 transition-all`}
        >
          {isLoading ? (
            <>
              <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
              Loading Model...
            </>
          ) : (
            <>
              {isModelLoaded && backendModelLoaded ? <Check size={16} className="mr-2" /> : <Database size={16} className="mr-2" />}
              {isModelLoaded && backendModelLoaded ? 'Model Loaded' : 'Load Model'}
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
        
        {requirementsStatus && !requirementsStatus.all_ok && (
          <Button
            variant="outline"
            size="sm"
            className="h-10"
            onClick={installRequiredPackages}
            disabled={isInstallingRequirements || !electronAvailable || !pythonServerRunning}
            title="Install required packages"
          >
            <PackageOpen size={16} className={isInstallingRequirements ? "animate-pulse mr-2" : "mr-2"} />
            Install Requirements
          </Button>
        )}
        
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
        
        {pythonServerRunning === false && (
          <div className="text-sm flex items-center p-2 bg-red-50 rounded border border-red-200">
            <AlertTriangle size={16} className="text-red-600 mr-2" />
            <span className="text-red-600">Python server not running</span>
          </div>
        )}
        
        {isModelLoaded && !backendModelLoaded && (
          <div className="text-sm flex items-center p-2 bg-amber-50 rounded border border-amber-200">
            <AlertTriangle size={16} className="text-amber-600 mr-2" />
            <span className="text-amber-600">Analysis features unavailable - backend model not loaded</span>
          </div>
        )}
      </div>

      {requirementsStatus && !requirementsStatus.all_ok && (
        <Alert variant="destructive" className="mb-6">
          <AlertTitle className="flex items-center">
            <PackageOpen size={16} className="mr-2" />
            Package Requirements Issue Detected
          </AlertTitle>
          <AlertDescription>
            <div className="mt-2">
              {requirementsStatus.missing_packages.length > 0 && (
                <div className="mb-2">
                  <span className="font-semibold">Missing Packages:</span>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {requirementsStatus.missing_packages.map(pkg => (
                      <Badge key={pkg} variant="outline" className="bg-red-50">{pkg}</Badge>
                    ))}
                  </div>
                </div>
              )}
              
              {requirementsStatus.incorrect_versions.length > 0 && (
                <div>
                  <span className="font-semibold">Incorrect Versions:</span>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {requirementsStatus.incorrect_versions.map(pkg => (
                      <Badge key={pkg} variant="outline" className="bg-amber-50">{pkg}</Badge>
                    ))}
                  </div>
                </div>
              )}
              
              <div className="mt-3">
                <p>Click "Install Requirements" to automatically install the correct package versions.</p>
                <p className="text-xs mt-1">Note: The application may need to be restarted after installation.</p>
              </div>
            </div>
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
                      <span className="font-semibold">Model Loading State:</span> {
                        environmentInfo.default_model_loaded ? 
                          <span className="text-green-600">Loaded successfully</span> : 
                          <span className="text-red-600">Not loaded</span>
                      }
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
          <AlertTitle className="flex items-center">
            <AlertTriangle size={16} className="mr-2" />
            Error Loading Model
          </AlertTitle>
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
                  <li>Check if the model.h5 file is valid and in the correct location</li>
                  <li>Try reinstalling dependencies with specific versions:</li>
                  <code className="block bg-black text-white p-2 mt-1 mb-2">
                    pip install tensorflow==2.10.0 keras==2.10.0 h5py==3.7.0 pillow==9.2.0 numpy==1.23.5
                  </code>
                  <li>Restart the application after making changes</li>
                </ol>
                <div className="flex gap-2 mt-2">
                  <Button 
                    onClick={checkEnvironment} 
                    variant="outline" 
                    size="sm" 
                    disabled={isCheckingEnv || !electronAvailable}
                  >
                    <Activity size={14} className="mr-1" /> 
                    Environment Diagnostics
                  </Button>
                  
                  {requirementsStatus && !requirementsStatus.all_ok && (
                    <Button 
                      onClick={installRequiredPackages} 
                      variant="outline" 
                      size="sm" 
                      disabled={isInstallingRequirements || !electronAvailable || !pythonServerRunning}
                    >
                      <PackageOpen size={14} className="mr-1" /> 
                      Install Requirements
                    </Button>
                  )}
                </div>
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
      
      {isModelLoaded && !backendModelLoaded && (
        <Alert variant="warning" className="mb-6 bg-amber-50 border-amber-200">
          <AlertTitle className="text-amber-800">Limited Functionality</AlertTitle>
          <AlertDescription className="text-amber-700">
            <p>The model has been loaded in the frontend but failed to load in the Python backend.</p>
            <p className="mt-2">
              Some features may work, but analysis of images will not be available. Try reloading the model or check the environment diagnostics.
            </p>
          </AlertDescription>
        </Alert>
      )}
    </>
  );
};

export default ModelLoader;
