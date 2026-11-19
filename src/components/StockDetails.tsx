import { useEffect, useState } from 'react';
import { ResponsiveContainer, AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { ArrowUp, ArrowDown, X, Plus, Check, Loader2 } from 'lucide-react';
import { useData } from '../context/DataContext';
import { useTheme } from '../context/ThemeContext';
import StockAnalysisCard from './StockAnalysisCard';

export interface StockData {
    symbol: string;
    shortName: string;
    price: number;
    currency: string;
    change: number;
    changePercent: number;
    dayHigh: number;
    dayLow: number;
    open: number;
    prevClose: number;
    bid: number;
    ask: number;
    volume: number;
    avgVolume: number;
    fiftyTwoWeekHigh: number;
    fiftyTwoWeekLow: number;
    marketCap: number;
    peRatio: number;
    isFallback?: boolean;
}

interface SparklinePoint {
    date?: string;
    price: number;
    open?: number;
    high?: number;
    low?: number;
    close?: number;
    candleData?: [number, number];
}

interface StockDetailsProps {
    data: StockData;
    onClose: () => void;
}

interface CandlestickProps {
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    payload?: SparklinePoint;
}

const Candlestick = (props: CandlestickProps) => {
    const { x = 0, y = 0, width = 0, height = 0, payload } = props;
    if (!payload) return null;

    const c = payload.close ?? payload.price;
    const o = payload.open ?? c;
    const h = payload.high ?? c;
    const l = payload.low ?? c;

    const isPositive = c >= o;
    const fill = isPositive ? '#10b981' : '#ef4444';

    const valueRange = h - l;
    const pixelPerValue = valueRange > 0 ? height / valueRange : 0;

    const yOpen = y + (h - o) * pixelPerValue;
    const yClose = y + (h - c) * pixelPerValue;

    const bodyTop = Math.min(yOpen, yClose) || y;
    const bodyBottom = Math.max(yOpen, yClose) || y;
    const bodyHeight = Math.max(bodyBottom - bodyTop, 1.5);

    const midX = x + width / 2;

    return (
        <g>
            <line x1={midX} y1={y || 0} x2={midX} y2={(y || 0) + (height || 0)} stroke={fill} strokeWidth={1.25} />
            <rect x={x || 0} y={bodyTop} width={Math.max(width || 0, 2)} height={bodyHeight} fill={fill} stroke={fill} rx={1} />
        </g>
    );
};

const RangeBar = ({ label, low, high, current }: { label: string; low?: number; high?: number; current?: number }) => {
    const hasValues = low != null && high != null && high > low && current != null;
    const pct = hasValues ? Math.min(100, Math.max(0, ((current! - low!) / (high! - low!)) * 100)) : 50;

    return (
        <div className="py-2.5 border-b border-slate-700/60 last:border-0 space-y-1.5">
            <div className="flex justify-between items-center text-sm">
                <span className="text-slate-300 font-medium">{label}</span>
                <span className="text-white font-mono tabular-nums font-semibold">
                    {low != null && high != null ? `$${low.toFixed(2)} – $${high.toFixed(2)}` : '—'}
                </span>
            </div>
            {hasValues && (
                <div className="relative h-1.5 bg-slate-900 rounded-full border border-slate-700/70 overflow-hidden">
                    <div
                        className="absolute top-0 left-0 h-full bg-gradient-to-r from-blue-500 to-emerald-400 rounded-full"
                        style={{ width: `${pct}%` }}
                    />
                </div>
            )}
        </div>
    );
};

const StockDetails = ({ data, onClose }: StockDetailsProps) => {
    const isPositive = (data.change ?? 0) >= 0;
    const [chartData, setChartData] = useState<SparklinePoint[]>([]);
    const [range, setRange] = useState('1mo');
    const [chartType, setChartType] = useState<'area' | 'candle'>('area');
    const [loadingChart, setLoadingChart] = useState(false);
    const { watchlist, addToWatchlist } = useData();
    const { theme } = useTheme();
    const [isAdded, setIsAdded] = useState(false);

    const isDark = theme === 'dark';
    const tickColor = isDark ? '#94a3b8' : '#475569';
    const gridColor = isDark ? 'rgba(148, 163, 184, 0.14)' : 'rgba(15, 23, 42, 0.08)';
    const tooltipBg = isDark ? '#0f172a' : '#ffffff';
    const tooltipBorder = isDark ? '#334155' : '#cbd5e1';
    const tooltipText = isDark ? '#f8fafc' : '#0f172a';
    const tooltipLabel = isDark ? '#cbd5e1' : '#475569';
    const trendStroke = isPositive ? (isDark ? '#10b981' : '#059669') : (isDark ? '#ef4444' : '#dc2626');

    useEffect(() => {
        setIsAdded(watchlist.some(w => w.ticker === data.symbol));
    }, [watchlist, data.symbol]);

    const handleAdd = async () => {
        if (isAdded) return;
        try {
            await addToWatchlist(data.symbol);
        } catch (err) {
            console.error('Failed to add to watchlist', err);
        }
    };

    useEffect(() => {
        const fetchChart = async () => {
            setLoadingChart(true);
            try {
                const res = await fetch(`/api/quote?symbol=${encodeURIComponent(data.symbol)}&range=${encodeURIComponent(range)}`);
                if (res.ok) {
                    const result = await res.json();
                    if (result.sparkline) {
                        const formatted = (result.sparkline as SparklinePoint[]).map((item) => ({
                            ...item,
                            candleData: [item.low ?? item.price, item.high ?? item.price] as [number, number]
                        }));
                        setChartData(formatted);
                    }
                }
            } catch (e) {
                console.error('Chart fetch failed', e);
            } finally {
                setLoadingChart(false);
            }
        };
        fetchChart();
    }, [data.symbol, range]);

    const formatAxisDate = (label: string) => {
        if (!label) return '';
        const d = new Date(label);
        if (isNaN(d.getTime())) return label;
        if (range === '1d') return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
        if (range === '5y') return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
            {/* Header Banner */}
            <div className="bg-slate-800/95 border border-slate-700/90 rounded-2xl p-6 shadow-xl flex flex-col lg:flex-row justify-between items-start lg:items-center gap-5">
                <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-3">
                        <span className="px-3 py-1 rounded-lg bg-slate-900 border border-slate-700 text-xl font-bold font-mono tracking-tight text-white">
                            {data.symbol}
                        </span>
                        <h2 className="text-xl sm:text-2xl font-bold text-white">{data.shortName}</h2>
                        {data.currency && (
                            <span className="px-2.5 py-0.5 rounded-md bg-slate-900/90 border border-slate-700 text-xs font-semibold text-slate-300">
                                {data.currency}
                            </span>
                        )}
                        {data.isFallback && (
                            <span className="px-2.5 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/40 text-xs font-semibold text-amber-400">
                                Delayed / Basic
                            </span>
                        )}
                    </div>
                </div>

                <div className="flex flex-wrap items-center justify-between lg:justify-end gap-5 w-full lg:w-auto">
                    <div className="text-left lg:text-right">
                        <div className="text-3xl sm:text-4xl font-bold text-white font-mono tabular-nums tracking-tight">
                            ${data.price != null ? data.price.toFixed(2) : '—'}
                        </div>
                        <div className="mt-1 flex lg:justify-end">
                            <span
                                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-sm font-semibold font-mono tabular-nums border bg-slate-900/80 border-slate-700 ${
                                    isPositive ? 'text-green-400' : 'text-red-400'
                                }`}
                            >
                                {isPositive ? <ArrowUp size={15} /> : <ArrowDown size={15} />}
                                {data.change != null ? `${isPositive ? '+' : ''}${data.change.toFixed(2)}` : '—'}
                                {' '}
                                ({data.changePercent != null ? `${isPositive ? '+' : ''}${data.changePercent.toFixed(2)}%` : '—'})
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-2.5">
                        <button
                            onClick={handleAdd}
                            disabled={isAdded}
                            style={!isAdded ? { color: '#ffffff' } : undefined}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all border ${
                                isAdded
                                    ? 'bg-green-500/15 border-green-500/40 text-green-400 cursor-default'
                                    : 'bg-blue-600 hover:bg-blue-500 border-blue-500 shadow-md shadow-blue-600/20'
                            }`}
                        >
                            {isAdded ? (
                                <>
                                    <Check size={16} />
                                    <span>Watchlisted</span>
                                </>
                            ) : (
                                <>
                                    <Plus size={16} />
                                    <span>Add to Watchlist</span>
                                </>
                            )}
                        </button>

                        <button
                            onClick={onClose}
                            className="p-2.5 bg-slate-900 text-slate-300 hover:text-white rounded-xl border border-slate-700 hover:border-slate-500 transition-colors"
                            title="Close quote"
                            aria-label="Close quote"
                        >
                            <X size={18} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Main Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Key Statistics */}
                <div className="bg-slate-800/95 border border-slate-700/90 rounded-2xl p-6 shadow-xl lg:col-span-1 flex flex-col justify-between">
                    <div>
                        <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-700/80">
                            <h3 className="text-base font-bold text-white tracking-tight">Key Statistics</h3>
                            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Snapshot</span>
                        </div>

                        <div>
                            <Row label="Open" value={formatDollar(data.open)} />
                            <Row label="Prev Close" value={formatDollar(data.prevClose)} />
                            <RangeBar label="Day Range" low={data.dayLow} high={data.dayHigh} current={data.price} />
                            <RangeBar label="52W Range" low={data.fiftyTwoWeekLow} high={data.fiftyTwoWeekHigh} current={data.price} />
                            <Row label="Volume" value={formatCompact(data.volume)} />
                            <Row label="Avg Volume" value={formatCompact(data.avgVolume)} />
                            <Row label="Bid / Ask" value={formatBidAsk(data.bid, data.ask)} />
                            <Row label="Market Cap" value={formatCompact(data.marketCap, true)} />
                            <Row label="P/E Ratio" value={data.peRatio != null && data.peRatio !== 0 ? data.peRatio.toFixed(2) : '—'} />
                        </div>
                    </div>
                </div>

                {/* Chart Section */}
                <div className="bg-slate-800/95 border border-slate-700/90 rounded-2xl p-6 shadow-xl lg:col-span-2 flex flex-col min-h-[430px]">
                    <div className="flex flex-wrap justify-between items-center gap-3 mb-5 pb-3 border-b border-slate-700/80">
                        <div>
                            <h3 className="text-base font-bold text-white tracking-tight">Price Action</h3>
                            <p className="text-xs text-slate-400">Historical price & intraday movement</p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2.5">
                            <div className="flex gap-1 bg-slate-900 border border-slate-700/90 p-1 rounded-xl">
                                <button
                                    onClick={() => setChartType('area')}
                                    style={chartType === 'area' ? { color: '#ffffff' } : undefined}
                                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                                        chartType === 'area'
                                            ? 'bg-blue-600 shadow-sm'
                                            : 'text-slate-300 hover:text-white hover:bg-slate-800'
                                    }`}
                                >
                                    Line
                                </button>
                                <button
                                    onClick={() => setChartType('candle')}
                                    style={chartType === 'candle' ? { color: '#ffffff' } : undefined}
                                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                                        chartType === 'candle'
                                            ? 'bg-blue-600 shadow-sm'
                                            : 'text-slate-300 hover:text-white hover:bg-slate-800'
                                    }`}
                                >
                                    Candle
                                </button>
                            </div>

                            <div className="flex gap-1 bg-slate-900 border border-slate-700/90 p-1 rounded-xl">
                                {['1d', '5d', '1mo', '6mo', '1y', '5y'].map(r => (
                                    <button
                                        key={r}
                                        onClick={() => setRange(r)}
                                        style={range === r ? { color: '#ffffff' } : undefined}
                                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold uppercase transition-colors ${
                                            range === r
                                                ? 'bg-blue-600 shadow-sm'
                                                : 'text-slate-300 hover:text-white hover:bg-slate-800'
                                        }`}
                                    >
                                        {r}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 w-full min-h-[300px] bg-slate-900/50 border border-slate-700/60 rounded-xl p-3">
                        {loadingChart ? (
                            <div className="h-full min-h-[280px] flex items-center justify-center gap-2 text-slate-300 text-sm">
                                <Loader2 size={18} className="animate-spin text-blue-400" />
                                <span>Loading chart...</span>
                            </div>
                        ) : chartData.length > 0 ? (
                            <ResponsiveContainer width="100%" height={300}>
                                {chartType === 'area' ? (
                                    <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="chartColor" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor={trendStroke} stopOpacity={0.32} />
                                                <stop offset="95%" stopColor={trendStroke} stopOpacity={0.02} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid vertical={false} stroke={gridColor} strokeDasharray="3 3" />
                                        <XAxis
                                            dataKey="date"
                                            tickFormatter={formatAxisDate}
                                            tick={{ fill: tickColor, fontSize: 11 }}
                                            axisLine={false}
                                            tickLine={false}
                                            minTickGap={36}
                                        />
                                        <YAxis
                                            domain={['auto', 'auto']}
                                            orientation="right"
                                            tick={{ fill: tickColor, fontSize: 11 }}
                                            tickFormatter={(val) => `$${val.toFixed(2)}`}
                                            axisLine={false}
                                            tickLine={false}
                                            width={64}
                                        />
                                        <Tooltip
                                            contentStyle={{
                                                backgroundColor: tooltipBg,
                                                borderColor: tooltipBorder,
                                                borderRadius: '0.75rem',
                                                color: tooltipText,
                                                boxShadow: '0 10px 25px -5px rgba(0,0,0,0.25)',
                                            }}
                                            itemStyle={{ color: tooltipText, fontWeight: 700, fontFamily: 'monospace' }}
                                            labelStyle={{ color: tooltipLabel, marginBottom: '4px', fontWeight: 600, fontSize: '12px' }}
                                            formatter={(value) => [`$${Number(value).toFixed(2)}`, 'Price']}
                                            labelFormatter={(label) => {
                                                if (!label) return '';
                                                const d = new Date(label);
                                                return isNaN(d.getTime())
                                                    ? label
                                                    : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                                            }}
                                        />
                                        <Area
                                            type="monotone"
                                            dataKey="price"
                                            stroke={trendStroke}
                                            fill="url(#chartColor)"
                                            strokeWidth={2.25}
                                            activeDot={{ r: 4, strokeWidth: 0 }}
                                        />
                                    </AreaChart>
                                ) : (
                                    <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                                        <CartesianGrid vertical={false} stroke={gridColor} strokeDasharray="3 3" />
                                        <XAxis
                                            dataKey="date"
                                            tickFormatter={formatAxisDate}
                                            tick={{ fill: tickColor, fontSize: 11 }}
                                            axisLine={false}
                                            tickLine={false}
                                            minTickGap={36}
                                        />
                                        <YAxis
                                            domain={['auto', 'auto']}
                                            orientation="right"
                                            tick={{ fill: tickColor, fontSize: 11 }}
                                            tickFormatter={(val) => `$${val.toFixed(2)}`}
                                            axisLine={false}
                                            tickLine={false}
                                            width={64}
                                        />
                                        <Tooltip
                                            contentStyle={{
                                                backgroundColor: tooltipBg,
                                                borderColor: tooltipBorder,
                                                borderRadius: '0.75rem',
                                                color: tooltipText,
                                                boxShadow: '0 10px 25px -5px rgba(0,0,0,0.25)',
                                            }}
                                            itemStyle={{ color: tooltipText, fontWeight: 700, fontFamily: 'monospace' }}
                                            labelStyle={{ color: tooltipLabel, marginBottom: '4px', fontWeight: 600, fontSize: '12px' }}
                                            formatter={(value, name, props) => {
                                                const payload = (props as { payload?: SparklinePoint }).payload;
                                                if (payload) {
                                                    return [`$${Number(payload.price || payload.close).toFixed(2)}`, 'Close'];
                                                }
                                                return [String(value ?? ''), String(name ?? '')];
                                            }}
                                            labelFormatter={(label) => {
                                                if (!label) return '';
                                                const d = new Date(label);
                                                return isNaN(d.getTime())
                                                    ? label
                                                    : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                                            }}
                                            cursor={{ fill: isDark ? 'rgba(148,163,184,0.12)' : 'rgba(15,23,42,0.06)' }}
                                        />
                                        <Bar dataKey="candleData" shape={<Candlestick />} />
                                    </BarChart>
                                )}
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full min-h-[280px] flex items-center justify-center text-slate-400 text-sm">
                                No chart data available
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Technical Analysis Section */}
            <StockAnalysisCard ticker={data.symbol} />
        </div>
    );
};

const Row = ({ label, value }: { label: string; value: string | number }) => (
    <div className="flex justify-between items-center py-2.5 border-b border-slate-700/60 last:border-0 text-sm">
        <span className="text-slate-300 font-medium">{label}</span>
        <span className="text-white font-mono tabular-nums font-semibold">{value}</span>
    </div>
);

const formatDollar = (num: number | null | undefined) => {
    if (num == null || num === 0) return '—';
    return `$${num.toFixed(2)}`;
};

const formatBidAsk = (bid: number | null | undefined, ask: number | null | undefined) => {
    if ((bid == null || bid === 0) && (ask == null || ask === 0)) return '—';
    const b = bid ? `$${bid.toFixed(2)}` : '—';
    const a = ask ? `$${ask.toFixed(2)}` : '—';
    return `${b} / ${a}`;
};

const formatCompact = (num: number | null | undefined, isCurrency = false) => {
    if (num === null || num === undefined || num === 0) return '—';
    const formatted = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 }).format(num);
    return isCurrency ? `$${formatted}` : formatted;
};

export default StockDetails;
