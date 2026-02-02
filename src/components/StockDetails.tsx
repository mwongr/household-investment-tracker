import { useEffect, useState } from 'react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { ArrowUp, ArrowDown, X, Plus, Check } from 'lucide-react';
import { useData } from '../context/DataContext';

interface StockData {
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

interface StockDetailsProps {
    data: StockData;
    onClose: () => void;
}

// Generate simple mock chart data if history is not available in the quote endpoint yet.
// NOTE: Ideally we fetch history from /api/quote logic (the v8 one includes sparkline), 
// but clear requirements asked for specific data points. 
// We will modify the stock-detailed endpoint to INCLUDE sparkline data later or fetch separately.
// For now, let's create a placeholder chart or fetch it.
// Actually, I can fetch the chart data separately in this component if needed.
// Le's just assume we want to display the quote data first for this step.
// Update: I will add a fetch for chart data here.

const StockDetails = ({ data, onClose }: StockDetailsProps) => {
    const isPositive = data.change >= 0;
    const [chartData, setChartData] = useState<any[]>([]);
    const [range, setRange] = useState('1mo'); // 1d, 5d, 1mo, 6mo, 1y, 5y
    const [loadingChart, setLoadingChart] = useState(false);
    const { watchlist, addToWatchlist } = useData();
    const [isAdded, setIsAdded] = useState(false);

    useEffect(() => {
        setIsAdded(watchlist.some(w => w.ticker === data.symbol));
    }, [watchlist, data.symbol]);

    const handleAdd = async () => {
        if (isAdded) return;
        await addToWatchlist(data.symbol);
    };

    useEffect(() => {
        const fetchChart = async () => {
            setLoadingChart(true);
            try {
                // Use the existing chart API from project
                const res = await fetch(`http://localhost:3001/api/quote?symbol=${data.symbol}&range=${range}`);
                if (res.ok) {
                    const result = await res.json();
                    if (result.sparkline) {
                        setChartData(result.sparkline);
                    }
                }
            } catch (e) {
                console.error("Chart fetch failed", e);
            } finally {
                setLoadingChart(false);
            }
        };
        fetchChart();
    }, [data.symbol, range]);

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 relative">
            <button
                onClick={onClose}
                className="absolute -top-3 -right-3 md:-right-4 md:-top-4 p-2 bg-slate-800 text-slate-400 hover:text-white rounded-full border border-slate-700 shadow-lg z-10 hover:bg-slate-700 transition-colors"
                title="Close research"
            >
                <X size={20} />
            </button>

            {/* Header Section */}
            <div className="glass-panel p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex-1">
                    <div className="flex items-baseline gap-3">
                        <h2 className="text-3xl font-bold text-white">{data.symbol}</h2>
                        <span className="text-slate-400 text-lg">{data.shortName}</span>
                        {data.isFallback && <span className="text-xs bg-yellow-500/20 text-yellow-500 px-2 py-0.5 rounded">Delayed/Basic</span>}
                    </div>
                    <div className="text-sm text-slate-500 mt-1">Currency: {data.currency}</div>
                </div>

                <div className="flex items-center gap-6">
                    <button
                        onClick={handleAdd}
                        disabled={isAdded}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${isAdded
                                ? 'bg-green-500/20 text-green-400 cursor-default'
                                : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg hover:shadow-blue-500/20'
                            }`}
                    >
                        {isAdded ? (
                            <>
                                <Check size={18} />
                                <span>Watchlisted</span>
                            </>
                        ) : (
                            <>
                                <Plus size={18} />
                                <span>Add to Watchlist</span>
                            </>
                        )}
                    </button>

                    <div className="text-right">
                        <div className="text-4xl font-bold text-white">${data.price.toFixed(2)}</div>
                        <div className={`flex items-center justify-end gap-2 text-lg font-medium ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
                            {isPositive ? <ArrowUp size={24} /> : <ArrowDown size={24} />}
                            {data.change.toFixed(2)} ({data.changePercent.toFixed(2)}%)
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Key Statistics */}
                <div className="glass-panel p-6 lg:col-span-1 space-y-4">
                    <h3 className="text-lg font-semibold text-white mb-4">Key Statistics</h3>

