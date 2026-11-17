import { describe, expect, it } from 'vitest';
import {
    buildMemberPortfolioHistories,
    getHistoryExtremes,
    mergeMemberHistories,
} from './portfolioHistory';
import type { Account, Asset, Member, Transaction } from '../types';

describe('getHistoryExtremes', () => {
    it('returns null for empty history', () => {
        expect(getHistoryExtremes([])).toBeNull();
    });

    it('returns the single point as both high and low', () => {
        const pts = [{ name: '2026-01-01', value: 12500 }];
        expect(getHistoryExtremes(pts)).toEqual({
            high: { name: '2026-01-01', value: 12500 },
            low: { name: '2026-01-01', value: 12500 },
        });
    });

    it('identifies the highest and lowest points achieved', () => {
        const pts = [
            { name: '2026-01-01', value: 10000 },
            { name: '2026-02-01', value: 15500 },
            { name: '2026-03-01', value: 8200 },
            { name: '2026-04-01', value: 14000 },
        ];
        expect(getHistoryExtremes(pts)).toEqual({
            high: { name: '2026-02-01', value: 15500 },
            low: { name: '2026-03-01', value: 8200 },
        });
    });
});

describe('buildMemberPortfolioHistories', () => {
    const members: Member[] = [
        { id: 'm1', name: 'Alex' },
        { id: 'm2', name: 'Sarah' },
    ];

    const accounts: Account[] = [
        { id: 'a1', memberId: 'm1', institutionId: 'i1', type: 'TFSA', name: 'Alex TFSA', cashBalance: 500 },
        { id: 'a2', memberId: 'm2', institutionId: 'i1', type: 'RRSP', name: 'Sarah RRSP', cashBalance: 1000 },
    ];

    const assets: Asset[] = [
        {
            id: 'as1',
            accountId: 'a1',
            ticker: 'VFV.TO',
            quantity: 10,
            averageCost: 100,
            currentPrice: 120,
            marketValue: 1200,
            totalCost: 1000,
            profit: 200,
            profitPercent: 20,
            todayChangePercent: 0,
            todayChangeDollar: 0,
            cadMarketValue: 1200,
            currency: 'CAD',
        },
        {
            id: 'as2',
            accountId: 'a2',
            ticker: 'XEQT.TO',
            quantity: 20,
            averageCost: 30,
            currentPrice: 35,
            marketValue: 700,
            totalCost: 600,
            profit: 100,
            profitPercent: 16.67,
            todayChangePercent: 0,
            todayChangeDollar: 0,
            cadMarketValue: 700,
            currency: 'CAD',
        },
    ];

    const transactions: Transaction[] = [
        {
            id: 't1',
            accountId: 'a1',
            ticker: 'VFV.TO',
            date: '2025-01-10',
            type: 'Buy',
            shares: 10,
            pricePerShare: 100,
            amount: 1000,
            currency: 'CAD',
        },
        {
            id: 't2',
            accountId: 'a2',
            ticker: 'XEQT.TO',
            date: '2025-02-15',
            type: 'Buy',
            shares: 20,
            pricePerShare: 30,
            amount: 600,
            currency: 'CAD',
        },
    ];

    it('returns empty array when tracking only one member', () => {
        const result = buildMemberPortfolioHistories({
            members: [members[0]],
            transactions,
            assets,
            accounts,
            netWorthHistory: [],
            totalValue: 3400,
            isDemoData: false,
        });
        expect(result).toEqual([]);
    });

    it('builds separate histories per member without leaking combined snapshots', () => {
        const result = buildMemberPortfolioHistories({
            members,
            transactions,
            assets,
            accounts,
            netWorthHistory: [{ date: '2025-03-01', value: 999999 }],
            totalValue: 3400,
            isDemoData: false,
        });

        expect(result).toHaveLength(2);
        expect(result[0].name).toBe('Alex');
        expect(result[1].name).toBe('Sarah');

        // Household netWorthHistory (999999) must not overwrite individual member series
        expect(result[0].data.some(p => p.value === 999999)).toBe(false);
        expect(result[1].data.some(p => p.value === 999999)).toBe(false);

        // Latest point for each member should reflect their own total value (assets + cash)
        expect(result[0].data[result[0].data.length - 1].value).toBe(1700);
        expect(result[1].data[result[1].data.length - 1].value).toBe(1700);
    });
});

describe('mergeMemberHistories', () => {
    it('aligns dates and carries forward latest values after each member starts', () => {
        const merged = mergeMemberHistories([
            {
                id: 'm1',
                name: 'Alex',
                data: [
                    { name: '2025-01-01', value: 10000 },
                    { name: '2025-02-01', value: 12000 },
                ],
            },
            {
                id: 'm2',
                name: 'Sarah',
                data: [
                    { name: '2025-01-15', value: 5000 },
                    { name: '2025-02-01', value: 5500 },
                ],
            },
        ]);

        expect(merged).toEqual([
            { name: '2025-01-01', m1: 10000, m2: null },
            { name: '2025-01-15', m1: 10000, m2: 5000 },
            { name: '2025-02-01', m1: 12000, m2: 5500 },
        ]);
    });
});
