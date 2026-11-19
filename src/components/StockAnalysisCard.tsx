import { useEffect, useMemo, useRef, useState } from 'react';
import {
    createChart,
    CandlestickSeries,
    LineSeries,
    type IChartApi,
    type ISeriesApi,
    type UTCTimestamp,
} from 'lightweight-charts';
import { TrendingUp, TrendingDown, Minus, RefreshCw, AlertCircle, Activity } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import type { AnalysisData } from '../types';

interface StockAnalysisCardProps {
    ticker: string;
}

// ─── RSI Gauge ────────────────────────────────────────────────────────────────
const RsiGauge = ({ rsi }: { rsi: number | null | undefined }) => {
    const val = rsi ?? 0;
    const pct = Math.min(100, Math.max(0, val));
    const isOversold = val < 30;
    const isOverbought = val > 70;

    const trackColor = isOversold
        ? 'from-green-500 to-emerald-400'
        : isOverbought
        ? 'from-red-500 to-rose-400'
        : 'from-blue-500 to-indigo-400';

    const labelColor = isOversold
        ? 'text-green-400'
        : isOverbought
        ? 'text-red-400'
        : 'text-blue-400';

    return (
        <div className="bg-slate-900/75 border border-slate-700/80 rounded-xl p-4 space-y-3 h-full flex flex-col justify-between">
            <div className="flex justify-between items-center">
                <div>
                    <span className="text-xs text-slate-300 uppercase font-bold tracking-wider">RSI (14)</span>
                    <p className="text-xs text-slate-400 mt-0.5">Relative Strength Index</p>
                </div>
                <span className={`text-2xl font-bold font-mono tabular-nums ${labelColor}`}>
                    {(rsi ?? 0).toFixed(1)}
                </span>
            </div>

            <div className="space-y-2">
                {/* Track */}
                <div className="relative h-3.5 bg-slate-800 border border-slate-700 rounded-full overflow-hidden">
                    {/* Zone markers */}
                    <div className="absolute top-0 left-[30%] w-0.5 h-full bg-slate-400/50 z-10" />
                    <div className="absolute top-0 left-[70%] w-0.5 h-full bg-slate-400/50 z-10" />
                    {/* Fill */}
                    <div
                        className={`absolute top-0 left-0 h-full rounded-full bg-gradient-to-r ${trackColor} transition-all duration-700`}
                        style={{ width: `${pct}%` }}
                    />
                    {/* Thumb */}
                    <div
                        className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-white shadow-md border-2 border-slate-900 transition-all duration-700 z-20"
                        style={{ left: `calc(${pct}% - 7px)` }}
                    />
                </div>

                <div className="flex justify-between text-xs font-semibold">
                    <span className="text-green-400">Oversold &lt;30</span>
                    <span className="text-slate-300">Neutral (30–70)</span>
                    <span className="text-red-400">&gt;70 Overbought</span>
                </div>
            </div>

            <div className="pt-1">
                {isOversold ? (
                    <p className="text-xs text-green-400 font-semibold bg-green-500/15 border border-green-500/30 rounded-lg py-1.5 px-3 text-center">
                        Potentially oversold — possible bounce zone
                    </p>
                ) : isOverbought ? (
                    <p className="text-xs text-red-400 font-semibold bg-red-500/15 border border-red-500/30 rounded-lg py-1.5 px-3 text-center">
                        Potentially overbought — possible pullback zone
                    </p>
                ) : (
                    <p className="text-xs text-slate-300 font-medium bg-slate-800/80 border border-slate-700/80 rounded-lg py-1.5 px-3 text-center">
                        Momentum in neutral territory
                    </p>
                )}
            </div>
        </div>
    );
};

