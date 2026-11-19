import { describe, expect, it } from 'vitest';
import type { Account, Asset, Transaction } from '../types';
import type { DividendMetadata } from '../types/dividends';
import {
    aggregateHoldingsByTicker,
    buildUpcomingPayouts,
    classifyTaxTreatment,
    computeAnnualPayouts,
    computeHoldingIncome,
    computeKpis,
    computeMonthlyPayouts,
    computeYtd,
    groupByAccount,
} from './dividendAnalytics';

const accounts: Account[] = [
    { id: 'tfsa', memberId: 'm1', institutionId: 'i1', type: 'TFSA', name: 'My TFSA', cashBalance: 0 },
    { id: 'rrsp', memberId: 'm1', institutionId: 'i1', type: 'RRSP', name: 'My RRSP', cashBalance: 0 },
    { id: 'fhsa', memberId: 'm1', institutionId: 'i1', type: 'FHSA', name: 'My FHSA', cashBalance: 0 },
    { id: 'lira', memberId: 'm1', institutionId: 'i1', type: 'LIRA', name: 'My LIRA', cashBalance: 0 },
];

const assets: Asset[] = [
    {
        id: 'a1',
        accountId: 'tfsa',
        ticker: 'SCHD',
        quantity: 100,
        averageCost: 70,
        currentPrice: 80,
        marketValue: 8000,
        totalCost: 7000,
        cadTotalCost: 9450,
        profit: 1000,
        profitPercent: 14,
        todayChangePercent: 0,
        todayChangeDollar: 0,
        currency: 'USD',
        cadMarketValue: 10800,
    },
    {
        id: 'a2',
        accountId: 'rrsp',
        ticker: 'XEQT.TO',
        quantity: 200,
        averageCost: 28,
        currentPrice: 32,
        marketValue: 6400,
        totalCost: 5600,
        cadTotalCost: 5600,
        profit: 800,
        profitPercent: 14,
        todayChangePercent: 0,
        todayChangeDollar: 0,
        currency: 'CAD',
        cadMarketValue: 6400,
    },
];

describe('classifyTaxTreatment', () => {
    it('marks TFSA/FHSA US payers as withholding-lost and RRSP/Spousal RRSP/LIRA/RRIF as treaty-exempt', () => {
        expect(classifyTaxTreatment('TFSA', true)).toBe('withholding-lost');
        expect(classifyTaxTreatment('FHSA', true)).toBe('withholding-lost');
        expect(classifyTaxTreatment('RRSP', true)).toBe('treaty-exempt');
        expect(classifyTaxTreatment('Spousal RRSP', true)).toBe('treaty-exempt');
        expect(classifyTaxTreatment('LIRA', true)).toBe('treaty-exempt');
        expect(classifyTaxTreatment('RRIF', true)).toBe('treaty-exempt');
        expect(classifyTaxTreatment('Margin', true)).toBe('recoverable');
        expect(classifyTaxTreatment('TFSA', false)).toBe('none');
    });
});

