import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
    ArrowLeft,
    Plus,
    RefreshCw,
    X,
    Pencil,
    Trash2,
    Save,
    RotateCcw,
    Wallet,
    ArrowRightLeft,
    Upload,
    Users,
    LayoutGrid,
    LayoutList,
    Table,
    ArrowUpDown,
    ArrowUp,
    ArrowDown,
    ChevronDown,
    ChevronUp,
    Wrench,
} from 'lucide-react';
import { AreaChart, Area, ResponsiveContainer, Tooltip } from 'recharts';
import { useData } from '../context/DataContext';
import { useTheme } from '../context/ThemeContext';
import type { Asset, Transaction, TransactionType } from '../types';

import '../styles/shared.css';
import PortfolioBalancer from '../components/PortfolioBalancer';
import AverageDownCalc from '../components/AverageDownCalc';
import StockDetails, { type StockData } from '../components/StockDetails';
import CurrencyMigrationModal from '../components/CurrencyMigrationModal';
import CsvImportModal from '../components/CsvImportModal';
import AssetSimulators from '../components/AssetSimulators';
import { QuoteStatusBadge, UnknownSymbolsBanner } from '../components/QuoteStatusBadge';

type AssetViewMode = 'table' | 'cards' | 'compact';
type AssetSortField = 'ticker' | 'profit' | 'profitPercent' | 'marketValue' | 'bookCost' | 'averageCost' | 'todayChange';
type SortDirection = 'asc' | 'desc';

