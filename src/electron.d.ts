// Type definitions for Electron preload API

interface ElectronAPI {
  isElectron: boolean;
  getDropboxPath: () => Promise<string | null>;
  getBackupFolder: () => Promise<string | null>;
  saveBackup: (data: string) => Promise<{ success: boolean; path?: string; error?: string }>;
  listBackups: () => Promise<Array<{ name: string; path: string; date: Date }>>;
  readBackup: (filepath: string) => Promise<string | null>;
  selectBackupFile: () => Promise<string | null>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};
