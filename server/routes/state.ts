import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { Router } from 'express';
import { db, type DbState } from '../lib/db.js';
import { sanitizeBackupDir, SyncPayloadSchema } from '../lib/validation.js';

const execFileAsync = promisify(execFile);

async function openNativeFolderPicker(): Promise<string | null> {
    if (process.platform === 'win32') {
        const script = [
            'Add-Type -AssemblyName System.Windows.Forms',
            '$owner = New-Object System.Windows.Forms.Form',
            '$owner.TopMost = $true',
            '$dialog = New-Object System.Windows.Forms.FolderBrowserDialog',
            "$dialog.Description = 'Select Automated Backup Folder'",
            '$dialog.ShowNewFolderButton = $true',
            '$result = $dialog.ShowDialog($owner)',
            '$owner.Dispose()',
            'if ($result -eq [System.Windows.Forms.DialogResult]::OK) { Write-Output $dialog.SelectedPath }',
        ].join('; ');
        const { stdout } = await execFileAsync(
            'powershell.exe',
            ['-NoProfile', '-STA', '-Command', script],
            { timeout: 120000, windowsHide: true }
        );
        return stdout.trim() || null;
    }

    try {
        if (process.platform === 'darwin') {
            const { stdout } = await execFileAsync(
                'osascript',
                ['-e', 'POSIX path of (choose folder with prompt "Select Automated Backup Folder")'],
                { timeout: 120000 }
            );
            return stdout.trim() || null;
        }
        const { stdout } = await execFileAsync(
            'zenity',
            ['--file-selection', '--directory', '--title=Select Automated Backup Folder'],
            { timeout: 120000 }
        );
        return stdout.trim() || null;
    } catch (err) {
        const code = (err as { code?: number | string })?.code;
        if (code === 1) return null;
        throw err;
    }
}

const CLIENT_KEYS = [
    'members',
    'institutions',
    'accountTypes',
    'accounts',
    'transactions',
    'assets',
    'netWorthHistory',
    'lastUpdated',
    'backupPath',
    'watchlist',
    'watchlistLastUpdated',
    'acbAccounts',
    'acbTransactions',
    'bankAccounts',
    'liabilities',
    'monthlyExpenses',
    'preferences',
    'exchangeRate',
    'isDemoData',
    'savedAt',
] as const;

function hasItems(val: unknown): boolean {
    return Array.isArray(val) && val.length > 0;
}

export function createStateRouter(store = db): Router {
    const router = Router();

    router.get('/state', (_req, res) => {
        const current = store.read();
        const result: Record<string, unknown> = {};
        for (const key of CLIENT_KEYS) {
            if (current[key] !== undefined) {
                result[key] = current[key];
            }
        }
        res.json(result);
    });

    router.post('/sync', async (req, res, next) => {
        const parsed = SyncPayloadSchema.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json({
                error: 'Invalid sync payload',
                issues: parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
            });
            return;
        }

        const { allowDestructive, ...incoming } = parsed.data;
        const current = store.read();

        const hadCoreData =
            hasItems(current.accounts) || hasItems(current.transactions) || hasItems(current.assets);
        const incomingEmpty =
            incoming.accounts.length === 0 &&
            incoming.transactions.length === 0 &&
            incoming.assets.length === 0;

        if (hadCoreData && incomingEmpty && !allowDestructive) {
            res.status(409).json({
                error: 'Destructive sync rejected; existing portfolio data cannot be wiped without allowDestructive',
            });
            return;
        }

        if (typeof current.savedAt === 'string' && typeof incoming.savedAt === 'string') {
            const existingMs = Date.parse(current.savedAt);
            const incomingMs = Date.parse(incoming.savedAt);
            if (!Number.isNaN(existingMs) && !Number.isNaN(incomingMs) && incomingMs < existingMs) {
                res.status(409).json({ error: 'Stale sync payload rejected' });
                return;
            }
        }

        try {
            const savedAt = incoming.savedAt ?? new Date().toISOString();
            await store.mutate((draft: DbState) => {
                Object.assign(draft, incoming, { savedAt });
            });
            res.json({ success: true, timestamp: savedAt });
        } catch (err) {
            next(err);
        }
    });

    router.post('/backup/browse', async (_req, res) => {
        try {
            const selected = await openNativeFolderPicker();
            if (!selected) {
                res.json({ cancelled: true, path: null });
                return;
            }
            try {
                const sanitized = sanitizeBackupDir(selected);
                res.json({ cancelled: false, path: sanitized });
            } catch (err) {
                res.status(400).json({
                    error: err instanceof Error ? err.message : 'Invalid backup folder',
                });
            }
        } catch (err) {
            res.status(500).json({
                error: err instanceof Error ? err.message : 'Unable to open folder browser',
            });
        }
    });

    return router;
}
