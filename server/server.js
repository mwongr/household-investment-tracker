import express from 'express';
import cors from 'cors';
import YahooFinance from 'yahoo-finance2';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import technicalindicators from 'technicalindicators';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3001;
const DB_PATH = path.join(__dirname, 'database.json');

const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey', 'cookie'] });

console.log('Server starting (Draft 8 - Chart API)...');

app.use(cors());
app.use(express.json({ limit: '50mb' })); // Increase limit for potentially large data

// Sync Endpoint - Saves state to local file
app.post('/api/sync', (req, res) => {
    try {
        const data = req.body;
        // Basic validation - ensure we aren't wiping with empty data
        if (!data || Object.keys(data).length === 0) {
            return res.status(400).json({ error: 'Empty data' });
        }
        let existingData = {};
        if (fs.existsSync(DB_PATH)) {
            try { 
                existingData = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8')); 
            } catch (e) {}
        }

        // Merge existing data with incoming data to preserve keys not managed by DataContext 
        // (like taxScenarios and taxSettings)
        const mergedData = { ...existingData, ...data };

        fs.writeFileSync(DB_PATH, JSON.stringify(mergedData, null, 2));
        res.json({ success: true, timestamp: new Date().toISOString() });
    } catch (e) {
        console.error('Sync failed:', e);
        res.status(500).json({ error: 'Failed to write to disk' });
    }
});

app.get('/api/exchange-rate', async (req, res) => {
    try {
        const quote = await yahooFinance.quote('CAD=X');
        if (quote && quote.regularMarketPrice) {
            res.json({ rate: quote.regularMarketPrice });
        } else {
            res.status(500).json({ error: 'Failed to fetch exchange rate' });
        }
    } catch (e) {
        console.error('Exchange rate fetch failed:', e);
        res.status(500).json({ error: 'Failed to fetch exchange rate' });
    }
});

app.post('/api/portfolio/migrate-currency', async (req, res) => {
    try {
        const { originalTicker, newTicker, conversionDate, newUsdCostBasis, shares, accountId } = req.body;

        if (!originalTicker || !newTicker || !conversionDate || !newUsdCostBasis || !shares || !accountId) {
            return res.status(400).json({ error: 'Missing required parameters' });
        }

        // 1. Fetch historical close price for originalTicker on conversionDate
        // period2 must be at least 1 day after period1 for yahoo-finance2
        // We fetch 7 days prior to ensure we catch the last trading day if conversionDate is a weekend/holiday.
        const targetDate = new Date(conversionDate);
        const period1 = new Date(targetDate.getTime() - 7 * 24 * 60 * 60 * 1000);
        const period2 = new Date(targetDate.getTime() + 24 * 60 * 60 * 1000);
        
        let closePrice = 0;
        try {
            const hist = await yahooFinance.chart(originalTicker, {
                period1: period1,
                period2: period2,
                interval: '1d'
            });
            if (hist && hist.quotes && hist.quotes.length > 0) {
                // Find the closest quote on or before the conversionDate
                const validQuotes = hist.quotes.filter(q => new Date(q.date) <= targetDate);
                if (validQuotes.length > 0) {
                    closePrice = validQuotes[validQuotes.length - 1].close;
                } else {
                    throw new Error('No historical data found for that date');
                }
            } else {
                throw new Error('No historical data found for that date');
            }
        } catch (e) {
            console.error('Failed to fetch historical price for migration:', e);
            return res.status(500).json({ error: 'Failed to fetch historical closing price for the conversion date.' });
        }

        // 2. Create the Sell transaction for the original asset
        const sellTx = {
            id: crypto.randomUUID(),
            accountId: accountId,
            ticker: originalTicker,
            date: targetDate.toISOString().split('T')[0],
            type: 'Sell',
            shares: Number(shares),
            pricePerShare: closePrice,
            amount: Number(shares) * closePrice,
            commission: 0,
            currency: 'CAD',
            ignoreCashImpact: true
        };

        // 3. Create the Buy transaction for the new USD asset
        const buyAmount = Number(newUsdCostBasis);
        const buyPricePerShare = buyAmount / Number(shares);

        const buyTx = {
            id: crypto.randomUUID(),
            accountId: accountId,
            ticker: newTicker,
            date: targetDate.toISOString().split('T')[0],
            type: 'Buy',
            shares: Number(shares),
            pricePerShare: buyPricePerShare,
            amount: buyAmount,
            commission: 0,
            currency: 'USD',
            previousTicker: originalTicker,
            ignoreCashImpact: true
        };

        // Return the transactions so frontend can append them
        res.json({ success: true, transactions: [sellTx, buyTx] });

    } catch (e) {
        console.error('Migration failed:', e);
        res.status(500).json({ error: 'Migration failed' });
    }
});

