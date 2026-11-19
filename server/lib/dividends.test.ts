import { describe, expect, it } from 'vitest';
import {
    buildTransactionHistory,
    computeTtmPerShare,
    estimateNextPayout,
    hasUnevenPayouts,
    inferCadence,
    paymentsPerYear,
    sharesHeldOn,
    type MinimalTx,
    type PayoutPoint,
} from './dividends.js';

describe('inferCadence', () => {
    it('detects monthly, quarterly, semi-annual, and annual cadences', () => {
        expect(inferCadence(['2026-01-15', '2026-02-15', '2026-03-15'])?.frequency).toBe('monthly');
        expect(inferCadence(['2026-01-15', '2026-04-15', '2026-07-15'])?.frequency).toBe('quarterly');
        expect(inferCadence(['2025-06-15', '2025-12-15', '2026-06-15'])?.frequency).toBe('semi-annual');
        expect(inferCadence(['2024-12-15', '2025-12-15'])?.frequency).toBe('annual');
        expect(inferCadence(['2026-01-15'])).toBeNull();
    });

    it('returns paymentsPerYear for each frequency', () => {
        expect(paymentsPerYear('monthly')).toBe(12);
        expect(paymentsPerYear('quarterly')).toBe(4);
        expect(paymentsPerYear('semi-annual')).toBe(2);
        expect(paymentsPerYear('annual')).toBe(1);
    });
});

describe('sharesHeldOn', () => {
    it('handles Buy, Sell, DRIP, and Stock Split chronologically', () => {
        const txs: MinimalTx[] = [
            { accountId: 'a1', ticker: 'XEQT.TO', date: '2025-01-10', type: 'Buy', shares: 100, amount: 3000 },
            { accountId: 'a1', ticker: 'XEQT.TO', date: '2025-03-01', type: 'DRIP', shares: 2, amount: 60 },
            { accountId: 'a1', ticker: 'XEQT.TO', date: '2025-06-01', type: 'Stock Split', amount: 0, splitFrom: 1, splitTo: 2 },
            { accountId: 'a1', ticker: 'XEQT.TO', date: '2025-08-01', type: 'Sell', shares: 50, amount: 1600 },
        ];

        expect(sharesHeldOn(txs, 'a1', 'XEQT.TO', '2025-02-01')).toBe(100);
        expect(sharesHeldOn(txs, 'a1', 'XEQT.TO', '2025-04-01')).toBe(102);
        expect(sharesHeldOn(txs, 'a1', 'XEQT.TO', '2025-07-01')).toBe(204);
        expect(sharesHeldOn(txs, 'a1', 'XEQT.TO', '2025-09-01')).toBe(154);
    });
});

describe('buildTransactionHistory & estimateNextPayout', () => {
    it('normalizes per-share payout and rolls nextPayDate past today', () => {
        const txs: MinimalTx[] = [
            { accountId: 'a1', ticker: 'VFV.TO', date: '2025-10-01', type: 'Buy', shares: 100, amount: 12000 },
            { accountId: 'a1', ticker: 'VFV.TO', date: '2026-01-10', type: 'Dividend Income', amount: 40 },
            { accountId: 'a1', ticker: 'VFV.TO', date: '2026-04-10', type: 'Dividend Income', amount: 42 },
            { accountId: 'a1', ticker: 'VFV.TO', date: '2026-07-10', type: 'Dividend Income', amount: 40 },
        ];

        const history = buildTransactionHistory(txs, 'VFV.TO');
        expect(history).toHaveLength(3);
        expect(history[0]?.amountPerShare).toBeCloseTo(0.4, 4);
        expect(history[1]?.amountPerShare).toBeCloseTo(0.42, 4);

        const est = estimateNextPayout(history, new Date('2026-08-01T12:00:00Z'));
        expect(est).not.toBeNull();
        expect(est?.frequency).toBe('quarterly');
        expect(est?.nextPayDate).toBe('2026-10-10');
        expect(est?.amountPerShare).toBeCloseTo(0.4, 4);
    });
});

describe('computeTtmPerShare & hasUnevenPayouts', () => {
    it('sums trailing 12 months of per-share payouts and detects uneven ETF distributions', () => {
        const xeqtPoints: PayoutPoint[] = [
            { date: '2025-09-29', amountPerShare: 0.09, totalAmount: 9 }, // outside 365d window
            { date: '2025-12-30', amountPerShare: 0.25, totalAmount: 25 },
            { date: '2026-03-30', amountPerShare: 0.10, totalAmount: 10 },
            { date: '2026-06-29', amountPerShare: 0.26, totalAmount: 26 },
            { date: '2026-09-29', amountPerShare: 0.09, totalAmount: 9 },
        ];
        const today = new Date('2026-11-19T12:00:00Z');
        expect(hasUnevenPayouts(xeqtPoints, today)).toBe(true);
        // 0.25 + 0.10 + 0.26 + 0.09 = 0.70 (vs 0.09 * 4 = 0.36)
        expect(computeTtmPerShare(xeqtPoints, today)).toBeCloseTo(0.70, 4);
    });
});
