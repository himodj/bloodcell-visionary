interface BcvModelFile {
  success: boolean;
  bytes?: Uint8Array;
  meta?: {
    name: string;
    version?: string;
    description?: string;
    inputSize: number;
    scale: number;
    labels: string[];
    abnormalLabels?: string[];
  };
  path?: string;
  fileName?: string;
  isDefault?: boolean;
  size?: number;
  sha256?: string;
  error?: string;
}

interface ElectronAPI {
  isElectron: boolean;

  getAppInfo: () => Promise<{
    version: string;
    electron: string;
    chrome: string;
    node: string;
    platform: string;
    arch: string;
    osVersion: string;
    logPath: string;
    reportsDir: string;
    packaged: boolean;
  }>;
  openLogFile: () => Promise<void>;
  openReportsDir: () => Promise<void>;
  log: (level: string, message: string) => void;

  loadModelFile: () => Promise<BcvModelFile>;
  browseForModel: () => Promise<{ success: boolean; canceled?: boolean; path?: string; error?: string }>;
  resetModel: () => Promise<{ success: boolean }>;
  getSelfTestSamples: () => Promise<{
    success: boolean;
    samples: Array<{ name: string; expected: string; dataUrl: string }>;
    source?: string;
    error?: string;
  }>;

  getSetting: (key: string) => Promise<any>;
  setSetting: (key: string, value: unknown) => Promise<{ success: boolean }>;

  archiveAllocate: () => Promise<{ reportId: string; createdAt: string }>;
  archiveSave: (payload: {
    folderPath?: string;
    record: Record<string, unknown>;
    html: string;
    images: { annotated?: string; original?: string };
  }) => Promise<{ success: boolean; folderPath?: string; updatedAt?: string; error?: string }>;
  archiveList: () => Promise<{ success: boolean; reports: BcvArchiveEntry[]; archiveDir?: string; error?: string }>;
  archiveLoad: (folderPath: string) => Promise<{
    success: boolean;
    record?: any;
    image?: string | null;
    hasOriginal?: boolean;
    folderPath?: string;
    error?: string;
  }>;
  archiveDelete: (folderPath: string) => Promise<{ success: boolean; error?: string }>;
  archiveOpenFolder: (folderPath: string) => Promise<{ success: boolean; error?: string }>;

  printReport: (payload: { html: string; pageSize?: string; landscape?: boolean }) => Promise<{
    success: boolean;
    canceled?: boolean;
    error?: string;
  }>;
  onMenuCommand: (callback: (command: 'print' | 'pdf' | 'save') => void) => () => void;
  exportReportPdf: (payload: { html: string; folderPath?: string; fileName?: string; footerText?: string; open?: boolean }) => Promise<{
    success: boolean;
    canceled?: boolean;
    filePath?: string;
    error?: string;
  }>;
}

interface BcvArchiveEntry {
  id: string;
  folderPath: string;
  reportId: string;
  patientName: string;
  patientId: string;
  age: string;
  gender: string;
  createdAt: string;
  updatedAt: string;
  cellCount: number;
  cellType: string;
  summary: string;
  legacy: boolean;
}

interface Window {
  electron?: ElectronAPI;
}
