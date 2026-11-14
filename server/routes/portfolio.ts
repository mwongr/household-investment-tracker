import crypto from 'crypto';
import { Router } from 'express';
import { CACHE_TTL } from '../config.js';
import { HistoryPricesBodySchema, MigrateCurrencySchema } from '../lib/validation.js';
import { cachedYahoo, yahooFinance } from '../lib/yahoo.js';

export function createPortfolioRouter(): Router {
    const router = Router();

    router.post('/portfolio/migrate-currency', async (req, res) => {
        const parsed = MigrateCurrencySchema.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json({
                error: 'Missing or invalid required parameters',
                issues: parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
            });
            return;
        }

        const {
            originalTicker,
            newTicker,
            conversionDate,
            newUsdCostBasis,
            shares,
            accountId,
            manualClosePrice,
        } = parsed.data;

        const targetDate = new Date(conversionDate);
        let closePrice = 0;

        if (manualClosePrice !== undefined) {
            closePrice = manualClosePrice;
        } else {
            // Fetch 7 days prior so weekends/holidays still resolve to the last trading day
            const period1 = new Date(targetDate.getTime() - 7 * 24 * 60 * 60 * 1000);
            const period2 = new Date(targetDate.getTime() + 24 * 60 * 60 * 1000);

            try {
                const hist = await cachedYahoo(
                    `migrate:${originalTicker}:${conversionDate}`,
                    CACHE_TTL.HISTORY,
                    () =>
                        yahooFinance.chart(originalTicker, {
                            period1,
                            period2,
                            interval: '1d',
                        })
                );
                const validQuotes = (hist?.quotes ?? []).filter(
                    (q) => q.date && new Date(q.date) <= targetDate && typeof q.close === 'number'
                );
                const lastQuote = validQuotes[validQuotes.length - 1];
                if (!lastQuote || lastQuote.close == null) {
                    throw new Error('No historical data found for that date');
                }
                closePrice = lastQuote.close;
            } catch (err) {
                console.error('Failed to fetch historical price for migration:', err);
                res.status(500).json({
                    error: 'Failed to fetch historical closing price for the conversion date. Please provide the closing price manually.',
                    requiresManualPrice: true,
                });
                return;
            }
        }

        const dateStr = targetDate.toISOString().split('T')[0];

        const sellTx = {
            id: crypto.randomUUID(),
            accountId,
            ticker: originalTicker,
            date: dateStr,
            type: 'Sell',
            shares,
            pricePerShare: closePrice,
            amount: shares * closePrice,
            commission: 0,
            currency: 'CAD',
            ignoreCashImpact: true,
        };

        const buyTx = {
            id: crypto.randomUUID(),
            accountId,
            ticker: newTicker,
            date: dateStr,
            type: 'Buy',
            shares,
            pricePerShare: newUsdCostBasis / shares,
            amount: newUsdCostBasis,
            commission: 0,
            currency: 'USD',
            previousTicker: originalTicker,
            ignoreCashImpact: true,
        };

        res.json({ success: true, transactions: [sellTx, buyTx] });
    });

    router.post('/portfolio/history-prices', async (req, res) => {
        const parsed = HistoryPricesBodySchema.safeParse(req.body ?? {});
        if (!parsed.success) {
            res.status(400).json({ error: 'Invalid history-prices request' });
            return;
        }

        const uniqueTickers = [...new Set(parsed.data.tickers)];
        if (uniqueTickers.length === 0) {
            res.json({ prices: {} });
            return;
        }

        const period1 = parsed.data.startDate ?? '2020-01-01';
        const period2 = new Date();
        const prices: Record<string, Array<{ date: string; close: number }>> = {};

        await Promise.all(
            uniqueTickers.map(async (ticker) => {
                try {
                    prices[ticker] = await cachedYahoo(
                        `history:${ticker}:${period1}`,
                        CACHE_TTL.HISTORY,
                        async () => {
                            const chart = await yahooFinance.chart(ticker, {
                                period1,
                                period2,
                                interval: '1wk',
                            });
                            const rawQuotes = (chart?.quotes ?? []).filter(
                                (q) => q.date && typeof q.close === 'number' && q.close > 0
                            );
                            const splits = (chart?.events?.splits ?? [])
                                .filter((s) => s.date && s.numerator > 0 && s.denominator > 0)
                                .map((s) => ({
                                    dateStr: new Date(s.date).toISOString().split('T')[0] ?? '',
                                    factor: s.numerator / s.denominator,
                                }));

                            return rawQuotes.map((q) => {
                                const dateStr = new Date(q.date).toISOString().split('T')[0] ?? '';
                                let unadjustedClose = q.close as number;
                                for (const sp of splits) {
                                    if (sp.dateStr > dateStr) {
                                        unadjustedClose *= sp.factor;
                                    }
                                }
                                return { date: dateStr, close: unadjustedClose };
                            });
                        }
                    );
                } catch {
                    // Delisted or unrecognized ticker — client falls back to transaction-based pricing
                    prices[ticker] = [];
                }
            })
        );

        res.json({ prices });
    });

    return router;
}
