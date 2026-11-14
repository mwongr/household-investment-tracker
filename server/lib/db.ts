import fs from 'fs';
import path from 'path';
import { BACKUPS_DIR, DB_PATH, MAX_SNAPSHOTS } from '../config.js';

export interface DbState {
    members?: unknown[];
    institutions?: unknown[];
    accountTypes?: string[];
    accounts?: unknown[];
    transactions?: unknown[];
    assets?: unknown[];
    netWorthHistory?: unknown[];
    lastUpdated?: string | null;
    backupPath?: string;
    watchlist?: unknown[];
    watchlistLastUpdated?: string | null;
    acbAccounts?: unknown[];
    acbTransactions?: unknown[];
    bankAccounts?: unknown[];
    liabilities?: unknown[];
    monthlyExpenses?: unknown[];
    preferences?: Record<string, boolean>;
    exchangeRate?: number;
    isDemoData?: boolean;
    savedAt?: string;
    taxScenarios?: Array<{
        id: string;
        savedAt: string;
        annualIncome: number;
        quebecTaxableIncome: number;
        rrspContribution: number;
        totalRefund: number;
        craRefund: number | null;
        rqRefund: number | null;
        effectiveRate: number;
        isSpousal: boolean;
        attributionDate: string | null;
    }>;
    taxSettings?: unknown;
    [key: string]: unknown;
}

export interface DbStoreOptions {
    dbPath?: string;
    backupsDir?: string;
    maxSnapshots?: number;
}

async function atomicWriteJson(targetPath: string, data: unknown): Promise<void> {
    await fs.promises.mkdir(path.dirname(targetPath), { recursive: true });
    const tmpPath = `${targetPath}.${process.pid}.${Date.now()}.tmp`;
    const payload = JSON.stringify(data, null, 2);

    const handle = await fs.promises.open(tmpPath, 'w');
    try {
        await handle.writeFile(payload, 'utf-8');
        await handle.sync();
    } finally {
        await handle.close();
    }

    for (let attempt = 0; attempt < 3; attempt++) {
        try {
            await fs.promises.rename(tmpPath, targetPath);
            return;
        } catch (err: unknown) {
            const code = (err as NodeJS.ErrnoException)?.code;
            if ((code === 'EPERM' || code === 'EACCES') && attempt < 2) {
                await new Promise((r) => setTimeout(r, 25 * (attempt + 1)));
                continue;
            }
            await fs.promises.unlink(tmpPath).catch(() => {});
            throw err;
        }
    }
}

export function createDbStore(options: DbStoreOptions = {}) {
    const dbPath = options.dbPath ?? DB_PATH;
    const backupsDir = options.backupsDir ?? BACKUPS_DIR;
    const maxSnapshots = options.maxSnapshots ?? MAX_SNAPSHOTS;

    let state: DbState = {};
    let queue: Promise<void> = Promise.resolve();
    let initialized = false;

    async function snapshotCurrent(): Promise<void> {
        if (!fs.existsSync(dbPath)) return;
        await fs.promises.mkdir(backupsDir, { recursive: true });
        const ts = new Date().toISOString().replace(/[:.]/g, '-');
        const snapPath = path.join(backupsDir, `db-${ts}-${Math.random().toString(36).slice(2, 6)}.json`);
        await fs.promises.copyFile(dbPath, snapPath);

        const files = (await fs.promises.readdir(backupsDir))
            .filter((f) => f.startsWith('db-') && f.endsWith('.json'))
            .sort();
        const excess = files.length - maxSnapshots;
        if (excess > 0) {
            await Promise.all(
                files.slice(0, excess).map((f) => fs.promises.unlink(path.join(backupsDir, f)).catch(() => {}))
            );
        }
    }

    function restoreNewestSnapshot(): DbState | null {
        if (!fs.existsSync(backupsDir)) return null;
        const files = fs
            .readdirSync(backupsDir)
            .filter((f) => f.startsWith('db-') && f.endsWith('.json'))
            .sort()
            .reverse();
        for (const file of files) {
            try {
                const raw = fs.readFileSync(path.join(backupsDir, file), 'utf-8');
                const parsed = JSON.parse(raw) as DbState;
                if (parsed && typeof parsed === 'object') {
                    console.error(`[DB] Restored state from snapshot ${file}`);
                    return parsed;
                }
            } catch {
                // Skip corrupt snapshot and try older one
            }
        }
        return null;
    }

    function init(): void {
        if (initialized) return;
        initialized = true;

        if (!fs.existsSync(dbPath)) {
            state = {};
            return;
        }

        try {
            const raw = fs.readFileSync(dbPath, 'utf-8');
            if (!raw.trim()) {
                state = {};
                return;
            }
            const parsed = JSON.parse(raw) as DbState;
            state = parsed && typeof parsed === 'object' ? parsed : {};
        } catch (err) {
            const ts = new Date().toISOString().replace(/[:.]/g, '-');
            const quarantinePath = `${dbPath}.corrupt-${ts}.json`;
            try {
                fs.renameSync(dbPath, quarantinePath);
                console.error(`[DB] Corrupt database quarantined to ${quarantinePath}`, err);
            } catch (renameErr) {
                console.error('[DB] Failed to quarantine corrupt database:', renameErr);
            }
            state = restoreNewestSnapshot() ?? {};
        }
    }

    function read(): DbState {
        if (!initialized) init();
        return state;
    }

    function mutate<T>(fn: (draft: DbState) => T): Promise<T> {
        if (!initialized) init();
        const run = queue.then(async () => {
            const next = structuredClone(state);
            const result = fn(next);
            await snapshotCurrent();
            await atomicWriteJson(dbPath, next);
            state = next;
            return result;
        });
        queue = run.then(
            () => undefined,
            () => undefined
        );
        return run;
    }

    async function flush(): Promise<void> {
        await queue;
    }

    return { init, read, mutate, flush, dbPath, backupsDir };
}

export const db = createDbStore();
