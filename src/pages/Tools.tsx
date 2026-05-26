import React, { useState, useMemo, useEffect } from 'react';
import { Wrench, Target, Shield, PieChart, Leaf, Plus, Trash2, TrendingUp, AlertTriangle, CheckCircle, RotateCcw, ShoppingCart } from 'lucide-react';
import { useData } from '../context/DataContext';
import '../styles/shared.css';

// ─── Helpers ────────────────────────────────────────────────────────────────

const fmtCurrency = (n: number): string =>
    n.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtPct = (n: number): string => n.toFixed(2) + '%';

interface InputFieldProps {
    label: string;
    value: string;
    onChange: (v: string) => void;
    prefix?: string;
    suffix?: string;
    placeholder?: string;
    step?: string;
    min?: string;
    action?: React.ReactNode;
}

const InputField: React.FC<InputFieldProps> = ({ label, value, onChange, prefix, suffix, placeholder, step = 'any', min = '0', action }) => (
    <div>
        <div className="flex justify-between items-end mb-1.5">
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide">{label}</label>
            {action && <div>{action}</div>}
        </div>
        <div className="relative flex items-center">
            {prefix && <span className="absolute left-3 text-slate-400 text-sm font-medium pointer-events-none">{prefix}</span>}
            <input
                type="number"
                step={step}
                min={min}
                className="input input-no-spinner w-full"
                style={{ paddingLeft: prefix ? '1.75rem' : undefined, paddingRight: suffix ? '2.5rem' : undefined }}
                value={value}
                onChange={e => onChange(e.target.value)}
                placeholder={placeholder ?? '0'}
            />
            {suffix && <span className="absolute right-3 text-slate-400 text-sm font-medium pointer-events-none">{suffix}</span>}
        </div>
    </div>
);

const ResultRow: React.FC<{ label: string; value: string; color?: string; large?: boolean }> = ({
    label, value, color = 'text-white', large = false
}) => (
    <div className="flex justify-between items-center py-2 border-b border-slate-700/40 last:border-0">
        <span className="text-sm text-slate-400">{label}</span>
        <span className={`font-mono font-bold ${large ? 'text-lg' : 'text-sm'} ${color}`}>{value}</span>
    </div>
);

const CardShell: React.FC<{ icon: React.ReactNode; title: string; subtitle: string; accentColor: string; onClear?: () => void; children: React.ReactNode }> = ({
    icon, title, subtitle, accentColor, onClear, children
}) => (
    <div className={`bg-slate-800/50 border border-slate-700/50 rounded-2xl overflow-hidden shadow-xl flex flex-col`}>
        <div className={`p-5 border-b border-slate-700/50 bg-gradient-to-r ${accentColor} flex justify-between items-start`}>
            <div>
                <div className="flex items-center gap-3 mb-1">
                    <div className="p-2 bg-white/10 rounded-lg backdrop-blur-sm">{icon}</div>
                    <h2 className="text-lg font-bold text-white">{title}</h2>
                </div>
                <p className="text-xs text-white/60 ml-12">{subtitle}</p>
            </div>
            {onClear && (
                <button 
                    onClick={onClear}
                    title="Clear Calculator"
                    className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white/10 hover:bg-white/20 text-white/80 hover:text-white rounded-lg text-xs font-bold transition-colors"
                >
                    <RotateCcw size={14} /> Clear
                </button>
            )}
        </div>
        <div className="p-5 flex-1 flex flex-col gap-5">{children}</div>
    </div>
);

// ─── 0. Stock Buying Planner ───────────────────────────────────────────────

interface PlannedBuy {
    id: string;
    ticker: string;
    price: string;
    shares: string;
    currentPrice?: number;
    isLoadingPrice?: boolean;
}

interface AccountGroup {
    id: string;
    accountId: string;
    buys: PlannedBuy[];
}

