
interface ElectronAPI {
  selectModel: () => Promise<string | null>;
  getDefaultModelPath: () => Promise<string | null>;
  getModelDir: (modelJsonPath: string) => Promise<string>;
  checkModelFormat: (modelPath: string) => Promise<{format?: string, path?: string, error?: string}>;
  readModelFile: (filePath: string) => Promise<{success: boolean, data?: string, error?: string}>;
  readModelDir: (dirPath: string) => Promise<string[] | {error: string}>;
  checkFileExists: (filePath: string) => Promise<boolean>;
  browseForModel: () => Promise<string | null>;
  isElectron: boolean;
  reloadPythonModel: (modelPath: string) => Promise<{
    success?: boolean;
    loaded?: boolean;
    path?: string;
    error?: string;
    stack?: string;
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
  }>;
}

interface Window {
  electron?: ElectronAPI;
}
