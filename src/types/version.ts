export interface VersionInfo {
    currentVersion: string;
    latestVersion: string | null;
    updateAvailable: boolean;
    releaseDate: string | null;
    githubUrl: string;
    releaseNotes: string | null;
    checkedAt: string;
    error?: string;
}