app.get('/api/quote', async (req, res) => {
    const { symbol } = req.query;

    if (!symbol) {
        return res.status(400).json({ error: 'Symbol is required' });
    }

    // Try V8 Chart API (Often more lenient than V7 Quote)
    try {

        const range = req.query.range || '1mo';
        console.log(`Fetching data for ${symbol} (Sparkline: ${range}, Price: 1d)...`);

        // Parallel fetch: 
        // 1. Requested range (e.g. 5y) for Sparkline
        // 2. 1d range for accurate Price/Change (Yahoo Metadata for 5y returns 5y-old PrevClose, which is wrong for daily change)
        const [resSpark, resPrice] = await Promise.all([
            fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=${range}`, { headers: { 'User-Agent': 'Mozilla/5.0' } }),
            fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`, { headers: { 'User-Agent': 'Mozilla/5.0' } })
        ]);

        let sparklineData = [];
        let priceData = null; // { price, changePercent, currency, etc }

        // Process Sparkline Response
        if (resSpark.ok) {
            const data = await resSpark.json();
            const result = data.chart?.result?.[0];
            if (result) {
                const timestamps = result.timestamp;
                const quote = result.indicators?.quote?.[0];
                const closeData = quote?.close;
                const openData = quote?.open;
                const highData = quote?.high;
                const lowData = quote?.low;

                if (timestamps && closeData) {
                    sparklineData = closeData.map((price, index) => {
                        if (price === null || price === undefined) return null;
                        return {
                            price: parseFloat(price.toFixed(2)),
                            open: openData?.[index] != null ? parseFloat(openData[index].toFixed(2)) : parseFloat(price.toFixed(2)),
                            high: highData?.[index] != null ? parseFloat(highData[index].toFixed(2)) : parseFloat(price.toFixed(2)),
                            low: lowData?.[index] != null ? parseFloat(lowData[index].toFixed(2)) : parseFloat(price.toFixed(2)),
                            close: parseFloat(price.toFixed(2)),
                            date: new Date(timestamps[index] * 1000).toISOString()
                        };
                    }).filter(item => item !== null);
                }

                // Fallback price data from sparkline if 1d fails
                priceData = {
                    price: result.meta.regularMarketPrice,
                    currency: result.meta.currency,
                    high: result.meta.fiftyTwoWeekHigh,
                    low: result.meta.fiftyTwoWeekLow,
                    low: result.meta.fiftyTwoWeekLow,
                    prevClose: result.meta.chartPreviousClose,
                    volume: result.meta.regularMarketVolume
                };
            }
        }

        // Process Daily Response (Override Price Data)
        let dailyChangePercent = 0;
        let foundDailyData = false;

        if (resPrice.ok) {
            const data = await resPrice.json();
            const result = data.chart?.result?.[0];
            if (result && result.meta) {
                const price = result.meta.regularMarketPrice || 0;
                const prevClose = result.meta.chartPreviousClose || 0; // For 1d, this IS yesterday's close

                dailyChangePercent = (prevClose && prevClose !== 0) ? ((price - prevClose) / prevClose) * 100 : 0;

                // Update priceData with more accurate daily info
                priceData = {
                    price: price,
                    currency: result.meta.currency, // Should be same
                    high: result.meta.fiftyTwoWeekHigh, // Should be same
                    low: result.meta.fiftyTwoWeekLow,
                    prevClose: prevClose,
                    volume: result.meta.regularMarketVolume
                };
                foundDailyData = true;
            }
        }

        // If Daily fetch failed or returned no data, fallback to calculating from Sparkline history
        if (!foundDailyData && sparklineData.length >= 2) {
            const current = sparklineData[sparklineData.length - 1].price;
            const previous = sparklineData[sparklineData.length - 2].price;
            if (previous && previous !== 0) {
                dailyChangePercent = ((current - previous) / previous) * 100;
            }
        } else if (!foundDailyData && priceData && priceData.prevClose) {
            const price = priceData.price || 0;
            const prevClose = priceData.prevClose || 0;
            if (range === '5y' || range === '1y') {
                dailyChangePercent = 0;
            } else if (prevClose !== 0) {
                dailyChangePercent = ((price - prevClose) / prevClose) * 100;
            }
        }

        console.log(`Success ${symbol}: Price ${priceData?.price}, Change ${dailyChangePercent.toFixed(2)}% (Source: ${foundDailyData ? '1d_fetch' : 'history_calc'})`);

        if (priceData) {
            res.json({
                symbol: symbol,
                regularMarketPrice: priceData.price,
                regularMarketChangePercent: dailyChangePercent,
                fiftyTwoWeekHigh: priceData.high,
                fiftyTwoWeekLow: priceData.low,
                currency: priceData.currency,
                volume: priceData.volume,
                sparkline: sparklineData,
                source: 'chart_api_v8_dual'
            });
            return;
        }
    } catch (e) {
        console.error(`Chart API failed for ${symbol}:`, e.message);
    }

    // Fallback: If Chart API fails, return error state instead of fake data
    // The user hates fake data.
    res.json({
        symbol: symbol,
        regularMarketPrice: 0,
        error: "Could not fetch data",
        isMock: true
    });
});