// ─── Signal Badge ─────────────────────────────────────────────────────────────
const SignalBadge = ({ signal, goldenCross, rsi }: {
    signal: AnalysisData['signal'];
    goldenCross: boolean;
    rsi: number | null;
}) => {
    const isOversold = rsi != null && rsi < 30;
    const isOverbought = rsi != null && rsi > 70;

    if (goldenCross) {
        return (
            <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-blue-500/15 border border-blue-500/45 shadow-sm">
                <TrendingUp className="text-blue-400 shrink-0" size={20} />
                <div>
                    <div className="text-blue-400 font-bold text-xs uppercase tracking-widest">Golden Cross</div>
                    <div className="text-slate-300 text-xs">EMA 50 crossed above EMA 200</div>
                </div>
            </div>
        );
    }

    if (isOversold || signal === 'buy') {
        return (
            <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-slate-900/90 border border-slate-700 shadow-sm">
                <TrendingUp className="text-green-400 shrink-0" size={20} />
                <div>
                    <div className="text-green-400 font-bold text-xs uppercase tracking-widest">Buy Signal</div>
                    <div className="text-slate-300 text-xs">
                        {isOversold ? 'RSI is oversold (<30)' : 'Bullish momentum detected'}
                    </div>
                </div>
            </div>
        );
    }

    if (isOverbought || signal === 'sell') {
        return (
            <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-slate-900/90 border border-slate-700 shadow-sm">
                <TrendingDown className="text-red-400 shrink-0" size={20} />
                <div>
                    <div className="text-red-400 font-bold text-xs uppercase tracking-widest">Sell Signal</div>
                    <div className="text-slate-300 text-xs">
                        {isOverbought ? 'RSI is overbought (>70)' : 'Bearish momentum detected'}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-slate-900/90 border border-slate-700">
            <Minus className="text-slate-300 shrink-0" size={20} />
            <div>
                <div className="text-white font-bold text-xs uppercase tracking-widest">Neutral</div>
                <div className="text-slate-300 text-xs">No strong directional signal</div>
            </div>
        </div>
    );
};

// ─── MACD Panel ───────────────────────────────────────────────────────────────
const MacdPanel = ({ macd }: { macd: AnalysisData['indicators']['macd'] }) => {
    const { MACD: macdLine, signal, histogram } = macd;
    const isPos = histogram != null && histogram >= 0;

    const fmt = (v: number | null | undefined) => (v != null ? v.toFixed(4) : '—');

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <h4 className="text-xs text-slate-300 uppercase font-bold tracking-wider">MACD (12, 26, 9)</h4>
                <span className="text-xs text-slate-400">Momentum Oscillator</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-slate-900/75 border border-slate-700/80 rounded-xl p-3.5 flex sm:flex-col justify-between items-center sm:text-center gap-1">
                    <div className="text-xs font-medium text-slate-300">MACD Line</div>
                    <div className={`font-mono tabular-nums font-bold text-base ${macdLine != null ? (macdLine >= 0 ? 'text-green-400' : 'text-red-400') : 'text-slate-300'}`}>
                        {fmt(macdLine)}
                    </div>
                </div>
                <div className="bg-slate-900/75 border border-slate-700/80 rounded-xl p-3.5 flex sm:flex-col justify-between items-center sm:text-center gap-1">
                    <div className="text-xs font-medium text-slate-300">Signal Line</div>
                    <div className={`font-mono tabular-nums font-bold text-base ${signal != null ? (signal >= 0 ? 'text-green-400' : 'text-red-400') : 'text-slate-300'}`}>
                        {fmt(signal)}
                    </div>
                </div>
                <div className="bg-slate-900/75 border border-slate-700/80 rounded-xl p-3.5 flex sm:flex-col justify-between items-center sm:text-center gap-1">
                    <div className="text-xs font-medium text-slate-300">Histogram</div>
                    <div className={`font-mono tabular-nums font-bold text-base ${histogram != null ? (isPos ? 'text-green-400' : 'text-red-400') : 'text-slate-300'}`}>
                        {fmt(histogram)}
                    </div>
                </div>
            </div>
        </div>
    );
};

