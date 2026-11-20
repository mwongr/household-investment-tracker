import YahooFinance from 'yahoo-finance2';

export const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)';

interface CacheEntry<T> {
    value: T;
    expiresAt: number;
}

class TtlLruCache<T> {
    private readonly map = new Map<string, CacheEntry<T>>();
    private readonly max: number;

    constructor(max: number) {
        this.max = max;
    }

    get(key: string): { value: T; stale: boolean } | null {
        const entry = this.map.get(key);
        if (!entry) return null;
        // Refresh insertion order for LRU eviction
        this.map.delete(key);
        this.map.set(key, entry);
        return { value: entry.value, stale: Date.now() > entry.expiresAt };
    }

    set(key: string, value: T, ttlMs: number): void {
        if (this.map.has(key)) {
            this.map.delete(key);
        } else if (this.map.size >= this.max) {
            const oldest = this.map.keys().next().value;
            if (oldest !== undefined) this.map.delete(oldest);
        }
        this.map.set(key, { value, expiresAt: Date.now() + ttlMs });
    }
}

function createLimiter(concurrency: number, minIntervalMs: number) {
    let active = 0;
    let lastStart = 0;
    const queue: Array<() => void> = [];

    const next = () => {
        if (active >= concurrency || queue.length === 0) return;
        const now = Date.now();
        const wait = Math.max(0, lastStart + minIntervalMs - now);
        if (wait > 0) {
            setTimeout(next, wait);
            return;
        }
        const task = queue.shift();
        if (!task) return;
        active++;
        lastStart = Date.now();
        task();
    };

    return function limit<T>(fn: () => Promise<T>): Promise<T> {
        return new Promise<T>((resolve, reject) => {
            queue.push(() => {
                fn()
                    .then(resolve, reject)
                    .finally(() => {
                        active--;
                        next();
                    });
            });
            next();
        });
    };
}

const limiter = createLimiter(4, 150);
const cache = new TtlLruCache<unknown>(500);
const inflight = new Map<string, Promise<unknown>>();

/** Yahoo returned 404: the symbol does not exist in Yahoo's format (e.g. TSX needs ".TO"). */
export class SymbolNotFoundError extends Error {
    constructor(symbol: string) {
        super(`Symbol "${symbol}" not found on Yahoo Finance`);
        this.name = 'SymbolNotFoundError';
    }
}

export class UpstreamRateLimitError extends Error {
    constructor(message = 'Yahoo Finance rate limit (429)') {
        super(message);
        this.name = 'UpstreamRateLimitError';
    }
}

async function withBackoff<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
    let attempt = 0;
    while (true) {
        try {
            return await fn();
        } catch (err: unknown) {
            const is429 =
                err instanceof UpstreamRateLimitError ||
                (err instanceof Error && /\b429\b/.test(err.message));
            if (!is429 || attempt >= maxRetries) {
                throw err;
            }
            const delayMs = 400 * Math.pow(2, attempt) + Math.floor(Math.random() * 150);
            attempt++;
            await new Promise((r) => setTimeout(r, delayMs));
        }
    }
}

/**
 * Fetches via the rate-limited Yahoo gateway with TTL caching, in-flight
 * deduplication, exponential backoff on 429, and stale-cache fallback.
 */
export async function cachedYahoo<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
    const hit = cache.get(key);
    if (hit && !hit.stale) {
        return hit.value as T;
    }

    const pending = inflight.get(key);
    if (pending) {
        return pending as Promise<T>;
    }

    const promise = limiter(() => withBackoff(fn))
        .then((val) => {
            cache.set(key, val, ttlMs);
            return val;
        })
        .catch((err) => {
            if (hit) {
                return hit.value as T;
            }
            throw err;
        })
        .finally(() => {
            inflight.delete(key);
        });

    inflight.set(key, promise);
    return promise;
}

export interface YahooChartResult {
    meta?: {
        regularMarketPrice?: number;
        currency?: string;
        fiftyTwoWeekHigh?: number;
        fiftyTwoWeekLow?: number;
        chartPreviousClose?: number;
        regularMarketVolume?: number;
        regularMarketDayHigh?: number;
        regularMarketDayLow?: number;
        regularMarketOpen?: number;
    };
    timestamp?: number[];
    indicators?: {
        quote?: Array<{
            close?: Array<number | null>;
            open?: Array<number | null>;
            high?: Array<number | null>;
            low?: Array<number | null>;
            volume?: Array<number | null>;
        }>;
        adjclose?: Array<{
            adjclose?: Array<number | null>;
        }>;
    };
}

export async function fetchYahooChart(symbol: string, range: string): Promise<YahooChartResult | null> {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=${encodeURIComponent(range)}`;
    const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
    if (response.status === 429) {
        throw new UpstreamRateLimitError();
    }
    if (response.status === 404) {
        throw new SymbolNotFoundError(symbol);
    }
    if (!response.ok) {
        throw new Error(`Yahoo chart HTTP ${response.status}`);
    }
    const json = (await response.json()) as { chart?: { result?: YahooChartResult[] } };
    const result = json.chart?.result?.[0] ?? null;
    // Yahoo answers some unlisted symbols (e.g. a TSX ticker without ".TO") with an empty
    // placeholder: no price and no currency. Treat that the same as a 404.
    if (result?.meta && result.meta.regularMarketPrice == null && result.meta.currency == null) {
        throw new SymbolNotFoundError(symbol);
    }
    return result;
}

export async function fetchYahooScreener(scrId: string): Promise<{
    title?: string;
    quotes: Array<{
        symbol: string;
        shortName?: string;
        price?: number;
        change?: number;
        changePercent?: number;
    }>;
}> {
    const url = `https://query1.finance.yahoo.com/v1/finance/screener/predefined/saved?formatted=false&lang=en-CA&region=CA&scrIds=${encodeURIComponent(scrId)}&count=5`;
    const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
    if (response.status === 429) {
        throw new UpstreamRateLimitError();
    }
    if (!response.ok) {
        throw new Error(`Yahoo screener HTTP ${response.status}`);
    }
    const data = (await response.json()) as {
        finance?: {
            result?: Array<{
                title?: string;
                quotes?: Array<{
                    symbol: string;
                    shortName?: string;
                    longName?: string;
                    regularMarketPrice?: number;
                    regularMarketChange?: number;
                    regularMarketChangePercent?: number;
                }>;
            }>;
        };
    };
    const first = data.finance?.result?.[0];
    const quotes = (first?.quotes ?? []).map((q) => ({
        symbol: q.symbol,
        shortName: q.shortName || q.longName,
        price: q.regularMarketPrice,
        change: q.regularMarketChange,
        changePercent: q.regularMarketChangePercent,
    }));
    return { title: first?.title, quotes };
}
