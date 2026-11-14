import { describe, expect, it } from 'vitest';
import type { Asset, Transaction } from '../types';
import { applyMarketData, calculateCashImpact, recalculateAssets } from './portfolio';

describe('calculateCashImpact', () => {
    it('computes cash impact per transaction type and respects ignoreCashImpact', () => {
        expect(calculateCashImpact({ type: 'Buy', amount: 500 })).toBe(-500);
        expect(calculateCashImpact({ type: 'Sell', amount: 750 })).toBe(750);
        expect(calculateCashImpact({ type: 'Deposit', amount: 1000 })).toBe(1000);
        expect(calculateCashImpact({ type: 'Withdrawal', amount: 200 })).toBe(-200);
        expect(calculateCashImpact({ type: 'Dividend', amount: 25 })).toBe(25);
        expect(calculateCashImpact({ type: 'Fee', amount: 10 })).toBe(-10);
        expect(calculateCashImpact({ type: 'DRIP', amount: 30 })).toBe(0);
        expect(calculateCashImpact({ type: 'Stock Split', amount: 0 })).toBe(0);
        expect(calculateCashImpact({ type: 'Buy', amount: 500, ignoreCashImpact: true })).toBe(0);
    });
});

describe('recalculateAssets', () => {
    it('rebuilds Buy, Sell, DRIP, and Stock Split accurately', () => {
        const txs: Transaction[] = [
            {
                id: 't1',
                accountId: 'acc1',
                ticker: 'XEQT.TO',
                date: '2025-01-10',
                type: 'Buy',
                shares: 10,
                pricePerShare: 30,
                amount: 300,
            },
            {
                id: 't2',
                accountId: 'acc1',
                ticker: 'XEQT.TO',
                date: '2025-02-10',
                type: 'Buy',
                shares: 10,
                pricePerShare: 34,
                amount: 340,
            },
            {
                id: 't3',
                accountId: 'acc1',
                ticker: 'XEQT.TO',
                date: '2025-03-01',
                type: 'Sell',
                shares: 5,
                pricePerShare: 36,
                amount: 180,
            },
            {
                id: 't4',
                accountId: 'acc1',
                ticker: 'XEQT.TO',
                date: '2025-04-01',
                type: 'Stock Split',
                amount: 0,
                splitFrom: 1,
                splitTo: 2,
            },
        ];

        const prev: Asset[] = [
            {
                id: 'asset-1',
                accountId: 'acc1',
                ticker: 'XEQT.TO',
                quantity: 0,
                averageCost: 0,
                currentPrice: 20,
                marketValue: 0,
                totalCost: 0,
                profit: 0,
                profitPercent: 0,
                todayChangePercent: 0,
                todayChangeDollar: 0,
                currency: 'CAD',
                cadMarketValue: 0,
            },
        ];

        const result = recalculateAssets(txs, prev, 1.35);
        expect(result).toHaveLength(1);
        const asset = result[0]!;
        // 10 + 10 - 5 = 15 shares, avg cost 640 / 20 = 32, remaining cost 480, then 2:1 split -> 30 shares, avg cost 16
        expect(asset.quantity).toBe(30);
        expect(asset.totalCost).toBeCloseTo(480, 4);
        expect(asset.averageCost).toBeCloseTo(16, 4);
        expect(asset.marketValue).toBeCloseTo(600, 4);
        expect(asset.profit).toBeCloseTo(120, 4);
    });

    it('adjusts customBookCost proportionally on partial sell', () => {
        const txs: Transaction[] = [
            {
                id: 't1',
                accountId: 'acc1',
                ticker: 'VFV.TO',
                date: '2025-01-01',
                type: 'Buy',
                shares: 10,
                pricePerShare: 100,
                amount: 1000,
            },
            {
                id: 't2',
                accountId: 'acc1',
                ticker: 'VFV.TO',
                date: '2025-02-01',
                type: 'Sell',
                shares: 2,
                pricePerShare: 120,
                amount: 240,
            },
        ];

        const prev: Asset[] = [
            {
                id: 'asset-vfv',
                accountId: 'acc1',
                ticker: 'VFV.TO',
                quantity: 10,
                averageCost: 110,
                currentPrice: 120,
                marketValue: 1200,
                totalCost: 1000,
                customBookCost: 1100,
                profit: 100,
                profitPercent: 9.09,
                todayChangePercent: 0,
                todayChangeDollar: 0,
                currency: 'CAD',
                cadMarketValue: 1200,
            },
        ];

        const result = recalculateAssets(txs, prev, 1.0);
        expect(result[0]!.quantity).toBe(8);
        expect(result[0]!.customBookCost).toBeCloseTo(880, 4);
        expect(result[0]!.cadTotalCost).toBeCloseTo(880, 4);
    });
});

describe('applyMarketData', () => {
    it('applies USD exchange rate to cadMarketValue and cadTotalCost', () => {
        const asset: Asset = {
            id: 'a1',
            accountId: 'acc1',
            ticker: 'AAPL',
            quantity: 10,
            averageCost: 150,
            currentPrice: 150,
            marketValue: 1500,
            totalCost: 1500,
            profit: 0,
            profitPercent: 0,
            todayChangePercent: 0,
            todayChangeDollar: 0,
            currency: 'USD',
            cadMarketValue: 1500,
        };

        const updated = applyMarketData(
            asset,
            {
                symbol: 'AAPL',
                regularMarketPrice: 200,
                regularMarketChangePercent: 2,
                currency: 'USD',
            },
            undefined,
            1.4,
            '1mo'
        );

        expect(updated.marketValue).toBe(2000);
        expect(updated.cadMarketValue).toBeCloseTo(2800, 4);
        expect(updated.cadTotalCost).toBeCloseTo(2100, 4);
        expect(updated.profit).toBeCloseTo(700, 4);
    });
});
