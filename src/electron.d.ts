
interface ElectronAPI {
  selectModel: () => Promise<string | null>;
  getDefaultModelPath: () => Promise<string | null>;
  getModelDir: (modelJsonPath: string) => Promise<string>;
  checkModelFormat: (modelPath: string) => Promise<{format?: string, path?: string, error?: string}>;
  readModelFile: (filePath: string) => Promise<{success: boolean, data?: string, error?: string}>;
  readModelDir: (dirPath: string) => Promise<string[] | {error: string}>;
  isElectron: boolean;
  analyzeWithH5Model: (modelPath: string, imageDataUrl: string) => Promise<{
    predictedClass?: string;
    confidence?: number;
    timestamp?: string;
    error?: string;
    stack?: string;
  }>;
}

interface Window {
  electron?: ElectronAPI;
}
