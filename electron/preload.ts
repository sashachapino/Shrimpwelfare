import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods to the renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  // Check if running in Electron
  isElectron: true,

  // Get Dropbox path
  getDropboxPath: () => ipcRenderer.invoke('get-dropbox-path'),

  // Get backup folder path
  getBackupFolder: () => ipcRenderer.invoke('get-backup-folder'),

  // Save backup to Dropbox folder
  saveBackup: (data: string) => ipcRenderer.invoke('save-backup', data),

  // List available backups
  listBackups: () => ipcRenderer.invoke('list-backups'),

  // Read a specific backup file
  readBackup: (filepath: string) => ipcRenderer.invoke('read-backup', filepath),

  // Open file picker to select a backup
  selectBackupFile: () => ipcRenderer.invoke('select-backup-file'),
});

// Type definitions for the exposed API
declare global {
  interface Window {
    electronAPI?: {
      isElectron: boolean;
      getDropboxPath: () => Promise<string | null>;
      getBackupFolder: () => Promise<string | null>;
      saveBackup: (data: string) => Promise<{ success: boolean; path?: string; error?: string }>;
      listBackups: () => Promise<Array<{ name: string; path: string; date: Date }>>;
      readBackup: (filepath: string) => Promise<string | null>;
      selectBackupFile: () => Promise<string | null>;
    };
  }
}
