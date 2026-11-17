import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const SERVER_DIR = __dirname;
export const APP_ROOT = path.resolve(__dirname, '..');

// Packaged Electron passes an explicit dataDir; HIT_DATA_DIR env allows override for scripts (e.g. backup.ts).
export const DATA_DIR = process.env.HIT_DATA_DIR?.trim() || SERVER_DIR;
export const DB_PATH = path.join(DATA_DIR, 'database.json');
export const BACKUPS_DIR = path.join(DATA_DIR, 'backups');

export function dataPaths(dataDir: string): { dbPath: string; backupsDir: string } {
    return {
        dbPath: path.join(dataDir, 'database.json'),
        backupsDir: path.join(dataDir, 'backups'),
    };
}

function readPackageVersion(): string {
    try {
        const packageJson = JSON.parse(
            fs.readFileSync(path.join(APP_ROOT, 'package.json'), 'utf-8')
        ) as { version?: string };
        return packageJson.version ?? '1.0.0';
    } catch {
        return '1.0.0';
    }
}

export const APP_VERSION = process.env.HIT_APP_VERSION ?? readPackageVersion();

export const GITHUB_OWNER = 'mwongr';
export const GITHUB_REPO = 'household-investment-tracker';
export const VERSION_CHECK_URL = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`;
export const GITHUB_REPO_URL = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}`;

export type Distribution = 'exe' | 'diy';

export const PORT = Number(process.env.PORT ?? 3001);
export const HOST = '127.0.0.1';
export const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN ?? 'http://localhost:5847';

export const MAX_SNAPSHOTS = 10;

export const CACHE_TTL = {
    PRICE_1D: 60 * 1000,
    EXCHANGE_RATE: 5 * 60 * 1000,
    SPARKLINE: 15 * 60 * 1000,
    ANALYSIS: 30 * 60 * 1000,
    COMPARE: 60 * 60 * 1000,
    EVENTS: 6 * 60 * 60 * 1000,
    HISTORY: 6 * 60 * 60 * 1000,
    VERSION_CHECK: 30 * 60 * 1000,
} as const;