// ─── Target Levels Panel ─────────────────────────────────────────────────────
const TargetLevels = ({ targets, currentPrice }: {
    targets: AnalysisData['priceTargets'];
    currentPrice: number;
}) => {
    const fmt = (v: number | null | undefined) => v != null ? `$${v.toFixed(2)}` : '—';

    const distPct = (target: number | null | undefined): string | null => {
        if (target == null || currentPrice === 0) return null;
        const pct = ((currentPrice - target) / target) * 100;
        const abs = Math.abs(pct).toFixed(1);
        if (pct > 0) return `${abs}% above`;
        if (pct < 0) return `${abs}% below`;
        return 'At target';
    };

    const buyDist  = distPct(targets.suggestedBuyPrice);
    const sellDist = distPct(targets.suggestedSellPrice);
    const fibDist  = distPct(targets.fibEntry);

    const bbWidth = (targets.bollingerUpper != null && targets.bollingerMiddle != null && targets.suggestedBuyPrice != null)
        ? ((targets.bollingerUpper - targets.suggestedBuyPrice) / targets.bollingerMiddle) * 100
        : null;

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h4 className="text-xs text-slate-300 uppercase font-bold tracking-wider">Price Targets &amp; Bands</h4>
                <span className="text-xs text-slate-400">Bollinger &amp; Fibonacci</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                {/* Buy Zone */}
                <div className="bg-green-500/10 border border-green-500/35 rounded-xl p-4 space-y-1.5">
                    <div className="text-xs text-green-400 uppercase font-bold tracking-wider">Buy Zone</div>
                    <div className="text-green-400 font-mono tabular-nums font-bold text-2xl">{fmt(targets.suggestedBuyPrice)}</div>
                    <div className="text-xs text-slate-300">Lower Bollinger Band</div>
                    {buyDist && (
                        <div className={`text-xs font-semibold pt-1 ${
                            buyDist.includes('above') ? 'text-green-400' : 'text-amber-400'
                        }`}>
                            Currently {buyDist}
                        </div>
                    )}
                </div>

                {/* Sell Zone */}
                <div className="bg-red-500/10 border border-red-500/35 rounded-xl p-4 space-y-1.5">
                    <div className="text-xs text-red-400 uppercase font-bold tracking-wider">Sell Zone</div>
                    <div className="text-red-400 font-mono tabular-nums font-bold text-2xl">{fmt(targets.suggestedSellPrice)}</div>
                    <div className="text-xs text-slate-300">Upper Bollinger Band</div>
                    {sellDist && (
                        <div className={`text-xs font-semibold pt-1 ${
                            sellDist.includes('below') ? 'text-red-400' : 'text-amber-400'
                        }`}>
                            Currently {sellDist}
                        </div>
                    )}
                </div>

                {/* Fibonacci Entry */}
                <div className="bg-indigo-500/10 border border-indigo-500/35 rounded-xl p-4 space-y-1.5">
                    <div className="text-xs text-indigo-400 uppercase font-bold tracking-wider">Fib 61.8% Entry</div>
                    <div className="text-indigo-400 font-mono tabular-nums font-bold text-2xl">{fmt(targets.fibEntry)}</div>
                    <div className="text-xs text-slate-300">52W High → Low retracement</div>
                    {fibDist && (
                        <div className="text-xs font-semibold text-indigo-400 pt-1">
                            Currently {fibDist}
                        </div>
                    )}
                </div>
            </div>

            {/* 52W range bar with BB bands overlaid */}
            {targets.high52w != null && targets.low52w != null && (
                <div className="bg-slate-900/75 border border-slate-700/80 rounded-xl p-4 space-y-2.5">
                    <div className="flex flex-wrap justify-between items-center gap-2 text-xs font-medium">
                        <span className="text-slate-300">
                            52W Low: <span className="text-white font-mono tabular-nums font-bold">{fmt(targets.low52w)}</span>
                        </span>
                        {bbWidth != null && (
                            <span className="text-slate-300">
                                BB Width: <span className="text-white font-mono tabular-nums font-bold">{bbWidth.toFixed(1)}%</span>
                                <span className="ml-1.5 text-slate-400">({bbWidth > 5 ? 'High volatility' : 'Low volatility / squeeze'})</span>
                            </span>
                        )}
                        <span className="text-slate-300">
                            52W High: <span className="text-white font-mono tabular-nums font-bold">{fmt(targets.high52w)}</span>
                        </span>
                    </div>
                    <div className="relative h-2.5 bg-slate-800 border border-slate-700 rounded-full overflow-hidden">
                        {(() => {
                            const range = (targets.high52w ?? 0) - (targets.low52w ?? 0);
                            const pricePct = range > 0 ? ((currentPrice - (targets.low52w ?? 0)) / range) * 100 : 50;
                            const buyPct   = range > 0 && targets.suggestedBuyPrice != null ? ((targets.suggestedBuyPrice  - (targets.low52w ?? 0)) / range) * 100 : null;
                            const sellPct  = range > 0 && targets.suggestedSellPrice != null ? ((targets.suggestedSellPrice - (targets.low52w ?? 0)) / range) * 100 : null;
                            return (
                                <>
                                    {buyPct != null && sellPct != null && (
                                        <div
                                            className="absolute top-0 h-full bg-blue-500/25 rounded-full"
                                            style={{ left: `${Math.max(0, buyPct)}%`, width: `${Math.max(0, Math.min(100, sellPct) - Math.max(0, buyPct))}%` }}
                                        />
                                    )}
                                    <div
                                        className="absolute top-0 left-0 h-full bg-gradient-to-r from-green-500 via-amber-400 to-red-500 opacity-85 rounded-full"
                                        style={{ width: `${Math.min(100, Math.max(0, pricePct))}%` }}
                                    />
                                    <div
                                        className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white shadow border-2 border-slate-900"
                                        style={{ left: `calc(${Math.min(100, Math.max(0, pricePct))}% - 6px)` }}
                                    />
                                </>
                            );
                        })()}
                    </div>
                </div>
            )}
        </div>
    );
};

