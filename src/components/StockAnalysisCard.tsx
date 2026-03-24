import { useEffect, useRef, useState } from 'react';
import { createChart, CandlestickSeries, LineSeries } from 'lightweight-charts';
import { TrendingUp, TrendingDown, Minus, RefreshCw, AlertCircle } from 'lucide-react';
import type { AnalysisData } from '../types';

interface StockAnalysisCardProps {
    ticker: string;
}

// ─── RSI Gauge ────────────────────────────────────────────────────────────────
const RsiGauge = ({ rsi }: { rsi: number }) => {
    const pct = Math.min(100, Math.max(0, rsi));
    const isOversold = rsi < 30;
    const isOverbought = rsi > 70;

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
        <div className="space-y-2">
            <div className="flex justify-between items-center">
                <span className="text-xs text-slate-400 uppercase font-bold tracking-wider">RSI (14)</span>
                <span className={`text-2xl font-bold font-mono ${labelColor}`}>
                    {rsi.toFixed(1)}
                </span>
            </div>

            {/* Track */}
            <div className="relative h-3 bg-slate-700 rounded-full overflow-hidden">
                {/* Zone markers */}
                <div className="absolute top-0 left-[30%] w-px h-full bg-slate-500/50" />
                <div className="absolute top-0 left-[70%] w-px h-full bg-slate-500/50" />
                {/* Fill */}
                <div
                    className={`absolute top-0 left-0 h-full rounded-full bg-gradient-to-r ${trackColor} transition-all duration-700`}
                    style={{ width: `${pct}%` }}
                />
                {/* Thumb */}
                <div
                    className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white shadow-lg border-2 border-slate-800 transition-all duration-700"
                    style={{ left: `calc(${pct}% - 6px)` }}
                />
            </div>

            <div className="flex justify-between text-[10px] text-slate-500 font-medium">
                <span className="text-green-500">Oversold &lt;30</span>
                <span>Neutral</span>
                <span className="text-red-500">&gt;70 Overbought</span>
            </div>

            {isOversold && (
                <p className="text-[11px] text-green-400/80 text-center font-medium">
                    📉 Potentially oversold — possible bounce zone
                </p>
            )}
            {isOverbought && (
                <p className="text-[11px] text-red-400/80 text-center font-medium">
                    📈 Potentially overbought — possible pullback zone
                </p>
            )}
        </div>
    );
};

