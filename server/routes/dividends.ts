import { Router } from 'express';
import { CACHE_TTL } from '../config.js';
import { db } from '../lib/db.js';
import {
    buildTransactionHistory,
    computeTtmPerShare,
    countTtmPayouts,
    estimateNextPayout,
    hasUnevenPayouts,
    inferCadence,
    paymentsPerYear,
    toIsoDay,
    type MinimalTx,
    type PayoutFrequency,
    type PayoutPoint,
} from '../lib/dividends.js';
import { SymbolSchema } from '../lib/validation.js';
import { cachedYahoo, yahooFinance } from '../lib/yahoo.js';

export interface DividendMetadata {
    symbol: string;
    currency: string | null;
    forwardAnnualRate: number | null;
    trailingAnnualRate: number | null;
    trailingYield: number | null;
    forwardYield: number | null;
    exDividendDate: string | null;
    payDate: string | null;
    amountPerPayment: number | null;
    frequency: PayoutFrequency | null;
    isEstimated: boolean;
    source: 'yahoo' | 'yahoo-history' | 'transactions' | 'none';
    error?: string;
}

interface StoredAssetLike {
    ticker?: unknown;
    quantity?: unknown;
}

function isCryptoTicker(symbol: string): boolean {
    return symbol.endsWith('-USD') || symbol.endsWith('-CAD');
}

function toIsoDateOrNull(val: unknown): string | null {
    if (!val) return null;
    if (val instanceof Date) {
        return Number.isNaN(val.getTime()) ? null : val.toISOString().slice(0, 10);
    }
    if (typeof val === 'number') {
        const ms = val > 1e12 ? val : val * 1000;
        const d = new Date(ms);
        return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
    }
    if (typeof val === 'string') {
        const d = new Date(val);
        return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
    }
    return null;
}

function toFiniteNumberOrNull(val: unknown): number | null {
    return typeof val === 'number' && Number.isFinite(val) && val > 0 ? val : null;
}

function isFutureOrToday(isoDay: string | null, todayIso: string): boolean {
    return Boolean(isoDay && isoDay >= todayIso);
}

