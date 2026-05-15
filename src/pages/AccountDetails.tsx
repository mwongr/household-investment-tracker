import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Plus, TrendingUp, RefreshCw, X, Pencil, Trash2, Save, RotateCcw, Calculator, Wallet } from 'lucide-react';
import { AreaChart, Area, ResponsiveContainer, Tooltip } from 'recharts';
import { useData } from '../context/DataContext';
import type { Transaction, TransactionType } from '../types';

import '../styles/shared.css';
import PortfolioBalancer from '../components/PortfolioBalancer';
import AverageDownCalc from '../components/AverageDownCalc';

const AccountDetails = () => {
    const { id } = useParams<{ id: string }>();
    const { accounts, getAssetsByAccount, addTransaction, updateTransaction, deleteTransaction, transactions, refreshPrices, refreshAsset, updateAssetCustomBookCost } = useData();
    const account = accounts.find(a => a.id === id);
    const assets = getAssetsByAccount(id || '');

    const [isAdding, setIsAdding] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [activeTab, setActiveTab] = useState<'assets' | 'transactions'>('assets');
    const [editingTxId, setEditingTxId] = useState<string | null>(null);
    const [selectedYear, setSelectedYear] = useState<number | 'All'>(new Date().getFullYear());

    // Transaction Form State
    const [ticker, setTicker] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [type, setType] = useState<TransactionType>('Buy');
    const [shares, setShares] = useState('');
    const [price, setPrice] = useState('');
    const [commission, setCommission] = useState('0');

    // Simulators State
    const [simSellPrice, setSimSellPrice] = useState<Record<string, string>>({});
    const [simSellShares, setSimSellShares] = useState<Record<string, string>>({});
    const [simBuyAmount, setSimBuyAmount] = useState<Record<string, string>>({});
    const [simBuyShares, setSimBuyShares] = useState<Record<string, string>>({});

    // Book Cost Editing State
    const [editingBookCostId, setEditingBookCostId] = useState<string | null>(null);
    const [customBookCostInput, setCustomBookCostInput] = useState<Record<string, string>>({});

    if (!account) return <div>Account not found</div>;

    const handleTransaction = (e: React.FormEvent) => {
        e.preventDefault();

        const isCashTx = type === 'Deposit' || type === 'Withdrawal';
        const isDividendCash = type === 'Dividend' || type === 'Dividend Income';
        const isStockSplit = type === 'Stock Split';

        // Validation: 
        // - Asset/DRIP: ticker + shares + price
        // - Dividend (Cash): ticker + price (Amount)
        // - Deposit/Withdrawal: price (Amount)
        // - Stock Split: ticker + shares
        if (
            (isCashTx && price) ||
            (isDividendCash && ticker && price) ||
            (isStockSplit && ticker && shares) ||
            (!isCashTx && !isDividendCash && !isStockSplit && ticker && shares && price)
        ) {
            const qty = shares ? parseFloat(shares) : 0;
            const priceVal = price ? parseFloat(price) : 0; // Used as "Amount" for cash/dividend, or "Price Per Share" for asset
            const commVal = commission ? parseFloat(commission) : 0;

            let amount = 0;
            let finalPricePerShare = 0;

            if (isCashTx || isDividendCash) {
                // For Cash Dividend or Deposit, user enters TOTAL Amount in "price" field
                amount = priceVal;
                finalPricePerShare = 0;
            } else if (isStockSplit) {
                // Stock split has no new monetary amount or price per share
                amount = 0;
                finalPricePerShare = 0;
            } else {
                // Buy/Sell/DRIP
                amount = (qty * priceVal) + commVal;
                finalPricePerShare = priceVal;
            }

            const txData = {
                accountId: account.id,
                ticker: isCashTx ? '' : ticker.toUpperCase(),
                date,
                type,
                shares: qty,
                pricePerShare: finalPricePerShare,
                commission: commVal,
                amount: amount
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
        setDate(tx.date);
        setType(tx.type);
        setShares(tx.shares?.toString() || '');

        // For Dividend/Cash txs, we stored amount in 'amount' but UI usually uses 'price' state
        if (tx.type === 'Deposit' || tx.type === 'Withdrawal' || tx.type === 'Dividend' || tx.type === 'Dividend Income') {
            setPrice(tx.amount.toString());
        } else if (tx.type === 'Stock Split') {
            setPrice('0');
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
        setEditingTxId(null);
    };

    // Calculations
    const totalValue = assets.reduce((sum, asset) => sum + asset.marketValue, 0);
    const totalCost = assets.reduce((sum, asset) => {
        const effectiveBookCost = asset.customBookCost !== undefined && asset.customBookCost !== null ? asset.customBookCost : asset.totalCost;
        return sum + effectiveBookCost;
    }, 0);
    const totalProfit = totalValue - totalCost;
    const totalProfitPercent = totalCost > 0 ? (totalProfit / totalCost) * 100 : 0;

    // Transaction activity summary with year filter
    const accountTxs = transactions.filter(tx => tx.accountId === id);
    const txYears = Array.from(new Set(accountTxs.map(tx => new Date(tx.date).getFullYear()))).sort((a, b) => b - a);
    const filteredTxs = selectedYear === 'All' ? accountTxs : accountTxs.filter(tx => new Date(tx.date).getFullYear() === selectedYear);
    const txSummary = filteredTxs.reduce((acc, tx) => {
        if (tx.type === 'Deposit') acc.deposits += tx.amount;
        else if (tx.type === 'Withdrawal') acc.withdrawals += tx.amount;
        else if (tx.type === 'Buy' || tx.type === 'Dividend Reinvested' || tx.type === 'DRIP') acc.buys += tx.amount;
        else if (tx.type === 'Sell') acc.sells += tx.amount;
        else if (tx.type === 'Dividend Income' || tx.type === 'Dividend') acc.dividends += tx.amount;
        return acc;
    }, { deposits: 0, withdrawals: 0, buys: 0, sells: 0, dividends: 0 });

    return (
        <div>
            {/* Page Header */}
            <div className="flex items-center gap-4 mb-6">
                <Link to="/accounts" className="text-slate-400 hover:text-white transition-colors">
                    <ArrowLeft size={24} />
                </Link>
                <div className="flex-1">
                    <h1 className="text-2xl font-bold text-white">{account.name}</h1>
                    <div className="flex gap-2 text-sm text-slate-400">
                        <span>{account.type}</span> •
                        <span>Cash Balance: ${account.cashBalance.toLocaleString()}</span>
                    </div>
                </div>
                <div>
                    <button
                        onClick={handleRefresh}
                        disabled={isRefreshing}
                        className="btn btn-secondary flex items-center gap-2"
                    >
                        <RotateCcw size={18} className="text-white" />
                        {isRefreshing ? 'Refreshing...' : 'Refresh Prices'}
                    </button>
                </div>
            </div>

            {/* Account Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
                <div className="glass-panel p-4 relative overflow-hidden">
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mb-1">Total Value</p>
                    <p className="text-3xl font-bold text-white font-mono">${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                    <TrendingUp size={48} className="absolute -right-2 -bottom-2 opacity-5 text-blue-500" />
                </div>
                <div className="glass-panel p-4 relative overflow-hidden">
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mb-1">Total Cost</p>
                    <p className="text-3xl font-bold text-slate-200 font-mono">${totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                    <Wallet size={48} className="absolute -right-2 -bottom-2 opacity-5 text-slate-500" />
                </div>
                <div className="glass-panel p-4 relative overflow-hidden">
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mb-1">Total Profit</p>
                    <p className={`text-3xl font-bold font-mono ${totalProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {totalProfit >= 0 ? '+' : ''}${Math.abs(totalProfit).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                    <TrendingUp size={48} className={`absolute -right-2 -bottom-2 opacity-10 ${totalProfit >= 0 ? 'text-green-500' : 'text-red-500'}`} />
                </div>
                <div className="glass-panel p-4 relative overflow-hidden">
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mb-1">Total Return</p>
                    <p className={`text-3xl font-bold font-mono ${totalProfitPercent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {totalProfitPercent >= 0 ? '+' : ''}{totalProfitPercent.toFixed(2)}%
                    </p>
                    <TrendingUp size={48} className={`absolute -right-2 -bottom-2 opacity-10 ${totalProfitPercent >= 0 ? 'text-green-500' : 'text-red-500'}`} />
                </div>
                <div className="glass-panel p-4 relative overflow-hidden bg-blue-900/20 border-blue-500/30">
                    <p className="text-xs text-blue-400 font-bold uppercase tracking-widest mb-1">Available Cash</p>
                    <p className="text-3xl font-bold text-white font-mono">${account.cashBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                    <Wallet size={48} className="absolute -right-2 -bottom-2 opacity-10 text-blue-400" />
                </div>
            </div>

            {/* Transaction Activity Summary */}
            <div className="glass-panel p-4 mb-6">
                <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Transaction Activity</span>
                    <div className="flex items-center gap-1 flex-wrap">
                        {txYears.map(yr => (
                            <button
                                key={yr}
                                onClick={() => setSelectedYear(yr)}
                                className={`px-3 py-1 rounded text-xs font-semibold transition-all ${ selectedYear === yr ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700' }`}
                            >
                                {yr}
                            </button>
                        ))}
                        <button
                            onClick={() => setSelectedYear('All')}
                            className={`px-3 py-1 rounded text-xs font-semibold transition-all ${ selectedYear === 'All' ? 'bg-slate-500 text-white shadow-md' : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700' }`}
                        >
                            All Time
                        </button>
                    </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                    <div className="bg-slate-800/60 rounded-lg p-3 border border-green-500/10">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Total Deposits</p>
                        <p className="text-lg font-bold font-mono text-green-400">${txSummary.deposits.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                    </div>
                    <div className="bg-slate-800/60 rounded-lg p-3 border border-red-500/10">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Total Withdrawals</p>
                        <p className="text-lg font-bold font-mono text-red-400">${txSummary.withdrawals.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                    </div>
                    <div className="bg-slate-800/60 rounded-lg p-3 border border-blue-500/10">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Total Buys</p>
                        <p className="text-lg font-bold font-mono text-blue-400">${txSummary.buys.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                    </div>
                    <div className="bg-slate-800/60 rounded-lg p-3 border border-purple-500/10">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Total Sells</p>
                        <p className="text-lg font-bold font-mono text-purple-400">${txSummary.sells.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                    </div>
                    <div className="bg-slate-800/60 rounded-lg p-3 border border-yellow-500/10">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Total Dividends</p>
                        <p className="text-lg font-bold font-mono text-yellow-400">${txSummary.dividends.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                    </div>
                </div>
            </div>

            {/* Actions Bar & Navigation */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-8">
                <div className="flex bg-slate-800/50 p-1.5 rounded-xl border border-slate-700/50">
                    <button
                        className={`px-6 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${activeTab === 'assets' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' : 'text-slate-400 hover:text-white hover:bg-slate-700/50'}`}
                        onClick={() => setActiveTab('assets')}
                    >
                        Assets
                    </button>
                    <button
                        className={`px-6 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${activeTab === 'transactions' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' : 'text-slate-400 hover:text-white hover:bg-slate-700/50'}`}
                        onClick={() => setActiveTab('transactions')}
                    >
                        Transactions
                    </button>
                </div>

                <div className="flex gap-3">
                    <button className="btn btn-primary shadow-lg shadow-blue-900/20 flex items-center gap-2" onClick={() => setIsAdding(true)}>
                        <Plus size={18} /> Add Transaction
                    </button>
                </div>
            </div>

            {/* Add Transaction Modal */}
            {isAdding && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="glass-panel w-full max-w-2xl p-6 border border-slate-700 shadow-2xl animate-in fade-in zoom-in duration-200">
                        <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-700/50">
                            <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                {editingTxId ? <Pencil size={20} className="text-blue-400" /> : <Plus size={20} className="text-blue-400" />}
                                {editingTxId ? 'Edit Transaction' : 'Add Transaction'}
                            </h3>
                            <button onClick={closeForm} className="p-1 hover:bg-slate-700 rounded-full transition-colors"><X size={24} className="text-slate-400 hover:text-white" /></button>
                        </div>
                        <form onSubmit={handleTransaction} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide block mb-2">Type</label>
                                <select className="input" value={type} onChange={e => {
                                    const newType = e.target.value as TransactionType;
                                    setType(newType);
                                    // Clear ticker if switching to cash transaction
                                    if (newType === 'Deposit' || newType === 'Withdrawal') {
                                        setTicker('');
                                        setShares('');
                                        setPrice('');
                                        setCommission('0');
                                    }
                                }}>
                                    <option value="Buy">Buy</option>
                                    <option value="Sell">Sell</option>
                                    <option value="Deposit">Deposit</option>
                                    <option value="Withdrawal">Withdrawal</option>
                                    <option value="Dividend Income">Dividend Income</option>
                                    <option value="Dividend Reinvested">Dividend Reinvested</option>
                                    <option value="Stock Split">Stock Split</option>
                                    {type === 'Dividend' && <option value="Dividend">Dividend (Legacy)</option>}
                                    {type === 'DRIP' && <option value="DRIP">DRIP (Legacy)</option>}
                                </select>
                            </div>

                            <div className="col-span-full md:col-span-1">
                                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide block mb-2">Date</label>
                                <input type="date" className="input" value={date} onChange={e => setDate(e.target.value)} required />
                            </div>

                            {(type === 'Deposit' || type === 'Withdrawal') ? (
                                /* Cash Transaction Fields */
                                <div className="col-span-full">
                                    <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide block mb-2">Amount ($)</label>
                                    <input
                                        type="number"
                                        step="any"
                                        className="input text-lg font-bold text-green-400"
                                        placeholder="0.00"
                                        value={price} // Reusing price state for raw amount in cash tx
                                        onChange={e => setPrice(e.target.value)}
                                        required
                                        autoFocus
                                    />
                                    <p className="text-xs text-slate-500 mt-2">
                                        {type === 'Deposit' ? 'Add cash to your account balance.' : 'Remove cash from your account balance.'}
                                    </p>
                                </div>
                            ) : (type === 'Dividend' || type === 'Dividend Income') ? (
                                /* Cash Dividend Fields: Ticker + Amount */
                                <>
                                    <div className="col-span-full md:col-span-1">
                                        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide block mb-2">Ticker Symbol</label>
                                        <input type="text" className="input" placeholder="e.g. AAPL" value={ticker} onChange={e => setTicker(e.target.value)} required autoFocus />
                                    </div>
                                    <div className="col-span-full md:col-span-1">
                                        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide block mb-2">Dividend Amount Total ($)</label>
                                        <input
                                            type="number"
                                            step="any"
                                            className="input"
                                            placeholder="0.00"
                                            value={price}
                                            onChange={e => setPrice(e.target.value)}
                                            required
                                        />
                                    </div>
                                </>
                            ) : type === 'Stock Split' ? (
                                /* Stock Split Fields: Ticker + New Additional Shares */
                                <>
                                    <div className="col-span-full md:col-span-1">
                                        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide block mb-2">Ticker Symbol</label>
                                        <input type="text" className="input" placeholder="e.g. AAPL" value={ticker} onChange={e => setTicker(e.target.value)} required autoFocus />
                                    </div>
                                    <div className="col-span-full md:col-span-1">
                                        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide block mb-2">Additional Shares Received</label>
                                        <input type="number" step="any" className="input" placeholder="0" value={shares} onChange={e => setShares(e.target.value)} required />
                                    </div>
                                </>
                            ) : (
                                /* Asset Transaction Fields (Buy, Sell, DRIP) */
                                <>
                                    <div className="col-span-full md:col-span-1">
                                        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide block mb-2">Ticker Symbol</label>
                                        <input type="text" className="input" placeholder="e.g. AAPL" value={ticker} onChange={e => setTicker(e.target.value)} required autoFocus />
                                    </div>
                                    <div>
                                        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide block mb-2">Shares</label>
                                        <input type="number" step="any" className="input" placeholder="0" value={shares} onChange={e => setShares(e.target.value)} required />
                                    </div>
                                    <div>
                                        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide block mb-2">Price per Share</label>
                                        <input type="number" step="any" className="input" placeholder="0.00" value={price} onChange={e => setPrice(e.target.value)} required />
                                    </div>
                                    <div>
                                        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide block mb-2">Commission</label>
                                        <input type="number" step="any" className="input" placeholder="0.00" value={commission} onChange={e => setCommission(e.target.value)} />
                                    </div>
                                </>
                            )}

                            <div className="col-span-full flex justify-end gap-3 mt-4 pt-4 border-t border-slate-700/50">
                                <button type="button" className="btn btn-secondary px-6" onClick={closeForm}>Cancel</button>
                                <button type="submit" className="btn btn-primary px-6 shadow-lg shadow-blue-900/20">
                                    <Save size={18} className="mr-2" /> {editingTxId ? 'Update' : 'Save'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Assets List Grid */}
            {activeTab === 'assets' && (
                <div className="flex flex-col gap-6">
                    {assets.map(asset => {
                        const sPrice = simSellPrice[asset.id] || '';
                        const bAmount = simBuyAmount[asset.id] || '';

                        return (
                            <div key={asset.id} className="glass-panel p-0 overflow-hidden border border-slate-700/50 bg-slate-800/40 hover:bg-slate-800/50 transition-all duration-300 shadow-xl">
                                {/* Header Row - All Key Metrics */}
                                <div className="p-5 bg-slate-800/30 border-b border-slate-700/50">
                                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-6">
                                        {/* 1. Stock Symbol/Shares */}
                                        <div>
                                            <h3 className="text-2xl font-bold text-white leading-none">{asset.ticker}</h3>
                                            <p className="text-sm text-slate-300 font-medium mt-1">{asset.quantity.toLocaleString()} shares</p>
                                        </div>

                                        {/* 2. Avg. Cost */}
                                        <div className="text-center">
                                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Avg. Cost</p>
                                            <p className="text-2xl font-mono font-bold text-slate-200">${asset.averageCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                                        </div>

                                        {/* 3. Current Price */}
                                        <div className="text-center">
                                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Current Price</p>
                                            <div className="flex items-center justify-center gap-2">
                                                <span className="text-2xl font-mono font-bold text-white">${asset.currentPrice.toFixed(2)}</span>
                                                <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${asset.todayChangePercent >= 0 ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                                                    {asset.todayChangePercent > 0 ? '+' : ''}{asset.todayChangePercent?.toFixed(2)}%
                                                </span>
                                            </div>
                                        </div>

                                        {/* 4. Book Cost */}
                                        <div className="text-center">
                                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1 flex items-center justify-center gap-1">
                                                Book Cost
                                                {asset.customBookCost !== undefined && asset.customBookCost !== null && (
                                                    <span className="text-[9px] bg-blue-500/20 text-blue-400 px-1 rounded">Custom</span>
                                                )}
                                            </p>
                                            {editingBookCostId === asset.id ? (
                                                <div className="flex items-center justify-center gap-2">
                                                    <input
                                                        type="number"
                                                        step="any"
                                                        className="w-32 bg-slate-900 border border-blue-500 rounded px-2 py-1 text-base text-white font-mono focus:outline-none input-no-spinner"
                                                        value={customBookCostInput[asset.id] || ''}
                                                        onChange={(e) => setCustomBookCostInput({ ...customBookCostInput, [asset.id]: e.target.value })}
                                                        autoFocus
                                                    />
                                                    <button
                                                        onClick={() => {
                                                            const rawInput = customBookCostInput[asset.id];
                                                            // Remove commas and dollar signs just in case
                                                            const cleaned = rawInput ? rawInput.toString().replace(/[,$]/g, '') : '';
                                                            const value = parseFloat(cleaned);

                                                            console.log(`[UI] Setting Custom Book Cost for ${asset.ticker}: Input='${rawInput}' Parsed=${value}`);

                                                            if (!isNaN(value) && value >= 0) {
                                                                updateAssetCustomBookCost(asset.id, value);
                                                            } else {
                                                                console.warn(`[UI] Invalid custom cost input: ${rawInput}`);
                                                                alert("Please enter a valid number (e.g. 18240.08)");
                                                            }
                                                            setEditingBookCostId(null);
                                                        }}
                                                        className="p-1 hover:bg-green-700 rounded text-green-400 hover:text-white transition-all"
                                                    >
                                                        <Save size={16} />
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            setEditingBookCostId(null);
                                                            setCustomBookCostInput({ ...customBookCostInput, [asset.id]: '' });
                                                        }}
                                                        className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-white transition-all"
                                                    >
                                                        <X size={16} />
                                                    </button>
                                                    {asset.customBookCost !== undefined && asset.customBookCost !== null && (
                                                        <button
                                                            onClick={() => {
                                                                updateAssetCustomBookCost(asset.id, null);
                                                                setEditingBookCostId(null);
                                                                setCustomBookCostInput({ ...customBookCostInput, [asset.id]: '' });
                                                            }}
                                                            className="p-1 hover:bg-red-700 rounded text-red-400 hover:text-white transition-all"
                                                            title="Reset to calculated"
                                                        >
                                                            <RotateCcw size={16} />
                                                        </button>
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="flex items-center justify-center gap-2">
                                                    <p className="text-2xl font-mono font-bold text-slate-200">
                                                        ${(asset.customBookCost !== undefined && asset.customBookCost !== null ? asset.customBookCost : asset.totalCost).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                    </p>
                                                    <button
                                                        onClick={() => {
                                                            setEditingBookCostId(asset.id);
                                                            setCustomBookCostInput({
                                                                ...customBookCostInput,
                                                                [asset.id]: (asset.customBookCost !== undefined && asset.customBookCost !== null ? asset.customBookCost : asset.totalCost).toString()
                                                            });
                                                        }}
                                                        className="p-1 hover:bg-slate-700 rounded text-slate-500 hover:text-white transition-all"
                                                    >
                                                        <Pencil size={14} />
                                                    </button>
                                                </div>
                                            )}
                                        </div>

                                        {/* 5. Market Value */}
                                        <div className="text-center">
                                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Market Value</p>
                                            <p className={`text-2xl font-mono font-bold ${asset.marketValue >= (asset.customBookCost !== undefined && asset.customBookCost !== null ? asset.customBookCost : asset.totalCost) ? 'text-green-400' : 'text-red-400'}`}>
                                                ${asset.marketValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </p>
                                        </div>

                                        {/* 6. P/L ($) */}
                                        <div className="text-center">
                                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">P/L ($)</p>
                                            <p className={`text-2xl font-mono font-bold ${asset.profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                {asset.profit >= 0 ? '+' : '-'}${Math.abs(asset.profit).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </p>
                                        </div>

                                        {/* 7. P/L (%) */}
                                        <div className="text-center">
                                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">P/L (%)</p>
                                            <p className={`text-2xl font-mono font-bold ${asset.profitPercent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                {asset.profitPercent >= 0 ? '+' : ''}{asset.profitPercent.toFixed(2)}%
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Content Grid */}
                                <div className="p-4 grid grid-cols-1 lg:grid-cols-[1fr_240px] gap-6">
                                    {/* Left Content Area */}
                                    <div className="space-y-6">

                                        {/* Row 2: 52W Stats */}
                                        <div className="grid grid-cols-2 lg:grid-cols-3 gap-6 pb-4 border-b border-slate-700/30 bg-slate-800/10 p-3 rounded-lg">
                                            <div>
                                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">52W High</p>
                                                <p className="font-mono text-white text-base font-bold">${asset.high52Week?.toFixed(2) || '-'}</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">52W Low</p>
                                                <p className="font-mono text-white text-base font-bold">${asset.low52Week?.toFixed(2) || '-'}</p>
                                            </div>
                                            <div className="col-span-1">
                                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1.5">% to High</p>
                                                <div className="flex items-center gap-2">
                                                    <div className="flex-1 h-1.5 bg-slate-900 rounded-full overflow-hidden">
                                                        <div
                                                            className="h-full bg-blue-500/80"
                                                            style={{ width: `${Math.max(0, Math.min(100, (asset.currentPrice / (asset.high52Week || 1)) * 100))}%` }}
                                                        ></div>
                                                    </div>
                                                    <span className="text-xs text-white font-mono font-bold">
                                                        {asset.high52Week ? (100 - (asset.currentPrice / asset.high52Week * 100)).toFixed(1) : '-'}%
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Row 3: Simulators */}
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                            {/* Sell Simulator */}
                                            <div>
                                                <h4 className="text-[9px] font-bold text-slate-500 uppercase flex items-center gap-2 mb-2"><Calculator size={12} /> Sell Simulator</h4>
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div>
                                                        <div className="relative mb-2">
                                                            <span className="absolute left-2.5 top-1.5 text-slate-500 text-[10px]">$</span>
                                                            <input
                                                                type="number"
                                                                className="bg-slate-900 border border-slate-700 rounded px-5 py-1 text-xs text-white w-full focus:outline-none focus:border-blue-500 input-no-spinner"
                                                                placeholder="Sell Amount"
                                                                value={sPrice}
                                                                onChange={(e) => setSimSellPrice({ ...simSellPrice, [asset.id]: e.target.value })}
                                                            />
                                                        </div>
                                                        {sPrice && (() => {
                                                            const amountVal = parseFloat(sPrice);
                                                            if (isNaN(amountVal) || amountVal <= 0) return null;
                                                            const sharesNum = amountVal / (asset.currentPrice || 1);
                                                            const effectiveBookCost = asset.customBookCost !== undefined && asset.customBookCost !== null ? asset.customBookCost : asset.totalCost;
                                                            const impliedAvgCost = asset.quantity > 0 ? (effectiveBookCost / asset.quantity) : asset.averageCost;
                                                            const profit = (asset.currentPrice - impliedAvgCost) * sharesNum;

                                                            const newQuantity = asset.quantity - sharesNum;
                                                            const newBookCost = effectiveBookCost - (sharesNum * impliedAvgCost);
                                                            const newMarketValue = newQuantity * asset.currentPrice;
                                                            const newAvg = newQuantity > 0 ? (newBookCost / newQuantity) : impliedAvgCost;
                                                            const newProfit = newMarketValue - newBookCost;
                                                            const newProfitPercent = Math.abs(newBookCost) > 0.01 ? (newProfit / newBookCost) * 100 : 0;

                                                            return (
                                                                <div className="text-[10px] space-y-0.5 px-1">
                                                                    <div className="flex justify-between">
                                                                        <p className="text-slate-400">Sells: <span className="text-white font-mono">{sharesNum.toFixed(2)} sh</span></p>
                                                                        <p className={`font-bold font-mono ${profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                                            {profit >= 0 ? '+' : '-'}${Math.abs(profit).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                        </p>
                                                                    </div>
                                                                    <div className="border-t border-slate-700/50 pt-1 mt-1 space-y-0.5">
                                                                        <p className="text-slate-500 flex justify-between"><span>New Book:</span> <span className="text-white font-mono">${newBookCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></p>
                                                                        <p className="text-slate-500 flex justify-between"><span>New MV:</span> <span className="text-white font-mono">${newMarketValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></p>
                                                                        <p className="text-slate-500 flex justify-between"><span>New P/L:</span> <span className={`${newProfit >= 0 ? 'text-green-400' : 'text-red-400'} font-bold font-mono`}>{newProfit >= 0 ? '+' : '-'}${Math.abs(newProfit).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ({newProfitPercent.toFixed(2)}%)</span></p>
                                                                        <p className="text-slate-500 flex justify-between"><span>New Avg:</span> <span className="text-blue-400 font-bold font-mono">${newAvg.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></p>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })()}
                                                    </div>
                                                    <div>
                                                        <input
                                                            type="number"
                                                            className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white w-full focus:outline-none focus:border-blue-500 input-no-spinner mb-2"
                                                            placeholder="Shares"
                                                            value={simSellShares[asset.id] || ''}
                                                            onChange={(e) => setSimSellShares({ ...simSellShares, [asset.id]: e.target.value })}
                                                        />
                                                        {simSellShares[asset.id] && (() => {
                                                            const sharesVal = parseFloat(simSellShares[asset.id]);
                                                            if (isNaN(sharesVal) || sharesVal <= 0) return null;
                                                            const proceeds = sharesVal * asset.currentPrice;
                                                            const effectiveBookCost = asset.customBookCost !== undefined && asset.customBookCost !== null ? asset.customBookCost : asset.totalCost;
                                                            const impliedAvgCost = asset.quantity > 0 ? (effectiveBookCost / asset.quantity) : asset.averageCost;
                                                            const profit = (asset.currentPrice - impliedAvgCost) * sharesVal;

                                                            const newQuantity = asset.quantity - sharesVal;
                                                            const newBookCost = effectiveBookCost - (sharesVal * impliedAvgCost);
                                                            const newMarketValue = newQuantity * asset.currentPrice;
                                                            const newAvg = newQuantity > 0 ? (newBookCost / newQuantity) : impliedAvgCost;
                                                            const newProfit = newMarketValue - newBookCost;
                                                            const newProfitPercent = Math.abs(newBookCost) > 0.01 ? (newProfit / newBookCost) * 100 : 0;

                                                            return (
                                                                <div className="text-[10px] space-y-0.5 px-1">
                                                                    <div className="flex justify-between">
                                                                        <p className="text-slate-400">Proc: <span className="text-white font-mono">${proceeds.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></p>
                                                                        <p className={`font-bold font-mono ${profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                                            {profit >= 0 ? '+' : '-'}${Math.abs(profit).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                        </p>
                                                                    </div>
                                                                    <div className="border-t border-slate-700/50 pt-1 mt-1 space-y-0.5">
                                                                        <p className="text-slate-500 flex justify-between"><span>New Book:</span> <span className="text-white font-mono">${newBookCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></p>
                                                                        <p className="text-slate-500 flex justify-between"><span>New MV:</span> <span className="text-white font-mono">${newMarketValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></p>
                                                                        <p className="text-slate-500 flex justify-between"><span>New P/L:</span> <span className={`${newProfit >= 0 ? 'text-green-400' : 'text-red-400'} font-bold font-mono`}>{newProfit >= 0 ? '+' : '-'}${Math.abs(newProfit).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ({newProfitPercent.toFixed(2)}%)</span></p>
                                                                        <p className="text-slate-500 flex justify-between"><span>New Avg:</span> <span className="text-blue-400 font-bold font-mono">${newAvg.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></p>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })()}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Buy Simulator */}
                                            <div>
                                                <h4 className="text-[9px] font-bold text-slate-500 uppercase flex items-center gap-2 mb-2"><RefreshCw size={12} /> Buy Simulator</h4>
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div>
                                                        <div className="relative mb-2">
                                                            <span className="absolute left-2.5 top-1.5 text-slate-500 text-[10px]">$</span>
                                                            <input
                                                                type="number"
                                                                className="bg-slate-900 border border-slate-700 rounded px-5 py-1 text-xs text-white w-full focus:outline-none focus:border-blue-500 input-no-spinner"
                                                                placeholder="Invest Amount"
                                                                value={bAmount}
                                                                onChange={(e) => setSimBuyAmount({ ...simBuyAmount, [asset.id]: e.target.value })}
                                                            />
                                                        </div>
                                                        {bAmount && (() => {
                                                            const investVal = parseFloat(bAmount);
                                                            if (isNaN(investVal) || investVal <= 0) return null;
                                                            const sharesNum = investVal / (asset.currentPrice || 1);
                                                            const effectiveBookCost = asset.customBookCost !== undefined && asset.customBookCost !== null ? asset.customBookCost : asset.totalCost;
                                                            const newAvg = (effectiveBookCost + investVal) / (asset.quantity + sharesNum);

                                                            const newQuantity = asset.quantity + sharesNum;
                                                            const newBookCost = effectiveBookCost + investVal;
                                                            const newMarketValue = newQuantity * asset.currentPrice;
                                                            const newProfit = newMarketValue - newBookCost;
                                                            const newProfitPercent = Math.abs(newBookCost) > 0.01 ? (newProfit / newBookCost) * 100 : 0;

                                                            return (
                                                                <div className="text-[10px] space-y-0.5 px-1">
                                                                    <div className="flex justify-between">
                                                                        <p className="text-slate-400 flex justify-between"><span>Buys:</span> <span className="text-white font-mono ml-1">{sharesNum.toFixed(2)} sh</span></p>
                                                                    </div>
                                                                    <div className="border-t border-slate-700/50 pt-1 mt-1 space-y-0.5">
                                                                        <p className="text-slate-500 flex justify-between"><span>New Book:</span> <span className="text-white font-mono">${newBookCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></p>
                                                                        <p className="text-slate-500 flex justify-between"><span>New MV:</span> <span className="text-white font-mono">${newMarketValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></p>
                                                                        <p className="text-slate-500 flex justify-between"><span>New P/L:</span> <span className={`${newProfit >= 0 ? 'text-green-400' : 'text-red-400'} font-bold font-mono`}>{newProfit >= 0 ? '+' : '-'}${Math.abs(newProfit).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ({newProfitPercent.toFixed(2)}%)</span></p>
                                                                        <p className="text-slate-500 flex justify-between"><span>New Avg:</span> <span className="text-blue-400 font-bold font-mono">${newAvg.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></p>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })()}
                                                    </div>
                                                    <div>
                                                        <input
                                                            type="number"
                                                            className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white w-full focus:outline-none focus:border-blue-500 input-no-spinner mb-2"
                                                            placeholder="Shares"
                                                            value={simBuyShares[asset.id] || ''}
                                                            onChange={(e) => setSimBuyShares({ ...simBuyShares, [asset.id]: e.target.value })}
                                                        />
                                                        {simBuyShares[asset.id] && (() => {
                                                            const sharesVal = parseFloat(simBuyShares[asset.id]);
                                                            if (isNaN(sharesVal) || sharesVal <= 0) return null;
                                                            const costVal = sharesVal * asset.currentPrice;
                                                            const effectiveBookCost = asset.customBookCost !== undefined && asset.customBookCost !== null ? asset.customBookCost : asset.totalCost;
                                                            const newAvg = (effectiveBookCost + costVal) / (asset.quantity + sharesVal);

                                                            const newQuantity = asset.quantity + sharesVal;
                                                            const newBookCost = effectiveBookCost + costVal;
                                                            const newMarketValue = newQuantity * asset.currentPrice;
                                                            const newProfit = newMarketValue - newBookCost;
                                                            const newProfitPercent = Math.abs(newBookCost) > 0.01 ? (newProfit / newBookCost) * 100 : 0;

                                                            return (
                                                                <div className="text-[10px] space-y-0.5 px-1">
                                                                    <div className="flex justify-between">
                                                                        <p className="text-slate-400">Cost: <span className="text-white font-mono">${costVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></p>
                                                                    </div>
                                                                    <div className="border-t border-slate-700/50 pt-1 mt-1 space-y-0.5">
                                                                        <p className="text-slate-500 flex justify-between"><span>New Book:</span> <span className="text-white font-mono">${newBookCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></p>
                                                                        <p className="text-slate-500 flex justify-between"><span>New MV:</span> <span className="text-white font-mono">${newMarketValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></p>
                                                                        <p className="text-slate-500 flex justify-between"><span>New P/L:</span> <span className={`${newProfit >= 0 ? 'text-green-400' : 'text-red-400'} font-bold font-mono`}>{newProfit >= 0 ? '+' : '-'}${Math.abs(newProfit).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ({newProfitPercent.toFixed(2)}%)</span></p>
                                                                        <p className="text-slate-500 flex justify-between"><span>New Avg:</span> <span className="text-blue-400 font-bold font-mono">${newAvg.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></p>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })()}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Right Content Area: Sparkline */}
                                    {/* Right Content Area: Sparkline */}
                                    <div className="bg-slate-900/40 rounded-xl p-3 border border-slate-700/30 flex flex-col justify-between">
                                        <div className="flex justify-between items-center mb-2">
                                            <p className="text-[9px] text-slate-500 font-bold uppercase">{asset.chartRange || '1MO'} Trend</p>
                                            <div className="flex gap-1">
                                                {['1mo', '3mo', '1y', '5y'].map((range) => (
                                                    <button
                                                        key={range}
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            // Only refresh THIS asset alone
                                                            refreshAsset(asset.id, range);
                                                        }}
                                                        className={`text-[8px] px-1.5 py-0.5 rounded uppercase font-bold transition-colors ${asset.chartRange === range || (!asset.chartRange && range === '1mo')
                                                            ? 'bg-blue-600/20 text-blue-400'
                                                            : 'text-slate-500 hover:text-slate-300 hover:bg-slate-700'
                                                            }`}
                                                    >
                                                        {range}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="w-full h-24">
                                            {asset.sparkline && asset.sparkline.length > 0 ? (
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <AreaChart data={asset.sparkline}>
                                                        <defs>
                                                            <linearGradient id={`grad-${asset.id}`} x1="0" y1="0" x2="0" y2="1">
                                                                <stop offset="5%" stopColor={asset.todayChangePercent >= 0 ? '#10b981' : '#ef4444'} stopOpacity={0.4} />
                                                                <stop offset="95%" stopColor={asset.todayChangePercent >= 0 ? '#10b981' : '#ef4444'} stopOpacity={0} />
                                                            </linearGradient>
                                                        </defs>
                                                        <Tooltip
                                                            cursor={{ stroke: '#475569', strokeWidth: 1 }}
                                                            contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f8fafc', fontSize: '12px', padding: '8px' }}
                                                            itemStyle={{ color: '#f8fafc' }}
                                                            formatter={(value: any) => [`$${parseFloat(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 'Price']}
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
                                                <div className="h-full flex flex-col items-center justify-center text-slate-600 text-[10px] italic text-center">
                                                    <RotateCcw size={16} className="mb-1 opacity-50" />
                                                    <span>Click "Refresh Prices"</span>
                                                    <span className="text-[8px]">to load chart</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}

                    {assets.length === 0 && (
                        <div className="text-center py-20 bg-slate-800/20 rounded-2xl border border-dashed border-slate-700">
                            <Plus size={48} className="text-slate-600 mx-auto mb-4 opacity-50" />
                            <p className="text-slate-400 font-medium">No assets in this account yet.</p>
                            <button onClick={() => setIsAdding(true)} className="text-blue-400 hover:text-blue-300 text-sm mt-2 font-bold decoration-dotted underline underline-offset-4 tracking-wide">
                                Add your first transaction
                            </button>
                        </div>
                    )}
                </div>
            )
            }

            {/* Transactions History Implementation */}
            {activeTab === 'transactions' && (
                <div className="glass-panel overflow-hidden">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-800/50 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-700/50">
                            <tr>
                                <th className="px-6 py-4">Date</th>
                                <th className="px-6 py-4">Ticker</th>
                                <th className="px-6 py-4">Type</th>
                                <th className="px-6 py-4 text-right">Shares</th>
                                <th className="px-6 py-4 text-right">Price</th>
                                <th className="px-6 py-4 text-right">Amount</th>
                                <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700/30">
                            {transactions
                                .filter(t => t.accountId === account.id)
                                .map((t, index) => ({ ...t, _originalIndex: index }))
                                .sort((a, b) => {
                                    const dateA = new Date(a.date).getTime();
                                    const dateB = new Date(b.date).getTime();
                                    if (dateA !== dateB) {
                                        return dateB - dateA;
                                    }
                                    return b._originalIndex - a._originalIndex;
                                })
                                .map(tx => (
                                    <tr key={tx.id} className="hover:bg-slate-800/20 transition-colors">
                                        <td className="px-6 py-4 text-sm text-slate-400 font-mono">{tx.date}</td>
                                        <td className="px-6 py-4 text-sm font-bold text-white">{tx.ticker}</td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${tx.type === 'Buy' || tx.type === 'DRIP' || tx.type === 'Dividend Reinvested' || tx.type === 'Stock Split' ? 'bg-green-500/10 text-green-400' : tx.type === 'Sell' ? 'bg-red-500/10 text-red-400' : 'bg-blue-500/10 text-blue-400'}`}>
                                                {tx.type}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-right font-mono text-slate-300">
                                            {tx.shares ? (tx.type === 'Sell' ? '-' : '+') + tx.shares.toLocaleString(undefined, { maximumFractionDigits: 4 }) : '-'}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-right font-mono text-slate-300">${tx.pricePerShare ? tx.pricePerShare.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}</td>
                                        <td className="px-6 py-4 text-sm text-right font-mono text-white font-bold">${tx.amount ? tx.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}</td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex justify-end gap-2">
                                                <button onClick={() => startEditTx(tx)} className="p-1.5 hover:bg-slate-700 rounded text-slate-400 hover:text-white transition-all"><Pencil size={14} /></button>
                                                <button onClick={() => deleteTransaction(tx.id)} className="p-1.5 hover:bg-red-900/30 rounded text-slate-400 hover:text-red-400 transition-all"><Trash2 size={14} /></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            {transactions.filter(t => t.accountId === account.id).length === 0 && (
                                <tr>
                                    <td colSpan={7} className="px-6 py-10 text-center text-slate-500 italic text-sm">No transaction history found.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Portfolio Balancer */}
            <PortfolioBalancer account={account} assets={assets} totalInvested={totalValue} />

            {/* Average Down Calculator */}
            <AverageDownCalc assets={assets} />
        </div>
    );
};

export default AccountDetails;
