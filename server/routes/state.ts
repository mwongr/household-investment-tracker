import { Router } from 'express';
import { db, type DbState } from '../lib/db.js';
import { SyncPayloadSchema } from '../lib/validation.js';

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

    return router;
}