const StockBuyingPlanner: React.FC = () => {
    const { accounts, getAssetsByAccount } = useData();
    const [groups, setGroups] = useState<AccountGroup[]>(() => {
        try {
            const saved = localStorage.getItem('stockPlannerGroups');
            if (saved) return JSON.parse(saved);
        } catch (e) {}
        return [
            { id: '1', accountId: accounts[0]?.id || '', buys: [{ id: 'b1', ticker: '', price: '', shares: '' }] }
        ];
    });

    useEffect(() => {
        localStorage.setItem('stockPlannerGroups', JSON.stringify(groups));
    }, [groups]);

    const addGroup = () => {
        setGroups([...groups, { id: Date.now().toString(), accountId: accounts[0]?.id || '', buys: [{ id: Date.now().toString() + 'b', ticker: '', price: '', shares: '' }] }]);
    };

    const removeGroup = (groupId: string) => {
        setGroups(groups.filter(g => g.id !== groupId));
    };

    const updateGroupAccount = (groupId: string, accountId: string) => {
        setGroups(groups.map(g => g.id === groupId ? { ...g, accountId } : g));
    };

    const addBuy = (groupId: string) => {
        setGroups(groups.map(g => g.id === groupId ? { ...g, buys: [...g.buys, { id: Date.now().toString(), ticker: '', price: '', shares: '' }] } : g));
    };

    const removeBuy = (groupId: string, buyId: string) => {
        setGroups(groups.map(g => g.id === groupId ? { ...g, buys: g.buys.filter(b => b.id !== buyId) } : g));
    };

    const updateBuy = (groupId: string, buyId: string, field: keyof PlannedBuy, value: string) => {
        setGroups(groups.map(g => g.id === groupId ? {
            ...g,
            buys: g.buys.map(b => b.id === buyId ? { ...b, [field]: field === 'ticker' ? value.toUpperCase() : value } : b)
        } : g));
    };

    const handleClear = () => {
        setGroups([{ id: '1', accountId: accounts[0]?.id || '', buys: [{ id: 'b1', ticker: '', price: '', shares: '' }] }]);
    };

    const handleTickerBlur = async (groupId: string, buyId: string, ticker: string) => {
        if (!ticker.trim()) return;
        const upperTicker = ticker.toUpperCase();
        
        const group = groups.find(g => g.id === groupId);
        if (!group) return;
        
        const assets = getAssetsByAccount(group.accountId);
        const existingAsset = assets.find(a => a.ticker === upperTicker);
        
        if (existingAsset && existingAsset.currentPrice) {
            setGroups(prev => prev.map(g => g.id === groupId ? {
                ...g,
                buys: g.buys.map(b => b.id === buyId ? {
                    ...b,
                    currentPrice: existingAsset.currentPrice,
                    price: b.price === '' ? existingAsset.currentPrice.toFixed(2) : b.price
                } : b)
            } : g));
            return;
        }

        setGroups(prev => prev.map(g => g.id === groupId ? { ...g, buys: g.buys.map(b => b.id === buyId ? { ...b, isLoadingPrice: true } : b) } : g));
        try {
            const res = await fetch(`/api/quote?symbol=${upperTicker}`);
            if (res.ok) {
                const data = await res.json();
                const currentPrice = data.regularMarketPrice;
                if (currentPrice !== undefined) {
                    setGroups(prev => prev.map(g => g.id === groupId ? {
                        ...g,
                        buys: g.buys.map(b => b.id === buyId ? { 
                            ...b, 
                            currentPrice, 
                            isLoadingPrice: false,
                            price: b.price === '' ? currentPrice.toFixed(2) : b.price 
                        } : b)
                    } : g));
                    return;
                }
            }
        } catch (e) {}
        
        setGroups(prev => prev.map(g => g.id === groupId ? { ...g, buys: g.buys.map(b => b.id === buyId ? { ...b, isLoadingPrice: false } : b) } : g));
    };

    const grandTotal = groups.reduce((sum, g) => sum + g.buys.reduce((s, b) => s + (parseFloat(b.price) || 0) * (parseFloat(b.shares) || 0), 0), 0);

    return (
        <CardShell
            icon={<ShoppingCart size={20} className="text-white" />}
            title="Stock Buying Planner"
            subtitle="Plan your stock purchases, track total spend, and preview your new average costs"
            accentColor="from-emerald-900/80 to-teal-900/60"
            onClear={handleClear}
        >
            <div className="flex flex-col gap-6">
                {groups.map((group, groupIdx) => {
                    const selectedAccount = accounts.find(a => a.id === group.accountId);
                    const availableCash = selectedAccount?.cashBalance || 0;
                    const assets = selectedAccount ? getAssetsByAccount(group.accountId) : [];
                    
                    const groupTotal = group.buys.reduce((sum, b) => sum + (parseFloat(b.price) || 0) * (parseFloat(b.shares) || 0), 0);
                    const remainingCash = availableCash - groupTotal;
                    const isOverdrawn = remainingCash < 0;

                    return (
                        <div key={group.id} className="flex flex-col gap-3 bg-slate-900/40 p-4 rounded-xl border border-slate-700/50 relative">
                            {groups.length > 1 && (
                                <button
                                    onClick={() => removeGroup(group.id)}
                                    className="absolute -top-3 -right-3 p-1.5 bg-red-500/20 text-red-400 hover:bg-red-500 hover:text-white rounded-full transition-colors z-10 border border-red-500/30 shadow-lg"
                                    title="Remove Account Group"
                                >
                                    <Trash2 size={14} />
                                </button>
                            )}
                            
                            {/* Account Selection & Cash Summary */}
                            <div className="flex items-center gap-4 bg-slate-800/60 p-3 rounded-lg border border-slate-700/50">
                                <div className="flex-1">
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Account {groupIdx + 1}</label>
                                    <select 
                                        className="input w-full bg-slate-900/80 text-sm font-bold border-slate-700/60"
                                        value={group.accountId}
                                        onChange={e => updateGroupAccount(group.id, e.target.value)}
                                    >
                                        <option value="" disabled>Select an Account</option>
                                        {accounts.map(a => (
                                            <option key={a.id} value={a.id}>{a.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Available Cash</p>
                                    <p className="font-mono font-bold text-lg text-emerald-400">${fmtCurrency(availableCash)}</p>
                                </div>
                            </div>

                            {/* Planned Buys */}
                            <div className="flex flex-col gap-2 pl-2 border-l-2 border-slate-700/50">
                                {group.buys.map(buy => {
                                    const p = parseFloat(buy.price) || 0;
                                    const s = parseFloat(buy.shares) || 0;
                                    const cost = p * s;
                                    const existingAsset = assets.find(a => a.ticker === buy.ticker && buy.ticker !== '');
                                    
                                    let newAvgCostMsg = '';
                                    if (existingAsset && p > 0 && s > 0) {
                                        const oldTotalCost = existingAsset.quantity * existingAsset.averageCost;
                                        const newTotalCost = oldTotalCost + cost;
                                        const newTotalQty = existingAsset.quantity + s;
                                        const newAvg = newTotalCost / newTotalQty;
                                        newAvgCostMsg = `Avg: $${fmtCurrency(existingAsset.averageCost)} → $${fmtCurrency(newAvg)} (${newTotalQty} shs)`;
                                    }

                                    return (
                                        <div key={buy.id} className="flex flex-col gap-2 p-2 bg-slate-900/60 rounded-lg border border-slate-700/30">
                                            <div className="flex flex-wrap md:flex-nowrap items-center gap-3">
                                                <input
                                                    type="text"
                                                    className="input flex-1 min-w-[90px] text-sm font-bold uppercase py-1.5"
                                                    placeholder="TICKER"
                                                    value={buy.ticker}
                                                    onChange={e => updateBuy(group.id, buy.id, 'ticker', e.target.value)}
                                                    onBlur={e => handleTickerBlur(group.id, buy.id, e.target.value)}
                                                    maxLength={15}
                                                />
                                                <input
                                                    type="number"
                                                    className="input input-no-spinner flex-1 min-w-[90px] text-sm font-mono py-1.5"
                                                    placeholder="Price ($)"
                                                    value={buy.price}
                                                    onChange={e => updateBuy(group.id, buy.id, 'price', e.target.value)}
                                                />
                                                <span className="text-slate-600 text-xs hidden md:block">×</span>
                                                <input
                                                    type="number"
                                                    className="input input-no-spinner flex-1 min-w-[90px] text-sm font-mono py-1.5"
                                                    placeholder="Shares"
                                                    value={buy.shares}
                                                    onChange={e => updateBuy(group.id, buy.id, 'shares', e.target.value)}
                                                />
                                                <div className="flex-1 min-w-[100px] text-right">
                                                    <span className="font-mono font-bold text-sm text-slate-200">${fmtCurrency(cost)}</span>
                                                </div>
                                                <button
                                                    onClick={() => removeBuy(group.id, buy.id)}
                                                    className="p-1.5 hover:bg-red-500/20 text-slate-500 hover:text-red-400 rounded transition-colors"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                            {(buy.isLoadingPrice || buy.currentPrice !== undefined || newAvgCostMsg) && (
                                                <div className="flex flex-wrap items-center gap-2 ml-1">
                                                    {buy.isLoadingPrice && (
                                                        <span className="text-[10px] text-slate-500 italic">Fetching...</span>
                                                    )}
                                                    {!buy.isLoadingPrice && buy.currentPrice !== undefined && (
                                                        <button 
                                                            onClick={() => updateBuy(group.id, buy.id, 'price', buy.currentPrice!.toFixed(2))}
                                                            className="text-[10px] text-emerald-400/80 hover:text-emerald-300 transition-colors px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 font-mono"
                                                            title="Click to use current price"
                                                        >
                                                            Market: ${buy.currentPrice.toFixed(2)}
                                                        </button>
                                                    )}
                                                    {newAvgCostMsg && (
                                                        <div className="text-[10px] text-blue-400/80 bg-blue-500/10 px-1.5 py-0.5 rounded border border-blue-500/20 font-mono">
                                                            {newAvgCostMsg}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>

                            <button
                                onClick={() => addBuy(group.id)}
                                className="flex items-center gap-1.5 justify-center py-1.5 text-xs font-bold text-slate-400 hover:text-emerald-400 border border-dashed border-slate-700 hover:border-emerald-500/50 rounded-lg transition-colors ml-2"
                            >
                                <Plus size={12} /> Add Stock to Account {groupIdx + 1}
                            </button>

                            {/* Account Footer Totals */}
                            <div className="flex justify-between items-center mt-2 p-3 bg-slate-800/40 rounded-lg border border-slate-700/40 ml-2">
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Account Spend</p>
                                    <p className="font-mono font-bold text-sm text-white">${fmtCurrency(groupTotal)}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Remaining Cash</p>
                                    <p className={`font-mono font-bold text-sm ${isOverdrawn ? 'text-red-400' : 'text-emerald-400'}`}>
                                        ${fmtCurrency(remainingCash)}
                                    </p>
                                </div>
                            </div>
                        </div>
                    );
                })}

                <button
                    onClick={addGroup}
                    className="flex items-center gap-2 justify-center py-2.5 text-sm font-bold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-xl shadow transition-colors"
                >
                    <Plus size={16} /> Add Another Account
                </button>

                {groups.length > 1 && (
                    <div className="flex justify-between items-center p-4 bg-gradient-to-r from-emerald-900/40 to-teal-900/40 rounded-xl border border-emerald-500/30">
                        <span className="text-sm font-bold text-emerald-400 uppercase tracking-widest">Grand Total Spend</span>
                        <span className="font-mono font-bold text-2xl text-emerald-400">${fmtCurrency(grandTotal)}</span>
                    </div>
                )}
            </div>
        </CardShell>
    );
};

// ─── 1. Profit / Loss & Risk-Reward Calculator ───────────────────────────────

const ProfitLossCalc: React.FC = () => {
    const [entry, setEntry] = useState('');
    const [target, setTarget] = useState('');
    const [stopLoss, setStopLoss] = useState('');
    const [shares, setShares] = useState('');

    const handleAutoStopLoss = () => {
        const e = parseFloat(entry);
        const t = parseFloat(target);
        if (e > 0 && t > e) {
            const reward = t - e;
            const risk = reward / 2;
            const autoSl = e - risk;
            if (autoSl > 0) {
                setStopLoss(autoSl.toFixed(2));
            }
        }
    };

    const result = useMemo(() => {
        const e = parseFloat(entry);
        const t = parseFloat(target);
        const s = parseFloat(stopLoss);
        const sh = parseFloat(shares);
        if (!e || !t || !s || !sh || e <= 0 || sh <= 0) return null;

        const profitPerShare = t - e;
        const lossPerShare = e - s;
        const totalProfit = profitPerShare * sh;
        const totalLoss = lossPerShare * sh;
        const profitPct = (profitPerShare / e) * 100;
        const lossPct = (lossPerShare / e) * 100;
        const rrRatio = lossPerShare > 0 ? profitPerShare / lossPerShare : 0;
        const isFavorable = rrRatio >= 2;

        return { totalProfit, totalLoss, profitPct, lossPct, rrRatio, isFavorable };
    }, [entry, target, stopLoss, shares]);

    const handleClear = () => {
        setEntry('');
        setTarget('');
        setStopLoss('');
        setShares('');
    };

    return (
        <CardShell
            icon={<Target size={20} className="text-white" />}
            title="Profit / Loss & Risk-Reward"
            subtitle="Evaluate your trade's upside vs. downside before entering"
            accentColor="from-blue-900/80 to-indigo-900/60"
            onClear={handleClear}
        >
            <div className="grid grid-cols-2 gap-3">
                <InputField label="Entry Price" value={entry} onChange={setEntry} prefix="$" placeholder="e.g. 50.00" />
                <InputField label="Target Price" value={target} onChange={setTarget} prefix="$" placeholder="e.g. 65.00" />
                <InputField 
                    label="Stop Loss Price" 
                    value={stopLoss} 
                    onChange={setStopLoss} 
                    prefix="$" 
                    placeholder="e.g. 45.00"
                    action={
                        <button 
                            type="button"
                            onClick={handleAutoStopLoss}
                            title="Auto-calculate 1:2 Risk/Reward based on Entry and Target"
                            className="text-[10px] text-blue-400 hover:text-blue-300 font-bold uppercase bg-blue-500/10 hover:bg-blue-500/20 px-1.5 py-0.5 rounded transition-colors"
                        >
                            Auto 1:2
                        </button>
                    }
                />
                <InputField label="Number of Shares" value={shares} onChange={setShares} placeholder="e.g. 100" step="1" />
            </div>

            {result ? (
                <div className="bg-slate-900/60 rounded-xl p-4 border border-slate-700/50">
                    <ResultRow label="Total Profit (at target)" value={`+$${fmtCurrency(result.totalProfit)}`} color="text-green-400" large />
                    <ResultRow label="Profit %" value={`+${fmtPct(result.profitPct)}`} color="text-green-400" />
                    <ResultRow label="Total Loss (at stop)" value={`-$${fmtCurrency(result.totalLoss)}`} color="text-red-400" large />
                    <ResultRow label="Loss %" value={`-${fmtPct(result.lossPct)}`} color="text-red-400" />
                    <div className="flex justify-between items-center pt-3 mt-1 border-t border-slate-700/40">
                        <span className="text-sm text-slate-400">Risk : Reward</span>
                        <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-white text-lg">
                                1 : {result.rrRatio.toFixed(2)}
                            </span>
                            {result.isFavorable ? (
                                <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-green-500/15 text-green-400 text-xs font-bold border border-green-500/30">
                                    <CheckCircle size={12} /> Favorable
                                </span>
                            ) : (
                                <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-500/15 text-red-400 text-xs font-bold border border-red-500/30">
                                    <AlertTriangle size={12} /> High Risk
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            ) : (
                <div className="flex-1 flex items-center justify-center text-slate-600 text-sm italic bg-slate-900/30 rounded-xl p-6 text-center">
                    Fill in all fields to see your risk/reward analysis
                </div>
            )}
        </CardShell>
    );
};

// ─── 2. Position Sizing Calculator ───────────────────────────────────────────

const API_BASE = 'http://localhost:3001';

const PositionSizingCalc: React.FC = () => {
    const [balance, setBalance] = useState('');
    const [riskPct, setRiskPct] = useState('1');
    const [entryPrice, setEntryPrice] = useState('');
    const [stopLoss, setStopLoss] = useState('');

    // ATR fields
    const [atrTicker, setAtrTicker] = useState('');
    const [currentATR, setCurrentATR] = useState('');
    const [multiplier, setMultiplier] = useState(2.0);
    const [atrLoading, setAtrLoading] = useState(false);
    const [atrError, setAtrError] = useState('');

    const fetchATR = async () => {
        const sym = atrTicker.trim().toUpperCase();
        if (!sym) return;
        setAtrLoading(true);
        setAtrError('');
        try {
            const res = await fetch(`${API_BASE}/api/stocks/${sym}/analysis`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            if (data.currentATR != null) {
                setCurrentATR(data.currentATR.toFixed(4));
                if (data.currentPrice) setEntryPrice(data.currentPrice.toFixed(2));
            } else {
                setAtrError('ATR not available for this symbol.');
            }
        } catch {
            setAtrError('Could not fetch ATR. Check ticker or server.');
        } finally {
            setAtrLoading(false);
        }
    };

    const handleAutoStopLoss = () => {
        const ep = parseFloat(entryPrice);
        const atr = parseFloat(currentATR);
        if (!ep || !atr || ep <= 0 || atr <= 0) return;
        const sl = ep - atr * multiplier;
        if (sl > 0) setStopLoss(sl.toFixed(2));
    };

    const result = useMemo(() => {
        const bal = parseFloat(balance);
        const rp = parseFloat(riskPct);
        const ep = parseFloat(entryPrice);
        const sl = parseFloat(stopLoss);
        if (!bal || !rp || !ep || !sl || ep <= sl || bal <= 0) return null;

        const dollarRisk = (rp / 100) * bal;
        const riskPerShare = ep - sl;
        const shares = Math.floor(dollarRisk / riskPerShare);
        const positionSize = shares * ep;
        const pctOfPortfolio = (positionSize / bal) * 100;

        return { dollarRisk, shares, positionSize, pctOfPortfolio, riskPerShare };
    }, [balance, riskPct, entryPrice, stopLoss]);

    const canAutoSL = parseFloat(entryPrice) > 0 && parseFloat(currentATR) > 0;

    const handleClear = () => {
        setBalance('');
        setRiskPct('1');
        setEntryPrice('');
        setStopLoss('');
        setAtrTicker('');
        setCurrentATR('');
        setMultiplier(2.0);
        setAtrError('');
    };

    return (
        <CardShell
            icon={<Shield size={20} className="text-white" />}
            title="Position Sizing"
            subtitle="Risk only what you can afford to lose on each trade"
            accentColor="from-blue-900/80 to-indigo-900/60"
            onClear={handleClear}
        >
            <div className="grid grid-cols-2 gap-3">
                <InputField label="Account Balance" value={balance} onChange={setBalance} prefix="$" placeholder="e.g. 25000" />
                <InputField label="Risk %" value={riskPct} onChange={setRiskPct} suffix="%" placeholder="e.g. 1" min="0.1" step="0.1" />
                <InputField label="Entry Price" value={entryPrice} onChange={setEntryPrice} prefix="$" placeholder="e.g. 50.00" />
                <InputField
                    label="Stop Loss Price"
                    value={stopLoss}
                    onChange={setStopLoss}
                    prefix="$"
                    placeholder="e.g. 46.00"
                    action={
                        <button
                            type="button"
                            onClick={handleAutoStopLoss}
                            disabled={!canAutoSL}
                            title="Set stop loss using ATR × Multiplier"
                            className="text-[10px] text-blue-400 hover:text-blue-300 font-bold uppercase bg-blue-500/10 hover:bg-blue-500/20 disabled:opacity-30 disabled:cursor-not-allowed px-1.5 py-0.5 rounded transition-colors"
                        >
                            ATR Auto
                        </button>
                    }
                />
            </div>

            {/* ATR Lookup Panel */}
            <div className="bg-slate-900/60 rounded-xl p-4 border border-slate-700/50 flex flex-col gap-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-blue-400">
                    📡 ATR-Based Stop Loss
                </p>

                {/* Ticker fetch row */}
                <div className="flex gap-2">
                    <div className="relative flex-1">
                        <input
                            type="text"
                            className="input input-no-spinner w-full uppercase"
                            placeholder="Ticker (e.g. AAPL)"
                            value={atrTicker}
                            onChange={e => setAtrTicker(e.target.value.toUpperCase())}
                            onKeyDown={e => e.key === 'Enter' && fetchATR()}
                        />
                    </div>
                    <button
                        onClick={fetchATR}
                        disabled={atrLoading || !atrTicker.trim()}
                        className="px-3 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg transition-colors whitespace-nowrap"
                    >
                        {atrLoading ? '...' : 'Fetch ATR'}
                    </button>
                </div>

                {atrError && (
                    <p className="text-xs text-red-400 flex items-center gap-1">
                        <AlertTriangle size={12} /> {atrError}
                    </p>
                )}

                {/* ATR value + multiplier */}
                <div className="grid grid-cols-2 gap-3">
                    <InputField
                        label="Current ATR ($)"
                        value={currentATR}
                        onChange={setCurrentATR}
                        prefix="$"
                        placeholder="Auto-filled or manual"
                    />
                    <div>
                        <div className="flex justify-between items-end mb-1.5">
                            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                                Volatility Multiplier
                            </label>
                            <span className="text-xs font-bold text-blue-400">{multiplier.toFixed(1)}×</span>
                        </div>
                        <input
                            type="range"
                            min="1.0"
                            max="3.0"
                            step="0.1"
                            value={multiplier}
                            onChange={e => setMultiplier(parseFloat(e.target.value))}
                            className="w-full accent-blue-500 cursor-pointer"
                        />
                        <div className="flex justify-between text-[10px] text-slate-600 mt-0.5">
                            <span>1.0× Tight</span>
                            <span>2.0× Standard</span>
                            <span>3.0× Wide</span>
                        </div>
                    </div>
                </div>

                {/* Preview of auto stop loss */}
                {canAutoSL && (
                    <div className="flex items-center justify-between p-2.5 bg-blue-500/8 border border-blue-500/20 rounded-lg">
                        <span className="text-xs text-slate-400">
                            Auto Stop: {parseFloat(entryPrice).toFixed(2)} − ({parseFloat(currentATR).toFixed(4)} × {multiplier.toFixed(1)})
                        </span>
                        <span className="font-mono font-bold text-blue-300 text-sm">
                            = ${Math.max(0, parseFloat(entryPrice) - parseFloat(currentATR) * multiplier).toFixed(2)}
                        </span>
                    </div>
                )}
            </div>

            {result ? (
                <div className="bg-slate-900/60 rounded-xl p-4 border border-slate-700/50">
                    {/* Dollar Risk — highlighted */}
                    <div className="mb-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/25 flex justify-between items-center">
                        <div>
                            <p className="text-xs font-bold uppercase tracking-wide text-amber-400 mb-0.5">⚠ Maximum Dollar Risk</p>
                            <p className="text-xs text-slate-400">This is the exact amount you can lose</p>
                        </div>
                        <span className="font-mono font-bold text-2xl text-amber-400">-${fmtCurrency(result.dollarRisk)}</span>
                    </div>
                    <ResultRow label="Risk per Share" value={`$${fmtCurrency(result.riskPerShare)}`} color="text-red-400" />
                    <ResultRow label="Recommended Shares" value={result.shares.toLocaleString()} color="text-white" large />
                    <ResultRow label="Total Position Size" value={`$${fmtCurrency(result.positionSize)}`} color="text-blue-400" large />
                    <ResultRow label="% of Portfolio" value={fmtPct(result.pctOfPortfolio)} color="text-slate-300" />
                </div>
            ) : (
                <div className="flex-1 flex items-center justify-center text-slate-600 text-sm italic bg-slate-900/30 rounded-xl p-6 text-center">
                    {parseFloat(entryPrice) <= parseFloat(stopLoss) && entryPrice && stopLoss
                        ? 'Entry price must be above stop loss'
                        : 'Fill in all fields to calculate your position size'}
                </div>
            )}
        </CardShell>
    );
};


// ─── 3. Portfolio Allocation Splitter ────────────────────────────────────────

interface AllocationAsset {
    id: string;
    ticker: string;
    pct: number;
}

const PortfolioSplitter: React.FC = () => {
    const [cash, setCash] = useState('');
    const [assets, setAssets] = useState<AllocationAsset[]>([
        { id: '1', ticker: 'VOO', pct: 50 },
        { id: '2', ticker: 'AAPL', pct: 30 },
        { id: '3', ticker: 'BND', pct: 20 },
    ]);

    const totalCash = parseFloat(cash) || 0;
    const totalPct = assets.reduce((s, a) => s + a.pct, 0);
    const isValid = Math.abs(totalPct - 100) < 0.01;

    const addAsset = () => {
        setAssets(prev => [...prev, { id: Date.now().toString(), ticker: '', pct: 0 }]);
    };

    const removeAsset = (id: string) => {
        setAssets(prev => prev.filter(a => a.id !== id));
    };

    const updateAsset = (id: string, field: 'ticker' | 'pct', value: string) => {
        setAssets(prev => prev.map(a =>
            a.id === id ? { ...a, [field]: field === 'pct' ? parseFloat(value) || 0 : value.toUpperCase() } : a
        ));
    };

    const pctBarColor = !isValid ? 'bg-red-500' : 'bg-green-500';

    const handleClear = () => {
        setCash('');
        setAssets([
            { id: '1', ticker: 'VOO', pct: 50 },
            { id: '2', ticker: 'AAPL', pct: 30 },
            { id: '3', ticker: 'BND', pct: 20 },
        ]);
    };

    return (
        <CardShell
            icon={<PieChart size={20} className="text-white" />}
            title="Portfolio Allocation Splitter"
            subtitle="Divide your cash across assets with instant dollar amounts"
            accentColor="from-blue-900/80 to-indigo-900/60"
            onClear={handleClear}
        >
            <InputField label="Total Cash to Invest" value={cash} onChange={setCash} prefix="$" placeholder="e.g. 10000" />

            {/* % validation bar */}
            <div>
                <div className="flex justify-between items-center mb-1.5">
                    <span className="text-xs text-slate-400 font-semibold uppercase tracking-wide">Allocation Total</span>
                    <span className={`text-xs font-bold ${isValid ? 'text-green-400' : totalPct > 100 ? 'text-red-400' : 'text-amber-400'}`}>
                        {totalPct.toFixed(1)}% {isValid ? '✓ Valid' : totalPct > 100 ? '— Over 100%' : '— Under 100%'}
                    </span>
                </div>
                <div className="h-1.5 w-full bg-slate-700/60 rounded-full overflow-hidden">
                    <div
                        className={`h-full rounded-full transition-all duration-300 ${pctBarColor}`}
                        style={{ width: `${Math.min(totalPct, 100)}%` }}
                    />
                </div>
            </div>

            {/* Asset rows */}
            <div className="flex flex-col gap-2">
                {assets.map(asset => {
                    const dollars = isValid && totalCash > 0 ? (asset.pct / 100) * totalCash : null;
                    return (
                        <div key={asset.id} className="flex items-center gap-2 p-2.5 bg-slate-900/50 rounded-lg border border-slate-700/40">
                            <input
                                type="text"
                                className="input w-24 text-sm font-bold uppercase"
                                placeholder="TICK"
                                value={asset.ticker}
                                onChange={e => updateAsset(asset.id, 'ticker', e.target.value)}
                                maxLength={6}
                            />
                            <input
                                type="number"
                                step="0.1"
                                min="0"
                                max="100"
                                className="input input-no-spinner w-20 text-sm text-right font-mono"
                                placeholder="%"
                                value={asset.pct || ''}
                                onChange={e => updateAsset(asset.id, 'pct', e.target.value)}
                            />
                            <span className="text-slate-500 text-sm">%</span>
                            <div className="flex-1 text-right">
                                {dollars !== null ? (
                                    <span className="font-mono font-bold text-sm text-purple-300">${fmtCurrency(dollars)}</span>
                                ) : (
                                    <span className="text-slate-600 text-xs italic">—</span>
                                )}
                            </div>
                            <button
                                onClick={() => removeAsset(asset.id)}
                                className="p-1.5 hover:bg-red-500/20 text-slate-500 hover:text-red-400 rounded transition-colors"
                            >
                                <Trash2 size={14} />
                            </button>
                        </div>
                    );
                })}
            </div>

            <button
                onClick={addAsset}
                className="flex items-center gap-2 justify-center py-2 text-sm text-slate-400 hover:text-purple-400 border border-dashed border-slate-700 hover:border-purple-500/50 rounded-lg transition-colors"
            >
                <Plus size={14} /> Add Asset
            </button>
        </CardShell>
    );
};

// ─── 4. DRIP Calculator ──────────────────────────────────────────────────────

interface DripYearRow {
    year: number;
    withDrip: number;
    withoutDrip: number;
    cashDividends: number;
}

const DripCalculator: React.FC = () => {
    const [initial, setInitial] = useState('10000');
    const [divYield, setDivYield] = useState('3');
    const [growth, setGrowth] = useState('7');
    const [years, setYears] = useState('20');

    const { withDripFinal, withoutDripFinal, rows, advantage, advantagePct } = useMemo(() => {
        const p = parseFloat(initial) || 0;
        const dy = (parseFloat(divYield) || 0) / 100;
        const gr = (parseFloat(growth) || 0) / 100;
        const yr = Math.min(Math.max(Math.floor(parseFloat(years) || 0), 1), 50);

        if (p <= 0 || yr <= 0) return { withDripFinal: 0, withoutDripFinal: 0, rows: [], advantage: 0, advantagePct: 0 };

        const rows: DripYearRow[] = [];
        let dripValue = p;
        let noDripValue = p;
        let totalCashDivs = 0;

        for (let y = 1; y <= yr; y++) {
            // WITH DRIP: dividends reinvested, compounding on total value
            dripValue = dripValue * (1 + gr + dy);

            // WITHOUT DRIP: only share price grows; dividends taken as cash
            const cashDiv = noDripValue * dy;
            totalCashDivs += cashDiv;
            noDripValue = noDripValue * (1 + gr);

            rows.push({ year: y, withDrip: dripValue, withoutDrip: noDripValue + totalCashDivs, cashDividends: totalCashDivs });
        }

        const withDripFinal = dripValue;
        const withoutDripFinal = noDripValue + totalCashDivs;
        const advantage = withDripFinal - withoutDripFinal;
        const advantagePct = withoutDripFinal > 0 ? (advantage / withoutDripFinal) * 100 : 0;

        return { withDripFinal, withoutDripFinal, rows, advantage, advantagePct };
    }, [initial, divYield, growth, years]);

    const maxVal = Math.max(withDripFinal, withoutDripFinal);

    const handleClear = () => {
        setInitial('10000');
        setDivYield('3');
        setGrowth('7');
        setYears('20');
    };

    return (
        <CardShell
            icon={<Leaf size={20} className="text-white" />}
            title="DRIP Calculator"
            subtitle="See how dividend reinvestment compounds your wealth over time"
            accentColor="from-blue-900/80 to-indigo-900/60"
            onClear={handleClear}
        >
            <div className="grid grid-cols-2 gap-3">
                <InputField label="Initial Investment" value={initial} onChange={setInitial} prefix="$" placeholder="10000" />
                <InputField label="Annual Dividend Yield" value={divYield} onChange={setDivYield} suffix="%" placeholder="3" step="0.1" />
                <InputField label="Annual Price Growth" value={growth} onChange={setGrowth} suffix="%" placeholder="7" step="0.1" />
                <InputField label="Years to Grow" value={years} onChange={setYears} placeholder="20" step="1" min="1" />
            </div>

            {withDripFinal > 0 && (
                <>
                    {/* Side-by-side hero comparison */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="bg-green-500/10 border border-green-500/25 rounded-xl p-4 text-center">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-green-400 mb-1">With DRIP</p>
                            <p className="text-2xl font-bold font-mono text-green-400">${fmtCurrency(withDripFinal)}</p>
                            <div className="mt-2 h-1.5 bg-slate-700/60 rounded-full overflow-hidden">
                                <div className="h-full bg-green-500 rounded-full" style={{ width: `${(withDripFinal / maxVal) * 100}%` }} />
                            </div>
                        </div>
                        <div className="bg-slate-800/60 border border-slate-700/40 rounded-xl p-4 text-center">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Without DRIP</p>
                            <p className="text-2xl font-bold font-mono text-slate-300">${fmtCurrency(withoutDripFinal)}</p>
                            <div className="mt-2 h-1.5 bg-slate-700/60 rounded-full overflow-hidden">
                                <div className="h-full bg-slate-500 rounded-full" style={{ width: `${(withoutDripFinal / maxVal) * 100}%` }} />
                            </div>
                        </div>
                    </div>

                    {/* DRIP advantage callout */}
                    <div className="flex items-center justify-between bg-green-500/8 border border-green-500/20 rounded-xl px-4 py-3">
                        <div className="flex items-center gap-2 text-green-400">
                            <TrendingUp size={16} />
                            <span className="text-sm font-semibold">DRIP Advantage</span>
                        </div>
                        <div className="text-right">
                            <span className="font-mono font-bold text-green-400 text-lg">+${fmtCurrency(advantage)}</span>
                            <span className="text-xs text-green-600 ml-2">(+{fmtPct(advantagePct)} more)</span>
                        </div>
                    </div>

                    {/* Year-by-year table (last 5 milestones) */}
                    <div className="bg-slate-900/50 rounded-xl border border-slate-700/40 overflow-hidden">
                        <div className="px-4 py-2 bg-slate-800/60 border-b border-slate-700/40">
                            <span className="text-xs font-bold uppercase tracking-wide text-slate-400">Year-by-Year Milestones</span>
                        </div>
                        <div className="overflow-auto max-h-48">
                            <table className="data-table w-full text-xs">
                                <thead>
                                    <tr>
                                        <th className="text-left">Year</th>
                                        <th className="text-right text-green-400">With DRIP</th>
                                        <th className="text-right text-slate-400">Without DRIP</th>
                                        <th className="text-right text-amber-400">Difference</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows
                                        .filter((_, i, arr) => {
                                            const yr = arr.length;
                                            if (yr <= 10) return true;
                                            // Show every 5 years + final
                                            return (i + 1) % 5 === 0 || i === arr.length - 1;
                                        })
                                        .map(row => (
                                            <tr key={row.year} className="hover:bg-slate-800/30">
                                                <td className="font-bold text-slate-300">Yr {row.year}</td>
                                                <td className="text-right font-mono text-green-400">${fmtCurrency(row.withDrip)}</td>
                                                <td className="text-right font-mono text-slate-400">${fmtCurrency(row.withoutDrip)}</td>
                                                <td className="text-right font-mono text-amber-400">+${fmtCurrency(row.withDrip - row.withoutDrip)}</td>
                                            </tr>
                                        ))
                                    }
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}
        </CardShell>
    );
};

// ─── Main Page ────────────────────────────────────────────────────────────────

const Tools: React.FC = () => (
    <div>
        {/* Page Header */}
        <div className="flex items-center gap-4 mb-8">
            <div className="p-3 bg-blue-500/15 rounded-xl border border-blue-500/20">
                <Wrench size={28} className="text-blue-400" />
            </div>
            <div>
                <h1 className="text-3xl font-bold text-white">Investment Tools</h1>
                <p className="text-slate-400 text-sm mt-0.5">Interactive calculators for smarter trading and long-term investing decisions</p>
            </div>
        </div>

        {/* 2×2 Responsive Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="lg:col-span-2">
                <StockBuyingPlanner />
            </div>
            <ProfitLossCalc />
            <PositionSizingCalc />
            <PortfolioSplitter />
            <DripCalculator />
        </div>
    </div>
);

export default Tools;