const fmt2 = (n: number) =>
    n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const AccountDetails = () => {
    const { id } = useParams<{ id: string }>();
    const {
        accounts,
        getAssetsByAccount,
        addTransaction,
        updateTransaction,
        deleteTransaction,
        renameTicker,
        transactions,
        refreshPrices,
        refreshAsset,
        updateAssetCustomBookCost,
        quoteErrors,
    } = useData();
    const { theme } = useTheme();
    const isDark = theme === 'dark';

    const account = accounts.find(a => a.id === id);
    const assets = getAssetsByAccount(id || '');

    const [isAdding, setIsAdding] = useState(false);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [showMigrationModal, setShowMigrationModal] = useState(false);
    const [activeTab, setActiveTab] = useState<'assets' | 'transactions'>('assets');
    const [editingTxId, setEditingTxId] = useState<string | null>(null);
    const [selectedYear, setSelectedYear] = useState<number | 'All'>(new Date().getFullYear());

    // Rename / Merge Ticker Modal State
    const [renameModalOpen, setRenameModalOpen] = useState(false);
    const [renameOldTicker, setRenameOldTicker] = useState('');
    const [renameNewTicker, setRenameNewTicker] = useState('');
    const [renameNewCurrency, setRenameNewCurrency] = useState<'CAD' | 'USD'>('CAD');

    const openRenameModal = (oldTicker: string, currentCurrency: 'CAD' | 'USD') => {
        setRenameOldTicker(oldTicker);
        setRenameNewTicker(oldTicker);
        setRenameNewCurrency(currentCurrency);
        setRenameModalOpen(true);
    };

    const handleRenameSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!account || !renameOldTicker || !renameNewTicker.trim()) return;
        renameTicker(account.id, renameOldTicker, renameNewTicker.trim().toUpperCase(), renameNewCurrency);
        setRenameModalOpen(false);
    };

    // Transaction Form State
    const [ticker, setTicker] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [type, setType] = useState<TransactionType>('Buy');
    const [shares, setShares] = useState('');
    const [price, setPrice] = useState('');
    const [commission, setCommission] = useState('0');
    const [splitFrom, setSplitFrom] = useState('');
    const [splitTo, setSplitTo] = useState('');

    // Simulators State
    const [simSellPrice, setSimSellPrice] = useState<Record<string, string>>({});
    const [simSellShares, setSimSellShares] = useState<Record<string, string>>({});
    const [simTargetPrice, setSimTargetPrice] = useState<Record<string, string>>({});
    const [simBuyAmount, setSimBuyAmount] = useState<Record<string, string>>({});
    const [simBuyShares, setSimBuyShares] = useState<Record<string, string>>({});

    // Book Cost Editing State
    const [editingBookCostId, setEditingBookCostId] = useState<string | null>(null);
    const [customBookCostInput, setCustomBookCostInput] = useState<Record<string, string>>({});

    // Assets View, Sorting & Tools Dropdown State
    const [assetView, setAssetView] = useState<AssetViewMode>(() => {
        const saved = localStorage.getItem('accountDetails.assetView');
        return saved === 'cards' || saved === 'compact' || saved === 'table' ? saved : 'table';
    });
    const [sortField, setSortField] = useState<AssetSortField>(() => {
        const saved = localStorage.getItem('accountDetails.sortField');
        return saved === 'ticker' ||
            saved === 'profit' ||
            saved === 'profitPercent' ||
            saved === 'marketValue' ||
            saved === 'bookCost' ||
            saved === 'averageCost' ||
            saved === 'todayChange'
            ? saved
            : 'ticker';
    });
    const [sortDirection, setSortDirection] = useState<SortDirection>(() => {
        const saved = localStorage.getItem('accountDetails.sortDirection');
        return saved === 'asc' || saved === 'desc' ? saved : 'asc';
    });
    const [expandedTools, setExpandedTools] = useState<Record<string, boolean>>({});

    useEffect(() => {
        localStorage.setItem('accountDetails.assetView', assetView);
    }, [assetView]);

    useEffect(() => {
        localStorage.setItem('accountDetails.sortField', sortField);
        localStorage.setItem('accountDetails.sortDirection', sortDirection);
    }, [sortField, sortDirection]);

    const toggleAssetTools = (assetId: string) => {
        setExpandedTools(prev => ({ ...prev, [assetId]: !prev[assetId] }));
    };

    const handleSortFieldSelect = (field: AssetSortField) => {
        setSortField(field);
        setSortDirection(field === 'ticker' ? 'asc' : 'desc');
    };

    const handleColumnSort = (field: AssetSortField) => {
        if (sortField === field) {
            setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
        } else {
            setSortField(field);
            setSortDirection(field === 'ticker' ? 'asc' : 'desc');
        }
    };

    // Inline Research State
    const [researchData, setResearchData] = useState<StockData | null>(null);
    const [loadingResearch, setLoadingResearch] = useState(false);

    if (!account) {
        return (
            <div className="bg-slate-800/95 border border-slate-700/90 rounded-2xl p-10 text-center space-y-3">
                <p className="text-lg font-bold text-white">Account not found</p>
                <Link to="/accounts" className="inline-flex items-center gap-2 text-sm font-semibold text-blue-400 hover:underline">
                    <ArrowLeft size={16} /> Back to Accounts
                </Link>
            </div>
        );
    }

    const handleResearchClick = async (symbol: string) => {
        setLoadingResearch(true);
        try {
            const res = await fetch(`/api/quote-detailed?symbol=${encodeURIComponent(symbol)}`);
            if (res.ok) {
                const data: StockData = await res.json();
                setResearchData(data);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoadingResearch(false);
        }
    };

    const handleTransaction = (e: React.FormEvent) => {
        e.preventDefault();

        const isCashTx = type === 'Deposit' || type === 'Withdrawal' || type === 'Interest' || type === 'Fee';
        const isDividendCash = type === 'Dividend' || type === 'Dividend Income';
        const isStockSplit = type === 'Stock Split';

        if (
            (isCashTx && price) ||
            (isDividendCash && ticker && price) ||
            (isStockSplit && ticker && splitFrom && splitTo) ||
            (!isCashTx && !isDividendCash && !isStockSplit && ticker && shares && price)
        ) {
            const qty = shares ? parseFloat(shares) : 0;
            const priceVal = price ? parseFloat(price) : 0;
            const commVal = commission ? parseFloat(commission) : 0;

            let amount = 0;
            let finalPricePerShare = 0;

            if (isCashTx || isDividendCash) {
                amount = priceVal;
                finalPricePerShare = 0;
            } else if (isStockSplit) {
                amount = 0;
                finalPricePerShare = 0;
            } else {
                amount = qty * priceVal + commVal;
                finalPricePerShare = priceVal;
            }

            const txData: Omit<Transaction, 'id'> = {
                accountId: account.id,
                ticker: isCashTx ? '' : ticker.toUpperCase(),
                date,
                type,
                shares: isStockSplit ? 0 : qty,
                pricePerShare: finalPricePerShare,
                commission: commVal,
                amount,
                ...(isStockSplit
                    ? {
                          splitFrom: parseFloat(splitFrom),
                          splitTo: parseFloat(splitTo),
                      }
                    : {}),
            };

            if (editingTxId) {
                updateTransaction(editingTxId, txData);
            } else {
                addTransaction(txData);
            }

            closeForm();
        }
    };

    const handleRefresh = async () => {
        setIsRefreshing(true);
        await refreshPrices();
        setIsRefreshing(false);
    };

    const startEditTx = (tx: Transaction) => {
        setEditingTxId(tx.id);
        setTicker(tx.ticker || '');
        setDate(tx.date ? tx.date.split('T')[0] : '');
        setType(tx.type);
        setShares(tx.shares?.toString() || '');

        if (tx.type === 'Deposit' || tx.type === 'Withdrawal' || tx.type === 'Dividend' || tx.type === 'Dividend Income' || tx.type === 'Interest' || tx.type === 'Fee') {
            setPrice(tx.amount.toString());
        } else if (tx.type === 'Stock Split') {
            setPrice('0');
            setSplitFrom(tx.splitFrom?.toString() || '');
            setSplitTo(tx.splitTo?.toString() || '');
        } else {
            setPrice(tx.pricePerShare?.toString() || '');
        }

        setCommission(tx.commission?.toString() || '0');
        setIsAdding(true);
        setActiveTab('transactions');
    };

    const closeForm = () => {
        setIsAdding(false);
        setEditingTxId(null);
        resetForm();
    };

    const resetForm = () => {
        setTicker('');
        setShares('');
        setPrice('');
        setCommission('0');
        setSplitFrom('');
        setSplitTo('');
        setEditingTxId(null);
    };

    // Calculations
    const totalValue = assets.reduce((sum, asset) => sum + (asset.cadMarketValue || asset.marketValue || 0), 0);
    const totalCost = assets.reduce((sum, asset) => {
        const effectiveBookCost =
            asset.customBookCost !== undefined && asset.customBookCost !== null ? asset.customBookCost : asset.totalCost;
        return sum + effectiveBookCost;
    }, 0);
    const totalProfit = totalValue - totalCost;
    const totalProfitPercent = totalCost > 0 ? (totalProfit / totalCost) * 100 : 0;

    // Transaction activity summary with year filter
    const accountTxs = transactions.filter(tx => tx.accountId === id);
    const txYears = Array.from(new Set(accountTxs.map(tx => new Date(tx.date).getFullYear()))).sort((a, b) => b - a);
    const sortedTxs = [...accountTxs].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const assetCosts: Record<string, { quantity: number; totalCost: number }> = {};
    const realizedGainsPerTx: Record<string, number> = {};

    sortedTxs.forEach(tx => {
        if (!tx.ticker) return;
        const sym = tx.ticker;
        if (!assetCosts[sym]) {
            assetCosts[sym] = { quantity: 0, totalCost: 0 };
        }

        const state = assetCosts[sym];

        if (tx.type === 'Buy' || tx.type === 'DRIP' || tx.type === 'Dividend Reinvested') {
            state.quantity += tx.shares || 0;
            state.totalCost += tx.amount;
        } else if (tx.type === 'Sell') {
            const avgCost = state.quantity > 0 ? state.totalCost / state.quantity : 0;
            const costOfSharesSold = (tx.shares || 0) * avgCost;
            state.quantity -= tx.shares || 0;
            state.totalCost -= costOfSharesSold;

            realizedGainsPerTx[tx.id] = tx.amount - costOfSharesSold;
        } else if (tx.type === 'Stock Split') {
            if (tx.splitFrom && tx.splitTo) {
                state.quantity = (state.quantity * tx.splitTo) / tx.splitFrom;
            } else {
                state.quantity += tx.shares || 0;
            }
        }
    });

    const filteredTxs =
        selectedYear === 'All' ? accountTxs : accountTxs.filter(tx => new Date(tx.date).getFullYear() === selectedYear);
    const txSummary = filteredTxs.reduce(
        (acc, tx) => {
            if (tx.type === 'Deposit') acc.deposits += tx.amount;
            else if (tx.type === 'Withdrawal') acc.withdrawals += tx.amount;
            else if (tx.type === 'Buy' || tx.type === 'Dividend Reinvested' || tx.type === 'DRIP') acc.buys += tx.amount;
            else if (tx.type === 'Sell') {
                acc.sells += tx.amount;
                acc.realizedGains += realizedGainsPerTx[tx.id] || 0;
            } else if (tx.type === 'Dividend Income' || tx.type === 'Dividend') acc.dividends += tx.amount;
            return acc;
        },
        { deposits: 0, withdrawals: 0, buys: 0, sells: 0, dividends: 0, realizedGains: 0 }
    );

    const tooltipContentStyle = {
        backgroundColor: isDark ? '#0f172a' : '#ffffff',
        borderColor: isDark ? '#334155' : '#cbd5e1',
        borderRadius: '0.75rem',
        color: isDark ? '#f8fafc' : '#0f172a',
        fontSize: '12px',
        padding: '8px 10px',
    };

    const tooltipItemStyle = {
        color: isDark ? '#f8fafc' : '#0f172a',
        fontWeight: 700,
        fontFamily: 'monospace',
    };

    const getEffectiveBookCost = (asset: Asset) =>
        asset.customBookCost !== undefined && asset.customBookCost !== null ? asset.customBookCost : asset.totalCost;

    const getImpliedAvgCost = (asset: Asset) => {
        const effectiveBookCost = getEffectiveBookCost(asset);
        return asset.quantity > 0 ? effectiveBookCost / asset.quantity : asset.averageCost;
    };

    const sortedAssets = [...assets].sort((a, b) => {
        const dir = sortDirection === 'asc' ? 1 : -1;
        switch (sortField) {
            case 'ticker':
                return a.ticker.localeCompare(b.ticker) * dir;
            case 'profit':
                return (a.profit - b.profit) * dir;
            case 'profitPercent':
                return (a.profitPercent - b.profitPercent) * dir;
            case 'marketValue':
                return (a.marketValue - b.marketValue) * dir;
            case 'bookCost':
                return (getEffectiveBookCost(a) - getEffectiveBookCost(b)) * dir;
            case 'averageCost':
                return (getImpliedAvgCost(a) - getImpliedAvgCost(b)) * dir;
            case 'todayChange':
                return ((a.todayChangePercent || 0) - (b.todayChangePercent || 0)) * dir;
            default:
                return 0;
        }
    });

    const renderSortIcon = (field: AssetSortField) => {
        if (sortField !== field) return <ArrowUpDown size={12} className="opacity-40" />;
        return sortDirection === 'asc' ? (
            <ArrowUp size={12} className="text-blue-400" />
        ) : (
            <ArrowDown size={12} className="text-blue-400" />
        );
    };

    const renderSignalBadge = (asset: Asset, size: 'normal' | 'sm' = 'normal') => {
        const badgeClasses = size === 'sm'
            ? 'px-1.5 py-0.5 rounded text-[10px] font-bold uppercase whitespace-nowrap'
            : 'px-2 py-0.5 rounded text-xs font-bold uppercase whitespace-nowrap';
        const neutralClasses = size === 'sm'
            ? 'px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase whitespace-nowrap'
            : 'px-2 py-0.5 rounded text-xs font-semibold uppercase whitespace-nowrap';

        if (asset.goldenCross) {
            return (
                <span className={`${badgeClasses} bg-blue-500/15 text-blue-400 border border-blue-500/35`}>
                    Golden Cross
                </span>
            );
        }
        if (asset.signal === 'buy' || (asset.rsi !== undefined && asset.rsi !== null && asset.rsi < 30)) {
            return (
                <span className={`${badgeClasses} bg-slate-900/80 text-green-400 border border-slate-700`}>
                    Buy Signal
                </span>
            );
        }
        if (asset.signal === 'sell' || (asset.rsi !== undefined && asset.rsi !== null && asset.rsi > 70)) {
            return (
                <span className={`${badgeClasses} bg-slate-900/80 text-red-400 border border-slate-700`}>
                    Sell Signal
                </span>
            );
        }
        if (typeof asset.signal === 'string') {
            return (
                <span className={`${neutralClasses} bg-slate-800 text-slate-300 border border-slate-700`}>
                    Neutral
                </span>
            );
        }
        return null;
    };

    const renderBookCost = (asset: Asset, size: 'lg' | 'sm' = 'lg', align: 'center' | 'right' | 'left' = 'center') => {
        const effectiveBookCost = getEffectiveBookCost(asset);
        const justifyClass =
            align === 'right' ? 'justify-end' : align === 'center' ? 'md:justify-center' : 'justify-start';
        const textSizeClass = size === 'lg' ? 'text-xl sm:text-2xl' : 'text-sm';

        if (editingBookCostId === asset.id) {
            return (
                <div className={`flex flex-col ${align === 'right' ? 'items-end' : align === 'center' ? 'items-center' : 'items-start'}`}>
                    <div className={`flex items-center ${justifyClass} gap-1.5`}>
                        <input
                            type="number"
                            step="any"
                            className="w-28 bg-slate-900 border border-blue-500 rounded-lg px-2 py-1 text-sm text-white font-mono focus:outline-none input-no-spinner"
                            value={customBookCostInput[asset.id] || ''}
                            onChange={e =>
                                setCustomBookCostInput({
                                    ...customBookCostInput,
                                    [asset.id]: e.target.value,
                                })
                            }
                            autoFocus
                        />
                        <button
                            onClick={() => {
                                const rawInput = customBookCostInput[asset.id];
                                const cleaned = rawInput ? rawInput.toString().replace(/[,$]/g, '') : '';
                                const value = parseFloat(cleaned);

                                if (!isNaN(value) && value >= 0) {
                                    updateAssetCustomBookCost(asset.id, value);
                                } else {
                                    alert('Please enter a valid number (e.g. 18240.08)');
                                }
                                setEditingBookCostId(null);
                            }}
                            className="p-1.5 bg-green-500/15 hover:bg-green-500/25 rounded-lg text-green-400 transition-colors"
                            title="Save custom book cost"
                        >
                            <Save size={15} />
                        </button>
                        <button
                            onClick={() => {
                                setEditingBookCostId(null);
                                setCustomBookCostInput({
                                    ...customBookCostInput,
                                    [asset.id]: '',
                                });
                            }}
                            className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 hover:text-white transition-colors"
                            title="Cancel"
                        >
                            <X size={15} />
                        </button>
                        {asset.customBookCost !== undefined && asset.customBookCost !== null && (
                            <button
                                onClick={() => {
                                    updateAssetCustomBookCost(asset.id, null);
                                    setEditingBookCostId(null);
                                    setCustomBookCostInput({
                                        ...customBookCostInput,
                                        [asset.id]: '',
                                    });
                                }}
                                className="p-1.5 bg-red-500/15 hover:bg-red-500/25 rounded-lg text-red-400 transition-colors"
                                title="Reset to calculated"
                            >
                                <RotateCcw size={15} />
                            </button>
                        )}
                    </div>
                    {(() => {
                        const rawVal = parseFloat((customBookCostInput[asset.id] || '').replace(/[,$]/g, ''));
                        if (!isNaN(rawVal) && rawVal > 0 && asset.quantity > 0) {
                            return (
                                <p className="text-[11px] text-blue-400 font-mono mt-1">
                                    ≈ ${fmt2(rawVal / asset.quantity)} / share
                                </p>
                            );
                        }
                        return null;
                    })()}
                </div>
            );
        }

        return (
            <div className={`flex items-center ${justifyClass} gap-1.5`}>
                <p className={`${textSizeClass} font-mono tabular-nums font-bold text-slate-200`}>
                    ${fmt2(effectiveBookCost)}
                </p>
                <button
                    onClick={() => {
                        setEditingBookCostId(asset.id);
                        setCustomBookCostInput({
                            ...customBookCostInput,
                            [asset.id]: effectiveBookCost.toString(),
                        });
                    }}
                    className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
                    title="Edit book cost"
                >
                    <Pencil size={13} />
                </button>
            </div>
        );
    };

    const render52WStats = (asset: Asset) => (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 bg-slate-900/60 border border-slate-700/70 p-3.5 rounded-xl">
            <div>
                <p className="text-xs text-slate-300 font-bold uppercase tracking-wider mb-1">52W High</p>
                <p className="font-mono tabular-nums text-white text-base font-bold">
                    {asset.high52Week ? `$${asset.high52Week.toFixed(2)}` : '—'}
                </p>
            </div>
            <div>
                <p className="text-xs text-slate-300 font-bold uppercase tracking-wider mb-1">52W Low</p>
                <p className="font-mono tabular-nums text-white text-base font-bold">
                    {asset.low52Week ? `$${asset.low52Week.toFixed(2)}` : '—'}
                </p>
            </div>
            <div className="col-span-2 sm:col-span-1">
                <p className="text-xs text-slate-300 font-bold uppercase tracking-wider mb-1.5">% to 52W High</p>
                <div className="flex items-center gap-2.5">
                    <div className="flex-1 h-2 bg-slate-800 border border-slate-700 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-blue-500 rounded-full"
                            style={{
                                width: `${Math.max(
                                    0,
                                    Math.min(100, (asset.currentPrice / (asset.high52Week || 1)) * 100)
                                )}%`,
                            }}
                        />
                    </div>
                    <span className="text-xs text-white font-mono tabular-nums font-bold">
                        {asset.high52Week ? `${(100 - (asset.currentPrice / asset.high52Week) * 100).toFixed(1)}%` : '—'}
                    </span>
                </div>
            </div>
        </div>
    );

    const renderSparkline = (asset: Asset, heightClass = 'h-24') => (
        <div className="bg-slate-900/65 rounded-xl p-3.5 border border-slate-700/80 flex flex-col justify-between">
            <div className="flex justify-between items-center mb-2">
                <p className="text-xs text-slate-300 font-bold uppercase tracking-wider">
                    {asset.chartRange || '1MO'} Trend
                </p>
                <div className="flex gap-1">
                    {['1mo', '3mo', '1y', '5y'].map(range => {
                        const isActiveRange = asset.chartRange === range || (!asset.chartRange && range === '1mo');
                        return (
                            <button
                                key={range}
                                onClick={e => {
                                    e.preventDefault();
                                    refreshAsset(asset.id, range);
                                }}
                                style={isActiveRange ? { color: '#ffffff' } : undefined}
                                className={`text-[11px] px-1.5 py-0.5 rounded-md uppercase font-bold transition-colors ${
                                    isActiveRange
                                        ? 'bg-blue-600'
                                        : 'text-slate-300 hover:text-white hover:bg-slate-800'
                                }`}
                            >
                                {range}
                            </button>
                        );
                    })}
                </div>
            </div>
            <div
                className={`w-full ${heightClass} cursor-pointer hover:opacity-85 transition-opacity`}
                onClick={() => handleResearchClick(asset.ticker)}
                title="Click to view detailed chart and research"
            >
                {asset.sparkline && asset.sparkline.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={asset.sparkline} style={{ cursor: 'pointer' }}>
                            <defs>
                                <linearGradient id={`grad-${asset.id}`} x1="0" y1="0" x2="0" y2="1">
                                    <stop
                                        offset="5%"
                                        stopColor={asset.todayChangePercent >= 0 ? '#10b981' : '#ef4444'}
                                        stopOpacity={0.35}
                                    />
                                    <stop
                                        offset="95%"
                                        stopColor={asset.todayChangePercent >= 0 ? '#10b981' : '#ef4444'}
                                        stopOpacity={0}
                                    />
                                </linearGradient>
                            </defs>
                            <Tooltip
                                cursor={{ stroke: isDark ? '#64748b' : '#94a3b8', strokeWidth: 1 }}
                                contentStyle={tooltipContentStyle}
                                itemStyle={tooltipItemStyle}
                                formatter={value => [`$${fmt2(Number(value))}`, 'Price']}
                                labelStyle={{ display: 'none' }}
                            />
                            <Area
                                type="monotone"
                                dataKey="price"
                                stroke={asset.todayChangePercent >= 0 ? '#10b981' : '#ef4444'}
                                strokeWidth={2}
                                fillOpacity={1}
                                fill={`url(#grad-${asset.id})`}
                                isAnimationActive={false}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-slate-300 text-xs text-center gap-1">
                        <RotateCcw size={16} className="text-slate-400" />
                        <span>Click &ldquo;Refresh Prices&rdquo; to load chart</span>
                    </div>
                )}
            </div>
        </div>
    );

    const renderSimulators = (asset: Asset, stacked = false) => (
        <AssetSimulators
            asset={asset}
            effectiveBookCost={getEffectiveBookCost(asset)}
            impliedAvgCost={getImpliedAvgCost(asset)}
            simTargetPrice={simTargetPrice[asset.id] || ''}
            onSimTargetPriceChange={val => setSimTargetPrice(prev => ({ ...prev, [asset.id]: val }))}
            simSellPrice={simSellPrice[asset.id] || ''}
            onSimSellPriceChange={val => setSimSellPrice(prev => ({ ...prev, [asset.id]: val }))}
            simSellShares={simSellShares[asset.id] || ''}
            onSimSellSharesChange={val => setSimSellShares(prev => ({ ...prev, [asset.id]: val }))}
            simBuyAmount={simBuyAmount[asset.id] || ''}
            onSimBuyAmountChange={val => setSimBuyAmount(prev => ({ ...prev, [asset.id]: val }))}
            simBuyShares={simBuyShares[asset.id] || ''}
            onSimBuySharesChange={val => setSimBuyShares(prev => ({ ...prev, [asset.id]: val }))}
            stacked={stacked}
        />
    );

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                    <Link
                        to="/accounts"
                        className="p-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 hover:text-white hover:border-slate-500 transition-colors"
                        title="Back to Accounts"
                        aria-label="Back to Accounts"
                    >
                        <ArrowLeft size={18} />
                    </Link>
                    <div>
                        <div className="flex flex-wrap items-center gap-2.5">
                            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">{account.name}</h1>
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-800 border border-slate-700 text-slate-200">
                                {account.type}
                            </span>
                        </div>
                        <p className="text-sm text-slate-300 mt-0.5">
                            Available Cash:{' '}
                            <span className="font-mono font-bold text-green-400">
                                ${fmt2(account.cashBalance)}
                            </span>
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap gap-2.5">
                    <button
                        onClick={handleRefresh}
                        disabled={isRefreshing}
                        style={{ color: '#ffffff' }}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-xl text-sm font-semibold shadow-sm transition-colors"
                    >
                        <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />
                        <span>{isRefreshing ? 'Refreshing...' : 'Refresh Prices'}</span>
                    </button>
                    <button
                        onClick={() => setShowMigrationModal(true)}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-750 text-slate-200 hover:text-white rounded-xl text-sm font-semibold transition-colors border border-slate-700 hover:border-slate-500"
                        title="Migrate CAD asset to USD"
                    >
                        <ArrowRightLeft size={16} />
                        <span>Migrate Currency</span>
                    </button>
                </div>
            </div>

            <UnknownSymbolsBanner quoteErrors={quoteErrors} tickers={assets.map((a) => a.ticker)} />

            {/* Account Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                <div className="bg-slate-800/95 border border-slate-700/90 rounded-2xl p-5 shadow-xl">
                    <p className="text-xs text-slate-300 font-bold uppercase tracking-wider mb-1.5">Total Value</p>
                    <p className="text-2xl sm:text-3xl font-bold text-white font-mono tabular-nums">
                        ${fmt2(totalValue)}
                    </p>
                </div>
                <div className="bg-slate-800/95 border border-slate-700/90 rounded-2xl p-5 shadow-xl">
                    <p className="text-xs text-slate-300 font-bold uppercase tracking-wider mb-1.5">Total Cost</p>
                    <p className="text-2xl sm:text-3xl font-bold text-slate-200 font-mono tabular-nums">
                        ${fmt2(totalCost)}
                    </p>
                </div>
                <div className="bg-slate-800/95 border border-slate-700/90 rounded-2xl p-5 shadow-xl">
                    <p className="text-xs text-slate-300 font-bold uppercase tracking-wider mb-1.5">Total Profit</p>
                    <p
                        className={`text-2xl sm:text-3xl font-bold font-mono tabular-nums ${
                            totalProfit >= 0 ? 'text-green-400' : 'text-red-400'
                        }`}
                    >
                        {totalProfit >= 0 ? '+' : '-'}${fmt2(Math.abs(totalProfit))}
                    </p>
                </div>
                <div className="bg-slate-800/95 border border-slate-700/90 rounded-2xl p-5 shadow-xl">
                    <p className="text-xs text-slate-300 font-bold uppercase tracking-wider mb-1.5">Total Return</p>
                    <p
                        className={`text-2xl sm:text-3xl font-bold font-mono tabular-nums ${
                            totalProfitPercent >= 0 ? 'text-green-400' : 'text-red-400'
                        }`}
                    >
                        {totalProfitPercent >= 0 ? '+' : ''}
                        {totalProfitPercent.toFixed(2)}%
                    </p>
                </div>
                <div className="bg-slate-800/95 border border-blue-500/40 rounded-2xl p-5 shadow-xl">
                    <div className="flex items-center justify-between mb-1.5">
                        <p className="text-xs text-blue-400 font-bold uppercase tracking-wider">Available Cash</p>
                        <Wallet size={16} className="text-blue-400" />
                    </div>
                    <p className="text-2xl sm:text-3xl font-bold text-white font-mono tabular-nums">
                        ${fmt2(account.cashBalance)}
                    </p>
                </div>
            </div>

            {/* Transaction Activity Summary */}
            <div className="bg-slate-800/95 border border-slate-700/90 rounded-2xl p-5 shadow-xl space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                        Transaction Activity
                    </span>
                    <div className="flex items-center gap-1 bg-slate-900 border border-slate-700/90 p-1 rounded-xl flex-wrap">
                        {txYears.map(yr => (
                            <button
                                key={yr}
                                onClick={() => setSelectedYear(yr)}
                                style={selectedYear === yr ? { color: '#ffffff' } : undefined}
                                className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
                                    selectedYear === yr
                                        ? 'bg-blue-600 shadow-sm'
                                        : 'text-slate-300 hover:text-white hover:bg-slate-800'
                                }`}
                            >
                                {yr}
                            </button>
                        ))}
                        <button
                            onClick={() => setSelectedYear('All')}
                            style={selectedYear === 'All' ? { color: '#ffffff' } : undefined}
                            className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
                                selectedYear === 'All'
                                    ? 'bg-blue-600 shadow-sm'
                                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                            }`}
                        >
                            All Time
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                    <div className="bg-slate-900/75 rounded-xl p-3.5 border border-green-500/25">
                        <p className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-1">Deposits</p>
                        <p className="text-lg font-bold font-mono tabular-nums text-green-400">
                            ${fmt2(txSummary.deposits)}
                        </p>
                    </div>
                    <div className="bg-slate-900/75 rounded-xl p-3.5 border border-red-500/25">
                        <p className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-1">Withdrawals</p>
                        <p className="text-lg font-bold font-mono tabular-nums text-red-400">
                            ${fmt2(txSummary.withdrawals)}
                        </p>
                    </div>
                    <div className="bg-slate-900/75 rounded-xl p-3.5 border border-blue-500/25">
                        <p className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-1">Buys</p>
                        <p className="text-lg font-bold font-mono tabular-nums text-blue-400">
                            ${fmt2(txSummary.buys)}
                        </p>
                    </div>
                    <div className="bg-slate-900/75 rounded-xl p-3.5 border border-red-500/25">
                        <p className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-1">Sells</p>
                        <p className="text-lg font-bold font-mono tabular-nums text-red-400">
                            ${fmt2(txSummary.sells)}
                        </p>
                    </div>
                    <div className="bg-slate-900/75 rounded-xl p-3.5 border border-amber-500/25">
                        <p className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-1">Dividends</p>
                        <p className="text-lg font-bold font-mono tabular-nums text-amber-400">
                            ${fmt2(txSummary.dividends)}
                        </p>
                    </div>
                    <div
                        className={`bg-slate-900/75 rounded-xl p-3.5 border ${
                            txSummary.realizedGains >= 0 ? 'border-green-500/25' : 'border-red-500/25'
                        }`}
                    >
                        <p className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-1">Realized P/L</p>
                        <p
                            className={`text-lg font-bold font-mono tabular-nums ${
                                txSummary.realizedGains >= 0 ? 'text-green-400' : 'text-red-400'
                            }`}
                        >
                            {txSummary.realizedGains >= 0 ? '+' : '-'}${fmt2(Math.abs(txSummary.realizedGains))}
                        </p>
                    </div>
                </div>
            </div>

            {/* Actions Bar & Navigation */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3">
                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex bg-slate-900 border border-slate-700/90 p-1 rounded-xl">
                        <button
                            style={activeTab === 'assets' ? { color: '#ffffff' } : undefined}
                            className={`px-5 py-2 rounded-lg text-sm font-bold transition-colors ${
                                activeTab === 'assets'
                                    ? 'bg-blue-600 shadow-sm'
                                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                            }`}
                            onClick={() => setActiveTab('assets')}
                        >
                            Assets ({assets.length})
                        </button>
                        <button
                            style={activeTab === 'transactions' ? { color: '#ffffff' } : undefined}
                            className={`px-5 py-2 rounded-lg text-sm font-bold transition-colors ${
                                activeTab === 'transactions'
                                    ? 'bg-blue-600 shadow-sm'
                                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                            }`}
                            onClick={() => setActiveTab('transactions')}
                        >
                            Transactions ({accountTxs.length})
                        </button>
                    </div>

                    {activeTab === 'assets' && (
                        <>
                            {/* View Switcher */}
                            <div
                                className="flex bg-slate-900 border border-slate-700/90 p-1 rounded-xl"
                                role="group"
                                aria-label="Asset view mode"
                            >
                                <button
                                    type="button"
                                    style={assetView === 'table' ? { color: '#ffffff' } : undefined}
                                    onClick={() => setAssetView('table')}
                                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                                        assetView === 'table'
                                            ? 'bg-blue-600 shadow-sm'
                                            : 'text-slate-300 hover:text-white hover:bg-slate-800'
                                    }`}
                                    title="Table View"
                                >
                                    <Table size={14} />
                                    <span>Table</span>
                                </button>
                                <button
                                    type="button"
                                    style={assetView === 'cards' ? { color: '#ffffff' } : undefined}
                                    onClick={() => setAssetView('cards')}
                                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                                        assetView === 'cards'
                                            ? 'bg-blue-600 shadow-sm'
                                            : 'text-slate-300 hover:text-white hover:bg-slate-800'
                                    }`}
                                    title="Full Card View"
                                >
                                    <LayoutGrid size={14} />
                                    <span>Cards</span>
                                </button>
                                <button
                                    type="button"
                                    style={assetView === 'compact' ? { color: '#ffffff' } : undefined}
                                    onClick={() => setAssetView('compact')}
                                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                                        assetView === 'compact'
                                            ? 'bg-blue-600 shadow-sm'
                                            : 'text-slate-300 hover:text-white hover:bg-slate-800'
                                    }`}
                                    title="Compact Card View"
                                >
                                    <LayoutList size={14} />
                                    <span>Compact</span>
                                </button>
                            </div>

                            {/* Sort Controls */}
                            <div className="flex items-center bg-slate-900 border border-slate-700/90 rounded-xl p-1 gap-1">
                                <span className="pl-2 text-slate-400" title="Sort assets">
                                    <ArrowUpDown size={14} />
                                </span>
                                <select
                                    aria-label="Sort assets by"
                                    value={sortField}
                                    onChange={e => handleSortFieldSelect(e.target.value as AssetSortField)}
                                    className="bg-transparent text-slate-200 text-xs font-bold py-1.5 pr-2 focus:outline-none cursor-pointer"
                                >
                                    <option value="ticker" className="bg-slate-900 text-white">
                                        Alphabetical
                                    </option>
                                    <option value="profit" className="bg-slate-900 text-white">
                                        Profit / Loss ($)
                                    </option>
                                    <option value="profitPercent" className="bg-slate-900 text-white">
                                        Return (%)
                                    </option>
                                    <option value="marketValue" className="bg-slate-900 text-white">
                                        Market Value
                                    </option>
                                    <option value="bookCost" className="bg-slate-900 text-white">
                                        Book Cost
                                    </option>
                                    <option value="averageCost" className="bg-slate-900 text-white">
                                        Avg. Cost
                                    </option>
                                    <option value="todayChange" className="bg-slate-900 text-white">
                                        Today&apos;s Change (%)
                                    </option>
                                </select>
                                <button
                                    type="button"
                                    onClick={() => setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'))}
                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-bold transition-colors"
                                    title={sortDirection === 'asc' ? 'Ascending (click to reverse)' : 'Descending (click to reverse)'}
                                    aria-label="Toggle sort direction"
                                >
                                    {sortDirection === 'asc' ? <ArrowUp size={13} /> : <ArrowDown size={13} />}
                                    <span>{sortDirection === 'asc' ? 'Asc' : 'Desc'}</span>
                                </button>
                            </div>
                        </>
                    )}
                </div>

                <div className="flex items-center gap-2.5 self-end lg:self-auto">
                    <button
                        type="button"
                        className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white rounded-xl text-sm font-semibold shadow-sm transition-colors"
                        onClick={() => setIsImportModalOpen(true)}
                    >
                        <Upload size={18} className="text-blue-400" /> Import CSV
                    </button>
                    <button
                        style={{ color: '#ffffff' }}
                        className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 rounded-xl text-sm font-semibold shadow-sm transition-colors"
                        onClick={() => setIsAdding(true)}
                    >
                        <Plus size={18} /> Add Transaction
                    </button>
                </div>
            </div>

            {/* Add Transaction Modal */}
            {isAdding && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-sm p-4">
                    <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-2xl p-6 shadow-2xl animate-in fade-in zoom-in duration-200">
                        <div className="flex justify-between items-center mb-5 pb-4 border-b border-slate-700/80">
                            <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                {editingTxId ? (
                                    <Pencil size={20} className="text-blue-400" />
                                ) : (
                                    <Plus size={20} className="text-blue-400" />
                                )}
                                {editingTxId ? 'Edit Transaction' : 'Add Transaction'}
                            </h3>
                            <button
                                onClick={closeForm}
                                className="p-1.5 bg-slate-900 border border-slate-700 hover:border-slate-500 rounded-lg text-slate-300 hover:text-white transition-colors"
                                aria-label="Close modal"
                            >
                                <X size={18} />
                            </button>
                        </div>
                        <form onSubmit={handleTransaction} className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <div>
                                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block mb-1.5">
                                    Type
                                </label>
                                <select
                                    className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl px-3.5 py-2.5 text-sm font-medium focus:outline-none focus:border-blue-500"
                                    value={type}
                                    onChange={e => {
                                        const newType = e.target.value as TransactionType;
                                        setType(newType);
                                        if (newType === 'Deposit' || newType === 'Withdrawal' || newType === 'Interest' || newType === 'Fee') {
                                            setTicker('');
                                            setShares('');
                                            setPrice('');
                                            setCommission('0');
                                        }
                                    }}
                                >
                                    <option value="Buy">Buy</option>
                                    <option value="Sell">Sell</option>
                                    <option value="Deposit">Deposit</option>
                                    <option value="Withdrawal">Withdrawal</option>
                                    <option value="Dividend Income">Dividend Income</option>
                                    <option value="Dividend Reinvested">Dividend Reinvested</option>
                                    <option value="Interest">Interest</option>
                                    <option value="Fee">Fee</option>
                                    <option value="Stock Split">Stock Split</option>
                                    {type === 'Dividend' && <option value="Dividend">Dividend (Legacy)</option>}
                                    {type === 'DRIP' && <option value="DRIP">DRIP (Legacy)</option>}
                                </select>
                            </div>

                            <div>
                                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block mb-1.5">
                                    Date
                                </label>
                                <input
                                    type="date"
                                    className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl px-3.5 py-2.5 text-sm font-mono focus:outline-none focus:border-blue-500"
                                    value={date}
                                    onChange={e => setDate(e.target.value)}
                                    required
                                />
                            </div>

                            {type === 'Deposit' || type === 'Withdrawal' ? (
                                <div className="col-span-full">
                                    <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block mb-1.5">
                                        Amount ($)
                                    </label>
                                    <input
                                        type="number"
                                        step="any"
                                        className="input-no-spinner w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-lg font-mono font-bold text-green-400 focus:outline-none focus:border-blue-500"
                                        placeholder="0.00"
                                        value={price}
                                        onChange={e => setPrice(e.target.value)}
                                        required
                                        autoFocus
                                    />
                                    <p className="text-xs text-slate-300 mt-2">
                                        {type === 'Deposit'
                                            ? 'Add cash to your account balance.'
                                            : 'Remove cash from your account balance.'}
                                    </p>
                                </div>
                            ) : type === 'Dividend' || type === 'Dividend Income' ? (
                                <>
                                    <div>
                                        <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block mb-1.5">
                                            Ticker Symbol
                                        </label>
                                        <input
                                            type="text"
                                            className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl px-3.5 py-2.5 text-sm font-mono font-bold uppercase focus:outline-none focus:border-blue-500"
                                            placeholder="e.g. AAPL"
                                            value={ticker}
                                            onChange={e => setTicker(e.target.value.toUpperCase())}
                                            required
                                            autoFocus
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block mb-1.5">
                                            Dividend Amount Total ($)
                                        </label>
                                        <input
                                            type="number"
                                            step="any"
                                            className="input-no-spinner w-full bg-slate-900 border border-slate-700 text-white rounded-xl px-3.5 py-2.5 text-sm font-mono focus:outline-none focus:border-blue-500"
                                            placeholder="0.00"
                                            value={price}
                                            onChange={e => setPrice(e.target.value)}
                                            required
                                        />
                                    </div>
                                </>
                            ) : type === 'Stock Split' ? (
                                <>
                                    <div className="col-span-full">
                                        <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block mb-1.5">
                                            Ticker Symbol
                                        </label>
                                        <input
                                            type="text"
                                            className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl px-3.5 py-2.5 text-sm font-mono font-bold uppercase focus:outline-none focus:border-blue-500"
                                            placeholder="e.g. AAPL"
                                            value={ticker}
                                            onChange={e => setTicker(e.target.value.toUpperCase())}
                                            required
                                            autoFocus
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block mb-1.5">
                                            Old Shares (From)
                                        </label>
                                        <input
                                            type="number"
                                            step="any"
                                            min="0.0001"
                                            className="input-no-spinner w-full bg-slate-900 border border-slate-700 text-white rounded-xl px-3.5 py-2.5 text-sm font-mono focus:outline-none focus:border-blue-500"
                                            placeholder="e.g. 3"
                                            value={splitFrom}
                                            onChange={e => setSplitFrom(e.target.value)}
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block mb-1.5">
                                            New Shares (To)
                                        </label>
                                        <input
                                            type="number"
                                            step="any"
                                            min="0.0001"
                                            className="input-no-spinner w-full bg-slate-900 border border-slate-700 text-white rounded-xl px-3.5 py-2.5 text-sm font-mono focus:outline-none focus:border-blue-500"
                                            placeholder="e.g. 1"
                                            value={splitTo}
                                            onChange={e => setSplitTo(e.target.value)}
                                            required
                                        />
                                    </div>
                                    <p className="col-span-full text-xs text-slate-300 italic">
                                        Example: For a 2-for-1 split, Old Shares = 1, New Shares = 2. For a 1-for-3 reverse split, Old Shares = 3, New Shares = 1.
                                    </p>
                                </>
                            ) : (
                                <>
                                    <div>
                                        <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block mb-1.5">
                                            Ticker Symbol
                                        </label>
                                        <input
                                            type="text"
                                            className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl px-3.5 py-2.5 text-sm font-mono font-bold uppercase focus:outline-none focus:border-blue-500"
                                            placeholder="e.g. AAPL"
                                            value={ticker}
                                            onChange={e => setTicker(e.target.value.toUpperCase())}
                                            required
                                            autoFocus
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block mb-1.5">
                                            Shares
                                        </label>
                                        <input
                                            type="number"
                                            step="any"
                                            className="input-no-spinner w-full bg-slate-900 border border-slate-700 text-white rounded-xl px-3.5 py-2.5 text-sm font-mono focus:outline-none focus:border-blue-500"
                                            placeholder="0"
                                            value={shares}
                                            onChange={e => setShares(e.target.value)}
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block mb-1.5">
                                            Price per Share
                                        </label>
                                        <input
                                            type="number"
                                            step="any"
                                            className="input-no-spinner w-full bg-slate-900 border border-slate-700 text-white rounded-xl px-3.5 py-2.5 text-sm font-mono focus:outline-none focus:border-blue-500"
                                            placeholder="0.00"
                                            value={price}
                                            onChange={e => setPrice(e.target.value)}
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block mb-1.5">
                                            Commission
                                        </label>
                                        <input
                                            type="number"
                                            step="any"
                                            className="input-no-spinner w-full bg-slate-900 border border-slate-700 text-white rounded-xl px-3.5 py-2.5 text-sm font-mono focus:outline-none focus:border-blue-500"
                                            placeholder="0.00"
                                            value={commission}
                                            onChange={e => setCommission(e.target.value)}
                                        />
                                    </div>
                                </>
                            )}

                            <div className="col-span-full flex justify-end gap-3 mt-2 pt-4 border-t border-slate-700/80">
                                <button
                                    type="button"
                                    className="px-5 py-2 bg-slate-900 hover:bg-slate-750 border border-slate-700 text-slate-200 hover:text-white rounded-xl text-sm font-semibold transition-colors"
                                    onClick={closeForm}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    style={{ color: '#ffffff' }}
                                    className="inline-flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-500 rounded-xl text-sm font-semibold transition-colors"
                                >
                                    <Save size={16} /> {editingTxId ? 'Update' : 'Save'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Assets List */}
            {activeTab === 'assets' && (
                <div className="flex flex-col gap-6">
                    {assets.length > 0 && assetView === 'cards' && (
                        <div className="flex flex-col gap-6">
                            {sortedAssets.map(asset => {
                                const effectiveBookCost = getEffectiveBookCost(asset);
                                const impliedAvgCost = getImpliedAvgCost(asset);

                                return (
                                    <div
                                        key={asset.id}
                                        className="bg-slate-800/95 border border-slate-700/90 rounded-2xl overflow-hidden shadow-xl"
                                    >
                                        {/* Header Row - All Key Metrics */}
                                        <div className="p-5 bg-slate-900/65 border-b border-slate-700/80">
                                            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-5 items-center">
                                                {/* 1. Stock Symbol/Shares */}
                                                <div>
                                                    <h3 className="text-xl sm:text-2xl font-bold font-mono text-white leading-none flex items-center gap-2">
                                                        <span>{asset.ticker}</span>
                                                        {asset.currency === 'USD' && (
                                                            <span className="text-[11px] font-sans font-bold px-1.5 py-0.5 rounded bg-blue-500/15 border border-blue-500/35 text-blue-400">
                                                                USD
                                                            </span>
                                                        )}
                                                        <QuoteStatusBadge ticker={asset.ticker} status={quoteErrors[asset.ticker]} />
                                                        <button
                                                            type="button"
                                                            onClick={() => openRenameModal(asset.ticker, asset.currency || 'CAD')}
                                                            className="p-1 text-slate-500 hover:text-blue-400 hover:bg-slate-800 rounded-lg transition-colors"
                                                            title={`Rename or Merge ${asset.ticker} (e.g. after uplisting or symbol change)`}
                                                        >
                                                            <Pencil size={13} />
                                                        </button>
                                                    </h3>
                                                    <p className="text-xs text-slate-300 font-mono font-semibold mt-1.5">
                                                        {asset.quantity.toLocaleString()} shares
                                                    </p>
                                                    <div className="mt-2 flex items-center gap-1 flex-wrap">
                                                        {renderSignalBadge(asset)}
                                                    </div>
                                                </div>

                                                {/* 2. Avg. Cost */}
                                                <div className="md:text-center">
                                                    <p className="text-xs text-slate-300 font-bold uppercase tracking-wider mb-1 flex items-center md:justify-center gap-1">
                                                        <span>Avg. Cost</span>
                                                        {asset.customBookCost !== undefined && asset.customBookCost !== null && (
                                                            <span className="text-[10px] text-blue-400 font-normal">(custom)</span>
                                                        )}
                                                    </p>
                                                    <p className="text-xl sm:text-2xl font-mono tabular-nums font-bold text-slate-200">
                                                        ${fmt2(impliedAvgCost)}
                                                    </p>
                                                </div>

                                                {/* 3. Current Price */}
                                                <div className="md:text-center">
                                                    <p className="text-xs text-slate-300 font-bold uppercase tracking-wider mb-1">
                                                        Current Price
                                                    </p>
                                                    <div className="flex flex-wrap items-center md:justify-center gap-1.5">
                                                        <span className="text-xl sm:text-2xl font-mono tabular-nums font-bold text-white">
                                                            ${asset.currentPrice.toFixed(2)}
                                                        </span>
                                                        <span
                                                            className={`text-xs font-mono font-bold px-2 py-0.5 rounded-md border bg-slate-900/80 border-slate-700 ${
                                                                asset.todayChangePercent >= 0
                                                                    ? 'text-green-400'
                                                                    : 'text-red-400'
                                                            }`}
                                                        >
                                                            {asset.todayChangePercent > 0 ? '+' : ''}
                                                            {asset.todayChangePercent?.toFixed(2)}%
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* 4. Book Cost */}
                                                <div className="md:text-center">
                                                    <p className="text-xs text-slate-300 font-bold uppercase tracking-wider mb-1 flex items-center md:justify-center gap-1.5">
                                                        <span>Book Cost</span>
                                                        {asset.customBookCost !== undefined && asset.customBookCost !== null && (
                                                            <span className="text-[11px] bg-blue-500/15 border border-blue-500/35 text-blue-400 px-1.5 py-0.5 rounded">
                                                                Custom
                                                            </span>
                                                        )}
                                                    </p>
                                                    {renderBookCost(asset, 'lg', 'center')}
                                                </div>

                                                {/* 5. Market Value */}
                                                <div className="md:text-center">
                                                    <p className="text-xs text-slate-300 font-bold uppercase tracking-wider mb-1">
                                                        Market Value
                                                    </p>
                                                    <p
                                                        className={`text-xl sm:text-2xl font-mono tabular-nums font-bold ${
                                                            asset.marketValue >= effectiveBookCost ? 'text-green-400' : 'text-red-400'
                                                        }`}
                                                    >
                                                        ${fmt2(asset.marketValue)}
                                                    </p>
                                                </div>

                                                {/* 6. P/L ($) */}
                                                <div className="md:text-center">
                                                    <p className="text-xs text-slate-300 font-bold uppercase tracking-wider mb-1">
                                                        P/L ($)
                                                    </p>
                                                    <p
                                                        className={`text-xl sm:text-2xl font-mono tabular-nums font-bold ${
                                                            asset.profit >= 0 ? 'text-green-400' : 'text-red-400'
                                                        }`}
                                                    >
                                                        {asset.profit >= 0 ? '+' : '-'}${fmt2(Math.abs(asset.profit))}
                                                    </p>
                                                </div>

                                                {/* 7. P/L (%) */}
                                                <div className="md:text-center">
                                                    <p className="text-xs text-slate-300 font-bold uppercase tracking-wider mb-1">
                                                        P/L (%)
                                                    </p>
                                                    <p
                                                        className={`text-xl sm:text-2xl font-mono tabular-nums font-bold ${
                                                            asset.profitPercent >= 0 ? 'text-green-400' : 'text-red-400'
                                                        }`}
                                                    >
                                                        {asset.profitPercent >= 0 ? '+' : ''}
                                                        {asset.profitPercent.toFixed(2)}%
                                                    </p>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Content Grid */}
                                        <div className="p-5 grid grid-cols-1 lg:grid-cols-[1fr_250px] gap-6">
                                            <div className="space-y-5">
                                                {render52WStats(asset)}
                                                {renderSimulators(asset)}
                                            </div>
                                            {renderSparkline(asset)}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* Compact Card View */}
                    {assets.length > 0 && assetView === 'compact' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                            {sortedAssets.map(asset => {
                                const effectiveBookCost = getEffectiveBookCost(asset);
                                const impliedAvgCost = getImpliedAvgCost(asset);
                                const isToolsOpen = !!expandedTools[asset.id];

                                return (
                                    <div
                                        key={asset.id}
                                        className="bg-slate-800/95 border border-slate-700/90 rounded-2xl overflow-hidden shadow-lg flex flex-col"
                                    >
                                        {/* Compact Header */}
                                        <div className="p-4 bg-slate-900/65 border-b border-slate-700/80 flex items-start justify-between gap-3">
                                            <div>
                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                    <h3 className="text-lg font-bold font-mono text-white leading-none">
                                                        {asset.ticker}
                                                    </h3>
                                                    {asset.currency === 'USD' && (
                                                        <span className="text-[10px] font-sans font-bold px-1.5 py-0.5 rounded bg-blue-500/15 border border-blue-500/35 text-blue-400">
                                                            USD
                                                        </span>
                                                    )}
                                                    <QuoteStatusBadge ticker={asset.ticker} status={quoteErrors[asset.ticker]} />
                                                    <button
                                                        type="button"
                                                        onClick={() => openRenameModal(asset.ticker, asset.currency || 'CAD')}
                                                        className="p-1 text-slate-500 hover:text-blue-400 hover:bg-slate-800 rounded-lg transition-colors"
                                                        title={`Rename or Merge ${asset.ticker}`}
                                                    >
                                                        <Pencil size={12} />
                                                    </button>
                                                </div>
                                                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                                    <span className="text-xs text-slate-300 font-mono font-semibold">
                                                        {asset.quantity.toLocaleString()} sh
                                                    </span>
                                                    {renderSignalBadge(asset)}
                                                </div>
                                            </div>

                                            <div className="text-right shrink-0">
                                                <p className="text-lg font-mono tabular-nums font-bold text-white leading-none">
                                                    ${asset.currentPrice.toFixed(2)}
                                                </p>
                                                <span
                                                    className={`inline-block mt-1.5 text-[11px] font-mono font-bold px-1.5 py-0.5 rounded-md border bg-slate-900/80 border-slate-700 ${
                                                        asset.todayChangePercent >= 0
                                                            ? 'text-green-400'
                                                            : 'text-red-400'
                                                    }`}
                                                >
                                                    {asset.todayChangePercent > 0 ? '+' : ''}
                                                    {asset.todayChangePercent?.toFixed(2)}%
                                                </span>
                                            </div>
                                        </div>

                                        {/* Compact Metrics */}
                                        <div className="p-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                                            <div>
                                                <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">
                                                    Market Value
                                                </p>
                                                <p
                                                    className={`font-mono tabular-nums font-bold text-base ${
                                                        asset.marketValue >= effectiveBookCost ? 'text-green-400' : 'text-red-400'
                                                    }`}
                                                >
                                                    ${fmt2(asset.marketValue)}
                                                </p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">
                                                    P/L
                                                </p>
                                                <p
                                                    className={`font-mono tabular-nums font-bold text-base ${
                                                        asset.profit >= 0 ? 'text-green-400' : 'text-red-400'
                                                    }`}
                                                >
                                                    {asset.profit >= 0 ? '+' : '-'}${fmt2(Math.abs(asset.profit))}{' '}
                                                    <span className="text-xs">
                                                        ({asset.profitPercent >= 0 ? '+' : ''}
                                                        {asset.profitPercent.toFixed(2)}%)
                                                    </span>
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">
                                                    Avg. Cost
                                                </p>
                                                <p className="font-mono tabular-nums font-semibold text-slate-200">
                                                    ${fmt2(impliedAvgCost)}
                                                </p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">
                                                    Book Cost
                                                </p>
                                                {renderBookCost(asset, 'sm', 'right')}
                                            </div>
                                        </div>

                                        {/* Compact Footer with Tools Dropdown */}
                                        <div className="px-4 py-2.5 bg-slate-900/45 border-t border-slate-700/70 flex items-center justify-between gap-2 mt-auto">
                                            <button
                                                type="button"
                                                onClick={() => handleResearchClick(asset.ticker)}
                                                className="text-xs font-semibold text-blue-400 hover:text-blue-300 transition-colors"
                                            >
                                                52W &amp; Research
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => toggleAssetTools(asset.id)}
                                                aria-expanded={isToolsOpen}
                                                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors ${
                                                    isToolsOpen
                                                        ? 'bg-blue-600/20 border-blue-500/40 text-blue-300'
                                                        : 'bg-slate-900 border-slate-700 text-slate-200 hover:text-white hover:border-slate-500'
                                                }`}
                                            >
                                                <Wrench size={13} className="text-blue-400" />
                                                <span>Tools</span>
                                                {isToolsOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                            </button>
                                        </div>

                                        {/* Expanded Tools Drawer */}
                                        {isToolsOpen && (
                                            <div className="p-4 border-t border-slate-700/80 bg-slate-900/40 space-y-4">
                                                {renderSimulators(asset, true)}
                                                {render52WStats(asset)}
                                                {renderSparkline(asset, 'h-20')}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* Table View */}
                    {assets.length > 0 && assetView === 'table' && (
                        <div className="bg-slate-800/95 border border-slate-700/90 rounded-2xl shadow-xl overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead className="bg-slate-900/90 text-xs font-bold text-slate-300 uppercase tracking-wider border-b border-slate-700/80">
                                        <tr>
                                            <th className="px-5 py-3.5">
                                                <button
                                                    type="button"
                                                    onClick={() => handleColumnSort('ticker')}
                                                    className="inline-flex items-center gap-1.5 hover:text-white transition-colors"
                                                >
                                                    <span>Asset</span>
                                                    {renderSortIcon('ticker')}
                                                </button>
                                            </th>
                                            <th className="px-4 py-3.5 text-right">
                                                <button
                                                    type="button"
                                                    onClick={() => handleColumnSort('averageCost')}
                                                    className="inline-flex items-center justify-end gap-1.5 hover:text-white transition-colors ml-auto"
                                                >
                                                    <span>Avg. Cost</span>
                                                    {renderSortIcon('averageCost')}
                                                </button>
                                            </th>
                                            <th className="px-4 py-3.5 text-right">
                                                <button
                                                    type="button"
                                                    onClick={() => handleColumnSort('todayChange')}
                                                    className="inline-flex items-center justify-end gap-1.5 hover:text-white transition-colors ml-auto"
                                                >
                                                    <span>Price</span>
                                                    {renderSortIcon('todayChange')}
                                                </button>
                                            </th>
                                            <th className="px-4 py-3.5 text-right">
                                                <button
                                                    type="button"
                                                    onClick={() => handleColumnSort('bookCost')}
                                                    className="inline-flex items-center justify-end gap-1.5 hover:text-white transition-colors ml-auto"
                                                >
                                                    <span>Book Cost</span>
                                                    {renderSortIcon('bookCost')}
                                                </button>
                                            </th>
                                            <th className="px-4 py-3.5 text-right">
                                                <button
                                                    type="button"
                                                    onClick={() => handleColumnSort('marketValue')}
                                                    className="inline-flex items-center justify-end gap-1.5 hover:text-white transition-colors ml-auto"
                                                >
                                                    <span>Market Value</span>
                                                    {renderSortIcon('marketValue')}
                                                </button>
                                            </th>
                                            <th className="px-4 py-3.5 text-right">
                                                <button
                                                    type="button"
                                                    onClick={() => handleColumnSort('profit')}
                                                    className="inline-flex items-center justify-end gap-1.5 hover:text-white transition-colors ml-auto"
                                                >
                                                    <span>P/L ($)</span>
                                                    {renderSortIcon('profit')}
                                                </button>
                                            </th>
                                            <th className="px-4 py-3.5 text-right">
                                                <button
                                                    type="button"
                                                    onClick={() => handleColumnSort('profitPercent')}
                                                    className="inline-flex items-center justify-end gap-1.5 hover:text-white transition-colors ml-auto"
                                                >
                                                    <span>P/L (%)</span>
                                                    {renderSortIcon('profitPercent')}
                                                </button>
                                            </th>
                                            <th className="px-5 py-3.5 text-right">Tools</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-700/60 text-sm">
                                        {sortedAssets.map(asset => {
                                            const effectiveBookCost = getEffectiveBookCost(asset);
                                            const impliedAvgCost = getImpliedAvgCost(asset);
                                            const isToolsOpen = !!expandedTools[asset.id];

                                            return (
                                                <React.Fragment key={asset.id}>
                                                    <tr className="hover:bg-slate-750/60 transition-colors">
                                                        <td className="px-5 py-3.5">
                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleResearchClick(asset.ticker)}
                                                                    className="font-bold font-mono text-white hover:text-blue-400 transition-colors text-base"
                                                                    title="View detailed research"
                                                                >
                                                                    {asset.ticker}
                                                                </button>
                                                                {asset.currency === 'USD' && (
                                                                    <span className="text-[10px] font-sans font-bold px-1.5 py-0.5 rounded bg-blue-500/15 border border-blue-500/35 text-blue-400">
                                                                        USD
                                                                    </span>
                                                                )}
                                                                <QuoteStatusBadge ticker={asset.ticker} status={quoteErrors[asset.ticker]} />
                                                                <button
                                                                    type="button"
                                                                    onClick={() => openRenameModal(asset.ticker, asset.currency || 'CAD')}
                                                                    className="p-1 text-slate-500 hover:text-blue-400 hover:bg-slate-800 rounded-lg transition-colors"
                                                                    title={`Rename or Merge ${asset.ticker}`}
                                                                >
                                                                    <Pencil size={12} />
                                                                </button>
                                                                {renderSignalBadge(asset, 'sm')}
                                                            </div>
                                                            <p className="text-xs text-slate-400 font-mono mt-0.5">
                                                                {asset.quantity.toLocaleString()} shares
                                                            </p>
                                                        </td>
                                                        <td className="px-4 py-3.5 text-right font-mono tabular-nums font-semibold text-slate-200">
                                                            ${fmt2(impliedAvgCost)}
                                                            {asset.customBookCost !== undefined && asset.customBookCost !== null && (
                                                                <span className="block text-[10px] text-blue-400 font-sans font-normal">
                                                                    custom
                                                                </span>
                                                            )}
                                                        </td>
                                                        <td className="px-4 py-3.5 text-right">
                                                            <span className="font-mono tabular-nums font-bold text-white">
                                                                ${asset.currentPrice.toFixed(2)}
                                                            </span>
                                                            <span
                                                                className={`block text-[11px] font-mono font-bold mt-0.5 ${
                                                                    asset.todayChangePercent >= 0 ? 'text-green-400' : 'text-red-400'
                                                                }`}
                                                            >
                                                                {asset.todayChangePercent > 0 ? '+' : ''}
                                                                {asset.todayChangePercent?.toFixed(2)}%
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-3.5 text-right">
                                                            {renderBookCost(asset, 'sm', 'right')}
                                                        </td>
                                                        <td
                                                            className={`px-4 py-3.5 text-right font-mono tabular-nums font-bold ${
                                                                asset.marketValue >= effectiveBookCost ? 'text-green-400' : 'text-red-400'
                                                            }`}
                                                        >
                                                            ${fmt2(asset.marketValue)}
                                                        </td>
                                                        <td
                                                            className={`px-4 py-3.5 text-right font-mono tabular-nums font-bold ${
                                                                asset.profit >= 0 ? 'text-green-400' : 'text-red-400'
                                                            }`}
                                                        >
                                                            {asset.profit >= 0 ? '+' : '-'}${fmt2(Math.abs(asset.profit))}
                                                        </td>
                                                        <td
                                                            className={`px-4 py-3.5 text-right font-mono tabular-nums font-bold ${
                                                                asset.profitPercent >= 0 ? 'text-green-400' : 'text-red-400'
                                                            }`}
                                                        >
                                                            {asset.profitPercent >= 0 ? '+' : ''}
                                                            {asset.profitPercent.toFixed(2)}%
                                                        </td>
                                                        <td className="px-5 py-3.5 text-right">
                                                            <button
                                                                type="button"
                                                                onClick={() => toggleAssetTools(asset.id)}
                                                                aria-expanded={isToolsOpen}
                                                                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors ${
                                                                    isToolsOpen
                                                                        ? 'bg-blue-600/20 border-blue-500/40 text-blue-300'
                                                                        : 'bg-slate-900 border-slate-700 text-slate-200 hover:text-white hover:border-slate-500'
                                                                }`}
                                                            >
                                                                <Wrench size={13} className="text-blue-400" />
                                                                <span>Tools</span>
                                                                {isToolsOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                                            </button>
                                                        </td>
                                                    </tr>
                                                    {isToolsOpen && (
                                                        <tr className="bg-slate-900/45">
                                                            <td colSpan={8} className="p-5">
                                                                <div className="grid grid-cols-1 lg:grid-cols-[1fr_250px] gap-6">
                                                                    <div className="space-y-4">
                                                                        {render52WStats(asset)}
                                                                        {renderSimulators(asset)}
                                                                    </div>
                                                                    {renderSparkline(asset)}
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    )}
                                                </React.Fragment>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {assets.length === 0 && (
                        <div className="text-center py-16 bg-slate-800/95 rounded-2xl border border-dashed border-slate-700 space-y-3">
                            <Plus size={40} className="text-slate-400 mx-auto" />
                            <div>
                                <p className="text-slate-200 font-medium">No assets in this account yet.</p>
                                <p className="text-slate-400 text-xs mt-1">Add transactions manually or import your portfolio via CSV.</p>
                            </div>
                            <div className="flex justify-center gap-3 pt-2">
                                <button
                                    onClick={() => setIsAdding(true)}
                                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-xl text-xs font-bold text-white transition-colors"
                                >
                                    <Plus size={15} /> Add Transaction
                                </button>
                                <button
                                    onClick={() => setIsImportModalOpen(true)}
                                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-750 border border-slate-700 text-slate-200 hover:text-white rounded-xl text-xs font-bold transition-colors"
                                >
                                    <Upload size={15} className="text-blue-400" /> Import CSV
                                </button>
                            </div>
                            <div className="pt-3 border-t border-slate-700/60 max-w-sm mx-auto text-xs text-slate-400 flex items-center justify-center gap-1.5">
                                <Users size={13} className="text-purple-400 shrink-0" />
                                <span>Need to add users or other accounts?</span>
                                <Link to="/settings" className="text-blue-400 hover:text-blue-300 font-semibold underline">
                                    Visit Settings
                                </Link>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Transactions History */}
            {activeTab === 'transactions' && (
                <div className="bg-slate-800/95 border border-slate-700/90 rounded-2xl shadow-xl overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-slate-900/90 text-xs font-bold text-slate-300 uppercase tracking-wider border-b border-slate-700/80">
                                <tr>
                                    <th className="px-6 py-3.5">Date</th>
                                    <th className="px-6 py-3.5">Ticker</th>
                                    <th className="px-6 py-3.5">Type</th>
                                    <th className="px-6 py-3.5 text-right">Shares</th>
                                    <th className="px-6 py-3.5 text-right">Price</th>
                                    <th className="px-6 py-3.5 text-right">Amount</th>
                                    <th className="px-6 py-3.5 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-700/60 text-sm">
                                {transactions
                                    .filter(t => t.accountId === account.id)
                                    .map((t, index) => ({ ...t, _originalIndex: index }))
                                    .sort((a, b) => {
                                        const dateA = new Date(a.date).getTime();
                                        const dateB = new Date(b.date).getTime();
                                        if (dateA !== dateB) return dateB - dateA;
                                        return b._originalIndex - a._originalIndex;
                                    })
                                    .map(tx => (
                                        <tr key={tx.id} className="hover:bg-slate-750/60 transition-colors">
                                            <td className="px-6 py-4 text-slate-300 font-mono tabular-nums">{tx.date ? tx.date.split('T')[0] : ''}</td>
                                            <td className="px-6 py-4 font-bold font-mono text-white">
                                                {tx.ticker || '—'}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span
                                                    className={`px-2.5 py-0.5 rounded-md text-xs font-bold uppercase border ${
                                                        tx.type === 'Buy' ||
                                                        tx.type === 'DRIP' ||
                                                        tx.type === 'Dividend Reinvested' ||
                                                        tx.type === 'Stock Split'
                                                            ? 'bg-slate-900/80 border-slate-700 text-green-400'
                                                            : tx.type === 'Sell'
                                                            ? 'bg-slate-900/80 border-slate-700 text-red-400'
                                                            : tx.type === 'Dividend Income' || tx.type === 'Dividend'
                                                            ? 'bg-amber-500/15 border-amber-500/35 text-amber-400'
                                                            : tx.type === 'Withdrawal'
                                                            ? 'bg-purple-500/15 border-purple-500/35 text-purple-400'
                                                            : tx.type === 'Interest'
                                                            ? 'bg-slate-900/80 border-slate-700 text-emerald-400'
                                                            : tx.type === 'Fee'
                                                            ? 'bg-amber-500/15 border-amber-500/35 text-amber-400'
                                                            : 'bg-blue-500/15 border-blue-500/35 text-blue-400'
                                                    }`}
                                                >
                                                    {tx.type}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right font-mono tabular-nums text-slate-200">
                                                {tx.type === 'Stock Split' && tx.splitFrom && tx.splitTo
                                                    ? `${tx.splitTo} : ${tx.splitFrom}`
                                                    : tx.shares
                                                    ? (tx.type === 'Sell' ? '-' : '+') +
                                                      tx.shares.toLocaleString(undefined, { maximumFractionDigits: 4 })
                                                    : '—'}
                                            </td>
                                            <td className="px-6 py-4 text-right font-mono tabular-nums text-slate-300">
                                                ${tx.pricePerShare ? fmt2(tx.pricePerShare) : '0.00'}
                                            </td>
                                            <td className="px-6 py-4 text-right font-mono tabular-nums text-white font-bold">
                                                ${tx.amount ? fmt2(tx.amount) : '0.00'}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex justify-end gap-2">
                                                    <button
                                                        onClick={() => startEditTx(tx)}
                                                        className="p-2 bg-slate-900 border border-slate-700 hover:border-slate-500 rounded-lg text-slate-300 hover:text-white transition-colors"
                                                        title="Edit transaction"
                                                        aria-label="Edit transaction"
                                                    >
                                                        <Pencil size={14} />
                                                    </button>
                                                    <button
                                                        onClick={() => deleteTransaction(tx.id)}
                                                        className="p-2 bg-red-500/15 border border-red-500/30 hover:bg-red-500/25 rounded-lg text-red-400 transition-colors"
                                                        title="Delete transaction"
                                                        aria-label="Delete transaction"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                {accountTxs.length === 0 && (
                                    <tr>
                                        <td colSpan={7} className="px-6 py-12 text-center text-slate-300 text-sm">
                                            <p className="font-medium text-slate-200">No transaction history found.</p>
                                            <p className="text-slate-400 text-xs mt-1">Import your past activity or add your first transaction manually.</p>
                                            <div className="flex justify-center gap-3 pt-3">
                                                <button
                                                    onClick={() => setIsAdding(true)}
                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded-lg text-xs font-bold text-white transition-colors"
                                                >
                                                    <Plus size={14} /> Add Transaction
                                                </button>
                                                <button
                                                    onClick={() => setIsImportModalOpen(true)}
                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-750 border border-slate-700 text-slate-200 hover:text-white rounded-lg text-xs font-bold transition-colors"
                                                >
                                                    <Upload size={14} className="text-blue-400" /> Import CSV
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Portfolio Balancer */}
            <PortfolioBalancer account={account} assets={assets} totalInvested={totalValue} />

            {/* Average Down Calculator */}
            <AverageDownCalc assets={assets} />

            {/* Stock Research Modal */}
            {researchData && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
                    <div className="w-full max-w-5xl my-auto relative">
                        <StockDetails data={researchData} onClose={() => setResearchData(null)} />
                    </div>
                </div>
            )}

            {loadingResearch && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="bg-slate-800 border border-slate-700 text-white p-6 rounded-2xl shadow-2xl flex items-center gap-3">
                        <RefreshCw size={22} className="animate-spin text-blue-400" />
                        <span className="font-semibold">Loading research...</span>
                    </div>
                </div>
            )}
            {showMigrationModal && <CurrencyMigrationModal onClose={() => setShowMigrationModal(false)} />}
            
            {/* Rename / Merge Ticker Modal */}
            {renameModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
                    <div className="relative w-full max-w-md bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden p-6 space-y-4">
                        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                            <div className="flex items-center gap-2">
                                <div className="p-1.5 rounded-lg bg-blue-500/20 text-blue-400 border border-blue-500/30">
                                    <Pencil size={16} />
                                </div>
                                <h3 className="text-base font-bold text-white">
                                    Rename / Merge Ticker Symbol
                                </h3>
                            </div>
                            <button
                                onClick={() => setRenameModalOpen(false)}
                                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        <p className="text-xs text-slate-300 leading-relaxed">
                            Use this when a company uplisted, reorganized, or changed symbols (e.g. <span className="font-mono text-white font-bold">TRUL</span> &rarr; <span className="font-mono text-white font-bold">TRLV</span> or <span className="font-mono text-white font-bold">CL</span> &rarr; <span className="font-mono text-white font-bold">CL.CN</span>). All past transactions in this account will be updated to the new symbol, merging shares and ACB, and live quotes will refresh immediately.
                        </p>

                        <form onSubmit={handleRenameSubmit} className="space-y-4">
                            <div>
                                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                                    Current Symbol in Account
                                </label>
                                <input
                                    type="text"
                                    disabled
                                    value={renameOldTicker}
                                    className="w-full px-3 py-2 bg-slate-800/60 border border-slate-700 text-slate-400 rounded-xl text-sm font-mono font-bold cursor-not-allowed"
                                />
                            </div>

                            <div>
                                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-300 mb-1">
                                    New Target Symbol (e.g. TRLV, CL.CN, AYR-A.CN)
                                </label>
                                <input
                                    type="text"
                                    value={renameNewTicker}
                                    onChange={e => setRenameNewTicker(e.target.value.toUpperCase())}
                                    placeholder="e.g. TRLV"
                                    autoFocus
                                    required
                                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 focus:border-blue-500 text-white rounded-xl text-sm font-mono font-bold outline-none uppercase"
                                />
                            </div>

                            <div>
                                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                                    Trading Currency
                                </label>
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setRenameNewCurrency('CAD')}
                                        className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all ${
                                            renameNewCurrency === 'CAD'
                                                ? 'bg-blue-600/20 border-blue-500 text-white'
                                                : 'bg-slate-800 border-slate-750 text-slate-400 hover:text-white'
                                        }`}
                                    >
                                        CAD ($)
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setRenameNewCurrency('USD')}
                                        className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all ${
                                            renameNewCurrency === 'USD'
                                                ? 'bg-emerald-600/20 border-emerald-500 text-white'
                                                : 'bg-slate-800 border-slate-750 text-slate-400 hover:text-white'
                                        }`}
                                    >
                                        USD ($)
                                    </button>
                                </div>
                            </div>

                            <div className="pt-2 flex justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setRenameModalOpen(false)}
                                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-semibold"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={!renameNewTicker.trim() || renameNewTicker.trim() === renameOldTicker}
                                    className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-colors inline-flex items-center gap-1.5 shadow-lg shadow-blue-600/20"
                                >
                                    Apply &amp; Merge
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* CSV Import Modal */}
            <CsvImportModal
                isOpen={isImportModalOpen}
                onClose={() => setIsImportModalOpen(false)}
                defaultAccountId={account?.id}
            />
        </div>
    );
};

export default AccountDetails;
