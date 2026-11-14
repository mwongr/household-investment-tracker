import fs from 'fs';
import type http from 'http';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../index.js';
import { createDbStore } from '../lib/db.js';

const tempDirs: string[] = [];
const servers: http.Server[] = [];

function baseSyncPayload(overrides: Record<string, unknown> = {}) {
    return {
        members: [],
        institutions: [],
        accountTypes: ['TFSA'],
        accounts: [],
        transactions: [],
        assets: [],
        netWorthHistory: [],
        lastUpdated: null,
        backupPath: '',
        watchlist: [],
        watchlistLastUpdated: null,
        acbAccounts: [],
        acbTransactions: [],
        bankAccounts: [],
        liabilities: [],
        monthlyExpenses: [],
        preferences: {
            enableNetWorth: true,
            enableTaxOptimizer: true,
            enableAcbTracker: true,
        },
        exchangeRate: 1.35,
        isDemoData: false,
        savedAt: '2026-01-01T12:00:00.000Z',
        ...overrides,
    };
}

async function startTestServer() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hit-route-test-'));
    tempDirs.push(dir);
    const store = createDbStore({
        dbPath: path.join(dir, 'database.json'),
        backupsDir: path.join(dir, 'backups'),
    });
    store.init();

    const app = createApp({
        store,
        allowedOrigin: 'http://localhost:5847',
        enableRateLimit: false,
    });

    const server = await new Promise<http.Server>((resolve) => {
        const s = app.listen(0, '127.0.0.1', () => resolve(s));
    });
    servers.push(server);
    const addr = server.address();
    if (!addr || typeof addr === 'string') throw new Error('Invalid address');
    return { baseUrl: `http://127.0.0.1:${addr.port}`, store };
}

afterEach(async () => {
    while (servers.length > 0) {
        const s = servers.pop()!;
        await new Promise<void>((resolve) => s.close(() => resolve()));
    }
    while (tempDirs.length > 0) {
        const dir = tempDirs.pop()!;
        fs.rmSync(dir, { recursive: true, force: true });
    }
});

describe('state routes & security', () => {
    it('rejects unknown keys and disallowed CORS origins', async () => {
        const { baseUrl } = await startTestServer();

        const corsRes = await fetch(`${baseUrl}/api/state`, {
            headers: { Origin: 'https://evil.example' },
        });
        expect(corsRes.status).toBe(403);

        const badKeyRes = await fetch(`${baseUrl}/api/sync`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(baseSyncPayload({ injectedKey: 'bad' })),
        });
        expect(badKeyRes.status).toBe(400);
    });

    it('guards against destructive wipes and stale writes', async () => {
        const { baseUrl } = await startTestServer();

        const seed = baseSyncPayload({
            accounts: [
                {
                    id: 'a1',
                    memberId: 'm1',
                    institutionId: 'i1',
                    type: 'TFSA',
                    name: 'Main',
                    cashBalance: 100,
                },
            ],
            savedAt: '2026-01-02T12:00:00.000Z',
        });

        const r1 = await fetch(`${baseUrl}/api/sync`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(seed),
        });
        expect(r1.status).toBe(200);

        // Stale timestamp rejected
        const staleRes = await fetch(`${baseUrl}/api/sync`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(
                baseSyncPayload({
                    accounts: seed.accounts,
                    savedAt: '2026-01-01T12:00:00.000Z',
                })
            ),
        });
        expect(staleRes.status).toBe(409);

        // Destructive wipe rejected without allowDestructive
        const wipeRes = await fetch(`${baseUrl}/api/sync`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(
                baseSyncPayload({
                    accounts: [],
                    savedAt: '2026-01-03T12:00:00.000Z',
                })
            ),
        });
        expect(wipeRes.status).toBe(409);

        // Allowed when allowDestructive: true
        const allowRes = await fetch(`${baseUrl}/api/sync`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(
                baseSyncPayload({
                    accounts: [],
                    savedAt: '2026-01-03T12:00:00.000Z',
                    allowDestructive: true,
                })
            ),
        });
        expect(allowRes.status).toBe(200);
    });
});
