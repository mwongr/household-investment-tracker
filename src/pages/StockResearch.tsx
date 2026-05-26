import { useState, useEffect, useRef } from 'react';
import StockSearch from '../components/StockSearch';
import StockDetails from '../components/StockDetails';
import StockComparison from '../components/StockComparison';
import { useData } from '../context/DataContext';
import { RefreshCw, Trash2, ArrowUp, ArrowDown, Minus } from 'lucide-react';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';

const StockResearch = () => {
    const [searchData, setSearchData] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSearch = async (symbol: string) => {
        setLoading(true);
        setError('');
        setSearchData(null);
        window.scrollTo({ top: 0, behavior: 'smooth' });

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
    
    type SortField = 'ticker' | 'price' | 'changePercent' | 'signal' | 'volume';
    type SortDirection = 'asc' | 'desc';
    const [sortField, setSortField] = useState<SortField>('ticker');
    const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

    const initialRefreshDone = useRef(false);

    // Auto-refresh watchlist on mount to get accurate prices
    useEffect(() => {
        if (!initialRefreshDone.current && watchlist.length > 0) {
            initialRefreshDone.current = true;
            const refresh = async () => {
                setRefreshingWatchlist(true);
                // Call without forcing, so it respects the 1-hour limit
                await refreshWatchlist(false);
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
        // Force refresh heavily hits Yahoo API if true
        await refreshWatchlist(true);
        setRefreshingWatchlist(false);
    };

    const formatVolume = (num: number) => {
        if (!num) return '-';
        if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
        if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
        return num.toLocaleString();
    };

    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('asc');
        }
    };

    const getSignalWeight = (item: any) => {
        if (item.goldenCross) return 3;
        if (item.signal === 'buy' || (item.rsi !== undefined && item.rsi !== null && item.rsi < 30)) return 2;
        if (item.signal === 'sell' || (item.rsi !== undefined && item.rsi !== null && item.rsi > 70)) return -1;
        return 0; // neutral
    };

    const sortedWatchlist = [...watchlist].sort((a, b) => {
        let valA: any = a[sortField];
        let valB: any = b[sortField];

        if (sortField === 'signal') {
            valA = getSignalWeight(a);
            valB = getSignalWeight(b);
        } else if (sortField === 'ticker') {
            valA = a.ticker;
            valB = b.ticker;
        }

        if (valA === undefined || valA === null) valA = '';
        if (valB === undefined || valB === null) valB = '';

        if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
        if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
        return 0;
    });

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
                    <div className="overflow-x-auto rounded-xl border border-slate-700/50 bg-slate-900/40">
                        <table className="w-full text-left border-collapse min-w-[800px]">
                            <thead className="bg-slate-800/80 border-b border-slate-700/50">
                                <tr>
                                    <th className="p-4 font-semibold text-slate-300 cursor-pointer hover:bg-slate-700/50 transition-colors" onClick={() => handleSort('ticker')}>
                                        <div className="flex items-center gap-2">Symbol {sortField === 'ticker' ? (sortDirection === 'asc' ? <ArrowUp size={14}/> : <ArrowDown size={14}/>) : <Minus size={14} className="text-slate-600"/>}</div>
                                    </th>
                                    <th className="p-4 font-semibold text-slate-300 cursor-pointer hover:bg-slate-700/50 transition-colors" onClick={() => handleSort('price')}>
                                        <div className="flex items-center gap-2">Price {sortField === 'price' ? (sortDirection === 'asc' ? <ArrowUp size={14}/> : <ArrowDown size={14}/>) : <Minus size={14} className="text-slate-600"/>}</div>
                                    </th>
                                    <th className="p-4 font-semibold text-slate-300 cursor-pointer hover:bg-slate-700/50 transition-colors" onClick={() => handleSort('changePercent')}>
                                        <div className="flex items-center gap-2">Change {sortField === 'changePercent' ? (sortDirection === 'asc' ? <ArrowUp size={14}/> : <ArrowDown size={14}/>) : <Minus size={14} className="text-slate-600"/>}</div>
                                    </th>
                                    <th className="p-4 font-semibold text-slate-300 cursor-pointer hover:bg-slate-700/50 transition-colors" onClick={() => handleSort('signal')}>
                                        <div className="flex items-center gap-2">Signal {sortField === 'signal' ? (sortDirection === 'asc' ? <ArrowUp size={14}/> : <ArrowDown size={14}/>) : <Minus size={14} className="text-slate-600"/>}</div>
                                    </th>
                                    <th className="p-4 font-semibold text-slate-300">52W Range</th>
                                    <th className="p-4 font-semibold text-slate-300 cursor-pointer hover:bg-slate-700/50 transition-colors" onClick={() => handleSort('volume')}>
                                        <div className="flex items-center gap-2">Volume {sortField === 'volume' ? (sortDirection === 'asc' ? <ArrowUp size={14}/> : <ArrowDown size={14}/>) : <Minus size={14} className="text-slate-600"/>}</div>
                                    </th>
                                    <th className="p-4 font-semibold text-slate-300 w-32">Chart</th>
                                    <th className="p-4 font-semibold text-slate-300 w-12 text-center"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {sortedWatchlist.map(item => (
                                    <tr 
                                        key={item.id}
                                        onClick={() => handleSearch(item.ticker)}
                                        className="border-b border-slate-700/30 hover:bg-slate-800/60 cursor-pointer transition-colors group"
                                    >
                                        <td className="p-4">
                                            <div className="font-bold text-white text-base">{item.ticker}</div>
                                            {item.name && <div className="text-[10px] text-slate-400 truncate max-w-[150px]">{item.name}</div>}
                                        </td>
                                        <td className="p-4 font-mono text-slate-200">
                                            ${item.price?.toFixed(2) || '-'}
                                        </td>
                                        <td className={`p-4 font-bold ${item.changePercent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                            {item.changePercent >= 0 ? '+' : ''}{item.changePercent?.toFixed(2)}%
                                        </td>
                                        <td className="p-4">
                                            <div className="flex items-center">
                                                {item.goldenCross ? (
                                                    <span className="px-2 py-1 rounded text-[10px] font-bold bg-blue-500/20 text-blue-400 uppercase border border-blue-500/30 whitespace-nowrap">Golden Cross</span>
                                                ) : (item.signal === 'buy' || (item.rsi !== undefined && item.rsi !== null && item.rsi < 30)) ? (
                                                    <span className="px-2 py-1 rounded text-[10px] font-bold bg-green-500/20 text-green-400 uppercase border border-green-500/30 whitespace-nowrap">Buy Signal</span>
                                                ) : (item.signal === 'sell' || (item.rsi !== undefined && item.rsi !== null && item.rsi > 70)) ? (
                                                    <span className="px-2 py-1 rounded text-[10px] font-bold bg-red-500/20 text-red-400 uppercase border border-red-500/30 whitespace-nowrap">Sell Signal</span>
                                                ) : typeof item.signal === 'string' ? (
                                                    <span className="px-2 py-1 rounded text-[10px] font-bold bg-slate-700/50 text-slate-400 uppercase border border-slate-600/50 whitespace-nowrap">Neutral</span>
                                                ) : <span className="text-slate-500">-</span>}
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex flex-col gap-1">
                                                <div className="flex justify-between text-xs">
                                                    <span className="text-slate-500 pr-2">H</span>
                                                    <span className="text-white font-mono">${item.high52Week?.toFixed(2) || '-'}</span>
                                                </div>
                                                <div className="flex justify-between text-xs">
                                                    <span className="text-slate-500 pr-2">L</span>
                                                    <span className="text-white font-mono">${item.low52Week?.toFixed(2) || '-'}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex flex-col gap-1">
                                                <div className="flex justify-between text-xs">
                                                    <span className="text-slate-500 pr-2">Vol</span>
                                                    <span className="text-white font-mono">{formatVolume(item.volume)}</span>
                                                </div>
                                                <div className="flex justify-between text-xs">
                                                    <span className="text-slate-500 pr-2">Avg</span>
                                                    <span className="text-slate-400 font-mono">{formatVolume(item.avgVolume)}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-4 h-16 w-32">
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
                                                <div className="h-full w-full flex items-center justify-center text-[10px] text-slate-600 italic">No Chart</div>
                                            )}
                                        </td>
                                        <td className="p-4 text-center">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    removeFromWatchlist(item.id);
                                                }}
                                                className="p-2 text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all rounded hover:bg-red-500/10"
                                                title="Remove"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Performance Comparison Tool */}
            <StockComparison />

        </div >
    );
};

export default StockResearch;
