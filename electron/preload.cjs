const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('formaDesktop', {
  getVersion: () => ipcRenderer.invoke('forma:version'),
  loadWorkspace: () => ipcRenderer.invoke('forma:workspace:load'),
  saveWorkspace: state => ipcRenderer.invoke('forma:workspace:save', state),
  checkForUpdates: () => ipcRenderer.invoke('forma:check-for-updates'),
  onUpdateStatus: callback => {
    if (typeof callback !== 'function') return () => {};
    const listener = (_event, status) => callback(status);
    ipcRenderer.on('forma:update-status', listener);
    return () => ipcRenderer.removeListener('forma:update-status', listener);
  }
});