                    <Row label="Open" value={data.open?.toFixed(2)} />
                    <Row label="Prev Close" value={data.prevClose?.toFixed(2)} />
                    <Row label="Day Range" value={`${data.dayLow?.toFixed(2)} - ${data.dayHigh?.toFixed(2)}`} />
                    <Row label="52W Range" value={`${data.fiftyTwoWeekLow?.toFixed(2)} - ${data.fiftyTwoWeekHigh?.toFixed(2)}`} />
                    <Row label="Volume" value={formatCompact(data.volume)} />
                    <Row label="Avg Volume" value={formatCompact(data.avgVolume)} />
                    <Row label="Bid" value={data.bid?.toFixed(2)} />
                    <Row label="Ask" value={data.ask?.toFixed(2)} />
                    <Row label="Market Cap" value={formatCompact(data.marketCap)} />
                    <Row label="P/E Ratio" value={data.peRatio?.toFixed(2)} />
                </div>

                {/* Chart Section */}
                <div className="glass-panel p-6 lg:col-span-2 flex flex-col min-h-[400px]">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-lg font-semibold text-white">Price Chart</h3>
                        <div className="flex gap-2">
                            {['1d', '5d', '1mo', '6mo', '1y', '5y'].map(r => (
                                <button
                                    key={r}
                                    onClick={() => setRange(r)}
                                    className={`px-3 py-1 rounded text-sm transition-colors ${range === r ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
                                >
                                    {r}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="flex-1 w-full min-h-0">
                        {loadingChart ? (
                            <div className="h-full flex items-center justify-center text-slate-500">Loading chart...</div>
                        ) : chartData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={chartData}>
                                    <defs>
                                        <linearGradient id="chartColor" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor={isPositive ? "#22c55e" : "#ef4444"} stopOpacity={0.3} />
                                            <stop offset="95%" stopColor={isPositive ? "#22c55e" : "#ef4444"} stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <XAxis
                                        dataKey="date"
                                        hide
                                    />
                                    <YAxis
                                        domain={['auto', 'auto']}
                                        orientation="right"
                                        tick={{ fill: '#64748b', fontSize: 12 }}
                                        tickFormatter={(val) => val.toFixed(2)}
                                        axisLine={false}
                                        tickLine={false}
                                    />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f8fafc' }}
                                        itemStyle={{ color: '#f8fafc' }}
                                        labelStyle={{ display: 'none' }}
                                        formatter={(value: any) => [`$${Number(value).toFixed(2)}`, 'Price']}
                                    />
                                    <CartesianGrid vertical={false} stroke="#334155" strokeDasharray="3 3" opacity={0.3} />
                                    <Area
                                        type="monotone"
                                        dataKey="price"
                                        stroke={isPositive ? "#22c55e" : "#ef4444"}
                                        fill="url(#chartColor)"
                                        strokeWidth={2}
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex items-center justify-center text-slate-500">No chart data available</div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

const Row = ({ label, value }: { label: string, value: string | undefined | number }) => {
    // Check for null, undefined, or 0 (if 0 is considered missing for things like PE/Bid/Ask, though price can be 0).
    const displayValue = (value === null || value === undefined) ? '-' : value;
    // Special handling for 0 in Bid/Ask/PE which usually means data missing in this context
    const finalValue = (displayValue === 0 || displayValue === '0' || displayValue === '0.00' || displayValue === '$0.00') ? '-' : displayValue;

    return (
        <div className="flex justify-between items-center py-2 border-b border-slate-700/50 last:border-0">
            <span className="text-slate-400">{label}</span>
            <span className="text-white font-medium">{finalValue}</span>
        </div>
    );
};

const formatCompact = (num: number | null | undefined) => {
    if (num === null || num === undefined || num === 0) return '-';
    return new Intl.NumberFormat('en-US', { notation: "compact", maximumFractionDigits: 1 }).format(num);
};

export default StockDetails;
