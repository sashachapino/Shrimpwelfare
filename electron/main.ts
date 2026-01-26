import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

// Handle creating/removing shortcuts on Windows when installing/uninstalling
if (require('electron-squirrel-startup')) {
  app.quit();
}

let mainWindow: BrowserWindow | null = null;

// Get the default Dropbox folder path
function getDropboxPath(): string | null {
  const homeDir = os.homedir();

  // Common Dropbox folder locations
  const possiblePaths = [
    path.join(homeDir, 'Dropbox'),
    path.join(homeDir, 'Dropbox (Personal)'),
    path.join(homeDir, 'Dropbox (Business)'),
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }

  return null;
}

// Get or create the backup folder
function getBackupFolder(): string | null {
  const dropboxPath = getDropboxPath();
  if (!dropboxPath) return null;

  const backupFolder = path.join(dropboxPath, 'CoachingCRM-Backups');

  if (!fs.existsSync(backupFolder)) {
    fs.mkdirSync(backupFolder, { recursive: true });
  }

  return backupFolder;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#faf9f7',
  });

  // In development, load from Vite dev server
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    // In production, load the built files
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// IPC handlers for file system operations
ipcMain.handle('get-dropbox-path', () => {
  return getDropboxPath();
});

ipcMain.handle('get-backup-folder', () => {
  return getBackupFolder();
});

ipcMain.handle('save-backup', async (_event, data: string) => {
  const backupFolder = getBackupFolder();

  if (!backupFolder) {
    // Dropbox not found, ask user to choose a folder
    const result = await dialog.showOpenDialog(mainWindow!, {
      properties: ['openDirectory', 'createDirectory'],
      title: 'Choose Backup Location',
      message: 'Dropbox folder not found. Choose where to save backups.',
    });

    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, error: 'No folder selected' };
    }

    const customFolder = path.join(result.filePaths[0], 'CoachingCRM-Backups');
    if (!fs.existsSync(customFolder)) {
      fs.mkdirSync(customFolder, { recursive: true });
    }

    const filename = `backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    const filepath = path.join(customFolder, filename);

    fs.writeFileSync(filepath, data, 'utf-8');
    return { success: true, path: filepath };
  }

  const filename = `backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  const filepath = path.join(backupFolder, filename);

  fs.writeFileSync(filepath, data, 'utf-8');

  // Clean up old backups (keep last 30)
  cleanupOldBackups(backupFolder, 30);

  return { success: true, path: filepath };
});

ipcMain.handle('list-backups', () => {
  const backupFolder = getBackupFolder();
  if (!backupFolder) return [];

  try {
    const files = fs.readdirSync(backupFolder)
      .filter(f => f.endsWith('.json') && f.startsWith('backup-'))
      .map(f => ({
        name: f,
        path: path.join(backupFolder, f),
        date: fs.statSync(path.join(backupFolder, f)).mtime,
      }))
      .sort((a, b) => b.date.getTime() - a.date.getTime());

    return files;
  } catch {
    return [];
  }
});

ipcMain.handle('read-backup', (_event, filepath: string) => {
  try {
    return fs.readFileSync(filepath, 'utf-8');
  } catch {
    return null;
  }
});

ipcMain.handle('select-backup-file', async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openFile'],
    filters: [{ name: 'Backup Files', extensions: ['json'] }],
    title: 'Select Backup File',
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  try {
    return fs.readFileSync(result.filePaths[0], 'utf-8');
  } catch {
    return null;
  }
});

function cleanupOldBackups(folder: string, keepCount: number) {
  try {
    const files = fs.readdirSync(folder)
      .filter(f => f.endsWith('.json') && f.startsWith('backup-'))
      .map(f => ({
        name: f,
        path: path.join(folder, f),
        date: fs.statSync(path.join(folder, f)).mtime,
      }))
      .sort((a, b) => b.date.getTime() - a.date.getTime());

    // Delete files beyond the keep count
    for (let i = keepCount; i < files.length; i++) {
      fs.unlinkSync(files[i].path);
    }
  } catch (err) {
    console.error('Error cleaning up old backups:', err);
  }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
