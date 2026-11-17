export type Distribution = 'exe' | 'diy';

export type UpdaterState =
    | 'idle'
    | 'checking'
    | 'available'
    | 'not-available'
    | 'downloading'
    | 'downloaded'
    | 'error';

export interface UpdaterStatus {
    state: UpdaterState;
    currentVersion: string;
    latestVersion: string | null;
    releaseDate: string | null;
    releaseNotes: string | null;
    githubUrl: string;
    percent?: number;
    checkedAt: string;
    error?: string;
}

export interface DesktopAppInfo {
    version: string;
    distribution: Distribution;
    dataDir: string;
}

export interface HitDesktopApi {
    getAppInfo: () => Promise<DesktopAppInfo>;
    getUpdaterStatus: () => Promise<UpdaterStatus | null>;
    checkForUpdates: () => Promise<void>;
    installUpdate: () => Promise<void>;
    setTheme: (theme: 'dark' | 'light') => Promise<void>;
    onUpdaterStatus: (callback: (status: UpdaterStatus) => void) => () => void;
}