describe('YTD, monthly YoY, holding income, KPIs, and upcoming payouts', () => {
    const fx = 1.35;
    const txs: Transaction[] = [
        { id: 't1', accountId: 'tfsa', ticker: 'SCHD', date: '2026-03-25', type: 'Dividend Income', amount: 100, currency: 'USD' },
        { id: 't2', accountId: 'rrsp', ticker: 'XEQT.TO', date: '2026-06-30', type: 'DRIP', shares: 1, amount: 32, currency: 'CAD' },
        { id: 't3', accountId: 'tfsa', ticker: 'SCHD', date: '2025-03-25', type: 'Dividend Income', amount: 80, currency: 'USD' },
    ];

    const metaMap = new Map<string, DividendMetadata>([
        [
            'SCHD',
            {
                symbol: 'SCHD',
                currency: 'USD',
                forwardAnnualRate: 3.0,
                trailingAnnualRate: 2.8,
                trailingYield: 0.035,
                forwardYield: 0.0375,
                exDividendDate: '2026-12-10',
                payDate: '2026-12-15',
                amountPerPayment: 0.75,
                frequency: 'quarterly',
                isEstimated: false,
                source: 'yahoo',
            },
        ],
        [
            'XEQT.TO',
            {
                symbol: 'XEQT.TO',
                currency: 'CAD',
                forwardAnnualRate: null,
                trailingAnnualRate: 0.64,
                trailingYield: 0.02,
                forwardYield: null,
                exDividendDate: null,
                payDate: '2026-12-28',
                amountPerPayment: 0.16,
                frequency: 'quarterly',
                isEstimated: true,
                source: 'transactions',
            },
        ],
    ]);

    it('computes YTD cash + DRIP converted to CAD', () => {
        const ytd = computeYtd(txs, assets, new Date('2026-11-19T12:00:00Z'), fx);
        expect(ytd.ytdCashCad).toBeCloseTo(135, 2);
        expect(ytd.ytdReinvestedCad).toBeCloseTo(32, 2);
        expect(ytd.ytdTotalCad).toBeCloseTo(167, 2);
    });

    it('buckets monthly payouts for current and previous year', () => {
        const months = computeMonthlyPayouts(txs, assets, 2026, fx);
        expect(months).toHaveLength(12);
        // March (index 2)
        expect(months[2]?.currentCash).toBeCloseTo(135, 2);
        expect(months[2]?.previousCash).toBeCloseTo(108, 2);
        // June (index 5)
        expect(months[5]?.currentReinvested).toBeCloseTo(32, 2);
    });

    it('computes holding income, concentration, KPIs, account groups, and upcoming payouts', () => {
        const rows = computeHoldingIncome(assets, accounts, metaMap, fx);
        expect(rows).toHaveLength(2);
        // SCHD: 100 * 3.0 * 1.35 = 405 CAD; XEQT.TO: 200 * 0.64 = 128 CAD
        expect(rows[0]?.ticker).toBe('SCHD');
        expect(rows[0]?.projectedAnnualCad).toBeCloseTo(405, 2);
        expect(rows[0]?.taxTreatment).toBe('withholding-lost');
        expect(rows[1]?.projectedAnnualCad).toBeCloseTo(128, 2);
        expect(rows[0]!.shareOfTotalPct + rows[1]!.shareOfTotalPct).toBeCloseTo(100, 2);

        const ytd = computeYtd(txs, assets, new Date('2026-11-19T12:00:00Z'), fx);
        const kpis = computeKpis(rows, ytd);
        expect(kpis.projectedAnnualCad).toBeCloseTo(533, 2);
        expect(kpis.averageMonthlyCad).toBeCloseTo(533 / 12, 2);
        expect(kpis.estimatedHoldingsCount).toBe(1);

        const groups = groupByAccount(rows, accounts, txs, assets, new Date('2026-11-19T12:00:00Z'), fx);
        const tfsaGroup = groups.find((g) => g.accountType === 'TFSA');
        expect(tfsaGroup?.hasUsWithholdingWarning).toBe(true);

        const upcoming30 = buildUpcomingPayouts(rows, metaMap, new Date('2026-11-19T12:00:00Z'), 30, fx);
        expect(upcoming30).toHaveLength(1);
        expect(upcoming30[0]?.ticker).toBe('SCHD');
        expect(upcoming30[0]?.isEstimated).toBe(false);

        const upcoming60 = buildUpcomingPayouts(rows, metaMap, new Date('2026-11-19T12:00:00Z'), 60, fx);
        expect(upcoming60).toHaveLength(2);
        expect(upcoming60[1]?.ticker).toBe('XEQT.TO');
        expect(upcoming60[1]?.isEstimated).toBe(true);
    });

    it('computes annual payouts across years and aggregates holdings by ticker', () => {
        const annual = computeAnnualPayouts(txs, assets, fx);
        expect(annual).toHaveLength(2);
        expect(annual[0]?.year).toBe('2025');
        expect(annual[0]?.cash).toBeCloseTo(108, 2);
        expect(annual[1]?.year).toBe('2026');
        expect(annual[1]?.total).toBeCloseTo(167, 2);

        const multiAccountAssets: Asset[] = [
            assets[1]!,
            { ...assets[1]!, id: 'a3', accountId: 'tfsa', quantity: 100, marketValue: 3200, cadMarketValue: 3200, totalCost: 2800, cadTotalCost: 2800 },
        ];
        const multiRows = computeHoldingIncome(multiAccountAssets, accounts, metaMap, fx);
        expect(multiRows).toHaveLength(2);
        const aggregated = aggregateHoldingsByTicker(multiRows);
        expect(aggregated).toHaveLength(1);
        expect(aggregated[0]?.ticker).toBe('XEQT.TO');
        expect(aggregated[0]?.accountName).toBe('2 accounts');
        expect(aggregated[0]?.shareOfTotalPct).toBeCloseTo(100, 2);
        expect(aggregated[0]?.projectedAnnualCad).toBeCloseTo(192, 2);
    });
});
