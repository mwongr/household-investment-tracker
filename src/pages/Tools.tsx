import React, { useState, useMemo, useEffect } from 'react';
import {
    Wrench,
    Target,
    Shield,
    PieChart,
    Leaf,
    Plus,
    Trash2,
    TrendingUp,
    AlertTriangle,
    CheckCircle,
    RotateCcw,
    ShoppingCart,
    Radio,
} from 'lucide-react';
import { useData } from '../context/DataContext';
import '../styles/shared.css';

// ─── Constants & Helpers ─────────────────────────────────────────────────────

const API_BASE = '';

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

const InputField: React.FC<InputFieldProps> = ({
    label,
    value,
    onChange,
    prefix,
    suffix,
    placeholder,
    step = 'any',
    min = '0',
    action,
}) => (
    <div>
        <div className="flex justify-between items-center gap-2 mb-1.5">
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">{label}</label>
            {action && <div>{action}</div>}
        </div>
        <div className="relative flex items-center">
            {prefix && (
                <span className="absolute left-3 text-slate-300 text-sm font-semibold pointer-events-none">
                    {prefix}
                </span>
            )}
            <input
                type="number"
                step={step}
                min={min}
                className="input-no-spinner w-full bg-slate-900 border border-slate-700 text-white placeholder-slate-400 rounded-xl py-2 px-3 text-sm font-mono tabular-nums font-medium focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                style={{
                    paddingLeft: prefix ? '1.75rem' : undefined,
                    paddingRight: suffix ? '2.25rem' : undefined,
                }}
                value={value}
                onChange={e => onChange(e.target.value)}
                placeholder={placeholder ?? '0'}
            />
            {suffix && (
                <span className="absolute right-3 text-slate-300 text-sm font-semibold pointer-events-none">
                    {suffix}
                </span>
            )}
        </div>
    </div>
);

const ResultRow: React.FC<{ label: string; value: string; color?: string; large?: boolean }> = ({
    label,
    value,
    color = 'text-white',
    large = false,
}) => (
    <div className="flex justify-between items-center py-2.5 border-b border-slate-700/60 last:border-0">
        <span className="text-sm text-slate-300 font-medium">{label}</span>
        <span className={`font-mono tabular-nums font-bold ${large ? 'text-lg' : 'text-sm'} ${color}`}>{value}</span>
    </div>
);

interface CardShellProps {
    icon: React.ReactNode;
    iconTone: string;
    title: string;
    subtitle: string;
    onClear?: () => void;
    children: React.ReactNode;
}

const CardShell: React.FC<CardShellProps> = ({ icon, iconTone, title, subtitle, onClear, children }) => (
    <section className="bg-slate-800/95 border border-slate-700/90 rounded-2xl overflow-hidden shadow-xl flex flex-col">
        <div className="px-5 py-4 bg-slate-900/80 border-b border-slate-700/80 flex justify-between items-center gap-4">
            <div className="flex items-center gap-3.5 min-w-0">
                <div className={`p-2.5 rounded-xl border shrink-0 ${iconTone}`}>{icon}</div>
                <div className="min-w-0">
                    <h2 className="text-lg font-bold text-white tracking-tight truncate">{title}</h2>
                    <p className="text-xs text-slate-300 mt-0.5">{subtitle}</p>
                </div>
            </div>
            {onClear && (
                <button
                    onClick={onClear}
                    title="Reset calculator"
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-750 border border-slate-700 hover:border-slate-500 text-slate-200 hover:text-white rounded-xl text-xs font-semibold transition-colors shrink-0"
                >
                    <RotateCcw size={13} /> Clear
                </button>
            )}
        </div>
        <div className="p-5 flex-1 flex flex-col gap-5">{children}</div>
    </section>
);

