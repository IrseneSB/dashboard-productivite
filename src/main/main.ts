// Main process entry point: owns the window, the database and the use cases.

import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { app, BrowserWindow, dialog } from 'electron';
import started from 'electron-squirrel-startup';
import { createUseCases } from '../application/use-cases';
import { createSqliteStore, openDatabase } from '../data/sqlite-store';
import { exportToFile } from './export-file';
import { registerIpcHandlers } from './ipc';
import { createStartup } from './startup';

// The Windows installer (Squirrel) launches the app once with special
// arguments to create shortcuts; in that case we must exit immediately.
if (started) {
  app.quit();
}

// End-to-end tests point the app at a throwaway data folder so they never
// read or modify the real database. Must run before anything uses userData.
// Ignored in the installed app: a stray environment variable must never make
// a user's real data look lost.
if (!app.isPackaged && process.env.DASHBOARD_USER_DATA) {
  app.setPath('userData', process.env.DASHBOARD_USER_DATA);
}

// Only one instance may run: two processes writing to the same database file
// is a recipe for confusing bugs. A second launch focuses the existing window.
if (!app.requestSingleInstanceLock()) {
  app.quit();
}

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 760,
    title: 'Productivity Dashboard',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      // Defaults made explicit: the UI is isolated from Node.js.
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }
  mainWindow.on('closed', () => (mainWindow = null));
}

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

app.whenReady().then(() => {
  // userData is a per-user folder (%APPDATA%\Productivity Dashboard on Windows),
  // outside the install folder and outside the git repository.
  const dbPath = path.join(app.getPath('userData'), 'dashboard.db');
  try {
    const db = openDatabase(dbPath);
    app.on('will-quit', () => db.close());
    const useCases = createUseCases({
      store: createSqliteStore(db),
      now: () => new Date(),
      newId: () => randomUUID(),
    });
    const startup = createStartup(app, process.execPath);
    registerIpcHandlers({
      ...useCases,
      getStartupState: () => startup.getState(),
      setStartAtLogin: (enabled: boolean) => startup.setEnabled(enabled),
      exportToFile: () =>
        exportToFile(dialog, mainWindow, app.getPath('documents'), () =>
          useCases.exportData(),
        ),
    });
  } catch (error) {
    // Without a database the app is useless; say so plainly and where the file is.
    console.error('[main] cannot open database', error);
    dialog.showErrorBox(
      'Cannot open your data',
      `The database could not be opened:\n${dbPath}\n\n${String(error)}\n\nSchema upgrades run in transactions, so a failed upgrade leaves the file as it was.`,
    );
    app.quit();
    return;
  }

  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
