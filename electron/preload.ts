import { contextBridge, ipcRenderer } from 'electron';
import type { DesktopAppInfo, HitDesktopApi, UpdaterStatus } from './types.js';

const api: HitDesktopApi = {
    getAppInfo: () => ipcRenderer.invoke('app:get-info') as Promise<DesktopAppInfo>,
    getUpdaterStatus: () => ipcRenderer.invoke('updater:get-status') as Promise<UpdaterStatus | null>,
    checkForUpdates: () => ipcRenderer.invoke('updater:check') as Promise<void>,
    installUpdate: () => ipcRenderer.invoke('updater:install') as Promise<void>,
    setTheme: (theme) => ipcRenderer.invoke('app:set-theme', theme) as Promise<void>,
    onUpdaterStatus: (callback) => {
        const handler = (_event: Electron.IpcRendererEvent, status: UpdaterStatus) => {
            callback(status);
        };
        ipcRenderer.on('updater:status', handler);
        return () => {
            ipcRenderer.removeListener('updater:status', handler);
        };
    },
};

contextBridge.exposeInMainWorld('hitDesktop', api);
