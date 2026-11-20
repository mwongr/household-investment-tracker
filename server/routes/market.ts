import { Router } from 'express';
import { CACHE_TTL } from '../config.js';
import { computeTechnicalAnalysis } from '../lib/indicators.js';
import {
    EventsBodySchema,
    RangeSchema,
    ScreenerTypeSchema,
    SymbolSchema,
} from '../lib/validation.js';
import {
    cachedYahoo,
    fetchYahooChart,
    fetchYahooScreener,
    SymbolNotFoundError,
    yahooFinance,
} from '../lib/yahoo.js';

export function createMarketRouter(): Router {
    const router = Router();

    router.get('/exchange-rate', async (_req, res) => {
        try {
            const rate = await cachedYahoo('exchange-rate:CAD=X', CACHE_TTL.EXCHANGE_RATE, async () => {
                const quote = await yahooFinance.quote('CAD=X');
                if (!quote?.regularMarketPrice) {
                    throw new Error('Missing regularMarketPrice for CAD=X');
                }
                return quote.regularMarketPrice;
            });
            res.json({ rate });
        } catch (err) {
            console.error('Exchange rate fetch failed:', err);
            res.status(500).json({ error: 'Failed to fetch exchange rate' });
        }
    });

    router.get('/quote', async (req, res) => {
        const symParsed = SymbolSchema.safeParse(req.query.symbol);
        if (!symParsed.success) {
            res.status(400).json({ error: 'Valid symbol is required' });
            return;
        }
        const rangeParsed = RangeSchema.safeParse(req.query.range ?? '1mo');
        const range = rangeParsed.success ? rangeParsed.data : '1mo';
        const symbol = symParsed.data;

        try {
            // Fetch 1d separately because multi-day chart meta.chartPreviousClose reflects range start, not yesterday's close
            const [resSpark, resPrice] = await Promise.all([
                cachedYahoo(`chart:${symbol}:${range}`, CACHE_TTL.SPARKLINE, () =>
                    fetchYahooChart(symbol, range)
                ),
                cachedYahoo(`chart:${symbol}:1d`, CACHE_TTL.PRICE_1D, () =>
                    fetchYahooChart(symbol, '1d')
                ),
            ]);

            let sparklineData: Array<{
                price: number;
                open: number;
                high: number;
                low: number;
                close: number;
                date: string;
            }> = [];

            let priceData: {
                price?: number;
                currency?: string;
                high?: number;
                low?: number;
                prevClose?: number;
                volume?: number;
            } | null = null;

            if (resSpark) {
                const timestamps = resSpark.timestamp;
                const quote = resSpark.indicators?.quote?.[0];
                const closeData = quote?.close;
                const openData = quote?.open;
                const highData = quote?.high;
                const lowData = quote?.low;

                if (timestamps && closeData) {
                    sparklineData = closeData
                        .map((price, index) => {
                            const ts = timestamps[index];
                            if (price == null || ts == null) return null;
                            const rounded = parseFloat(price.toFixed(2));
                            return {
                                price: rounded,
                                open:
                                    openData?.[index] != null
                                        ? parseFloat(openData[index]!.toFixed(2))
                                        : rounded,
                                high:
                                    highData?.[index] != null
                                        ? parseFloat(highData[index]!.toFixed(2))
                                        : rounded,
                                low:
                                    lowData?.[index] != null
                                        ? parseFloat(lowData[index]!.toFixed(2))
                                        : rounded,
                                close: rounded,
                                date: new Date(ts * 1000).toISOString(),
                            };
                        })
                        .filter((item): item is NonNullable<typeof item> => item !== null);
                }

                if (resSpark.meta) {
                    priceData = {
                        price: resSpark.meta.regularMarketPrice,
                        currency: resSpark.meta.currency,
                        high: resSpark.meta.fiftyTwoWeekHigh,
                        low: resSpark.meta.fiftyTwoWeekLow,
                        prevClose: resSpark.meta.chartPreviousClose,
                        volume: resSpark.meta.regularMarketVolume,
                    };
                }
            }

            let dailyChangePercent = 0;
            let foundDailyData = false;

            if (resPrice?.meta) {
                const price = resPrice.meta.regularMarketPrice ?? 0;
                const prevClose = resPrice.meta.chartPreviousClose ?? 0;
                dailyChangePercent = prevClose !== 0 ? ((price - prevClose) / prevClose) * 100 : 0;
                priceData = {
                    price,
                    currency: resPrice.meta.currency,
                    high: resPrice.meta.fiftyTwoWeekHigh,
                    low: resPrice.meta.fiftyTwoWeekLow,
                    prevClose,
                    volume: resPrice.meta.regularMarketVolume,
                };
                foundDailyData = true;
            }

            if (!foundDailyData && sparklineData.length >= 2) {
                const current = sparklineData[sparklineData.length - 1]!.price;
                const previous = sparklineData[sparklineData.length - 2]!.price;
                if (previous !== 0) {
                    dailyChangePercent = ((current - previous) / previous) * 100;
                }
            } else if (!foundDailyData && priceData?.prevClose) {
                const price = priceData.price ?? 0;
                const prevClose = priceData.prevClose;
                if (range === '5y' || range === '1y') {
                    dailyChangePercent = 0;
                } else if (prevClose !== 0) {
                    dailyChangePercent = ((price - prevClose) / prevClose) * 100;
                }
            }

            if (priceData) {
                res.json({
                    symbol,
                    regularMarketPrice: priceData.price,
                    regularMarketChangePercent: dailyChangePercent,
                    fiftyTwoWeekHigh: priceData.high,
                    fiftyTwoWeekLow: priceData.low,
                    currency: priceData.currency,
                    volume: priceData.volume,
                    sparkline: sparklineData,
                    source: 'chart_api_v8_dual',
                });
                return;
            }
        } catch (err) {
            if (err instanceof SymbolNotFoundError) {
                res.status(404).json({ symbol, error: err.message, notFound: true });
                return;
            }
            console.error(`Chart API failed for ${symbol}:`, err);
        }

        res.json({
            symbol,
            regularMarketPrice: 0,
            error: 'Could not fetch data',
            isMock: true,
        });
    });

    router.get('/quote-detailed', async (req, res) => {
        const symParsed = SymbolSchema.safeParse(req.query.symbol);
        if (!symParsed.success) {
            res.status(400).json({ error: 'Valid symbol is required' });
            return;
        }
        const symbol = symParsed.data;

        try {
            const detailed = await cachedYahoo(`quote-detailed:${symbol}`, CACHE_TTL.PRICE_1D, async () => {
                try {
                    const quote = await yahooFinance.quote(symbol);
                    // A quote with no price is Yahoo's placeholder for an unlisted symbol;
                    // fall through to the chart API, which reports it as not found.
                    if (quote && quote.regularMarketPrice != null) {
                        return {
                            symbol: quote.symbol,
                            shortName: quote.shortName || quote.longName,
                            price: quote.regularMarketPrice,
                            currency: quote.currency,
                            change: quote.regularMarketChange,
                            changePercent: quote.regularMarketChangePercent,
                            dayHigh: quote.regularMarketDayHigh,
                            dayLow: quote.regularMarketDayLow,
                            open: quote.regularMarketOpen,
                            prevClose: quote.regularMarketPreviousClose,
                            bid: quote.bid,
                            ask: quote.ask,
                            volume: quote.regularMarketVolume,
                            avgVolume: quote.averageDailyVolume3Month,
                            fiftyTwoWeekHigh: quote.fiftyTwoWeekHigh,
                            fiftyTwoWeekLow: quote.fiftyTwoWeekLow,
                            marketCap: quote.marketCap,
                            peRatio: quote.trailingPE || quote.forwardPE,
                        };
                    }
                } catch {
                    // Fallback to V8 chart meta when quoteSummary/quote fails
                }

                const chart = await fetchYahooChart(symbol, '1d');
                if (chart?.meta) {
                    const price = chart.meta.regularMarketPrice ?? 0;
                    const prevClose = chart.meta.chartPreviousClose ?? 0;
                    return {
                        symbol,
                        shortName: symbol,
                        price,
                        currency: chart.meta.currency,
                        change: price - prevClose,
                        changePercent: prevClose ? ((price - prevClose) / prevClose) * 100 : 0,
                        dayHigh: chart.meta.regularMarketDayHigh,
                        dayLow: chart.meta.regularMarketDayLow,
                        open: chart.meta.regularMarketOpen,
                        prevClose,
                        bid: null,
                        ask: null,
                        volume: chart.meta.regularMarketVolume,
                        avgVolume: null,
                        fiftyTwoWeekHigh: chart.meta.fiftyTwoWeekHigh,
                        fiftyTwoWeekLow: chart.meta.fiftyTwoWeekLow,
                        marketCap: null,
                        peRatio: null,
                    };
                }
                throw new Error(`No quote data available for ${symbol}`);
            });

            res.json(detailed);
        } catch (err) {
            if (err instanceof SymbolNotFoundError) {
                res.status(404).json({ symbol, error: err.message, notFound: true });
                return;
            }
            console.error(`Detailed quote failed for ${symbol}:`, err);
            res.status(500).json({ error: 'Failed to fetch detailed quote' });
        }
    });

    router.get('/screener', async (req, res) => {
        const typeParsed = ScreenerTypeSchema.safeParse(req.query.type);
        const scrId = typeParsed.success ? typeParsed.data : 'most_actives';

        try {
            const data = await cachedYahoo(`screener:${scrId}`, CACHE_TTL.SPARKLINE, () =>
                fetchYahooScreener(scrId)
            );
            res.json(data);
        } catch (err) {
            console.error(`Screener error for ${scrId}:`, err);
            res.status(500).json({ error: 'Screener fetch failed' });
        }
    });

    router.post('/events', async (req, res) => {
        const parsed = EventsBodySchema.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json({ error: 'Valid symbols array required' });
            return;
        }

        const results = await Promise.all(
            parsed.data.symbols.map(async (symbol) => {
                try {
                    const data = await cachedYahoo(`events:${symbol}`, CACHE_TTL.EVENTS, () =>
                        yahooFinance.quoteSummary(symbol, {
                            modules: ['calendarEvents', 'summaryDetail'],
                        })
                    );
                    return { symbol, success: true, data };
                } catch (err) {
                    console.error(`Failed events for ${symbol}:`, err);
                    return { symbol, success: false };
                }
            })
        );

        res.json(results);
    });

    router.get('/stocks/compare', async (req, res) => {
        const rawSymbols = typeof req.query.symbols === 'string' ? req.query.symbols : '';
        const rawList = rawSymbols
            .split(',')
            .map((s) => s.trim().toUpperCase())
            .filter(Boolean);

        if (rawList.length === 0) {
            res.status(400).json({ error: 'At least one symbol is required' });
            return;
        }
        if (rawList.length > 8) {
            res.status(400).json({ error: 'Maximum 8 symbols allowed' });
            return;
        }

        const symbolList: string[] = [];
        for (const s of rawList) {
            const p = SymbolSchema.safeParse(s);
            if (!p.success) {
                res.status(400).json({ error: `Invalid symbol: ${s}` });
                return;
            }
            symbolList.push(p.data);
        }

        const rangeParsed = RangeSchema.safeParse(req.query.range ?? '1y');
        const range = rangeParsed.success ? rangeParsed.data : '1y';
        const cacheKey = `compare:${[...symbolList].sort().join(',')}:${range}`;

        try {
            const responseData = await cachedYahoo(cacheKey, CACHE_TTL.COMPARE, async () => {
                const fetchResults = await Promise.allSettled(
                    symbolList.map(async (symbol) => {
                        const result = await fetchYahooChart(symbol, range);
                        if (!result?.timestamp || !result.indicators?.quote?.[0]) {
                            throw new Error('Invalid data structure');
                        }
                        const timestamps = result.timestamp;
                        const quote = result.indicators.quote[0];
                        const adjcloseArr = result.indicators.adjclose?.[0]?.adjclose ?? quote.close ?? [];
                        const closeArr = quote.close ?? [];

                        const rows: Array<{ date: string; adjClose: number; close: number }> = [];
                        for (let i = 0; i < timestamps.length; i++) {
                            const ac = adjcloseArr[i];
                            const ts = timestamps[i];
                            if (ac != null && ts != null) {
                                const date = new Date(ts * 1000).toISOString().split('T')[0] ?? '';
                                rows.push({
                                    date,
                                    adjClose: ac,
                                    close: closeArr[i] != null ? closeArr[i]! : ac,
                                });
                            }
                        }
                        rows.sort((a, b) => a.date.localeCompare(b.date));
                        return { symbol, rows };
                    })
                );

                const successfulSeries: Array<{
                    symbol: string;
                    rows: Array<{ date: string; adjClose: number; close: number }>;
                }> = [];
                const errors: Record<string, string> = {};

                for (let i = 0; i < fetchResults.length; i++) {
                    const result = fetchResults[i]!;
                    const symbol = symbolList[i]!;
                    if (result.status === 'fulfilled' && result.value.rows.length > 0) {
                        successfulSeries.push(result.value);
                    } else {
                        const reason =
                            result.status === 'rejected'
                                ? (result.reason as Error)?.message
                                : 'No data returned';
                        errors[symbol] = reason || 'No data available for this symbol';
                    }
                }

                if (successfulSeries.length === 0) {
                    return { status: 404 as const, body: { error: 'No data found for any of the requested symbols', errors } };
                }

                const dateSets = successfulSeries.map(({ rows }) => new Set(rows.map((r) => r.date)));
                let commonDates = dateSets[0]!;
                for (let i = 1; i < dateSets.length; i++) {
                    const nextSet = dateSets[i]!;
                    commonDates = new Set([...commonDates].filter((d) => nextSet.has(d)));
                }
                const alignedDates = Array.from(commonDates).sort();

                if (alignedDates.length < 2) {
                    return {
                        status: 422 as const,
                        body: { error: 'Insufficient overlapping dates between the requested symbols' },
                    };
                }

                const seriesData: Record<string, (number | null)[]> = {};
                const summaryData: Record<
                    string,
                    { currentPrice: number; firstPrice: number; totalReturn: number }
                > = {};

                for (const { symbol, rows } of successfulSeries) {
                    const priceMap = new Map<string, number>();
                    for (const row of rows) {
                        priceMap.set(row.date, row.adjClose ?? row.close);
                    }

                    const firstPrice = priceMap.get(alignedDates[0]!);
                    if (!firstPrice) continue;

                    seriesData[symbol] = alignedDates.map((d) => {
                        const price = priceMap.get(d);
                        if (price == null) return null;
                        return parseFloat((((price - firstPrice) / firstPrice) * 100).toFixed(4));
                    });

                    const lastPrice = priceMap.get(alignedDates[alignedDates.length - 1]!) ?? 0;
                    summaryData[symbol] = {
                        currentPrice: parseFloat(lastPrice.toFixed(2)),
                        firstPrice: parseFloat(firstPrice.toFixed(2)),
                        totalReturn: parseFloat((((lastPrice - firstPrice) / firstPrice) * 100).toFixed(2)),
                    };
                }

                return {
                    status: 200 as const,
                    body: {
                        dates: alignedDates,
                        series: seriesData,
                        summary: summaryData,
                        errors,
                        range,
                        fetchedAt: new Date().toISOString(),
                    },
                };
            });

            res.status(responseData.status).json(responseData.body);
        } catch (err) {
            console.error('Compare endpoint failed:', err);
            res.status(500).json({ error: 'Failed to compare symbols' });
        }
    });

    router.get('/stocks/:ticker/analysis', async (req, res) => {
        const symParsed = SymbolSchema.safeParse(req.params.ticker);
        if (!symParsed.success) {
            res.status(400).json({ error: 'Invalid ticker symbol' });
            return;
        }
        const ticker = symParsed.data;

        try {
            const analysis = await cachedYahoo(`analysis:${ticker}`, CACHE_TTL.ANALYSIS, async () => {
                const chart = await fetchYahooChart(ticker, '1y');
                if (!chart) {
                    throw new Error(`No data returned for ${ticker}`);
                }
                return computeTechnicalAnalysis(ticker, chart);
            });
            res.json(analysis);
        } catch (err) {
            console.error(`[Analysis] Error for ${ticker}:`, err);
            res.status(502).json({ error: 'Failed to compute stock analysis' });
        }
    });

    return router;
}
