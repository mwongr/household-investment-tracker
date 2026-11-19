import { useState, useEffect, useRef, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import StockSearch from '../components/StockSearch';
import StockDetails, { type StockData } from '../components/StockDetails';
import StockComparison from '../components/StockComparison';
import { useData } from '../context/DataContext';
import type { WatchlistItem } from '../types';
import { RefreshCw, Trash2, ArrowUp, ArrowDown, ArrowUpDown, LineChart, AlertCircle, Plus, Bookmark } from 'lucide-react';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';

const DEFAULT_QUICK_TICKERS = ['XEQT.TO', 'VFV.TO', 'TD.TO', 'AAPL', 'MSFT', 'NVDA'];

const StockResearch = () => {
    const [searchData, setSearchData] = useState<StockData | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSearch = async (symbol: string) => {
        setLoading(true);
        setError('');
        setSearchData(null);
        window.scrollTo({ top: 0, behavior: 'smooth' });

        try {
            const res = await fetch(`/api/quote-detailed?symbol=${encodeURIComponent(symbol)}`);
            if (!res.ok) {
                if (res.status === 404) throw new Error(`Stock "${symbol}" not found`);
                throw new Error('Failed to fetch quote data');
            }
            const data: StockData = await res.json();
            setSearchData(data);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to fetch quote data');
        } finally {
            setLoading(false);
        }
    };

    const [searchParams] = useSearchParams();
    const urlTicker = searchParams.get('ticker');

    useEffect(() => {
        if (urlTicker) {
            handleSearch(urlTicker);
        }
    }, [urlTicker]);

    const handleClose = () => {
        setSearchData(null);
        setError('');
    };

    const { assets, watchlist, addToWatchlist, removeFromWatchlist, refreshWatchlist } = useData();
    const [newItem, setNewItem] = useState('');
    const [addingItem, setAddingItem] = useState(false);
    const [refreshingWatchlist, setRefreshingWatchlist] = useState(false);

    type SortField = 'ticker' | 'price' | 'changePercent' | 'signal' | 'volume';
    type SortDirection = 'asc' | 'desc';
    const [sortField, setSortField] = useState<SortField>('ticker');
    const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

    const initialRefreshDone = useRef(false);

    // Quick lookup suggestions from user's holdings (falling back to popular benchmarks)
    const quickTickers = useMemo(() => {
        const held = Array.from(new Set(assets.filter(a => a.quantity > 0).map(a => a.ticker.toUpperCase())));
        return held.length > 0 ? held.slice(0, 8) : DEFAULT_QUICK_TICKERS;
    }, [assets]);

    // Auto-refresh watchlist on mount to get accurate prices
    useEffect(() => {
        if (!initialRefreshDone.current && watchlist.length > 0) {
            initialRefreshDone.current = true;
            const refresh = async () => {
                setRefreshingWatchlist(true);
                await refreshWatchlist(false);
                setRefreshingWatchlist(false);
            };
            refresh();
        }
    }, [watchlist.length, refreshWatchlist]);

    const handleAddItem = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newItem.trim()) return;
        setAddingItem(true);
        try {
            await addToWatchlist(newItem.trim().toUpperCase());
            setNewItem('');
        } catch (err) {
            console.error('Failed to add to watchlist', err);
            setError(`Could not add "${newItem.trim().toUpperCase()}". Check symbol or try again.`);
        } finally {
            setAddingItem(false);
        }
    };

    const handleRefreshWatchlist = async () => {
        setRefreshingWatchlist(true);
        await refreshWatchlist(true);
        setRefreshingWatchlist(false);
    };

    const formatVolume = (num: number) => {
        if (!num) return '—';
        if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
        if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
        if (num >= 1e3) return (num / 1e3).toFixed(1) + 'K';
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

    const getSignalWeight = (item: WatchlistItem) => {
        if (item.goldenCross) return 3;
        if (item.signal === 'buy' || (item.rsi !== undefined && item.rsi !== null && item.rsi < 30)) return 2;
        if (item.signal === 'sell' || (item.rsi !== undefined && item.rsi !== null && item.rsi > 70)) return -1;
        return 0;
    };

    const sortedWatchlist = [...watchlist].sort((a, b) => {
        let valA: string | number = '';
        let valB: string | number = '';

        if (sortField === 'signal') {
            valA = getSignalWeight(a);
            valB = getSignalWeight(b);
        } else if (sortField === 'ticker') {
            valA = a.ticker;
            valB = b.ticker;
        } else {
            valA = a[sortField] ?? '';
            valB = b[sortField] ?? '';
        }

        if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
        if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
        return 0;
    });

    const renderSortIcon = (field: SortField) => {
        if (sortField !== field) return <ArrowUpDown size={13} className="text-slate-400" />;
        return sortDirection === 'asc'
            ? <ArrowUp size={13} className="text-blue-400" />
            : <ArrowDown size={13} className="text-blue-400" />;
    };

    return (
        <div className="space-y-8">
            {/* Page Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div className="flex items-center gap-3.5">
                    <div className="p-3 rounded-2xl bg-blue-500/15 border border-blue-500/35 text-blue-400 shadow-sm">
                        <LineChart size={24} />
                    </div>
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Stock Research</h1>
                        <p className="text-sm text-slate-300 mt-0.5">
                            Live quotes, technical signals, watchlist monitoring &amp; performance comparison
                        </p>
                    </div>
                </div>
            </div>

            {/* Search Hero */}
            <StockSearch
                onSearch={handleSearch}
                isLoading={loading}
                quickTickers={quickTickers}
                activeTicker={searchData?.symbol}
            />

            {/* Error Alert */}
            {error && (
                <div className="bg-red-500/15 border border-red-500/40 text-red-400 px-4 py-3.5 rounded-xl flex justify-between items-center gap-4">
                    <div className="flex items-center gap-2.5 text-sm font-medium">
                        <AlertCircle size={18} className="shrink-0" />
                        <span>{error}</span>
                    </div>
                    <button
                        onClick={() => setError('')}
                        className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-red-500/15 hover:bg-red-500/25 text-red-400 transition-colors"
                    >
                        Dismiss
                    </button>
                </div>
            )}

            {/* Selected Stock Research Detail */}
            {searchData && <StockDetails data={searchData} onClose={handleClose} />}

            {/* Watchlist Section */}
            <section className="bg-slate-800/95 border border-slate-700/90 rounded-2xl shadow-xl overflow-hidden">
                {/* Watchlist Toolbar */}
                <div className="p-5 bg-slate-900/70 border-b border-slate-700/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-blue-500/15 border border-blue-500/35 text-blue-400">
                            <Bookmark size={18} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2.5">
                                <h2 className="text-lg font-bold text-white tracking-tight">My Watchlist</h2>
                                <span className="px-2 py-0.5 rounded-full text-xs font-bold font-mono bg-slate-800 border border-slate-700 text-slate-300">
                                    {watchlist.length}
                                </span>
                            </div>
                            <p className="text-xs text-slate-300">Click any row to open full quote &amp; technical analysis</p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <form onSubmit={handleAddItem} className="flex items-center gap-2">
                            <input
                                type="text"
                                className="bg-slate-900 border border-slate-700 text-white placeholder-slate-400 rounded-xl px-3.5 py-2 text-sm font-medium w-40 sm:w-48 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                                placeholder="Add symbol (e.g. AAPL)"
                                value={newItem}
                                onChange={e => setNewItem(e.target.value.toUpperCase())}
                            />
                            <button
                                type="submit"
                                disabled={addingItem || !newItem.trim()}
                                style={{ color: '#ffffff' }}
                                className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-45 disabled:cursor-not-allowed px-3.5 py-2 rounded-xl text-sm font-semibold transition-colors"
                            >
                                <Plus size={15} />
                                <span>{addingItem ? 'Adding...' : 'Add'}</span>
                            </button>
                        </form>

                        <button
                            onClick={handleRefreshWatchlist}
                            disabled={refreshingWatchlist}
                            title="Refresh watchlist prices"
                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 hover:text-white hover:border-slate-500 text-sm font-semibold transition-colors disabled:opacity-50"
                        >
                            <RefreshCw size={14} className={refreshingWatchlist ? 'animate-spin text-blue-400' : ''} />
                            <span className="hidden sm:inline">Refresh</span>
                        </button>
                    </div>
                </div>

                {watchlist.length === 0 ? (
                    <div className="text-center py-14 px-6">
                        <p className="text-slate-300 text-sm font-medium">Your watchlist is empty.</p>
                        <p className="text-slate-400 text-xs mt-1">Add a ticker symbol above to monitor prices, signals, and 52-week ranges.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse min-w-[860px]">
                            <thead className="bg-slate-900/90 border-b border-slate-700/80">
                                <tr>
                                    <th
                                        className={`px-4 py-3.5 text-xs font-bold uppercase tracking-wider cursor-pointer hover:bg-slate-800/70 transition-colors ${sortField === 'ticker' ? 'text-blue-400' : 'text-slate-300'}`}
                                        onClick={() => handleSort('ticker')}
                                    >
                                        <div className="flex items-center gap-1.5">Symbol {renderSortIcon('ticker')}</div>
                                    </th>
                                    <th
                                        className={`px-4 py-3.5 text-xs font-bold uppercase tracking-wider cursor-pointer hover:bg-slate-800/70 transition-colors text-right ${sortField === 'price' ? 'text-blue-400' : 'text-slate-300'}`}
                                        onClick={() => handleSort('price')}
                                    >
                                        <div className="flex items-center justify-end gap-1.5">Price {renderSortIcon('price')}</div>
                                    </th>
                                    <th
                                        className={`px-4 py-3.5 text-xs font-bold uppercase tracking-wider cursor-pointer hover:bg-slate-800/70 transition-colors text-right ${sortField === 'changePercent' ? 'text-blue-400' : 'text-slate-300'}`}
                                        onClick={() => handleSort('changePercent')}
                                    >
                                        <div className="flex items-center justify-end gap-1.5">Change {renderSortIcon('changePercent')}</div>
                                    </th>
                                    <th
                                        className={`px-4 py-3.5 text-xs font-bold uppercase tracking-wider cursor-pointer hover:bg-slate-800/70 transition-colors ${sortField === 'signal' ? 'text-blue-400' : 'text-slate-300'}`}
                                        onClick={() => handleSort('signal')}
                                    >
                                        <div className="flex items-center gap-1.5">Signal {renderSortIcon('signal')}</div>
                                    </th>
                                    <th className="px-4 py-3.5 text-xs font-bold uppercase tracking-wider text-slate-300 min-w-[170px]">
                                        52W Range
                                    </th>
                                    <th
                                        className={`px-4 py-3.5 text-xs font-bold uppercase tracking-wider cursor-pointer hover:bg-slate-800/70 transition-colors text-right ${sortField === 'volume' ? 'text-blue-400' : 'text-slate-300'}`}
                                        onClick={() => handleSort('volume')}
                                    >
                                        <div className="flex items-center justify-end gap-1.5">Volume {renderSortIcon('volume')}</div>
                                    </th>
                                    <th className="px-4 py-3.5 text-xs font-bold uppercase tracking-wider text-slate-300 w-32 text-center">
                                        Trend
                                    </th>
                                    <th className="px-4 py-3.5 w-12 text-center" aria-label="Actions"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-700/50">
                                {sortedWatchlist.map(item => {
                                    const isPos = (item.changePercent ?? 0) >= 0;
                                    const isSelected = searchData?.symbol === item.ticker;
                                    const has52W = item.high52Week != null && item.low52Week != null && item.high52Week > item.low52Week && item.price != null;
                                    const rangePct = has52W
                                        ? Math.min(100, Math.max(0, ((item.price - item.low52Week) / (item.high52Week - item.low52Week)) * 100))
                                        : 50;

                                    return (
                                        <tr
                                            key={item.id}
                                            onClick={() => handleSearch(item.ticker)}
                                            className={`cursor-pointer transition-colors group ${
                                                isSelected
                                                    ? 'bg-blue-500/10 hover:bg-blue-500/15'
                                                    : 'hover:bg-slate-750/60'
                                            }`}
                                        >
                                            <td className="px-4 py-3.5">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-bold font-mono text-white text-sm">{item.ticker}</span>
                                                    {isSelected && (
                                                        <span className="w-2 h-2 rounded-full bg-blue-400 shrink-0" title="Currently viewing" />
                                                    )}
                                                </div>
                                                {item.name && (
                                                    <div className="text-xs text-slate-300 truncate max-w-[175px] mt-0.5">
                                                        {item.name}
                                                    </div>
                                                )}
                                            </td>

                                            <td className="px-4 py-3.5 text-right font-mono tabular-nums font-semibold text-white text-sm">
                                                {item.price != null ? `$${item.price.toFixed(2)}` : '—'}
                                            </td>

                                            <td className="px-4 py-3.5 text-right">
                                                {item.changePercent != null ? (
                                                    <span
                                                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-mono tabular-nums font-bold text-xs border ${
                                                            isPos
                                                                ? 'bg-green-500/15 border-green-500/35 text-green-400'
                                                                : 'bg-red-500/15 border-red-500/35 text-red-400'
                                                        }`}
                                                    >
                                                        {isPos ? '+' : ''}{item.changePercent.toFixed(2)}%
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-400">—</span>
                                                )}
                                            </td>

                                            <td className="px-4 py-3.5">
                                                <div className="flex items-center">
                                                    {item.goldenCross ? (
                                                        <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-blue-500/15 text-blue-400 uppercase border border-blue-500/40 whitespace-nowrap">
                                                            Golden Cross
                                                        </span>
                                                    ) : (item.signal === 'buy' || (item.rsi !== undefined && item.rsi !== null && item.rsi < 30)) ? (
                                                        <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-slate-900/80 text-green-400 uppercase border border-slate-700 whitespace-nowrap">
                                                            Buy Signal
                                                        </span>
                                                    ) : (item.signal === 'sell' || (item.rsi !== undefined && item.rsi !== null && item.rsi > 70)) ? (
                                                        <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-slate-900/80 text-red-400 uppercase border border-slate-700 whitespace-nowrap">
                                                            Sell Signal
                                                        </span>
                                                    ) : typeof item.signal === 'string' ? (
                                                        <span className="px-2.5 py-1 rounded-md text-xs font-semibold bg-slate-900/80 text-slate-300 uppercase border border-slate-700 whitespace-nowrap">
                                                            Neutral
                                                        </span>
                                                    ) : (
                                                        <span className="text-slate-400">—</span>
                                                    )}
                                                </div>
                                            </td>

                                            <td className="px-4 py-3.5">
                                                <div className="space-y-1.5">
                                                    <div className="flex justify-between text-xs font-mono tabular-nums gap-3">
                                                        <span className="text-slate-300">
                                                            {item.low52Week != null ? `$${item.low52Week.toFixed(2)}` : '—'}
                                                        </span>
                                                        <span className="text-white font-semibold">
                                                            {item.high52Week != null ? `$${item.high52Week.toFixed(2)}` : '—'}
                                                        </span>
                                                    </div>
                                                    {has52W && (
                                                        <div className="relative h-1.5 bg-slate-900 border border-slate-700 rounded-full overflow-hidden">
                                                            <div
                                                                className="absolute top-0 left-0 h-full bg-gradient-to-r from-blue-500 to-emerald-400 rounded-full"
                                                                style={{ width: `${rangePct}%` }}
                                                            />
                                                        </div>
                                                    )}
                                                </div>
                                            </td>

                                            <td className="px-4 py-3.5 text-right">
                                                <div className="flex flex-col items-end gap-0.5 font-mono tabular-nums text-xs">
                                                    <span className="text-white font-semibold">{formatVolume(item.volume)}</span>
                                                    <span className="text-slate-400">Avg {formatVolume(item.avgVolume)}</span>
                                                </div>
                                            </td>

                                            <td className="px-4 py-3.5 h-16 w-32">
                                                {item.sparkline && item.sparkline.length > 0 ? (
                                                    <ResponsiveContainer width="100%" height="100%">
                                                        <AreaChart data={item.sparkline}>
                                                            <defs>
                                                                <linearGradient id={`grad-wl-${item.id}`} x1="0" y1="0" x2="0" y2="1">
                                                                    <stop offset="5%" stopColor={isPos ? '#10b981' : '#ef4444'} stopOpacity={0.35} />
                                                                    <stop offset="95%" stopColor={isPos ? '#10b981' : '#ef4444'} stopOpacity={0} />
                                                                </linearGradient>
                                                            </defs>
                                                            <Area
                                                                type="monotone"
                                                                dataKey="price"
                                                                stroke={isPos ? '#10b981' : '#ef4444'}
                                                                strokeWidth={2}
                                                                fill={`url(#grad-wl-${item.id})`}
                                                                isAnimationActive={false}
                                                            />
                                                        </AreaChart>
                                                    </ResponsiveContainer>
                                                ) : (
                                                    <div className="h-full w-full flex items-center justify-center text-xs text-slate-400 italic">
                                                        No chart
                                                    </div>
                                                )}
                                            </td>

                                            <td className="px-4 py-3.5 text-center">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        removeFromWatchlist(item.id);
                                                    }}
                                                    className="p-2 text-slate-400 hover:text-red-400 rounded-lg hover:bg-red-500/15 transition-colors"
                                                    title={`Remove ${item.ticker} from watchlist`}
                                                    aria-label={`Remove ${item.ticker} from watchlist`}
                                                >
                                                    <Trash2 size={15} />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>

            {/* Performance Comparison Tool */}
            <StockComparison />
        </div>
    );
};

export default StockResearch;
