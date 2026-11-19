import fs from 'fs';
import type http from 'http';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../index.js';
import { createDbStore } from '../lib/db.js';
import { yahooFinance } from '../lib/yahoo.js';

const tempDirs: string[] = [];
const servers: http.Server[] = [];

async function startTestServer(seedData: Record<string, unknown>) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hit-div-route-'));
    tempDirs.push(dir);
    const store = createDbStore({
        dbPath: path.join(dir, 'database.json'),
        backupsDir: path.join(dir, 'backups'),
    });
    store.init();
    await store.mutate((draft) => {
        Object.assign(draft, seedData);
    });

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
    return `http://127.0.0.1:${addr.port}`;
}

afterEach(async () => {
    vi.restoreAllMocks();
    while (servers.length > 0) {
        const s = servers.pop()!;
        await new Promise<void>((resolve) => s.close(() => resolve()));
    }
    while (tempDirs.length > 0) {
        const dir = tempDirs.pop()!;
        fs.rmSync(dir, { recursive: true, force: true });
    }
});

describe('GET /api/dividends/metadata', () => {
    it('falls back to local transaction history when Yahoo lacks dates for .TO ETF', async () => {
        vi.spyOn(yahooFinance, 'quoteSummary').mockResolvedValue({
            summaryDetail: { currency: 'CAD' },
            calendarEvents: {},
        } as never);
        vi.spyOn(yahooFinance, 'chart').mockResolvedValue({
            events: { dividends: [] },
        } as never);

        const baseUrl = await startTestServer({
            assets: [
                { id: 'as1', accountId: 'acc1', ticker: 'CASH.TO', quantity: 100 },
            ],
            transactions: [
                { id: 't1', accountId: 'acc1', ticker: 'CASH.TO', date: '2026-01-05', type: 'Buy', shares: 100, amount: 5000 },
                { id: 't2', accountId: 'acc1', ticker: 'CASH.TO', date: '2026-09-07', type: 'Dividend Income', amount: 20 },
                { id: 't3', accountId: 'acc1', ticker: 'CASH.TO', date: '2026-10-07', type: 'Dividend Income', amount: 21 },
                { id: 't4', accountId: 'acc1', ticker: 'CASH.TO', date: '2026-11-07', type: 'Dividend Income', amount: 20 },
            ],
        });

        const res = await fetch(`${baseUrl}/api/dividends/metadata`);
        expect(res.status).toBe(200);
        const body = (await res.json()) as {
            items: Array<{
                symbol: string;
                isEstimated: boolean;
                source: string;
                frequency: string | null;
                amountPerPayment: number | null;
                trailingAnnualRate: number | null;
            }>;
        };

        expect(body.items).toHaveLength(1);
        const item = body.items[0]!;
        expect(item.symbol).toBe('CASH.TO');
        expect(item.isEstimated).toBe(true);
        expect(item.source).toBe('transactions');
        expect(item.frequency).toBe('monthly');
        expect(item.amountPerPayment).toBeCloseTo(0.2, 3);
        expect(item.trailingAnnualRate).toBeCloseTo(2.4, 2);
    });
});