// ... (existing helper function if any)

// Helper for Screen Scrape Strategy (Robust Fallback)
// const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args)); // Removed: Native fetch is available in Node 18+

async function scrapeQuote(symbol) {
    try {
        const res = await fetch(`https://finance.yahoo.com/quote/${symbol}`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });
        const text = await res.text();
        const match = text.match(/root\.App\.main\s*=\s*({[\s\S]*?});/);
        if (match && match[1]) {
            const json = JSON.parse(match[1]);
            const stores = json.context?.dispatcher?.stores;
            if (!stores) return null;

            const s = stores.QuoteSummaryStore;
            if (s) {
                const price = s.price || {};
                const detail = s.summaryDetail || {};
                const stats = s.defaultKeyStatistics || {};

                return {
                    symbol: symbol,
                    shortName: price.shortName,
                    regularMarketPrice: price.regularMarketPrice?.raw,
                    regularMarketChange: price.regularMarketChange?.raw,
                    regularMarketChangePercent: (price.regularMarketChangePercent?.raw || 0) * 100,
                    currency: price.currency,
                    regularMarketOpen: price.regularMarketOpen?.raw || detail.open?.raw,
                    regularMarketDayHigh: detail.dayHigh?.raw,
                    regularMarketDayLow: detail.dayLow?.raw,
                    regularMarketPreviousClose: detail.previousClose?.raw,
                    regularMarketVolume: detail.volume?.raw,
                    averageDailyVolume3Month: detail.averageVolume?.raw,
                    bid: detail.bid?.raw,
                    ask: detail.ask?.raw,
                    marketCap: detail.marketCap?.raw,
                    trailingPE: stats.trailingPE?.raw || detail.trailingPE?.raw,
                    fiftyTwoWeekHigh: detail.fiftyTwoWeekHigh?.raw,
                    fiftyTwoWeekLow: detail.fiftyTwoWeekLow?.raw,
                };
            }
        }
        return null;
    } catch (e) {
        console.error("Scrape strategy error:", e.message);
        return null;
    }
}

