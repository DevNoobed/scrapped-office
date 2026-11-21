const { app, BrowserWindow, dialog, ipcMain, Menu, shell } = require('electron');
const { autoUpdater } = require('electron-updater');
const fs = require('node:fs/promises');
const path = require('node:path');

const APP_ID = 'com.forma.workspace';
let mainWindow;
let updatePromptOpen = false;
let workspaceWriteQueue = Promise.resolve();

app.setAppUserModelId(APP_ID);
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;
autoUpdater.allowPrerelease = false;
autoUpdater.logger = console;

function sendUpdateStatus(message, kind = 'info') {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('forma:update-status', { message, kind });
  }
}

async function workspaceFile() {
  return path.join(app.getPath('userData'), 'workspace.json');
}

ipcMain.handle('forma:workspace:load', async () => {
  try {
    const raw = await fs.readFile(await workspaceFile(), 'utf8');
    const state = JSON.parse(raw);
    return {
      documents: Array.isArray(state.documents) ? state.documents : [],
      activeId: typeof state.activeId === 'string' ? state.activeId : ''
    };
  } catch (error) {
    if (error.code !== 'ENOENT') console.error('Could not load workspace:', error);
    return { documents: [], activeId: '' };
  }
});

ipcMain.handle('forma:workspace:save', async (_event, state) => {
  if (!state || !Array.isArray(state.documents) || state.documents.length > 500) {
    throw new Error('Invalid workspace data.');
  }
  const cleanState = {
    documents: state.documents,
    activeId: typeof state.activeId === 'string' ? state.activeId : ''
  };
  workspaceWriteQueue = workspaceWriteQueue.catch(() => {}).then(async () => {
    const target = await workspaceFile();
    const temporary = `${target}.tmp`;
    await fs.writeFile(temporary, JSON.stringify(cleanState), 'utf8');
    await fs.rename(temporary, target);
  });
  await workspaceWriteQueue;
  return true;
});

ipcMain.handle('forma:version', () => app.getVersion());
ipcMain.handle('forma:check-for-updates', async () => {
  if (!app.isPackaged) {
    return { ok: false, message: 'Update checks are available in the installed app.' };
  }
  try {
    sendUpdateStatus('Checking for updates on GitHub…');
    await autoUpdater.checkForUpdates();
    return { ok: true, message: 'Checking GitHub Releases for updates…' };
  } catch (error) {
    console.error('Update check failed:', error);
    return { ok: false, message: 'Could not check for updates. Please try again later.' };
  }
});

function createMenu() {
  const template = [
    {
      label: 'Forma',
      submenu: [
        { label: 'About Forma', click: () => dialog.showMessageBox(mainWindow, {
          type: 'info', title: 'About Forma', message: `Forma ${app.getVersion()}`,
          detail: 'Your creative workspace. Presentations are saved locally on this device.'
        }) },
        { type: 'separator' },
        { label: 'Check for Updates…', click: () => checkForUpdatesManually() },
        { type: 'separator' },
        { role: 'quit', label: 'Quit Forma' }
      ]
    },
    { label: 'Edit', submenu: [{ role: 'undo' }, { role: 'redo' }, { type: 'separator' }, { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }] },
    { label: 'View', submenu: [{ role: 'reload' }, { role: 'toggleDevTools' }, { type: 'separator' }, { role: 'togglefullscreen' }] },
    { label: 'Window', submenu: [{ role: 'minimize' }, { role: 'close' }] },
    { label: 'Help', submenu: [
      { label: 'Forma on GitHub', click: () => shell.openExternal('https://github.com/DevNoobed/scrapped-office') },
      { label: 'Check for Updates…', click: () => checkForUpdatesManually() }
    ] }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

async function checkForUpdatesManually() {
  if (!app.isPackaged) {
    await dialog.showMessageBox(mainWindow, { type: 'info', message: 'Update checks are available in the installed app.' });
    return;
  }
  try {
    sendUpdateStatus('Checking for updates on GitHub…');
    await autoUpdater.checkForUpdates();
  } catch (error) {
    console.error('Update check failed:', error);
    await dialog.showMessageBox(mainWindow, {
      type: 'warning', title: 'Update check failed',
      message: 'Forma could not check GitHub Releases for an update.',
      detail: 'Check your internet connection and try again.'
    });
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1460,
    height: 930,
    minWidth: 830,
    minHeight: 620,
    show: false,
    backgroundColor: '#f7f8fc',
    title: 'Forma',
    autoHideMenuBar: true,
    icon: path.join(__dirname, '..', 'build', 'forma.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.on('closed', () => { mainWindow = null; });
  mainWindow.loadFile(path.join(__dirname, '..', 'index.html'));
  createMenu();
}

function configureUpdater() {
  if (!app.isPackaged) return;
  autoUpdater.on('checking-for-update', () => sendUpdateStatus('Checking for updates…'));
  autoUpdater.on('update-available', info => {
    sendUpdateStatus(`Forma ${info.version} is downloading in the background.`, 'success');
  });
  autoUpdater.on('update-not-available', () => {
    sendUpdateStatus('You’re up to date.', 'success');
  });
  autoUpdater.on('error', error => {
    console.error('Automatic update error:', error);
    sendUpdateStatus('Update check did not finish. You can try again from Help → Check for Updates.', 'error');
  });
  autoUpdater.on('download-progress', progress => {
    sendUpdateStatus(`Downloading update… ${Math.round(progress.percent)}%`, 'progress');
  });
  autoUpdater.on('update-downloaded', async info => {
    sendUpdateStatus(`Forma ${info.version} is ready to install.`, 'success');
    if (updatePromptOpen) return;
    updatePromptOpen = true;
    const result = await dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Forma update ready',
      message: `Forma ${info.version} has downloaded.`,
      detail: 'Your presentations and settings will stay on this device. Restart now to finish installing, or choose Later and Forma will install the update when you quit.',
      buttons: ['Restart now', 'Later'],
      defaultId: 0,
      cancelId: 1,
      noLink: true
    });
    updatePromptOpen = false;
    if (result.response === 0) autoUpdater.quitAndInstall();
  });
  setTimeout(() => {
    if (app.isReady()) autoUpdater.checkForUpdates().catch(error => console.error('Startup update check failed:', error));
  }, 5000);
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });
  app.whenReady().then(() => {
    createWindow();
    configureUpdater();
    app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
  });
  app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
}