// ─── Lightweight Chart with EMA Overlay ───────────────────────────────────────
const TaChart = ({ data }: { data: AnalysisData }) => {
    const chartContainerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);
    const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
    const ema50SeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
    const ema200SeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
    const { theme } = useTheme();
    const isDark = theme === 'dark';

    const candleData = useMemo(
        () =>
            data.ohlcv.map((bar) => ({
                time: bar.time as UTCTimestamp,
                open: bar.open,
                high: bar.high,
                low: bar.low,
                close: bar.close,
            })),
        [data.ohlcv]
    );

    const ema50Data = useMemo(
        () =>
            data.emaSeries
                .filter((e) => e.ema50 != null)
                .map((e) => ({ time: e.time as UTCTimestamp, value: e.ema50! })),
        [data.emaSeries]
    );

    const ema200Data = useMemo(
        () =>
            data.emaSeries
                .filter((e) => e.ema200 != null)
                .map((e) => ({ time: e.time as UTCTimestamp, value: e.ema200! })),
        [data.emaSeries]
    );

    useEffect(() => {
        const container = chartContainerRef.current;
        if (!container) return;

        const chart = createChart(container, {
            layout: { background: { color: 'transparent' } },
            crosshair: { mode: 1 },
            timeScale: { timeVisible: true, secondsVisible: false },
            width: container.clientWidth,
            height: 340,
        });

        const candleSeries = chart.addSeries(CandlestickSeries, {
            upColor: '#10b981',
            downColor: '#ef4444',
            borderUpColor: '#10b981',
            borderDownColor: '#ef4444',
            wickUpColor: '#10b981',
            wickDownColor: '#ef4444',
        });

        const ema50Series = chart.addSeries(LineSeries, {
            lineWidth: 2,
            title: 'EMA 50',
            priceLineVisible: false,
            lastValueVisible: true,
        });

        const ema200Series = chart.addSeries(LineSeries, {
            lineWidth: 2,
            title: 'EMA 200',
            priceLineVisible: false,
            lastValueVisible: true,
        });

        chartRef.current = chart;
        candleSeriesRef.current = candleSeries;
        ema50SeriesRef.current = ema50Series;
        ema200SeriesRef.current = ema200Series;

        const observer = new ResizeObserver(() => {
            if (chartContainerRef.current) {
                chart.applyOptions({ width: chartContainerRef.current.clientWidth });
            }
        });
        observer.observe(container);

        return () => {
            observer.disconnect();
            chart.remove();
            chartRef.current = null;
            candleSeriesRef.current = null;
            ema50SeriesRef.current = null;
            ema200SeriesRef.current = null;
        };
    }, []);

    useEffect(() => {
        const chart = chartRef.current;
        if (!chart) return;
        chart.applyOptions({
            layout: {
                background: { color: 'transparent' },
                textColor: isDark ? '#cbd5e1' : '#334155',
            },
            grid: {
                vertLines: { color: isDark ? 'rgba(148, 163, 184, 0.12)' : 'rgba(15, 23, 42, 0.08)' },
                horzLines: { color: isDark ? 'rgba(148, 163, 184, 0.12)' : 'rgba(15, 23, 42, 0.08)' },
            },
            rightPriceScale: {
                borderColor: isDark ? 'rgba(148, 163, 184, 0.25)' : 'rgba(15, 23, 42, 0.15)',
            },
            timeScale: {
                borderColor: isDark ? 'rgba(148, 163, 184, 0.25)' : 'rgba(15, 23, 42, 0.15)',
            },
        });
        ema50SeriesRef.current?.applyOptions({ color: isDark ? '#f59e0b' : '#d97706' });
        ema200SeriesRef.current?.applyOptions({ color: isDark ? '#a855f7' : '#7c3aed' });
    }, [isDark]);

    useEffect(() => {
        if (!candleData.length) return;
        candleSeriesRef.current?.setData(candleData);
        ema50SeriesRef.current?.setData(ema50Data);
        ema200SeriesRef.current?.setData(ema200Data);
        chartRef.current?.timeScale().fitContent();
    }, [candleData, ema50Data, ema200Data]);

    return (
        <div className="bg-slate-900/75 border border-slate-700/80 rounded-xl p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    Candlestick &amp; Moving Averages
                </span>
                <div className="flex items-center gap-4 text-xs font-semibold">
                    <span className="flex items-center gap-1.5">
                        <span className="inline-block w-4 h-0.5 bg-amber-400 rounded" />
                        <span className="text-amber-400">EMA 50</span>
                    </span>
                    <span className="flex items-center gap-1.5">
                        <span className="inline-block w-4 h-0.5 bg-purple-400 rounded" />
                        <span className="text-purple-400">EMA 200</span>
                    </span>
                </div>
            </div>
            <div ref={chartContainerRef} className="w-full rounded-lg overflow-hidden" />
        </div>
    );
};

