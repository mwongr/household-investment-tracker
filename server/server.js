import express from 'express';
import cors from 'cors';
import YahooFinance from 'yahoo-finance2';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

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

        fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
        res.json({ success: true, timestamp: new Date().toISOString() });
    } catch (e) {
        console.error('Sync failed:', e);
        res.status(500).json({ error: 'Failed to write to disk' });
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
                const closeData = result.indicators?.quote?.[0]?.close;

                if (timestamps && closeData) {
                    sparklineData = closeData.map((price, index) => {
                        if (price === null || price === undefined) return null;
                        return {
                            price: parseFloat(price.toFixed(2)),
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
                const price = result.meta.regularMarketPrice;
                const prevClose = result.meta.chartPreviousClose; // For 1d, this IS yesterday's close

                dailyChangePercent = prevClose ? ((price - prevClose) / prevClose) * 100 : 0;

                // Update priceData with more accurate daily info
                priceData = {
                    price: price,
                    currency: result.meta.currency, // Should be same
                    high: result.meta.fiftyTwoWeekHigh, // Should be same
                    low: result.meta.fiftyTwoWeekLow,
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
            if (previous !== 0) {
                dailyChangePercent = ((current - previous) / previous) * 100;
            }
            // Use last price from history as current price if meta was suspect? 
            // Usually meta regularMarketPrice is real-timeish even on 5y chart.
        } else if (!foundDailyData && priceData && priceData.prevClose) {
            // Absolute fallback if we only have 5y meta (WARNING: This gave the +68% bug if prevClose was 5y old)
            // We should check granularity or assume it's wrong for daily change if range > 1mo.
            // If range is 5y, priceData.prevClose is ANCIENT using v8 chart meta.
            // Safest to return 0 if we can't calc from history.
            if (range === '5y' || range === '1y') {
                dailyChangePercent = 0;
            } else {
                dailyChangePercent = ((priceData.price - priceData.prevClose) / priceData.prevClose) * 100;
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

app.listen(PORT, () => {
    console.log(`Proxy server running on http://localhost:${PORT}`);
});