// ─── Signal Badge ─────────────────────────────────────────────────────────────
const SignalBadge = ({ signal, goldenCross, rsi }: {
    signal: AnalysisData['signal'];
    goldenCross: boolean;
    rsi: number | null;
}) => {
    const isOversold = rsi !== null && rsi < 30;
    const isOverbought = rsi !== null && rsi > 70;

    if (goldenCross) {
        return (
            <div className="flex items-center gap-3 px-5 py-3 rounded-xl bg-blue-500/10 border border-blue-500/40 shadow-[0_0_20px_rgba(59,130,246,0.2)]">
                <TrendingUp className="text-blue-400" size={22} />
                <div>
                    <div className="text-blue-300 font-bold text-sm uppercase tracking-widest">Golden Cross</div>
                    <div className="text-blue-400/70 text-xs">EMA 50 crossed above EMA 200</div>
                </div>
            </div>
        );
    }

    if (isOversold || signal === 'buy') {
        return (
            <div className="flex items-center gap-3 px-5 py-3 rounded-xl bg-green-500/10 border border-green-500/40 shadow-[0_0_20px_rgba(34,197,94,0.2)]">
                <TrendingUp className="text-green-400" size={22} />
                <div>
                    <div className="text-green-300 font-bold text-sm uppercase tracking-widest">Buy Signal</div>
                    <div className="text-green-400/70 text-xs">
                        {isOversold ? 'RSI is oversold' : 'Bullish momentum detected'}
                    </div>
                </div>
            </div>
        );
    }

    if (isOverbought || signal === 'sell') {
        return (
            <div className="flex items-center gap-3 px-5 py-3 rounded-xl bg-red-500/10 border border-red-500/40 shadow-[0_0_20px_rgba(239,68,68,0.2)]">
                <TrendingDown className="text-red-400" size={22} />
                <div>
                    <div className="text-red-300 font-bold text-sm uppercase tracking-widest">Sell Signal</div>
                    <div className="text-red-400/70 text-xs">
                        {isOverbought ? 'RSI is overbought' : 'Bearish momentum detected'}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex items-center gap-3 px-5 py-3 rounded-xl bg-slate-700/40 border border-slate-600/40">
            <Minus className="text-slate-400" size={22} />
            <div>
                <div className="text-slate-300 font-bold text-sm uppercase tracking-widest">Neutral</div>
                <div className="text-slate-500 text-xs">No strong signal detected</div>
            </div>
        </div>
    );
};

// ─── MACD Panel ───────────────────────────────────────────────────────────────
const MacdPanel = ({ macd }: { macd: AnalysisData['indicators']['macd'] }) => {
    const { MACD: macdLine, signal, histogram } = macd;
    const isPos = histogram !== null && histogram >= 0;

    const fmt = (v: number | null) => (v !== null ? v.toFixed(4) : '—');

    return (
        <div className="space-y-3">
            <h4 className="text-xs text-slate-400 uppercase font-bold tracking-wider">MACD (12, 26, 9)</h4>
            <div className="grid grid-cols-3 gap-3">
                <div className="text-center bg-slate-800/60 rounded-lg p-3">
                    <div className="text-[10px] text-slate-500 mb-1">MACD Line</div>
                    <div className={`font-mono font-bold text-sm ${macdLine !== null && macdLine >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {fmt(macdLine)}
                    </div>
                </div>
                <div className="text-center bg-slate-800/60 rounded-lg p-3">
                    <div className="text-[10px] text-slate-500 mb-1">Signal</div>
                    <div className={`font-mono font-bold text-sm ${signal !== null && signal >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {fmt(signal)}
                    </div>
                </div>
                <div className="text-center bg-slate-800/60 rounded-lg p-3">
                    <div className="text-[10px] text-slate-500 mb-1">Histogram</div>
                    <div className={`font-mono font-bold text-sm ${isPos ? 'text-green-400' : 'text-red-400'}`}>
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
    const fmt = (v: number | null) => v !== null ? `$${v.toFixed(2)}` : '—';

    const distPct = (target: number | null): string | null => {
        if (target === null || currentPrice === 0) return null;
        const pct = ((currentPrice - target) / target) * 100;
        const abs = Math.abs(pct).toFixed(1);
        if (pct > 0) return `${abs}% above`;
        if (pct < 0) return `${abs}% below`;
        return 'At target';
    };

    const buyDist  = distPct(targets.suggestedBuyPrice);
    const sellDist = distPct(targets.suggestedSellPrice);
    const fibDist  = distPct(targets.fibEntry);

    // BB bandwidth as % of middle, for the width bar
    const bbWidth = (targets.bollingerUpper !== null && targets.bollingerMiddle !== null && targets.suggestedBuyPrice !== null)
        ? ((targets.bollingerUpper - targets.suggestedBuyPrice) / targets.bollingerMiddle) * 100
        : null;

    return (
        <div className="space-y-4">
            <h4 className="text-xs text-slate-400 uppercase font-bold tracking-wider">Price Targets</h4>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* Buy Zone */}
                <div className="bg-green-500/5 border border-green-500/20 rounded-xl p-4 space-y-1">
                    <div className="text-[10px] text-green-500/70 uppercase font-bold tracking-wider">Buy Zone</div>
                    <div className="text-green-400 font-mono font-bold text-xl">{fmt(targets.suggestedBuyPrice)}</div>
                    <div className="text-[10px] text-slate-500">Lower Bollinger Band</div>
                    {buyDist && (
                        <div className={`text-[11px] font-semibold mt-1 ${
                            buyDist.includes('above') ? 'text-green-400/70' : 'text-amber-400'
                        }`}>
                            Currently {buyDist}
                        </div>
                    )}
                </div>

                {/* Sell Zone */}
                <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4 space-y-1">
                    <div className="text-[10px] text-red-500/70 uppercase font-bold tracking-wider">Sell Zone</div>
                    <div className="text-red-400 font-mono font-bold text-xl">{fmt(targets.suggestedSellPrice)}</div>
                    <div className="text-[10px] text-slate-500">Upper Bollinger Band</div>
                    {sellDist && (
                        <div className={`text-[11px] font-semibold mt-1 ${
                            sellDist.includes('below') ? 'text-red-400/70' : 'text-amber-400'
                        }`}>
                            Currently {sellDist}
                        </div>
                    )}
                </div>

                {/* Fibonacci Entry */}
                <div className="bg-indigo-500/5 border border-indigo-500/20 rounded-xl p-4 space-y-1">
                    <div className="text-[10px] text-indigo-400/70 uppercase font-bold tracking-wider">Fib 61.8% Entry</div>
                    <div className="text-indigo-400 font-mono font-bold text-xl">{fmt(targets.fibEntry)}</div>
                    <div className="text-[10px] text-slate-500">52W High → Low retracement</div>
                    {fibDist && (
                        <div className={`text-[11px] font-semibold mt-1 ${
                            fibDist.includes('below') ? 'text-indigo-400/70' : 'text-slate-400'
                        }`}>
                            Currently {fibDist}
                        </div>
                    )}
                </div>
            </div>

            {/* 52W range bar with BB bands overlaid */}
            {targets.high52w !== null && targets.low52w !== null && (
                <div className="space-y-1.5">
                    <div className="flex justify-between text-[10px] text-slate-500 font-medium">
                        <span>52W Low: <span className="text-white font-mono">{fmt(targets.low52w)}</span></span>
                        <span>52W High: <span className="text-white font-mono">{fmt(targets.high52w)}</span></span>
                    </div>
                    <div className="relative h-2 bg-slate-700 rounded-full overflow-hidden">
                        {/* Current price position */}
                        {(() => {
                            const range = (targets.high52w ?? 0) - (targets.low52w ?? 0);
                            const pricePct = range > 0 ? ((currentPrice - (targets.low52w ?? 0)) / range) * 100 : 50;
                            const buyPct   = range > 0 && targets.suggestedBuyPrice  ? ((targets.suggestedBuyPrice  - (targets.low52w ?? 0)) / range) * 100 : null;
                            const sellPct  = range > 0 && targets.suggestedSellPrice ? ((targets.suggestedSellPrice - (targets.low52w ?? 0)) / range) * 100 : null;
                            return (
                                <>
                                    {/* BB band fill */}
                                    {buyPct !== null && sellPct !== null && (
                                        <div className="absolute top-0 h-full bg-slate-600/50 rounded-full"
                                            style={{ left: `${Math.max(0, buyPct)}%`, width: `${Math.min(100, sellPct) - Math.max(0, buyPct)}%` }} />
                                    )}
                                    {/* Gradient fill up to current price */}
                                    <div
                                        className="absolute top-0 left-0 h-full bg-gradient-to-r from-green-500 via-amber-400 to-red-500 opacity-60 rounded-full"
                                        style={{ width: `${Math.min(100, Math.max(0, pricePct))}%` }}
                                    />
                                    {/* Current price pin */}
                                    <div
                                        className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-white shadow border border-slate-800"
                                        style={{ left: `calc(${Math.min(100, Math.max(0, pricePct))}% - 4px)` }}
                                    />
                                </>
                            );
                        })()}
                    </div>
                    {bbWidth !== null && (
                        <div className="text-[10px] text-slate-500 text-center">
                            BB Width: <span className="text-slate-300 font-mono">{bbWidth.toFixed(1)}%</span>
                            <span className="ml-1 text-slate-600">— {bbWidth > 5 ? 'High volatility' : 'Low volatility / squeeze'}</span>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

// ─── Lightweight Chart with EMA Overlay ───────────────────────────────────────
const TaChart = ({ data }: { data: AnalysisData }) => {
    const chartContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!chartContainerRef.current || !data.ohlcv.length) return;

        const chart = createChart(chartContainerRef.current, {
            layout: {
                background: { color: 'transparent' },
                textColor: '#94a3b8',
            },
            grid: {
                vertLines: { color: 'rgba(51,65,85,0.4)' },
                horzLines: { color: 'rgba(51,65,85,0.4)' },
            },
            crosshair: { mode: 1 },
            rightPriceScale: { borderColor: 'rgba(51,65,85,0.6)' },
            timeScale: {
                borderColor: 'rgba(51,65,85,0.6)',
                timeVisible: true,
                secondsVisible: false,
            },
            width: chartContainerRef.current.clientWidth,
            height: 340,
        });

        // Candlestick series
        const candleSeries = chart.addSeries(CandlestickSeries, {
            upColor: '#22c55e',
            downColor: '#ef4444',
            borderUpColor: '#22c55e',
            borderDownColor: '#ef4444',
            wickUpColor: '#22c55e',
            wickDownColor: '#ef4444',
        });

        candleSeries.setData(
            data.ohlcv.map(bar => ({
                time: bar.time as any,
                open: bar.open,
                high: bar.high,
                low: bar.low,
                close: bar.close,
            }))
        );

        // EMA 50 line
        const ema50Series = chart.addSeries(LineSeries, {
            color: '#f59e0b',
            lineWidth: 1,
            title: 'EMA 50',
            priceLineVisible: false,
            lastValueVisible: true,
        });
        ema50Series.setData(
            data.emaSeries
                .filter(e => e.ema50 !== null)
                .map(e => ({ time: e.time as any, value: e.ema50! }))
        );

        // EMA 200 line
        const ema200Series = chart.addSeries(LineSeries, {
            color: '#a855f7',
            lineWidth: 1,
            title: 'EMA 200',
            priceLineVisible: false,
            lastValueVisible: true,
        });
        ema200Series.setData(
            data.emaSeries
                .filter(e => e.ema200 !== null)
                .map(e => ({ time: e.time as any, value: e.ema200! }))
        );

        chart.timeScale().fitContent();

        const handleResize = () => {
            if (chartContainerRef.current) {
                chart.applyOptions({ width: chartContainerRef.current.clientWidth });
            }
        };
        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            chart.remove();
        };
    }, [data]);

    return (
        <div className="space-y-2">
            <div className="flex items-center gap-4 text-xs font-medium">
                <span className="flex items-center gap-1.5">
                    <span className="inline-block w-5 h-0.5 bg-amber-400 rounded" />
                    <span className="text-amber-400">EMA 50</span>
                </span>
                <span className="flex items-center gap-1.5">
                    <span className="inline-block w-5 h-0.5 bg-purple-400 rounded" />
                    <span className="text-purple-400">EMA 200</span>
                </span>
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

    const fetchAnalysis = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`http://localhost:3001/api/stocks/${ticker}/analysis`);
            if (!res.ok) {
                const errJson = await res.json().catch(() => ({}));
                throw new Error(errJson.error || `HTTP ${res.status}`);
            }
            const json: AnalysisData = await res.json();
            setData(json);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAnalysis();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ticker]);

    return (
        <div className="glass-panel p-6 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-bold text-white">Technical Analysis</h3>
                    <p className="text-xs text-slate-500 mt-0.5">Last 250 days · EMA, RSI, MACD</p>
                </div>
                <button
                    onClick={fetchAnalysis}
                    disabled={loading}
                    className="p-2 rounded-lg bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
                    title="Refresh analysis"
                >
                    <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                </button>
            </div>

            {/* Loading */}
            {loading && (
                <div className="flex items-center justify-center gap-3 py-16 text-slate-400">
                    <RefreshCw size={20} className="animate-spin" />
                    <span>Calculating indicators…</span>
                </div>
            )}

            {/* Error */}
            {!loading && error && (
                <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400">
                    <AlertCircle size={18} className="shrink-0" />
                    <span className="text-sm">{error}</span>
                </div>
            )}

            {/* Content */}
            {!loading && data && (
                <>
                    {/* Signal Badge */}
                    <SignalBadge
                        signal={data.signal}
                        goldenCross={data.indicators.goldenCross}
                        rsi={data.indicators.rsi}
                    />

                    {/* Chart */}
                    <TaChart data={data} />

                    {/* EMA Values + RSI */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* EMA Values */}
                        <div className="space-y-3">
                            <h4 className="text-xs text-slate-400 uppercase font-bold tracking-wider">Trend (EMA)</h4>
                            <div className="space-y-2">
                                <div className="flex justify-between items-center p-3 bg-slate-800/60 rounded-lg">
                                    <div className="flex items-center gap-2">
                                        <span className="w-3 h-3 rounded-full bg-amber-400" />
                                        <span className="text-sm text-slate-300">EMA 50</span>
                                    </div>
                                    <span className="font-mono font-bold text-white">
                                        {data.indicators.ema50 !== null
                                            ? `$${data.indicators.ema50.toFixed(2)}`
                                            : '—'}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center p-3 bg-slate-800/60 rounded-lg">
                                    <div className="flex items-center gap-2">
                                        <span className="w-3 h-3 rounded-full bg-purple-400" />
                                        <span className="text-sm text-slate-300">EMA 200</span>
                                    </div>
                                    <span className="font-mono font-bold text-white">
                                        {data.indicators.ema200 !== null
                                            ? `$${data.indicators.ema200.toFixed(2)}`
                                            : '—'}
                                    </span>
                                </div>
                                {data.indicators.ema50 !== null && data.indicators.ema200 !== null && (
                                    <div className={`text-xs text-center py-1.5 rounded-lg font-medium ${data.indicators.ema50 > data.indicators.ema200
                                            ? 'bg-green-500/10 text-green-400'
                                            : 'bg-red-500/10 text-red-400'
                                        }`}>
                                        {data.indicators.ema50 > data.indicators.ema200
                                            ? '✦ Bullish trend (EMA 50 > EMA 200)'
                                            : '✦ Bearish trend (EMA 50 < EMA 200)'}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* RSI Gauge */}
                        <div>
                            {data.indicators.rsi !== null ? (
                                <RsiGauge rsi={data.indicators.rsi} />
                            ) : (
                                <p className="text-slate-500 text-sm">RSI data unavailable</p>
                            )}
                        </div>
                    </div>

                    {/* MACD */}
                    <MacdPanel macd={data.indicators.macd} />

                    {/* Price Targets */}
                    <TargetLevels targets={data.priceTargets} currentPrice={data.currentPrice} />

                    {/* Footer */}
                    <p className="text-[10px] text-slate-600 text-right">
                        Fetched {new Date(data.fetchedAt).toLocaleTimeString()} · Cached 30 min ·{' '}
                        <span className="italic">Not financial advice</span>
                    </p>
                </>
            )}
        </div>
    );
};

export default StockAnalysisCard;