app.get('/api/quote-detailed', async (req, res) => {
    const { symbol } = req.query;
    if (!symbol) return res.status(400).json({ error: 'Symbol is required' });

    try {
        console.log(`Fetching detailed quote for ${symbol}...`);

        // 1. Try standard library (v2.8.1)
        // 1. Try standard library (v3)

        const quote = await yahooFinance.quote(symbol);

        if (quote) {
            res.json({
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
            });
            return;
        }
    } catch (e) {
        console.error(`Library error: ${e.message}. Using V8 fallback...`);

        // 2. Fallback: V8 Chart API
        try {
            const range = '1d';
            const resPrice = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`, { headers: { 'User-Agent': 'Mozilla/5.0' } });
            if (resPrice.ok) {
                const data = await resPrice.json();
                const result = data.chart?.result?.[0];
                if (result && result.meta) {
                    const price = result.meta.regularMarketPrice;
                    const prevClose = result.meta.chartPreviousClose;

                    res.json({
                        symbol: symbol,
                        shortName: symbol,
                        price: price,
                        currency: result.meta.currency,
                        change: price - prevClose,
                        changePercent: prevClose ? ((price - prevClose) / prevClose) * 100 : 0,
                        dayHigh: result.meta.regularMarketDayHigh,
                        dayLow: result.meta.regularMarketDayLow,
                        open: result.meta.regularMarketOpen, // Often null in V8
                        prevClose: prevClose,
                        bid: null,
                        ask: null,
                        volume: result.meta.regularMarketVolume,
                        avgVolume: null,
                        fiftyTwoWeekHigh: result.meta.fiftyTwoWeekHigh,
                        fiftyTwoWeekLow: result.meta.fiftyTwoWeekLow,
                        marketCap: null,
                        peRatio: null
                    });
                    return;
                }
            }
        } catch (fallbackErr) {
            console.error(`Fallback failed: ${fallbackErr.message}`);
        }
        res.status(500).json({ error: "Internal Server Error", details: e.message });
    }
});

app.get('/api/screener', async (req, res) => {
    const { type } = req.query;
    // Mappings for Yahoo Finance Screener options if we use the library, 
    // OR we can still use the raw URL if the library doesn't support "predefined" easily.
    // The library `screener` method usually takes a predefined strict query object.
    // The raw URL `https://query1.finance.yahoo.com/v1/finance/screener/predefined/saved` is very specific.
    // We will stick to raw fetch for screener as it worked, but we'll monitor it.

    const allowedTypes = ['day_gainers', 'day_losers', 'most_actives', 'most_shorted_stocks', 'undervalued_growth_stocks', 'growth_technology_stocks', 'aggressive_small_caps'];
    const scrId = allowedTypes.includes(type) ? type : 'most_actives';

    console.log(`[API] Screener Request - Type: '${type}', Allowed: ${allowedTypes.includes(type)}, Selected ID: '${scrId}'`);

    try {
        console.log(`Fetching screener ${scrId} for CA region...`);


        const url = `https://query1.finance.yahoo.com/v1/finance/screener/predefined/saved?formatted=false&lang=en-CA&region=CA&scrIds=${scrId}&count=5`;
        const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });

        if (response.ok) {
            const data = await response.json();
            const results = data.finance?.result?.[0]?.quotes || [];

            const simplified = results.map(q => ({
                symbol: q.symbol,
                shortName: q.shortName || q.longName,
                price: q.regularMarketPrice,
                change: q.regularMarketChange,
                changePercent: q.regularMarketChangePercent
            }));

            res.json({ title: data.finance?.result?.[0]?.title, quotes: simplified });
            return;
        }
        res.status(500).json({ error: "Screener fetch failed" });
    } catch (e) {
        console.error(`Screener error: ${e.message}`);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

app.post('/api/events', async (req, res) => {
    const { symbols } = req.body;
    if (!symbols || !Array.isArray(symbols)) return res.status(400).json({ error: 'Symbols array required' });

    console.log(`Fetching events for ${symbols.length} symbols...`);

    try {
        const results = await Promise.all(symbols.map(async (symbol) => {
            try {
                const summary = await yahooFinance.quoteSummary(symbol, { modules: ['calendarEvents', 'summaryDetail'] });
                return { symbol, success: true, data: summary };
            } catch (err) {
                console.error(`Failed events for ${symbol}: ${err.message}`);
                return { symbol, success: false };
            }
        }));

        res.json(results);
    } catch (error) {
        console.error("Events fetch error:", error);
        res.status(500).json({ error: "Failed to fetch events" });
    }
});

// ─── In-Memory Cache (30-min TTL) ───────────────────────────────────────────
const analysisCache = new Map(); // key: ticker, value: { data, expiresAt }
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

function getCached(ticker) {
    const entry = analysisCache.get(ticker.toUpperCase());
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
        analysisCache.delete(ticker.toUpperCase());
        return null;
    }
    return entry.data;
}

function setCached(ticker, data) {
    analysisCache.set(ticker.toUpperCase(), { data, expiresAt: Date.now() + CACHE_TTL_MS });
}

// ─── Helper: derive buy/sell/neutral signal ───────────────────────────────────
function deriveSignal({ rsi, ema50, ema200, macdHistogram }) {
    const signals = [];

    // RSI signals
    if (rsi !== null) {
        if (rsi < 30) signals.push('buy');       // Oversold
        else if (rsi > 70) signals.push('sell'); // Overbought
    }

    // Golden / Death Cross
    if (ema50 !== null && ema200 !== null) {
        if (ema50 > ema200) signals.push('buy');  // Golden Cross
        else signals.push('sell');               // Death Cross
    }

    // MACD histogram momentum
    if (macdHistogram !== null) {
        if (macdHistogram > 0) signals.push('buy');
        else if (macdHistogram < 0) signals.push('sell');
    }

    const buyCount = signals.filter(s => s === 'buy').length;
    const sellCount = signals.filter(s => s === 'sell').length;

    if (buyCount > sellCount) return 'buy';
    if (sellCount > buyCount) return 'sell';
    return 'neutral';
}

// ─── GET /api/stocks/:ticker/analysis ────────────────────────────────────────
app.get('/api/stocks/:ticker/analysis', async (req, res) => {
    const ticker = req.params.ticker.toUpperCase();

    // Return cached result if fresh
    const cached = getCached(ticker);
    if (cached) {
        console.log(`[Analysis] Cache hit for ${ticker}`);
        return res.json(cached);
    }

    console.log(`[Analysis] Fetching 250-day OHLC for ${ticker}...`);
    try {
        // Fetch ~250 trading days (≈1 year) of daily OHLC
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=1y`;
        const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });

        if (!response.ok) {
            return res.status(502).json({ error: `Yahoo Finance fetch failed: HTTP ${response.status}` });
        }

        const json = await response.json();
        const result = json.chart?.result?.[0];

        if (!result) {
            return res.status(404).json({ error: 'No data returned for ticker' });
        }

        const meta = result.meta;
        const timestamps = result.timestamp || [];
        const quote = result.indicators?.quote?.[0] || {};
        const closes = quote.close || [];
        const highs = quote.high || [];
        const lows = quote.low || [];
        const opens = quote.open || [];
        const volumes = quote.volume || [];

        // Filter out nulls (keep parallel arrays in sync)
        const ohlcv = timestamps
            .map((ts, i) => ({
                time: ts,
                open: opens[i],
                high: highs[i],
                low: lows[i],
                close: closes[i],
                volume: volumes[i],
            }))
            .filter(bar => bar.close != null && bar.open != null && bar.high != null && bar.low != null);

        const closePrices = ohlcv.map(b => b.close);
        const highPrices  = ohlcv.map(b => b.high);
        const lowPrices   = ohlcv.map(b => b.low);

        // ── ATR (14) ──────────────────────────────────────────────────────────
        const atrValues = technicalindicators.ATR.calculate({
            period: 14,
            high: highPrices,
            low: lowPrices,
            close: closePrices,
        });
        const currentATR = (atrValues.length > 0 && atrValues[atrValues.length - 1] !== undefined) ? atrValues[atrValues.length - 1] : null;

        // ── EMA 50 & 200 ──────────────────────────────────────────────────────
        const ema50Values = technicalindicators.EMA.calculate({ period: 50, values: closePrices });
        const ema200Values = technicalindicators.EMA.calculate({ period: 200, values: closePrices });
        const ema50 = (ema50Values.length > 0 && ema50Values[ema50Values.length - 1] !== undefined) ? ema50Values[ema50Values.length - 1] : null;
        const ema200 = (ema200Values.length > 0 && ema200Values[ema200Values.length - 1] !== undefined) ? ema200Values[ema200Values.length - 1] : null;

        // Build EMA series aligned to OHLCV timestamps for charting
        const ema50Offset = closePrices.length - ema50Values.length;
        const ema200Offset = closePrices.length - ema200Values.length;
        const emaSeries = ohlcv.map((bar, i) => ({
            time: bar.time,
            ema50: i >= ema50Offset ? ema50Values[i - ema50Offset] : null,
            ema200: i >= ema200Offset ? ema200Values[i - ema200Offset] : null,
        }));

        // ── RSI (14) ──────────────────────────────────────────────────────────
        const rsiValues = technicalindicators.RSI.calculate({ period: 14, values: closePrices });
        const rsi = (rsiValues.length > 0 && rsiValues[rsiValues.length - 1] !== undefined) ? rsiValues[rsiValues.length - 1] : null;

        // ── MACD (12, 26, 9) ──────────────────────────────────────────────────
        const macdResult = technicalindicators.MACD.calculate({
            values: closePrices,
            fastPeriod: 12,
            slowPeriod: 26,
            signalPeriod: 9,
            SimpleMAOscillator: false,
            SimpleMASignal: false,
        });
        const lastMacd = macdResult.length > 0 ? macdResult[macdResult.length - 1] : null;
        const macd = lastMacd
            ? { 
                MACD: lastMacd.MACD !== undefined ? lastMacd.MACD : null, 
                signal: lastMacd.signal !== undefined ? lastMacd.signal : null, 
                histogram: lastMacd.histogram !== undefined ? lastMacd.histogram : null 
              }
            : { MACD: null, signal: null, histogram: null };

        // ── Golden Cross detection ─────────────────────────────────────────────
        // Check if the 50 EMA just crossed above 200 EMA (previous bar: ema50 <= ema200)
        let goldenCross = false;
        if (ema50Values.length >= 2 && ema200Values.length >= 2) {
            const prevEma50 = ema50Values[ema50Values.length - 2];
            const prevEma200Idx = ema200Values.length - 1 - (ema50Values.length - ema200Values.length > 0 ? (ema50Values.length - ema200Values.length) : 0);
            const prevEma200 = prevEma200Idx >= 1 ? ema200Values[prevEma200Idx - 1] : null;
            if (prevEma200 !== null && ema50 !== null && ema200 !== null) {
                goldenCross = (prevEma50 <= prevEma200) && (ema50 > ema200);
            }
        }

        // ── Bollinger Bands (20-period SMA ± 2 StdDev) ───────────────────────
        const BB_PERIOD = 20;
        let bollingerUpper = null;
        let bollingerMiddle = null;
        let bollingerLower = null;
        if (closePrices.length >= BB_PERIOD) {
            const slice = closePrices.slice(-BB_PERIOD);
            const sma = slice.reduce((a, b) => a + b, 0) / BB_PERIOD;
            const variance = slice.reduce((sum, v) => sum + Math.pow(v - sma, 2), 0) / BB_PERIOD;
            const stdDev = Math.sqrt(variance);
            bollingerMiddle = sma;
            bollingerUpper = sma + 2 * stdDev;
            bollingerLower = sma - 2 * stdDev;
        }

        // ── 52-Week High / Low & Fibonacci 61.8% Retracement ──────────────────
        const high52w = ohlcv.length > 0 ? Math.max(...ohlcv.map(b => b.high)) : null;
        const low52w  = ohlcv.length > 0 ? Math.min(...ohlcv.map(b => b.low))  : null;
        // 61.8% retracement from the high: low + (high - low) * 0.382 (measured down from high)
        // Conventionally: fibEntry = high - (high - low) * 0.618
        const fibEntry = (high52w !== null && low52w !== null)
            ? high52w - (high52w - low52w) * 0.618
            : null;

        const priceTargets = {
            bollingerUpper,
            bollingerMiddle,
            suggestedBuyPrice: bollingerLower,   // Lower BB = buy zone
            suggestedSellPrice: bollingerUpper,  // Upper BB = sell zone
            high52w,
            low52w,
            fibEntry,  // 61.8% Fibonacci suggested entry
        };

        // ── Signal ────────────────────────────────────────────────────────────
        const signal = deriveSignal({
            rsi,
            ema50,
            ema200,
            macdHistogram: macd.histogram,
        });

        // ── Build Response ────────────────────────────────────────────────────
        const analysisData = {
            ticker,
            currentPrice: meta.regularMarketPrice,
            currency: meta.currency,
            currentATR: currentATR ? parseFloat(currentATR.toFixed(4)) : null,
            indicators: {
                ema50,
                ema200,
                rsi,
                macd,
                goldenCross,
            },
            signal,
            priceTargets,
            // Chart series (last 250 bars)
            ohlcv: ohlcv.slice(-250),
            emaSeries: emaSeries.slice(-250),
            fetchedAt: new Date().toISOString(),
        };

        // Don't cache if ATR is null — means bad data slipped through; retry next request
        if (currentATR !== null) {
            setCached(ticker, analysisData);
        }
        console.log(`[Analysis] ${ticker}: RSI=${rsi?.toFixed(1)}, EMA50=${ema50?.toFixed(2)}, EMA200=${ema200?.toFixed(2)}, ATR=${currentATR?.toFixed(4)}, Signal=${signal}`);
        res.json(analysisData);

    } catch (err) {
        console.error(`[Analysis] Error for ${ticker}:`, err.message);
        res.status(500).json({ error: 'Internal server error', details: err.message });
    }
});

// ─── Tax Scenarios ────────────────────────────────────────────────────────────

/**
 * GET /api/tax-scenarios
 * Returns all saved tax scenarios from database.json (newest first).
 */
app.get('/api/tax-scenarios', (req, res) => {
    try {
        const raw = fs.existsSync(DB_PATH) ? fs.readFileSync(DB_PATH, 'utf-8') : '{}';
        const db = JSON.parse(raw);
        const scenarios = db.taxScenarios || [];
        // Return sorted newest-first
        res.json([...scenarios].sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt)));
    } catch (e) {
        console.error('[TaxScenarios] GET failed:', e.message);
        res.status(500).json({ error: 'Failed to read scenarios' });
    }
});

/**
 * POST /api/tax-scenarios
 */
app.post('/api/tax-scenarios', (req, res) => {
    try {
        const {
            annualIncome, quebecTaxableIncome,
            rrspContribution, totalRefund, craRefund, rqRefund,
            effectiveRate, isSpousal, attributionDate
        } = req.body;
        if (annualIncome == null || rrspContribution == null) {
            return res.status(400).json({ error: 'annualIncome and rrspContribution are required' });
        }

        const raw = fs.existsSync(DB_PATH) ? fs.readFileSync(DB_PATH, 'utf-8') : '{}';
        const db = JSON.parse(raw);
        if (!db.taxScenarios) db.taxScenarios = [];

        const newScenario = {
            id: `ts_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            savedAt: new Date().toISOString(),
            annualIncome: Number(annualIncome),
            quebecTaxableIncome: quebecTaxableIncome != null ? Number(quebecTaxableIncome) : Number(annualIncome),
            rrspContribution: Number(rrspContribution),
            totalRefund: Number(totalRefund),
            craRefund: craRefund != null ? Number(craRefund) : null,
            rqRefund: rqRefund != null ? Number(rqRefund) : null,
            effectiveRate: Number(effectiveRate),
            isSpousal: Boolean(isSpousal),
            attributionDate: isSpousal ? (attributionDate || new Date().toISOString()) : null,
        };

        db.taxScenarios.push(newScenario);
        fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));

        const type = newScenario.isSpousal ? 'Spousal' : 'Personal';
        console.log(`[TaxScenarios] Saved ${type} scenario ${newScenario.id} — Fed: $${annualIncome}, RRSP: $${rrspContribution}, CRA: $${craRefund?.toFixed(2)}, RQ: $${rqRefund?.toFixed(2)}`);
        res.json(newScenario);
    } catch (e) {
        console.error('[TaxScenarios] POST failed:', e.message);
        res.status(500).json({ error: 'Failed to save scenario' });
    }
});


