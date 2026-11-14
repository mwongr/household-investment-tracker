import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const SERVER_DIR = __dirname;
export const APP_ROOT = path.resolve(__dirname, '..');
export const DB_PATH = path.join(SERVER_DIR, 'database.json');
export const BACKUPS_DIR = path.join(SERVER_DIR, 'backups');

const packageJson = JSON.parse(
    fs.readFileSync(path.join(APP_ROOT, 'package.json'), 'utf-8')
) as { version?: string };
export const APP_VERSION = packageJson.version ?? '1.0.0';

export const VERSION_CHECK_URL = 'https://zerosum.ca/appversions/updatehouseholdinvestmenttracker.json';
export const GITHUB_REPO_URL = 'https://github.com/mwongr/household-investment-tracker';

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
