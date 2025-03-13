
interface ElectronAPI {
  selectModel: () => Promise<string | null>;
  getModelDir: (modelJsonPath: string) => Promise<string>;
}

interface Window {
  electron?: ElectronAPI;
}