/**
 * DELETE /api/tax-scenarios/:id
 */
app.delete('/api/tax-scenarios/:id', (req, res) => {
    try {
        const { id } = req.params;
        const raw = fs.existsSync(DB_PATH) ? fs.readFileSync(DB_PATH, 'utf-8') : '{}';
        const db = JSON.parse(raw);
        
        if (db.taxScenarios) {
            db.taxScenarios = db.taxScenarios.filter(s => s.id !== id);
            fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
            console.log(`[TaxScenarios] Deleted scenario ${id}`);
        }
        res.json({ success: true });
    } catch (e) {
        console.error('[TaxScenarios] DELETE failed:', e.message);
        res.status(500).json({ error: 'Failed to delete scenario' });
    }
});

/**
 * GET /api/tax-settings
 */
app.get('/api/tax-settings', (req, res) => {
    try {
        const raw = fs.existsSync(DB_PATH) ? fs.readFileSync(DB_PATH, 'utf-8') : '{}';
        const db = JSON.parse(raw);
        res.json(db.taxSettings || null);
    } catch (e) {
        console.error('[TaxSettings] GET failed:', e.message);
        res.status(500).json({ error: 'Failed to read tax settings' });
    }
});

/**
 * POST /api/tax-settings
 */
app.post('/api/tax-settings', (req, res) => {
    try {
        const raw = fs.existsSync(DB_PATH) ? fs.readFileSync(DB_PATH, 'utf-8') : '{}';
        const db = JSON.parse(raw);
        db.taxSettings = req.body;
        fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
        res.json({ success: true });
    } catch (e) {
        console.error('[TaxSettings] POST failed:', e.message);
        res.status(500).json({ error: 'Failed to save tax settings' });
    }
});

