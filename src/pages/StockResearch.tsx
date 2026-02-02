import { useState, useEffect } from 'react';
import StockSearch from '../components/StockSearch';
import StockDetails from '../components/StockDetails';
import ScreenerWidget from '../components/ScreenerWidget';
import { useData } from '../context/DataContext';
import { RefreshCw, Trash2 } from 'lucide-react';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';

const StockResearch = () => {
    const [searchData, setSearchData] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSearch = async (symbol: string) => {
        setLoading(true);
        setError('');
        setSearchData(null);

        try {
            const res = await fetch(`http://localhost:3001/api/quote-detailed?symbol=${symbol}`);
            if (!res.ok) {
                if (res.status === 404) throw new Error('Stock not found');
                throw new Error('Failed to fetch data');
            }
            const data = await res.json();
            setSearchData(data);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        setSearchData(null);
        setError('');
    };

    const { watchlist, addToWatchlist, removeFromWatchlist, refreshWatchlist } = useData();
    const [newItem, setNewItem] = useState('');
    const [addingItem, setAddingItem] = useState(false);
    const [refreshingWatchlist, setRefreshingWatchlist] = useState(false);

    // Auto-refresh watchlist on mount if names are missing (migration)
    useEffect(() => {
        if (watchlist.length > 0 && watchlist.some(item => !item.name)) {
            const refresh = async () => {
                setRefreshingWatchlist(true);
                // The refreshWatchlist function in DataContext needs to be updated too to fetch names
                await refreshWatchlist();
                setRefreshingWatchlist(false);
            };
            refresh();
        }
    }, [watchlist.length, refreshWatchlist]);

    const handleAddItem = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newItem) return;
        setAddingItem(true);
        await addToWatchlist(newItem);
        setNewItem('');
        setAddingItem(false);
    };

    const handleRefreshWatchlist = async () => {
        setRefreshingWatchlist(true);
        await refreshWatchlist();
        setRefreshingWatchlist(false);
    };

    const formatVolume = (num: number) => {
        if (!num) return '-';
        if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
        if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
        return num.toLocaleString();
    };

    return (
        <div className="content-container">
            <h1 className="text-3xl font-bold mb-8 text-white">Stock Research</h1>

            <StockSearch onSearch={handleSearch} isLoading={loading} />

            {error && (
                <div className="bg-red-500/10 border border-red-500/50 text-red-500 p-4 rounded-lg mb-8 text-center flex justify-between items-center">
                    <span>{error}</span>
                    <button onClick={() => setError('')} className="text-red-400 hover:text-red-300">Close</button>
                </div>
            )}

            {searchData && <StockDetails data={searchData} onClose={handleClose} />}

            {/* Watchlist Section */}
            <div className="mb-12">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-white">My Watchlist</h2>
                    <div className="flex gap-2">
                        <form onSubmit={handleAddItem} className="flex gap-2">
                            <input
                                type="text"
                                className="input py-1 px-3 text-sm w-32 md:w-48"
                                placeholder="Add Symbol (e.g. AAPL)"
                                value={newItem}
                                onChange={e => setNewItem(e.target.value)}
                            />
                            <button type="submit" disabled={addingItem} className="btn btn-primary py-1 px-3 text-sm">
                                {addingItem ? 'Adding...' : 'Add'}
                            </button>
                        </form>
                        <button onClick={handleRefreshWatchlist} disabled={refreshingWatchlist} className="btn btn-secondary py-1 px-3 text-sm flex items-center gap-2">
                            <RefreshCw size={14} className={refreshingWatchlist ? 'animate-spin' : ''} />
                        </button>
                    </div>
                </div>

                {watchlist.length === 0 ? (
                    <div className="text-center py-10 bg-slate-800/20 rounded-xl border border-dashed border-slate-700">
                        <p className="text-slate-400 italic text-sm">Your watchlist is empty. Add a symbol to start tracking.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {watchlist.map(item => (
                            <div
                                key={item.id}
                                onClick={() => handleSearch(item.ticker)}
                                className="glass-panel p-4 flex flex-col md:flex-row gap-4 items-center justify-between group md:h-28 cursor-pointer hover:bg-slate-800/50 transition-colors"
                            >
                                <div className="flex-1 min-w-0 grid grid-cols-2 md:grid-cols-4 gap-4 w-full">
                                    {/* Ticker & Price */}
                                    <div className="col-span-1">
                                        <h3 className="text-lg font-bold text-white">{item.ticker}</h3>
                                        {item.name && <p className="text-[10px] text-slate-400 truncate">{item.name}</p>}
                                        <p className="text-xl font-mono text-slate-200">${item.price?.toFixed(2) || '-'}</p>
                                        <p className={`text-xs font-bold ${item.changePercent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                            {item.changePercent >= 0 ? '+' : ''}{item.changePercent?.toFixed(2)}%
                                        </p>
                                    </div>

                                    {/* 52W Range */}
                                    <div className="col-span-1 flex flex-col justify-center">
                                        <p className="text-[10px] text-slate-500 uppercase font-bold">52W High</p>
                                        <p className="text-xs text-white font-mono">${item.high52Week?.toFixed(2) || '-'}</p>
                                        <p className="text-[10px] text-slate-500 uppercase font-bold mt-1">52W Low</p>
                                        <p className="text-xs text-white font-mono">${item.low52Week?.toFixed(2) || '-'}</p>
                                    </div>

                                    {/* Volume */}
                                    <div className="col-span-1 flex flex-col justify-center">
                                        <p className="text-[10px] text-slate-500 uppercase font-bold">Volume</p>
                                        <p className="text-xs text-white font-mono">{formatVolume(item.volume)}</p>
                                        <p className="text-[10px] text-slate-500 uppercase font-bold mt-1">Avg Vol</p>
                                        <p className="text-xs text-slate-400 font-mono">{formatVolume(item.avgVolume)}</p>
                                    </div>

                                    {/* Chart */}
                                    <div className="col-span-1 h-16 w-full">
                                        {item.sparkline && item.sparkline.length > 0 ? (
                                            <ResponsiveContainer width="100%" height="100%">
                                                <AreaChart data={item.sparkline}>
                                                    <defs>
                                                        <linearGradient id={`grad-wl-${item.id}`} x1="0" y1="0" x2="0" y2="1">
                                                            <stop offset="5%" stopColor={item.changePercent >= 0 ? '#10b981' : '#ef4444'} stopOpacity={0.4} />
                                                            <stop offset="95%" stopColor={item.changePercent >= 0 ? '#10b981' : '#ef4444'} stopOpacity={0} />
                                                        </linearGradient>
                                                    </defs>
                                                    <Area
                                                        type="monotone"
                                                        dataKey="price"
                                                        stroke={item.changePercent >= 0 ? '#10b981' : '#ef4444'}
                                                        strokeWidth={2}
                                                        fill={`url(#grad-wl-${item.id})`}
                                                        isAnimationActive={false}
                                                    />
                                                </AreaChart>
                                            </ResponsiveContainer>
                                        ) : (
                                            <div className="h-full w-full flex items-center justify-center text-[10px] text-slate-600 italic">
                                                No Chart
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        removeFromWatchlist(item.id);
                                    }}
                                    className="p-2 text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all absolute top-2 right-2 md:static"
                                    title="Remove"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="mt-12">
                <h2 className="text-2xl font-bold mb-6 text-white text-center md:text-left">Market Screeners (Canada)</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <ScreenerWidget title="Day Gainers" type="day_gainers" />
                    <ScreenerWidget title="Day Losers" type="day_losers" />
                    <ScreenerWidget title="Most Active" type="most_actives" />
                </div>
            </div>
        </div >
    );
};

export default StockResearch;