// ─── Main Component ───────────────────────────────────────────────────────────
const StockAnalysisCard = ({ ticker }: StockAnalysisCardProps) => {
    const [data, setData] = useState<AnalysisData | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [reloadToken, setReloadToken] = useState(0);

    const fetchAnalysis = () => setReloadToken((n) => n + 1);

    useEffect(() => {
        const controller = new AbortController();

        (async () => {
            await Promise.resolve();
            if (controller.signal.aborted) return;
            setLoading(true);
            setError(null);
            try {
                const res = await fetch(
                    `/api/stocks/${encodeURIComponent(ticker)}/analysis`,
                    { signal: controller.signal }
                );
                if (!res.ok) {
                    const errJson = await res.json().catch(() => ({}));
                    throw new Error(errJson.error || `HTTP ${res.status}`);
                }
                const json: AnalysisData = await res.json();
                if (!controller.signal.aborted) {
                    setData(json);
                }
            } catch (err: unknown) {
                if (!controller.signal.aborted) {
                    setError(err instanceof Error ? err.message : 'Failed to load analysis');
                }
            } finally {
                if (!controller.signal.aborted) {
                    setLoading(false);
                }
            }
        })();

        return () => controller.abort();
    }, [ticker, reloadToken]);

    return (
        <div className="bg-slate-800/95 border border-slate-700/90 rounded-2xl p-6 shadow-xl space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-700/80">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-blue-500/15 border border-blue-500/35 text-blue-400">
                        <Activity size={20} />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-white tracking-tight">Technical Analysis</h3>
                        <p className="text-xs text-slate-300">Last 250 trading days · EMA, RSI, MACD &amp; Bollinger Targets</p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {!loading && data && (
                        <SignalBadge
                            signal={data.signal}
                            goldenCross={data.indicators.goldenCross}
                            rsi={data.indicators.rsi}
                        />
                    )}
                    <button
                        onClick={fetchAnalysis}
                        disabled={loading}
                        className="p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-300 hover:text-white hover:border-slate-500 transition-colors"
                        title="Refresh analysis"
                        aria-label="Refresh technical analysis"
                    >
                        <RefreshCw size={16} className={loading ? 'animate-spin text-blue-400' : ''} />
                    </button>
                </div>
            </div>

            {/* Loading */}
            {loading && (
                <div className="flex items-center justify-center gap-3 py-16 text-slate-300 text-sm">
                    <RefreshCw size={20} className="animate-spin text-blue-400" />
                    <span>Calculating technical indicators…</span>
                </div>
            )}

            {/* Error */}
            {!loading && error && (
                <div className="flex items-center gap-3 bg-red-500/15 border border-red-500/35 rounded-xl p-4 text-red-400">
                    <AlertCircle size={18} className="shrink-0" />
                    <span className="text-sm font-medium">{error}</span>
                </div>
            )}

            {/* Content */}
            {!loading && data && (
                <>
                    {/* Chart */}
                    <TaChart data={data} />

                    {/* EMA Values + RSI */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* EMA Values */}
                        <div className="bg-slate-900/75 border border-slate-700/80 rounded-xl p-4 space-y-3">
                            <div className="flex items-center justify-between">
                                <h4 className="text-xs text-slate-300 uppercase font-bold tracking-wider">Trend (EMA)</h4>
                                <span className="text-xs text-slate-400">50 vs 200 Day</span>
                            </div>
                            <div className="space-y-2.5">
                                <div className="flex justify-between items-center p-3 bg-slate-800/90 border border-slate-700/70 rounded-lg">
                                    <div className="flex items-center gap-2.5">
                                        <span className="w-3 h-3 rounded-full bg-amber-400 shrink-0" />
                                        <span className="text-sm font-medium text-slate-200">EMA 50</span>
                                    </div>
                                    <span className="font-mono tabular-nums font-bold text-white">
                                        {data.indicators.ema50 != null
                                            ? `$${data.indicators.ema50.toFixed(2)}`
                                            : '—'}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center p-3 bg-slate-800/90 border border-slate-700/70 rounded-lg">
                                    <div className="flex items-center gap-2.5">
                                        <span className="w-3 h-3 rounded-full bg-purple-400 shrink-0" />
                                        <span className="text-sm font-medium text-slate-200">EMA 200</span>
                                    </div>
                                    <span className="font-mono tabular-nums font-bold text-white">
                                        {data.indicators.ema200 != null
                                            ? `$${data.indicators.ema200.toFixed(2)}`
                                            : '—'}
                                    </span>
                                </div>
                                {data.indicators.ema50 != null && data.indicators.ema200 != null && (
                                    <div className={`text-xs text-center py-2 px-3 rounded-lg font-semibold border ${
                                        data.indicators.ema50 > data.indicators.ema200
                                            ? 'bg-green-500/15 border-green-500/35 text-green-400'
                                            : 'bg-red-500/15 border-red-500/35 text-red-400'
                                    }`}>
                                        {data.indicators.ema50 > data.indicators.ema200
                                            ? 'Bullish trend (EMA 50 > EMA 200)'
                                            : 'Bearish trend (EMA 50 < EMA 200)'}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* RSI Gauge */}
                        <div>
                            {data.indicators.rsi != null ? (
                                <RsiGauge rsi={data.indicators.rsi} />
                            ) : (
                                <div className="bg-slate-900/75 border border-slate-700/80 rounded-xl p-4 h-full flex items-center justify-center text-slate-400 text-sm">
                                    RSI data unavailable
                                </div>
                            )}
                        </div>
                    </div>

                    {/* MACD */}
                    <MacdPanel macd={data.indicators.macd} />

                    {/* Price Targets */}
                    <TargetLevels targets={data.priceTargets} currentPrice={data.currentPrice} />

                    {/* Footer */}
                    <p className="text-xs text-slate-400 text-right pt-2 border-t border-slate-700/60">
                        Fetched {new Date(data.fetchedAt).toLocaleTimeString()} · Cached 30 min ·{' '}
                        <span className="italic">Informational only — not financial advice</span>
                    </p>
                </>
            )}
        </div>
    );
};

export default StockAnalysisCard;
