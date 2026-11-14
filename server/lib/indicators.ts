import technicalindicators from 'technicalindicators';
import type { YahooChartResult } from './yahoo.js';

export type TaSignal = 'buy' | 'sell' | 'neutral';

export interface OhlcvBar {
    time: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

export interface EmaPoint {
    time: number;
    ema50: number | null;
    ema200: number | null;
}

export interface AnalysisResult {
    ticker: string;
    currentPrice: number | undefined;
    currency: string | undefined;
    currentATR: number | null;
    indicators: {
        ema50: number | null;
        ema200: number | null;
        rsi: number | null;
        macd: {
            MACD: number | null;
            signal: number | null;
            histogram: number | null;
        };
        goldenCross: boolean;
    };
    signal: TaSignal;
    priceTargets: {
        bollingerUpper: number | null;
        bollingerMiddle: number | null;
        suggestedBuyPrice: number | null;
        suggestedSellPrice: number | null;
        high52w: number | null;
        low52w: number | null;
        fibEntry: number | null;
    };
    ohlcv: OhlcvBar[];
    emaSeries: EmaPoint[];
    fetchedAt: string;
}

export function deriveSignal(params: {
    rsi: number | null;
    ema50: number | null;
    ema200: number | null;
    macdHistogram: number | null;
}): TaSignal {
    const { rsi, ema50, ema200, macdHistogram } = params;
    let score = 0;

    if (rsi !== null) {
        if (rsi < 30) score++;
        else if (rsi > 70) score--;
    }

    if (ema50 !== null && ema200 !== null) {
        if (ema50 > ema200) score++;
        else score--;
    }

    if (macdHistogram !== null) {
        if (macdHistogram > 0) score++;
        else if (macdHistogram < 0) score--;
    }

    if (score > 0) return 'buy';
    if (score < 0) return 'sell';
    return 'neutral';
}

export function computeTechnicalAnalysis(ticker: string, result: YahooChartResult): AnalysisResult {
    const meta = result.meta ?? {};
    const timestamps = result.timestamp ?? [];
    const quote = result.indicators?.quote?.[0] ?? {};
    const closes = quote.close ?? [];
    const highs = quote.high ?? [];
    const lows = quote.low ?? [];
    const opens = quote.open ?? [];
    const volumes = quote.volume ?? [];

    const ohlcv: OhlcvBar[] = [];
    for (let i = 0; i < timestamps.length; i++) {
        const time = timestamps[i];
        const open = opens[i];
        const high = highs[i];
        const low = lows[i];
        const close = closes[i];
        if (
            time !== undefined &&
            open != null &&
            high != null &&
            low != null &&
            close != null
        ) {
            ohlcv.push({
                time,
                open,
                high,
                low,
                close,
                volume: volumes[i] ?? 0,
            });
        }
    }

    const closePrices = ohlcv.map((b) => b.close);
    const highPrices = ohlcv.map((b) => b.high);
    const lowPrices = ohlcv.map((b) => b.low);

    const atrValues = technicalindicators.ATR.calculate({
        period: 14,
        high: highPrices,
        low: lowPrices,
        close: closePrices,
    });
    const currentATR = atrValues.length > 0 ? (atrValues[atrValues.length - 1] ?? null) : null;

    const ema50Values = technicalindicators.EMA.calculate({ period: 50, values: closePrices });
    const ema200Values = technicalindicators.EMA.calculate({ period: 200, values: closePrices });
    const ema50 = ema50Values.length > 0 ? (ema50Values[ema50Values.length - 1] ?? null) : null;
    const ema200 = ema200Values.length > 0 ? (ema200Values[ema200Values.length - 1] ?? null) : null;

    const ema50Offset = closePrices.length - ema50Values.length;
    const ema200Offset = closePrices.length - ema200Values.length;
    const emaSeries: EmaPoint[] = ohlcv.map((bar, i) => ({
        time: bar.time,
        ema50: i >= ema50Offset ? (ema50Values[i - ema50Offset] ?? null) : null,
        ema200: i >= ema200Offset ? (ema200Values[i - ema200Offset] ?? null) : null,
    }));

    const rsiValues = technicalindicators.RSI.calculate({ period: 14, values: closePrices });
    const rsi = rsiValues.length > 0 ? (rsiValues[rsiValues.length - 1] ?? null) : null;

    const macdResult = technicalindicators.MACD.calculate({
        values: closePrices,
        fastPeriod: 12,
        slowPeriod: 26,
        signalPeriod: 9,
        SimpleMAOscillator: false,
        SimpleMASignal: false,
    });
    const lastMacd = macdResult.length > 0 ? macdResult[macdResult.length - 1] : null;
    const macd = {
        MACD: lastMacd?.MACD ?? null,
        signal: lastMacd?.signal ?? null,
        histogram: lastMacd?.histogram ?? null,
    };

    // Both EMA arrays end on the same latest bar, so previous bar is length - 2 in each
    let goldenCross = false;
    if (ema50Values.length >= 2 && ema200Values.length >= 2 && ema50 !== null && ema200 !== null) {
        const prevEma50 = ema50Values[ema50Values.length - 2];
        const prevEma200 = ema200Values[ema200Values.length - 2];
        if (prevEma50 !== undefined && prevEma200 !== undefined) {
            goldenCross = prevEma50 <= prevEma200 && ema50 > ema200;
        }
    }

    const BB_PERIOD = 20;
    let bollingerUpper: number | null = null;
    let bollingerMiddle: number | null = null;
    let bollingerLower: number | null = null;
    if (closePrices.length >= BB_PERIOD) {
        const slice = closePrices.slice(-BB_PERIOD);
        const sma = slice.reduce((a, b) => a + b, 0) / BB_PERIOD;
        const variance = slice.reduce((sum, v) => sum + Math.pow(v - sma, 2), 0) / BB_PERIOD;
        const stdDev = Math.sqrt(variance);
        bollingerMiddle = sma;
        bollingerUpper = sma + 2 * stdDev;
        bollingerLower = sma - 2 * stdDev;
    }

    const high52w = ohlcv.length > 0 ? Math.max(...ohlcv.map((b) => b.high)) : null;
    const low52w = ohlcv.length > 0 ? Math.min(...ohlcv.map((b) => b.low)) : null;
    const fibEntry =
        high52w !== null && low52w !== null
            ? high52w - (high52w - low52w) * 0.618
            : null;

    const signal = deriveSignal({
        rsi,
        ema50,
        ema200,
        macdHistogram: macd.histogram,
    });

    return {
        ticker,
        currentPrice: meta.regularMarketPrice,
        currency: meta.currency,
        currentATR: currentATR !== null ? parseFloat(currentATR.toFixed(4)) : null,
        indicators: {
            ema50,
            ema200,
            rsi,
            macd,
            goldenCross,
        },
        signal,
        priceTargets: {
            bollingerUpper,
            bollingerMiddle,
            suggestedBuyPrice: bollingerLower,
            suggestedSellPrice: bollingerUpper,
            high52w,
            low52w,
            fibEntry,
        },
        ohlcv: ohlcv.slice(-250),
        emaSeries: emaSeries.slice(-250),
        fetchedAt: new Date().toISOString(),
    };
}