// ─── Stock Comparison Endpoint ─────────────────────────────────────────────
// In-memory cache: { key -> { data, expiresAt } }
const compareCache = new Map();

/**
 * GET /api/stocks/compare?symbols=XEQT.TO,XGRO.TO&range=1y
 * Returns normalized % performance data aligned by common trading dates.
 * Uses adjClose (dividend-adjusted) for fair total-return comparison.
 */
app.get('/api/stocks/compare', async (req, res) => {
    const { symbols, range = '1y' } = req.query;

    if (!symbols) {
        return res.status(400).json({ error: 'symbols query parameter is required' });
    }

    const symbolList = symbols.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
    if (symbolList.length === 0) {
        return res.status(400).json({ error: 'At least one symbol is required' });
    }
    if (symbolList.length > 8) {
        return res.status(400).json({ error: 'Maximum 8 symbols allowed' });
    }

    const cacheKey = `${symbolList.sort().join(',')}_${range}`;
    const cached = compareCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
        console.log(`[Compare] Cache hit: ${cacheKey}`);
        return res.json(cached.data);
    }

    console.log(`[Compare] Fetching ${symbolList.join(', ')} | range=${range}`);

    // Fetch historical data for all symbols in parallel using Yahoo V8 API directly
    const fetchResults = await Promise.allSettled(
        symbolList.map(async (symbol) => {
            const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=${range}`, { 
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } 
            });
            if (!res.ok) {
                throw new Error(`HTTP ${res.status}`);
            }
            const data = await res.json();
            const result = data.chart?.result?.[0];
            if (!result || !result.timestamp || !result.indicators) {
                throw new Error('Invalid data structure');
            }
            
            const timestamps = result.timestamp;
            const quote = result.indicators.quote[0];
            const adjcloseArr = result.indicators.adjclose?.[0]?.adjclose || quote.close;
            
            const rows = [];
            for (let i = 0; i < timestamps.length; i++) {
                const ac = adjcloseArr[i];
                if (ac !== null && ac !== undefined) {
                    rows.push({
                        date: new Date(timestamps[i] * 1000).toISOString().split('T')[0],
                        adjClose: ac,
                        close: quote.close[i] !== null ? quote.close[i] : ac
                    });
                }
            }
            // Ensure sorted by date (though API typically returns sorted)
            rows.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
            return { symbol, rows };
        })
    );

    // Separate successes from failures
    const successfulSeries = [];
    const errors = {};

    for (let i = 0; i < fetchResults.length; i++) {
        const result = fetchResults[i];
        const symbol = symbolList[i];
        if (result.status === 'fulfilled' && result.value.rows.length > 0) {
            successfulSeries.push(result.value);
        } else {
            const reason = result.status === 'rejected' ? result.reason?.message : 'No data returned';
            console.warn(`[Compare] Failed to fetch ${symbol}: ${reason}`);
            errors[symbol] = reason || 'No data available for this symbol';
        }
    }

    if (successfulSeries.length === 0) {
        return res.status(404).json({ error: 'No data found for any of the requested symbols', errors });
    }

    // ── Date Alignment ──────────────────────────────────────────────────────
    // Build a Set of dates that ALL symbols have data for (inner join).
    // This ensures the chart starts at the same point for all assets.
    const dateSets = successfulSeries.map(({ rows }) =>
        new Set(rows.map(r => new Date(r.date).toISOString().split('T')[0]))
    );
    // Intersection of all date sets
    let commonDates = dateSets[0];
    for (let i = 1; i < dateSets.length; i++) {
        commonDates = new Set([...commonDates].filter(d => dateSets[i].has(d)));
    }
    const alignedDates = Array.from(commonDates).sort();

    if (alignedDates.length < 2) {
        return res.status(422).json({ error: 'Insufficient overlapping dates between the requested symbols' });
    }

    // ── Normalization ────────────────────────────────────────────────────────
    // For each symbol: take adjClose on first aligned date as base (= 0%)
    // then compute ((adjClose - base) / base) * 100 for each subsequent date.
    const seriesData = {};
    const summaryData = {};

    for (const { symbol, rows } of successfulSeries) {
        // Build a lookup map: dateStr -> adjClose (fallback to close)
        const priceMap = new Map();
        for (const row of rows) {
            const dateStr = new Date(row.date).toISOString().split('T')[0];
            // Prefer adjClose for total-return accuracy (accounts for dividends)
            priceMap.set(dateStr, row.adjClose ?? row.close);
        }

        const firstPrice = priceMap.get(alignedDates[0]);
        if (!firstPrice || firstPrice === 0) continue;

        const normalizedValues = alignedDates.map(d => {
            const price = priceMap.get(d);
            if (price == null) return null;
            return parseFloat(((price - firstPrice) / firstPrice * 100).toFixed(4));
        });

        seriesData[symbol] = normalizedValues;

        // Summary: current raw price + total return for the period
        const lastPrice = priceMap.get(alignedDates[alignedDates.length - 1]) ?? 0;
        const totalReturn = parseFloat(((lastPrice - firstPrice) / firstPrice * 100).toFixed(2));
        summaryData[symbol] = {
            currentPrice: parseFloat(lastPrice.toFixed(2)),
            firstPrice:   parseFloat(firstPrice.toFixed(2)),
            totalReturn,
        };
    }

    const responseData = {
        dates:   alignedDates,
        series:  seriesData,
        summary: summaryData,
        errors,
        range,
        fetchedAt: new Date().toISOString(),
    };

    // Cache for 1 hour
    compareCache.set(cacheKey, { data: responseData, expiresAt: Date.now() + 60 * 60 * 1000 });

    console.log(`[Compare] Done — ${alignedDates.length} aligned dates, ${Object.keys(seriesData).length} series`);
    res.json(responseData);
});

app.listen(PORT, () => {
    console.log(`Proxy server running on http://localhost:${PORT}`);
});
