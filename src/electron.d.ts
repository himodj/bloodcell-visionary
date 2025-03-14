
interface ElectronAPI {
  selectModel: () => Promise<string | null>;
  getModelDir: (modelJsonPath: string) => Promise<string>;
  isElectron: boolean;
}

interface Window {
  electron?: ElectronAPI;
}
