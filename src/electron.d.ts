
interface ElectronAPI {
  selectModel: () => Promise<string | null>;
  getDefaultModelPath: () => Promise<string | null>;
  getModelDir: (modelJsonPath: string) => Promise<string>;
  checkModelFormat: (modelPath: string) => Promise<{format?: string, path?: string, error?: string, size?: number}>;
  readModelFile: (filePath: string) => Promise<{success: boolean, data?: string, format?: string, size?: number, error?: string, message?: string}>;
  readModelDir: (dirPath: string) => Promise<string[] | {error: string}>;
  checkFileExists: (filePath: string) => Promise<boolean>;
  browseForModel: () => Promise<string | null>;
  isElectron: boolean;
  isPythonServerRunning: () => Promise<boolean>;
  reloadPythonModel: (modelPath: string) => Promise<{
    success?: boolean;
    loaded?: boolean;
    path?: string;
    error?: string;
    stack?: string;
    details?: string;
    usedFallback?: boolean;
    message?: string;
  }>;
  getPythonEnvironmentInfo: () => Promise<{
    python_version?: string;
    platform?: string;
    default_model_loaded?: boolean;
    default_model_path?: string;
    modules?: Record<string, {
      installed: boolean;
      version?: string;
      path?: string;
    }>;
    error?: string;
    stack?: string;
    details?: string;
    usedFallback?: boolean;
    requirements_check?: {
      all_ok: boolean;
      missing_packages: string[];
      incorrect_versions: string[];
    };
  }>;
  analyzeWithH5Model: (modelPath: string, imageDataUrl: string) => Promise<{
    cell_type?: string;
    confidence?: number;
    all_probabilities?: number[];
    class_labels?: string[];
    detectedCells?: Array<{
      type: string;
      confidence: number;
      boundingBox: {
        x: number;
        y: number;
        width: number;
        height: number;
      };
    }>;
    cellCounts?: Record<string, number>;
    timestamp?: string;
    error?: string;
    stack?: string;
    details?: string;
    usedFallback?: boolean;
  }>;
  checkRequirements: () => Promise<{
    all_ok: boolean;
    missing_packages: string[];
    incorrect_versions: string[];
    error?: string;
    details?: string;
  }>;
  installRequirements: () => Promise<{
    success: boolean;
    message?: string;
    error?: string;
    details?: string;
  }>;
  saveReport: (reportData: any) => Promise<{
    success: boolean;
    filePath?: string;
    folder?: string;
    error?: string;
  }>;
  getPatientReports: () => Promise<{
    success: boolean;
    reports: Array<{
      id: string;
      patientName: string;
      cellType: string;
      reportDate: string;
      folderPath: string;
    }>;
  }>;
  openReportFolder: (folderPath: string) => Promise<void>;
  loadAnalysisFromReport: (folderPath: string) => Promise<{
    success: boolean;
    analysis?: any;
    error?: string;
  }>;
}

interface Window {
  electron?: ElectronAPI;
}
