import { app, BrowserWindow, dialog, ipcMain, nativeTheme, shell } from 'electron';
import electronUpdater, { type ProgressInfo, type UpdateInfo } from 'electron-updater';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { startServer, type RunningServer } from '../server/index.js';
import type { DesktopAppInfo, Distribution, UpdaterStatus } from './types.js';

const { autoUpdater } = electronUpdater;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const GITHUB_OWNER = 'mwongr';
const GITHUB_REPO = 'household-investment-tracker';
const GITHUB_REPO_URL = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}`;
const FOUR_HOURS_MS = 4 * 60 * 60 * 1000;

const isDev = !app.isPackaged;
const distribution: Distribution = app.isPackaged ? 'exe' : 'diy';
const PREFERRED_PORT = isDev ? 3001 : 47821;

let mainWindow: BrowserWindow | null = null;
let server: RunningServer | null = null;
let dataDir = '';
let lastUpdaterStatus: UpdaterStatus | null = null;
let isQuitting = false;
let updateCheckInterval: ReturnType<typeof setInterval> | null = null;

function normalizeReleaseNotes(notes: UpdateInfo['releaseNotes']): string | null {
    if (!notes) return null;
    if (typeof notes === 'string') {
        const cleaned = notes.replace(/<[^>]+>/g, '').trim();
        return cleaned || null;
    }
    if (Array.isArray(notes)) {
        const joined = notes
            .map((entry) => {
                const body = (entry.note ?? '').replace(/<[^>]+>/g, '').trim();
                return entry.version ? `v${entry.version}\n${body}` : body;
            })
            .filter(Boolean)
            .join('\n\n');
        return joined || null;
    }
    return null;
}

function formatReleaseDate(raw: string | undefined): string | null {
    if (!raw) return null;
    const iso = raw.trim().slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso : raw;
}

function buildStatus(
    state: UpdaterStatus['state'],
    info?: UpdateInfo | null,
    extra?: { percent?: number; error?: string }
): UpdaterStatus {
    const version = info?.version ? info.version.replace(/^v/i, '') : null;
    return {
        state,
        currentVersion: app.getVersion(),
        latestVersion: version,
        releaseDate: formatReleaseDate(info?.releaseDate),
        releaseNotes: normalizeReleaseNotes(info?.releaseNotes),
        githubUrl: version ? `${GITHUB_REPO_URL}/releases/tag/v${version}` : GITHUB_REPO_URL,
        percent: extra?.percent,
        checkedAt: new Date().toISOString(),
        error: extra?.error,
    };
}

function sendUpdaterStatus(status: UpdaterStatus): void {
    lastUpdaterStatus = status;
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('updater:status', status);
    }
}

function initAutoUpdater(): void {
    autoUpdater.setFeedURL({
        provider: 'github',
        owner: GITHUB_OWNER,
        repo: GITHUB_REPO,
    });
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;

    autoUpdater.on('checking-for-update', () => {
        sendUpdaterStatus(buildStatus('checking'));
    });

    autoUpdater.on('update-available', (info) => {
        sendUpdaterStatus(buildStatus('available', info));
    });

    autoUpdater.on('update-not-available', (info) => {
        sendUpdaterStatus(buildStatus('not-available', info));
    });

    autoUpdater.on('download-progress', (progress: ProgressInfo) => {
        const prev = lastUpdaterStatus;
        sendUpdaterStatus({
            state: 'downloading',
            currentVersion: app.getVersion(),
            latestVersion: prev?.latestVersion ?? null,
            releaseDate: prev?.releaseDate ?? null,
            releaseNotes: prev?.releaseNotes ?? null,
            githubUrl: prev?.githubUrl ?? GITHUB_REPO_URL,
            percent: Math.round(progress.percent),
            checkedAt: new Date().toISOString(),
        });
    });

    autoUpdater.on('update-downloaded', (info) => {
        sendUpdaterStatus(buildStatus('downloaded', info, { percent: 100 }));
    });

    autoUpdater.on('error', (err) => {
        sendUpdaterStatus(
            buildStatus('error', null, {
                error: err instanceof Error ? err.message : 'Auto-update error',
            })
        );
    });
}

function createWindow(targetUrl: string): void {
    const appOrigin = new URL(targetUrl).origin;
    const iconPath = path.join(app.getAppPath(), isDev ? 'public' : 'dist', 'icon.png');

    mainWindow = new BrowserWindow({
        width: 1360,
        height: 880,
        minWidth: 1024,
        minHeight: 680,
        title: 'Household Investment Tracker',
        icon: fs.existsSync(iconPath) ? iconPath : undefined,
        backgroundColor: '#0f172a',
        autoHideMenuBar: true,
        webPreferences: {
            preload: path.join(__dirname, 'preload.cjs'),
            contextIsolation: true,
            sandbox: true,
            nodeIntegration: false,
        },
    });

    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        if (url.startsWith('https://')) {
            void shell.openExternal(url);
        }
        return { action: 'deny' };
    });

    mainWindow.webContents.on('will-navigate', (event, url) => {
        if (url.startsWith(appOrigin)) {
            return;
        }
        event.preventDefault();
        if (url.startsWith('https://')) {
            void shell.openExternal(url);
        }
    });

    mainWindow.webContents.once('did-finish-load', () => {
        if (app.isPackaged) {
            void autoUpdater.checkForUpdates().catch(() => {});
            updateCheckInterval = setInterval(() => {
                void autoUpdater.checkForUpdates().catch(() => {});
            }, FOUR_HOURS_MS);
        }
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });

    void mainWindow.loadURL(targetUrl);
}

function registerIpcHandlers(): void {
    ipcMain.handle('app:get-info', (): DesktopAppInfo => ({
        version: app.getVersion(),
        distribution,
        dataDir,
    }));

    ipcMain.handle('updater:get-status', (): UpdaterStatus | null => lastUpdaterStatus);

    ipcMain.handle('app:set-theme', (_event, theme: 'dark' | 'light') => {
        nativeTheme.themeSource = theme === 'light' ? 'light' : 'dark';
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.setBackgroundColor(theme === 'light' ? '#FAF7F0' : '#090e1a');
        }
    });

    ipcMain.handle('updater:check', async () => {
        if (!app.isPackaged) return;
        await autoUpdater.checkForUpdates();
    });

    ipcMain.handle('updater:install', async () => {
        if (!app.isPackaged) return;
        isQuitting = true;
        if (updateCheckInterval) {
            clearInterval(updateCheckInterval);
            updateCheckInterval = null;
        }
        if (server) {
            await server.close();
            server = null;
        }
        autoUpdater.quitAndInstall();
    });
}

const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
    app.quit();
} else {
    app.on('second-instance', () => {
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.focus();
        }
    });

    app.whenReady().then(async () => {
        nativeTheme.themeSource = 'dark';
        dataDir = app.isPackaged
            ? app.getPath('userData')
            : path.join(app.getAppPath(), 'server');

        const staticDir = app.isPackaged
            ? path.join(app.getAppPath(), 'dist')
            : undefined;

        try {
            server = await startServer({
                port: PREFERRED_PORT,
                strictPort: isDev,
                dataDir,
                staticDir,
                currentVersion: app.getVersion(),
                distribution,
            });
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            dialog.showErrorBox(
                'Failed to start backend server',
                `Household Investment Tracker could not start its local server:\n\n${message}`
            );
            app.quit();
            return;
        }

        registerIpcHandlers();
        if (app.isPackaged) {
            initAutoUpdater();
        }

        const targetUrl = isDev ? 'http://localhost:5847' : server.origin;
        createWindow(targetUrl);
    });

    app.on('before-quit', (event) => {
        if (isQuitting) return;
        isQuitting = true;
        if (updateCheckInterval) {
            clearInterval(updateCheckInterval);
            updateCheckInterval = null;
        }
        if (server) {
            event.preventDefault();
            const running = server;
            server = null;
            void running.close().finally(() => {
                app.exit(0);
            });
        }
    });

    app.on('window-all-closed', () => {
        if (process.platform !== 'darwin') {
            app.quit();
        }
    });
}