// ─── 0. Stock Buying Planner ─────────────────────────────────────────────────

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
        } catch {
            // ignore corrupt localStorage
        }
        return [
            { id: '1', accountId: accounts[0]?.id || '', buys: [{ id: 'b1', ticker: '', price: '', shares: '' }] },
        ];
    });

    useEffect(() => {
        localStorage.setItem('stockPlannerGroups', JSON.stringify(groups));
    }, [groups]);

    const addGroup = () => {
        setGroups([
            ...groups,
            {
                id: Date.now().toString(),
                accountId: accounts[0]?.id || '',
                buys: [{ id: Date.now().toString() + 'b', ticker: '', price: '', shares: '' }],
            },
        ]);
    };

    const removeGroup = (groupId: string) => {
        setGroups(groups.filter(g => g.id !== groupId));
    };

    const updateGroupAccount = (groupId: string, accountId: string) => {
        setGroups(groups.map(g => (g.id === groupId ? { ...g, accountId } : g)));
    };

    const addBuy = (groupId: string) => {
        setGroups(
            groups.map(g =>
                g.id === groupId
                    ? { ...g, buys: [...g.buys, { id: Date.now().toString(), ticker: '', price: '', shares: '' }] }
                    : g
            )
        );
    };

    const removeBuy = (groupId: string, buyId: string) => {
        setGroups(
            groups.map(g => (g.id === groupId ? { ...g, buys: g.buys.filter(b => b.id !== buyId) } : g))
        );
    };

    const updateBuy = (groupId: string, buyId: string, field: keyof PlannedBuy, value: string) => {
        setGroups(
            groups.map(g =>
                g.id === groupId
                    ? {
                          ...g,
                          buys: g.buys.map(b =>
                              b.id === buyId
                                  ? { ...b, [field]: field === 'ticker' ? value.toUpperCase() : value }
                                  : b
                          ),
                      }
                    : g
            )
        );
    };

    const handleClear = () => {
        setGroups([
            { id: '1', accountId: accounts[0]?.id || '', buys: [{ id: 'b1', ticker: '', price: '', shares: '' }] },
        ]);
    };

    const handleTickerBlur = async (groupId: string, buyId: string, ticker: string) => {
        if (!ticker.trim()) return;
        const upperTicker = ticker.toUpperCase();

        const group = groups.find(g => g.id === groupId);
        if (!group) return;

        const accountAssets = getAssetsByAccount(group.accountId);
        const existingAsset = accountAssets.find(a => a.ticker === upperTicker);

        if (existingAsset && existingAsset.currentPrice) {
            setGroups(prev =>
                prev.map(g =>
                    g.id === groupId
                        ? {
                              ...g,
                              buys: g.buys.map(b =>
                                  b.id === buyId
                                      ? {
                                            ...b,
                                            currentPrice: existingAsset.currentPrice,
                                            price: b.price === '' ? existingAsset.currentPrice.toFixed(2) : b.price,
                                        }
                                      : b
                              ),
                          }
                        : g
                )
            );
            return;
        }

        setGroups(prev =>
            prev.map(g =>
                g.id === groupId
                    ? { ...g, buys: g.buys.map(b => (b.id === buyId ? { ...b, isLoadingPrice: true } : b)) }
                    : g
            )
        );
        try {
            const res = await fetch(`${API_BASE}/api/quote?symbol=${upperTicker}`);
            if (res.ok) {
                const data = await res.json();
                const currentPrice = data.regularMarketPrice;
                if (currentPrice !== undefined) {
                    setGroups(prev =>
                        prev.map(g =>
                            g.id === groupId
                                ? {
                                      ...g,
                                      buys: g.buys.map(b =>
                                          b.id === buyId
                                              ? {
                                                    ...b,
                                                    currentPrice,
                                                    isLoadingPrice: false,
                                                    price: b.price === '' ? currentPrice.toFixed(2) : b.price,
                                                }
                                              : b
                                      ),
                                  }
                                : g
                        )
                    );
                    return;
                }
            }
        } catch {
            // ignore network quote error
        }

        setGroups(prev =>
            prev.map(g =>
                g.id === groupId
                    ? { ...g, buys: g.buys.map(b => (b.id === buyId ? { ...b, isLoadingPrice: false } : b)) }
                    : g
            )
        );
    };

    const grandTotal = groups.reduce(
        (sum, g) => sum + g.buys.reduce((s, b) => s + (parseFloat(b.price) || 0) * (parseFloat(b.shares) || 0), 0),
        0
    );

    return (
        <CardShell
            icon={<ShoppingCart size={20} />}
            iconTone="bg-green-500/15 border-green-500/35 text-green-400"
            title="Stock Buying Planner"
            subtitle="Plan purchases by account, track remaining cash, and preview updated average cost"
            onClear={handleClear}
        >
            <div className="flex flex-col gap-5">
                {groups.map((group, groupIdx) => {
                    const selectedAccount = accounts.find(a => a.id === group.accountId);
                    const availableCash = selectedAccount?.cashBalance || 0;
                    const accountAssets = selectedAccount ? getAssetsByAccount(group.accountId) : [];

                    const groupTotal = group.buys.reduce(
                        (sum, b) => sum + (parseFloat(b.price) || 0) * (parseFloat(b.shares) || 0),
                        0
                    );
                    const remainingCash = availableCash - groupTotal;
                    const isOverdrawn = remainingCash < 0;

                    return (
                        <div
                            key={group.id}
                            className="flex flex-col gap-4 bg-slate-900/65 p-4 sm:p-5 rounded-xl border border-slate-700/80"
                        >
                            {/* Account Selection & Cash Summary */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-800/95 p-3.5 rounded-xl border border-slate-700/80">
                                <div className="flex-1 min-w-0">
                                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                                        Account {groupIdx + 1}
                                    </label>
                                    <select
                                        className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl px-3 py-2 text-sm font-semibold focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                                        value={group.accountId}
                                        onChange={e => updateGroupAccount(group.id, e.target.value)}
                                    >
                                        <option value="" disabled>
                                            Select an Account
                                        </option>
                                        {accounts.map(a => (
                                            <option key={a.id} value={a.id}>
                                                {a.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="flex items-center justify-between sm:justify-end gap-4">
                                    <div className="sm:text-right">
                                        <p className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                                            Available Cash
                                        </p>
                                        <p className="font-mono tabular-nums font-bold text-lg text-green-400">
                                            ${fmtCurrency(availableCash)}
                                        </p>
                                    </div>

                                    {groups.length > 1 && (
                                        <button
                                            onClick={() => removeGroup(group.id)}
                                            className="p-2 bg-red-500/15 hover:bg-red-500/25 text-red-400 rounded-xl transition-colors border border-red-500/35"
                                            title="Remove Account Group"
                                            aria-label={`Remove Account ${groupIdx + 1}`}
                                        >
                                            <Trash2 size={15} />
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Column Labels (Desktop) */}
                            <div className="hidden md:grid md:grid-cols-[1.2fr_1fr_20px_1fr_110px_36px] gap-3 px-3 text-xs font-bold uppercase tracking-wider text-slate-400">
                                <span>Ticker</span>
                                <span>Price ($)</span>
                                <span />
                                <span>Shares</span>
                                <span className="text-right">Est. Cost</span>
                                <span />
                            </div>

                            {/* Planned Buys */}
                            <div className="flex flex-col gap-2.5">
                                {group.buys.map(buy => {
                                    const p = parseFloat(buy.price) || 0;
                                    const s = parseFloat(buy.shares) || 0;
                                    const cost = p * s;
                                    const existingAsset = accountAssets.find(
                                        a => a.ticker === buy.ticker && buy.ticker !== ''
                                    );

                                    let newAvgCostMsg = '';
                                    if (existingAsset && p > 0 && s > 0) {
                                        const oldTotalCost = existingAsset.quantity * existingAsset.averageCost;
                                        const newTotalCost = oldTotalCost + cost;
                                        const newTotalQty = existingAsset.quantity + s;
                                        const newAvg = newTotalCost / newTotalQty;
                                        newAvgCostMsg = `New Avg: $${fmtCurrency(existingAsset.averageCost)} → $${fmtCurrency(newAvg)} (${newTotalQty.toLocaleString()} shs)`;
                                    }

                                    return (
                                        <div
                                            key={buy.id}
                                            className="flex flex-col gap-2 p-3 bg-slate-800/80 rounded-xl border border-slate-700/80"
                                        >
                                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-[1.2fr_1fr_20px_1fr_110px_36px] items-center gap-3">
                                                <input
                                                    type="text"
                                                    className="bg-slate-900 border border-slate-700 text-white placeholder-slate-400 rounded-xl px-3 py-2 text-sm font-bold font-mono uppercase focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                                                    placeholder="TICKER"
                                                    value={buy.ticker}
                                                    onChange={e => updateBuy(group.id, buy.id, 'ticker', e.target.value)}
                                                    onBlur={e => handleTickerBlur(group.id, buy.id, e.target.value)}
                                                    maxLength={15}
                                                />
                                                <input
                                                    type="number"
                                                    className="input-no-spinner bg-slate-900 border border-slate-700 text-white placeholder-slate-400 rounded-xl px-3 py-2 text-sm font-mono tabular-nums focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                                                    placeholder="Price ($)"
                                                    value={buy.price}
                                                    onChange={e => updateBuy(group.id, buy.id, 'price', e.target.value)}
                                                />
                                                <span className="text-slate-400 text-sm font-bold text-center hidden md:block">
                                                    ×
                                                </span>
                                                <input
                                                    type="number"
                                                    className="input-no-spinner bg-slate-900 border border-slate-700 text-white placeholder-slate-400 rounded-xl px-3 py-2 text-sm font-mono tabular-nums focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                                                    placeholder="Shares"
                                                    value={buy.shares}
                                                    onChange={e => updateBuy(group.id, buy.id, 'shares', e.target.value)}
                                                />
                                                <div className="flex items-center justify-between md:justify-end">
                                                    <span className="text-xs font-semibold text-slate-400 md:hidden">
                                                        Est. Cost:
                                                    </span>
                                                    <span className="font-mono tabular-nums font-bold text-sm text-white">
                                                        ${fmtCurrency(cost)}
                                                    </span>
                                                </div>
                                                <button
                                                    onClick={() => removeBuy(group.id, buy.id)}
                                                    className="p-2 hover:bg-red-500/15 text-slate-400 hover:text-red-400 rounded-lg transition-colors justify-self-end"
                                                    title="Remove order row"
                                                    aria-label="Remove order row"
                                                >
                                                    <Trash2 size={15} />
                                                </button>
                                            </div>

                                            {(buy.isLoadingPrice || buy.currentPrice !== undefined || newAvgCostMsg) && (
                                                <div className="flex flex-wrap items-center gap-2 pt-1">
                                                    {buy.isLoadingPrice && (
                                                        <span className="text-xs text-slate-300 italic">
                                                            Fetching quote…
                                                        </span>
                                                    )}
                                                    {!buy.isLoadingPrice && buy.currentPrice !== undefined && (
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                updateBuy(
                                                                    group.id,
                                                                    buy.id,
                                                                    'price',
                                                                    buy.currentPrice!.toFixed(2)
                                                                )
                                                            }
                                                            className="text-xs font-mono font-semibold text-green-400 bg-green-500/15 hover:bg-green-500/25 border border-green-500/35 px-2.5 py-0.5 rounded-md transition-colors"
                                                            title="Click to apply current market price"
                                                        >
                                                            Market: ${buy.currentPrice.toFixed(2)}
                                                        </button>
                                                    )}
                                                    {newAvgCostMsg && (
                                                        <span className="text-xs font-mono font-semibold text-blue-400 bg-blue-500/15 border border-blue-500/35 px-2.5 py-0.5 rounded-md">
                                                            {newAvgCostMsg}
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>

                            <button
                                onClick={() => addBuy(group.id)}
                                className="flex items-center gap-1.5 justify-center py-2 text-xs font-bold text-slate-300 hover:text-green-400 border border-dashed border-slate-600 hover:border-green-500/60 rounded-xl transition-colors"
                            >
                                <Plus size={14} /> Add Stock to Account {groupIdx + 1}
                            </button>

                            {/* Account Footer Totals */}
                            <div className="flex justify-between items-center p-3.5 bg-slate-800/95 rounded-xl border border-slate-700/80">
                                <div>
                                    <p className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                                        Account Spend
                                    </p>
                                    <p className="font-mono tabular-nums font-bold text-base text-white mt-0.5">
                                        ${fmtCurrency(groupTotal)}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                                        Remaining Cash
                                    </p>
                                    <p
                                        className={`font-mono tabular-nums font-bold text-base mt-0.5 ${
                                            isOverdrawn ? 'text-red-400' : 'text-green-400'
                                        }`}
                                    >
                                        ${fmtCurrency(remainingCash)}
                                    </p>
                                </div>
                            </div>
                        </div>
                    );
                })}

                <button
                    onClick={addGroup}
                    className="flex items-center gap-2 justify-center py-2.5 text-sm font-semibold text-slate-200 hover:text-white bg-slate-900 hover:bg-slate-750 border border-slate-700 hover:border-slate-500 rounded-xl transition-colors"
                >
                    <Plus size={16} /> Add Another Account
                </button>

                {groups.length > 1 && (
                    <div className="flex justify-between items-center p-4 bg-green-500/15 rounded-xl border border-green-500/35">
                        <span className="text-sm font-bold text-green-400 uppercase tracking-widest">
                            Grand Total Spend
                        </span>
                        <span className="font-mono tabular-nums font-bold text-2xl text-green-400">
                            ${fmtCurrency(grandTotal)}
                        </span>
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
            icon={<Target size={20} />}
            iconTone="bg-blue-500/15 border-blue-500/35 text-blue-400"
            title="Profit / Loss & Risk-Reward"
            subtitle="Evaluate your trade's upside vs. downside before entering"
            onClear={handleClear}
        >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
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
                            className="text-xs text-blue-400 font-bold bg-blue-500/15 hover:bg-blue-500/25 border border-blue-500/35 px-2 py-0.5 rounded-md transition-colors"
                        >
                            Auto 1:2
                        </button>
                    }
                />
                <InputField label="Number of Shares" value={shares} onChange={setShares} placeholder="e.g. 100" step="1" />
            </div>

            {result ? (
                <div className="bg-slate-900/75 rounded-xl p-4 border border-slate-700/80">
                    <ResultRow
                        label="Total Profit (at target)"
                        value={`+$${fmtCurrency(result.totalProfit)}`}
                        color="text-green-400"
                        large
                    />
                    <ResultRow label="Profit %" value={`+${fmtPct(result.profitPct)}`} color="text-green-400" />
                    <ResultRow
                        label="Total Loss (at stop)"
                        value={`-$${fmtCurrency(result.totalLoss)}`}
                        color="text-red-400"
                        large
                    />
                    <ResultRow label="Loss %" value={`-${fmtPct(result.lossPct)}`} color="text-red-400" />
                    <div className="flex justify-between items-center pt-3 mt-1 border-t border-slate-700/60">
                        <span className="text-sm font-medium text-slate-300">Risk : Reward</span>
                        <div className="flex items-center gap-2.5">
                            <span className="font-mono tabular-nums font-bold text-white text-lg">
                                1 : {result.rrRatio.toFixed(2)}
                            </span>
                            {result.isFavorable ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-green-500/15 text-green-400 text-xs font-bold border border-green-500/35">
                                    <CheckCircle size={12} /> Favorable
                                </span>
                            ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-500/15 text-red-400 text-xs font-bold border border-red-500/35">
                                    <AlertTriangle size={12} /> High Risk
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            ) : (
                <div className="flex-1 flex items-center justify-center text-slate-300 text-sm bg-slate-900/50 border border-dashed border-slate-700 rounded-xl p-6 text-center min-h-[150px]">
                    Fill in all fields to see your risk/reward analysis
                </div>
            )}
        </CardShell>
    );
};

// ─── 2. Position Sizing Calculator ───────────────────────────────────────────

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
            icon={<Shield size={20} />}
            iconTone="bg-indigo-500/15 border-indigo-500/35 text-indigo-400"
            title="Position Sizing"
            subtitle="Cap maximum dollar risk per trade using account size & stop distance"
            onClear={handleClear}
        >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
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
                            className="text-xs text-blue-400 font-bold bg-blue-500/15 hover:bg-blue-500/25 border border-blue-500/35 disabled:opacity-40 disabled:cursor-not-allowed px-2 py-0.5 rounded-md transition-colors"
                        >
                            ATR Auto
                        </button>
                    }
                />
            </div>

            {/* ATR Lookup Panel */}
            <div className="bg-slate-900/75 rounded-xl p-4 border border-slate-700/80 flex flex-col gap-3.5">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-blue-400">
                    <Radio size={14} />
                    <span>ATR-Based Stop Loss</span>
                </div>

                {/* Ticker fetch row */}
                <div className="flex gap-2">
                    <input
                        type="text"
                        className="flex-1 bg-slate-800 border border-slate-700 text-white placeholder-slate-400 rounded-xl px-3.5 py-2 text-sm font-mono font-semibold uppercase focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                        placeholder="Ticker (e.g. AAPL)"
                        value={atrTicker}
                        onChange={e => setAtrTicker(e.target.value.toUpperCase())}
                        onKeyDown={e => e.key === 'Enter' && fetchATR()}
                    />
                    <button
                        onClick={fetchATR}
                        disabled={atrLoading || !atrTicker.trim()}
                        style={{ color: '#ffffff' }}
                        className="px-4 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-500 disabled:opacity-45 disabled:cursor-not-allowed rounded-xl transition-colors whitespace-nowrap"
                    >
                        {atrLoading ? 'Fetching…' : 'Fetch ATR'}
                    </button>
                </div>

                {atrError && (
                    <p className="text-xs text-red-400 font-medium flex items-center gap-1.5">
                        <AlertTriangle size={13} /> {atrError}
                    </p>
                )}

                {/* ATR value + multiplier */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 items-end">
                    <InputField
                        label="Current ATR ($)"
                        value={currentATR}
                        onChange={setCurrentATR}
                        prefix="$"
                        placeholder="Auto or manual"
                    />
                    <div className="space-y-1.5">
                        <div className="flex justify-between items-center">
                            <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                                Volatility Mult.
                            </label>
                            <span className="text-xs font-mono font-bold text-blue-400">{multiplier.toFixed(1)}×</span>
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
                        <div className="flex justify-between text-xs text-slate-400 font-medium">
                            <span>1.0× Tight</span>
                            <span>2.0× Std</span>
                            <span>3.0× Wide</span>
                        </div>
                    </div>
                </div>

                {/* Preview of auto stop loss */}
                {canAutoSL && (
                    <div className="flex items-center justify-between px-3.5 py-2.5 bg-blue-500/15 border border-blue-500/35 rounded-xl">
                        <span className="text-xs font-medium text-slate-200 font-mono">
                            Auto Stop: {parseFloat(entryPrice).toFixed(2)} − ({parseFloat(currentATR).toFixed(4)} ×{' '}
                            {multiplier.toFixed(1)})
                        </span>
                        <span className="font-mono tabular-nums font-bold text-blue-400 text-sm">
                            = ${Math.max(0, parseFloat(entryPrice) - parseFloat(currentATR) * multiplier).toFixed(2)}
                        </span>
                    </div>
                )}
            </div>

            {result ? (
                <div className="bg-slate-900/75 rounded-xl p-4 border border-slate-700/80">
                    <div className="mb-3 p-3.5 rounded-xl bg-amber-500/15 border border-amber-500/35 flex justify-between items-center gap-3">
                        <div>
                            <p className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5 mb-0.5">
                                <AlertTriangle size={13} /> Maximum Dollar Risk
                            </p>
                            <p className="text-xs text-slate-300">Exact loss if stopped out</p>
                        </div>
                        <span className="font-mono tabular-nums font-bold text-2xl text-amber-400">
                            -${fmtCurrency(result.dollarRisk)}
                        </span>
                    </div>
                    <ResultRow label="Risk per Share" value={`$${fmtCurrency(result.riskPerShare)}`} color="text-red-400" />
                    <ResultRow
                        label="Recommended Shares"
                        value={result.shares.toLocaleString()}
                        color="text-white"
                        large
                    />
                    <ResultRow
                        label="Total Position Size"
                        value={`$${fmtCurrency(result.positionSize)}`}
                        color="text-blue-400"
                        large
                    />
                    <ResultRow label="% of Portfolio" value={fmtPct(result.pctOfPortfolio)} color="text-slate-200" />
                </div>
            ) : (
                <div className="flex-1 flex items-center justify-center text-slate-300 text-sm bg-slate-900/50 border border-dashed border-slate-700 rounded-xl p-6 text-center min-h-[120px]">
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
        setAssets(prev =>
            prev.map(a =>
                a.id === id ? { ...a, [field]: field === 'pct' ? parseFloat(value) || 0 : value.toUpperCase() } : a
            )
        );
    };

    const pctBarColor = !isValid ? (totalPct > 100 ? 'bg-red-500' : 'bg-amber-400') : 'bg-green-500';

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
            icon={<PieChart size={20} />}
            iconTone="bg-purple-500/15 border-purple-500/35 text-purple-400"
            title="Portfolio Allocation Splitter"
            subtitle="Divide available cash across target weights with exact dollar amounts"
            onClear={handleClear}
        >
            <InputField label="Total Cash to Invest" value={cash} onChange={setCash} prefix="$" placeholder="e.g. 10000" />

            {/* % validation bar */}
            <div className="bg-slate-900/75 border border-slate-700/80 rounded-xl p-3.5 space-y-2">
                <div className="flex justify-between items-center">
                    <span className="text-xs text-slate-300 font-bold uppercase tracking-wider">Allocation Total</span>
                    <span
                        className={`text-xs font-mono font-bold ${
                            isValid ? 'text-green-400' : totalPct > 100 ? 'text-red-400' : 'text-amber-400'
                        }`}
                    >
                        {totalPct.toFixed(1)}% {isValid ? '✓ Valid' : totalPct > 100 ? '— Over 100%' : '— Under 100%'}
                    </span>
                </div>
                <div className="h-2 w-full bg-slate-800 border border-slate-700 rounded-full overflow-hidden">
                    <div
                        className={`h-full rounded-full transition-all duration-300 ${pctBarColor}`}
                        style={{ width: `${Math.min(totalPct, 100)}%` }}
                    />
                </div>
            </div>

            {/* Asset rows */}
            <div className="flex flex-col gap-2.5">
                {assets.map(asset => {
                    const dollars = isValid && totalCash > 0 ? (asset.pct / 100) * totalCash : null;
                    return (
                        <div
                            key={asset.id}
                            className="flex items-center gap-2.5 p-2.5 bg-slate-900/75 rounded-xl border border-slate-700/80"
                        >
                            <input
                                type="text"
                                className="w-24 bg-slate-800 border border-slate-700 text-white placeholder-slate-400 rounded-lg px-2.5 py-1.5 text-sm font-bold font-mono uppercase focus:outline-none focus:border-blue-500"
                                placeholder="TICK"
                                value={asset.ticker}
                                onChange={e => updateAsset(asset.id, 'ticker', e.target.value)}
                                maxLength={10}
                            />
                            <div className="relative flex items-center">
                                <input
                                    type="number"
                                    step="0.1"
                                    min="0"
                                    max="100"
                                    className="input-no-spinner w-20 bg-slate-800 border border-slate-700 text-white placeholder-slate-400 rounded-lg pl-2.5 pr-6 py-1.5 text-sm text-right font-mono tabular-nums focus:outline-none focus:border-blue-500"
                                    placeholder="0"
                                    value={asset.pct || ''}
                                    onChange={e => updateAsset(asset.id, 'pct', e.target.value)}
                                />
                                <span className="absolute right-2.5 text-slate-300 text-xs font-bold pointer-events-none">
                                    %
                                </span>
                            </div>
                            <div className="flex-1 text-right">
                                {dollars !== null ? (
                                    <span className="font-mono tabular-nums font-bold text-sm text-purple-400">
                                        ${fmtCurrency(dollars)}
                                    </span>
                                ) : (
                                    <span className="text-slate-400 text-xs font-mono">—</span>
                                )}
                            </div>
                            <button
                                onClick={() => removeAsset(asset.id)}
                                className="p-1.5 hover:bg-red-500/15 text-slate-400 hover:text-red-400 rounded-lg transition-colors"
                                title="Remove asset"
                                aria-label="Remove asset"
                            >
                                <Trash2 size={14} />
                            </button>
                        </div>
                    );
                })}
            </div>

            <button
                onClick={addAsset}
                className="flex items-center gap-2 justify-center py-2.5 text-sm font-semibold text-slate-300 hover:text-purple-400 border border-dashed border-slate-600 hover:border-purple-500/60 rounded-xl transition-colors"
            >
                <Plus size={15} /> Add Asset
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

        if (p <= 0 || yr <= 0) {
            return { withDripFinal: 0, withoutDripFinal: 0, rows: [], advantage: 0, advantagePct: 0 };
        }

        const computedRows: DripYearRow[] = [];
        let dripValue = p;
        let noDripValue = p;
        let totalCashDivs = 0;

        for (let y = 1; y <= yr; y++) {
            dripValue = dripValue * (1 + gr + dy);
            const cashDiv = noDripValue * dy;
            totalCashDivs += cashDiv;
            noDripValue = noDripValue * (1 + gr);

            computedRows.push({
                year: y,
                withDrip: dripValue,
                withoutDrip: noDripValue + totalCashDivs,
                cashDividends: totalCashDivs,
            });
        }

        const finalWith = dripValue;
        const finalWithout = noDripValue + totalCashDivs;
        const adv = finalWith - finalWithout;
        const advPct = finalWithout > 0 ? (adv / finalWithout) * 100 : 0;

        return {
            withDripFinal: finalWith,
            withoutDripFinal: finalWithout,
            rows: computedRows,
            advantage: adv,
            advantagePct: advPct,
        };
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
            icon={<Leaf size={20} />}
            iconTone="bg-green-500/15 border-green-500/35 text-green-400"
            title="DRIP Calculator"
            subtitle="Compare dividend reinvestment compounding vs. taking cash dividends"
            onClear={handleClear}
        >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <InputField label="Initial Investment" value={initial} onChange={setInitial} prefix="$" placeholder="10000" />
                <InputField label="Annual Dividend Yield" value={divYield} onChange={setDivYield} suffix="%" placeholder="3" step="0.1" />
                <InputField label="Annual Price Growth" value={growth} onChange={setGrowth} suffix="%" placeholder="7" step="0.1" />
                <InputField label="Years to Grow" value={years} onChange={setYears} placeholder="20" step="1" min="1" />
            </div>

            {withDripFinal > 0 && (
                <>
                    {/* Side-by-side hero comparison */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="bg-green-500/15 border border-green-500/35 rounded-xl p-4 text-center space-y-2">
                            <p className="text-xs font-bold uppercase tracking-wider text-green-400">With DRIP</p>
                            <p className="text-2xl font-bold font-mono tabular-nums text-green-400">
                                ${fmtCurrency(withDripFinal)}
                            </p>
                            <div className="h-2 bg-slate-900 border border-slate-700 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-green-500 rounded-full"
                                    style={{ width: `${maxVal > 0 ? (withDripFinal / maxVal) * 100 : 0}%` }}
                                />
                            </div>
                        </div>

                        <div className="bg-slate-900/75 border border-slate-700/80 rounded-xl p-4 text-center space-y-2">
                            <p className="text-xs font-bold uppercase tracking-wider text-slate-300">Without DRIP</p>
                            <p className="text-2xl font-bold font-mono tabular-nums text-white">
                                ${fmtCurrency(withoutDripFinal)}
                            </p>
                            <div className="h-2 bg-slate-800 border border-slate-700 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-slate-400 rounded-full"
                                    style={{ width: `${maxVal > 0 ? (withoutDripFinal / maxVal) * 100 : 0}%` }}
                                />
                            </div>
                        </div>
                    </div>

                    {/* DRIP advantage callout */}
                    <div className="flex flex-wrap items-center justify-between gap-2 bg-green-500/15 border border-green-500/35 rounded-xl px-4 py-3">
                        <div className="flex items-center gap-2 text-green-400">
                            <TrendingUp size={16} />
                            <span className="text-sm font-bold">DRIP Advantage</span>
                        </div>
                        <div className="text-right font-mono tabular-nums">
                            <span className="font-bold text-green-400 text-lg">+${fmtCurrency(advantage)}</span>
                            <span className="text-xs font-semibold text-slate-200 ml-2">
                                (+{fmtPct(advantagePct)} more)
                            </span>
                        </div>
                    </div>

                    {/* Year-by-year table */}
                    <div className="bg-slate-900/75 rounded-xl border border-slate-700/80 overflow-hidden">
                        <div className="px-4 py-2.5 bg-slate-900/95 border-b border-slate-700/80">
                            <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                                Year-by-Year Milestones
                            </span>
                        </div>
                        <div className="overflow-auto max-h-52">
                            <table className="w-full text-xs border-collapse">
                                <thead className="bg-slate-900/90 border-b border-slate-700/80 sticky top-0">
                                    <tr>
                                        <th className="px-4 py-2.5 text-left font-bold uppercase tracking-wider text-slate-300">
                                            Year
                                        </th>
                                        <th className="px-4 py-2.5 text-right font-bold uppercase tracking-wider text-green-400">
                                            With DRIP
                                        </th>
                                        <th className="px-4 py-2.5 text-right font-bold uppercase tracking-wider text-slate-300">
                                            Without DRIP
                                        </th>
                                        <th className="px-4 py-2.5 text-right font-bold uppercase tracking-wider text-amber-400">
                                            Difference
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-700/50">
                                    {rows
                                        .filter((_, i, arr) => {
                                            const yr = arr.length;
                                            if (yr <= 10) return true;
                                            return (i + 1) % 5 === 0 || i === arr.length - 1;
                                        })
                                        .map(row => (
                                            <tr key={row.year} className="hover:bg-slate-800/70 transition-colors">
                                                <td className="px-4 py-2.5 font-bold text-white">Yr {row.year}</td>
                                                <td className="px-4 py-2.5 text-right font-mono tabular-nums font-semibold text-green-400">
                                                    ${fmtCurrency(row.withDrip)}
                                                </td>
                                                <td className="px-4 py-2.5 text-right font-mono tabular-nums text-slate-300">
                                                    ${fmtCurrency(row.withoutDrip)}
                                                </td>
                                                <td className="px-4 py-2.5 text-right font-mono tabular-nums font-semibold text-amber-400">
                                                    +${fmtCurrency(row.withDrip - row.withoutDrip)}
                                                </td>
                                            </tr>
                                        ))}
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
    <div className="space-y-8">
        {/* Page Header */}
        <div className="flex items-center gap-3.5">
            <div className="p-3 bg-blue-500/15 rounded-2xl border border-blue-500/35 text-blue-400 shadow-sm">
                <Wrench size={24} />
            </div>
            <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Investment Tools</h1>
                <p className="text-slate-300 text-sm mt-0.5">
                    Interactive calculators for position planning, risk management, allocation &amp; compounding
                </p>
            </div>
        </div>

        {/* Responsive Grid */}
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