export function createDividendsRouter(store = db): Router {
    const router = Router();

    router.get('/dividends/metadata', async (req, res) => {
        const state = store.read();
        const today = new Date();
        const todayIso = today.toISOString().slice(0, 10);

        let symbols: string[] = [];
        if (typeof req.query.symbols === 'string' && req.query.symbols.trim().length > 0) {
            const rawList = req.query.symbols
                .split(',')
                .map((s) => s.trim().toUpperCase())
                .filter(Boolean);

            if (rawList.length > 100) {
                res.status(400).json({ error: 'Maximum 100 symbols allowed' });
                return;
            }

            const validated: string[] = [];
            for (const raw of rawList) {
                const parsed = SymbolSchema.safeParse(raw);
                if (!parsed.success) {
                    res.status(400).json({ error: `Invalid ticker symbol: ${raw}` });
                    return;
                }
                validated.push(parsed.data);
            }
            symbols = Array.from(new Set(validated));
        } else {
            const rawAssets = Array.isArray(state.assets) ? (state.assets as StoredAssetLike[]) : [];
            const heldTickers = rawAssets
                .filter(
                    (a) =>
                        typeof a.ticker === 'string' &&
                        typeof a.quantity === 'number' &&
                        a.quantity > 0
                )
                .map((a) => (a.ticker as string).trim().toUpperCase())
                .filter((sym) => sym.length > 0 && !isCryptoTicker(sym) && SymbolSchema.safeParse(sym).success);
            symbols = Array.from(new Set(heldTickers));
        }

        const rawTxs = Array.isArray(state.transactions) ? (state.transactions as MinimalTx[]) : [];

        const items = await Promise.all(
            symbols.map(async (symbol): Promise<DividendMetadata> => {
                let currency: string | null = null;
                let forwardAnnualRate: number | null = null;
                let trailingAnnualRate: number | null = null;
                let trailingYield: number | null = null;
                let forwardYield: number | null = null;
                let confirmedExDate: string | null = null;
                let confirmedPayDate: string | null = null;
                let yahooError: string | undefined;

                try {
                    const summary = await cachedYahoo(
                        `div-meta:${symbol}`,
                        CACHE_TTL.DIVIDENDS,
                        () =>
                            yahooFinance.quoteSummary(symbol, {
                                modules: ['summaryDetail', 'calendarEvents'],
                            })
                    );

                    const detail = summary?.summaryDetail;
                    const cal = summary?.calendarEvents;

                    if (detail) {
                        currency = typeof detail.currency === 'string' ? detail.currency : null;
                        forwardAnnualRate = toFiniteNumberOrNull(detail.dividendRate);
                        trailingAnnualRate = toFiniteNumberOrNull(detail.trailingAnnualDividendRate);
                        forwardYield = toFiniteNumberOrNull(detail.dividendYield);
                        trailingYield = toFiniteNumberOrNull(detail.trailingAnnualDividendYield);
                        confirmedExDate = toIsoDateOrNull(detail.exDividendDate);
                    }
                    if (cal) {
                        const calEx = toIsoDateOrNull(cal.exDividendDate);
                        const calPay = toIsoDateOrNull(cal.dividendDate);
                        if (calEx && (!confirmedExDate || calEx > confirmedExDate)) {
                            confirmedExDate = calEx;
                        }
                        if (calPay) {
                            confirmedPayDate = calPay;
                        }
                    }
                } catch (err) {
                    yahooError = err instanceof Error ? err.message : 'Yahoo quoteSummary failed';
                }

                // Fetch 2y dividend event history from Yahoo (cached 24h) for cadence & .TO fallback
                let yahooHistory: PayoutPoint[] = [];
                try {
                    const period1 = new Date(today.getTime() - 730 * 24 * 60 * 60 * 1000);
                    const chart = await cachedYahoo(
                        `div-hist:${symbol}`,
                        CACHE_TTL.DIVIDEND_HISTORY,
                        () =>
                            yahooFinance.chart(symbol, {
                                period1,
                                period2: today,
                                interval: '1mo',
                                events: 'div',
                            })
                    );

                    const divEvents = chart?.events?.dividends ?? [];
                    yahooHistory = divEvents
                        .map((ev): PayoutPoint | null => {
                            const dateStr = toIsoDateOrNull(ev.date);
                            const amount = toFiniteNumberOrNull(ev.amount);
                            if (!dateStr || amount === null) return null;
                            return {
                                date: dateStr,
                                amountPerShare: amount,
                                totalAmount: amount,
                            };
                        })
                        .filter((p): p is PayoutPoint => p !== null)
                        .sort((a, b) => a.date.localeCompare(b.date));
                } catch {
                    // Chart dividend history optional — fall through to local transactions
                }

                const txHistory = buildTransactionHistory(rawTxs, symbol);

                // Determine cadence from Yahoo history first, then local transactions
                const yahooCadence = inferCadence(yahooHistory.map((p) => p.date));
                const txCadence = inferCadence(txHistory.map((p) => p.date));
                const frequency: PayoutFrequency | null =
                    yahooCadence?.frequency ?? txCadence?.frequency ?? null;

                // Determine annual rate using TTM per-share sum (for uneven ETFs like XEQT.TO or missing forward rates)
                const effectiveYahooLast = yahooHistory[yahooHistory.length - 1]?.amountPerShare ?? null;
                const effectiveTxLast = txHistory[txHistory.length - 1]?.amountPerShare ?? null;

                const yahooTtm = computeTtmPerShare(yahooHistory, today);
                const txTtm = computeTtmPerShare(txHistory, today);
                const ttmRate = yahooTtm ?? txTtm;
                const ttmSource = yahooTtm !== null ? yahooHistory : txHistory;
                const activeHistory = yahooHistory.length > 0 ? yahooHistory : txHistory;
                const uneven = hasUnevenPayouts(activeHistory, today);

                const expectedAnnualPayouts =
                    frequency !== null && frequency !== 'irregular'
                        ? paymentsPerYear(frequency)
                        : 0;
                const minFullYearPayouts =
                    expectedAnnualPayouts >= 12 ? expectedAnnualPayouts - 1 : expectedAnnualPayouts;
                const hasFullYearTtm =
                    ttmRate !== null &&
                    (expectedAnnualPayouts === 0 ||
                        countTtmPayouts(ttmSource, today) >= minFullYearPayouts);

                if (hasFullYearTtm && ttmRate !== null) {
                    trailingAnnualRate = ttmRate;
                    // For uneven distributions (e.g. XEQT.TO), Yahoo's forward dividendRate often reflects lastPayout * 4
                    // which understates/overstates the annual total; prefer the true TTM sum instead.
                    if (uneven) {
                        forwardAnnualRate = null;
                    }
                } else if (forwardAnnualRate === null && trailingAnnualRate === null && frequency !== null) {
                    const perShare = effectiveYahooLast ?? effectiveTxLast;
                    if (perShare !== null && perShare > 0) {
                        trailingAnnualRate = perShare * paymentsPerYear(frequency);
                    }
                } else if (ttmRate !== null && trailingAnnualRate === null) {
                    trailingAnnualRate = ttmRate;
                }

                const annualRate = forwardAnnualRate ?? trailingAnnualRate;
                const perPaymentFromAnnual =
                    uneven
                        ? (effectiveYahooLast ?? effectiveTxLast)
                        : annualRate !== null && frequency !== null
                            ? annualRate / paymentsPerYear(frequency)
                            : null;

                // Resolution order:
                // 1. Confirmed future dates from Yahoo Finance
                const hasConfirmedFuture =
                    isFutureOrToday(confirmedExDate, todayIso) ||
                    isFutureOrToday(confirmedPayDate, todayIso);

                if (hasConfirmedFuture) {
                    return {
                        symbol,
                        currency,
                        forwardAnnualRate,
                        trailingAnnualRate,
                        trailingYield,
                        forwardYield,
                        exDividendDate: isFutureOrToday(confirmedExDate, todayIso)
                            ? confirmedExDate
                            : null,
                        payDate: isFutureOrToday(confirmedPayDate, todayIso)
                            ? confirmedPayDate
                            : null,
                        amountPerPayment:
                            perPaymentFromAnnual ?? effectiveYahooLast ?? effectiveTxLast,
                        frequency,
                        isEstimated: false,
                        source: 'yahoo',
                    };
                }

                // 2. Estimated next payout from Yahoo dividend history
                const yahooEstimate = estimateNextPayout(yahooHistory, today);
                if (yahooEstimate) {
                    return {
                        symbol,
                        currency,
                        forwardAnnualRate,
                        trailingAnnualRate,
                        trailingYield,
                        forwardYield,
                        exDividendDate: null,
                        payDate: yahooEstimate.nextPayDate,
                        amountPerPayment: perPaymentFromAnnual ?? yahooEstimate.amountPerShare,
                        frequency: yahooEstimate.frequency,
                        isEstimated: true,
                        source: 'yahoo-history',
                    };
                }

                // 3. Estimated next payout from local transaction history
                const txEstimate = estimateNextPayout(txHistory, today);
                if (txEstimate) {
                    return {
                        symbol,
                        currency,
                        forwardAnnualRate,
                        trailingAnnualRate,
                        trailingYield,
                        forwardYield,
                        exDividendDate: null,
                        payDate: txEstimate.nextPayDate,
                        amountPerPayment: perPaymentFromAnnual ?? txEstimate.amountPerShare,
                        frequency: txEstimate.frequency,
                        isEstimated: true,
                        source: 'transactions',
                    };
                }

                // 4. Annual rate known (e.g. from summaryDetail) even without upcoming date
                if (annualRate !== null) {
                    return {
                        symbol,
                        currency,
                        forwardAnnualRate,
                        trailingAnnualRate,
                        trailingYield,
                        forwardYield,
                        exDividendDate: confirmedExDate ? toIsoDay(confirmedExDate) : null,
                        payDate: confirmedPayDate ? toIsoDay(confirmedPayDate) : null,
                        amountPerPayment: perPaymentFromAnnual,
                        frequency,
                        isEstimated: true,
                        source: 'yahoo',
                    };
                }

                return {
                    symbol,
                    currency,
                    forwardAnnualRate: null,
                    trailingAnnualRate: null,
                    trailingYield: null,
                    forwardYield: null,
                    exDividendDate: null,
                    payDate: null,
                    amountPerPayment: null,
                    frequency: null,
                    isEstimated: false,
                    source: 'none',
                    ...(yahooError ? { error: yahooError } : {}),
                };
            })
        );

        res.json({
            items,
            fetchedAt: today.toISOString(),
        });
    });

    return router;
}
