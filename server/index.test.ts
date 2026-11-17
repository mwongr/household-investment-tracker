import fs from 'fs';
import net from 'net';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { startServer, type RunningServer } from './index.js';

describe('startServer', () => {
    const cleanups: Array<() => Promise<void>> = [];

    afterEach(async () => {
        while (cleanups.length > 0) {
            const fn = cleanups.pop();
            if (fn) await fn();
        }
    });

    it('writes database.json into dataDir, serves static SPA fallback, and allows same-origin POST', async () => {
        const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'hit-server-test-'));
        const dataDir = path.join(tmpRoot, 'userdata');
        const staticDir = path.join(tmpRoot, 'dist');
        fs.mkdirSync(staticDir, { recursive: true });
        fs.writeFileSync(path.join(staticDir, 'index.html'), '<!doctype html><html><body>HIT SPA</body></html>');

        const running: RunningServer = await startServer({
            port: 0,
            dataDir,
            staticDir,
            currentVersion: '1.2.3',
            distribution: 'exe',
            enableRateLimit: false,
        });
        cleanups.push(async () => {
            await running.close();
            fs.rmSync(tmpRoot, { recursive: true, force: true });
        });

        // SPA fallback for client-side route
        const spaRes = await fetch(`${running.origin}/accounts`);
        expect(spaRes.status).toBe(200);
        expect(await spaRes.text()).toContain('HIT SPA');

        // Same-origin POST /api/sync succeeds (CORS allows server's own origin)
        const syncRes = await fetch(`${running.origin}/api/sync`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Origin: running.origin,
            },
            body: JSON.stringify({
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
            }),
        });
        expect(syncRes.status).toBe(200);

        const dbFile = path.join(dataDir, 'database.json');
        expect(fs.existsSync(dbFile)).toBe(true);
        const saved = JSON.parse(fs.readFileSync(dbFile, 'utf-8')) as { accountTypes?: string[] };
        expect(saved.accountTypes).toEqual(['TFSA']);
    });

    it('falls back to an ephemeral port when the preferred port is busy', async () => {
        const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'hit-port-test-'));
        const blocker = net.createServer();
        await new Promise<void>((resolve) => blocker.listen(0, '127.0.0.1', resolve));
        const busyPort = (blocker.address() as net.AddressInfo).port;

        cleanups.push(
            () => new Promise<void>((resolve) => blocker.close(() => resolve())),
            async () => fs.rmSync(tmpRoot, { recursive: true, force: true })
        );

        const running = await startServer({
            port: busyPort,
            dataDir: tmpRoot,
            enableRateLimit: false,
        });
        cleanups.push(() => running.close());

        expect(running.port).not.toBe(busyPort);
        expect(running.port).toBeGreaterThan(0);
    });
});
