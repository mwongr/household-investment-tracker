import React, { useState, useMemo } from 'react';
import { Sliders, AlertTriangle, CheckCircle, RotateCcw, Plus, Trash2 } from 'lucide-react';
import type { Asset } from '../types';

interface BalancerRow {
    id: string;         // asset id or custom key
    ticker: string;
    currentValue: number;   // live market value
    currentPct: number;     // actual % of total invested
    targetPct: number;      // user-desired %
}

interface Props {
    assets: Asset[];
    totalInvested: number;  // sum of all marketValues in account
}

const fmtCurrency = (n: number): string =>
    n.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtPct = (n: number): string => n.toFixed(2) + '%';

// Drift threshold: flag if actual is more than this many pp away from target
const DRIFT_THRESHOLD = 2;

const PortfolioBalancer: React.FC<Props> = ({ assets, totalInvested }) => {
    // Initialise target percentages from current actual weights
    const [targetPcts, setTargetPcts] = useState<Record<string, number>>(() => {
        const init: Record<string, number> = {};
        assets.forEach(a => {
            const pct = totalInvested > 0 ? (a.marketValue / totalInvested) * 100 : 0;
            init[a.id] = Math.round(pct * 10) / 10;
        });
        return init;
    });

    // Extra custom rows (tickers user wants to add to the plan that aren't held yet)
    const [extraRows, setExtraRows] = useState<{ id: string; ticker: string; targetPct: number }[]>([]);

    const rows: BalancerRow[] = useMemo(() => {
        const assetRows: BalancerRow[] = assets.map(a => ({
            id: a.id,
            ticker: a.ticker,
            currentValue: a.marketValue,
            currentPct: totalInvested > 0 ? (a.marketValue / totalInvested) * 100 : 0,
            targetPct: targetPcts[a.id] ?? 0,
        }));
        const custom: BalancerRow[] = extraRows.map(r => ({
            id: r.id,
            ticker: r.ticker,
            currentValue: 0,
            currentPct: 0,
            targetPct: r.targetPct,
        }));
        return [...assetRows, ...custom];
    }, [assets, totalInvested, targetPcts, extraRows]);

    const totalTargetPct = rows.reduce((s, r) => s + r.targetPct, 0);
    const isBalanced = Math.abs(totalTargetPct - 100) < 0.1;
    const overAllocated = totalTargetPct > 100.05;
    const underAllocated = totalTargetPct < 99.95;

    const updateTarget = (id: string, isExtra: boolean, val: string) => {
        const num = parseFloat(val);
        const v = isNaN(num) ? 0 : Math.max(0, Math.min(100, num));
        if (isExtra) {
            setExtraRows(prev => prev.map(r => r.id === id ? { ...r, targetPct: v } : r));
        } else {
            setTargetPcts(prev => ({ ...prev, [id]: v }));
        }
    };

    const addExtraRow = () => {
        setExtraRows(prev => [...prev, { id: `custom-${Date.now()}`, ticker: '', targetPct: 0 }]);
    };

    const removeExtraRow = (id: string) => {
        setExtraRows(prev => prev.filter(r => r.id !== id));
    };

    const updateExtraTicker = (id: string, val: string) => {
        setExtraRows(prev => prev.map(r => r.id === id ? { ...r, ticker: val.toUpperCase() } : r));
    };

    // Reset targets to current actual weights
    const resetToActual = () => {
        const next: Record<string, number> = {};
        assets.forEach(a => {
            const pct = totalInvested > 0 ? (a.marketValue / totalInvested) * 100 : 0;
            next[a.id] = Math.round(pct * 10) / 10;
        });
        setTargetPcts(next);
        setExtraRows([]);
    };

    // Rebalance amount: how much $ to buy/sell to reach target
    const rebalanceActions = useMemo(() => {
        if (!isBalanced || totalInvested <= 0) return [];
        return rows.map(row => {
            const targetValue = (row.targetPct / 100) * totalInvested;
            const delta = targetValue - row.currentValue;
            return { ticker: row.ticker, delta };
        }).filter(r => Math.abs(r.delta) > 0.5);
    }, [rows, isBalanced, totalInvested]);

    if (assets.length === 0) return null;

    // Validation state label
    const validationLabel = isBalanced
        ? { text: '✓ 100% — Balanced', cls: 'text-green-400' }
        : overAllocated
        ? { text: `${fmtPct(totalTargetPct)} — Over-allocated`, cls: 'text-red-400' }
        : { text: `${fmtPct(totalTargetPct)} — Under-allocated`, cls: 'text-amber-400' };

    return (
        <div className="glass-panel overflow-hidden mt-8">
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-700/50 bg-gradient-to-r from-blue-900/80 to-indigo-900/60">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-white/10 rounded-lg">
                        <Sliders size={20} className="text-white" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-white">Portfolio Balancer</h2>
                        <p className="text-xs text-white/60">Set your target allocation and see how far your portfolio has drifted</p>
                    </div>
                </div>
                <button
                    onClick={resetToActual}
                    className="flex items-center gap-2 text-xs text-slate-300 hover:text-white bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg transition-colors"
                    title="Reset targets to current actual weights"
                >
                    <RotateCcw size={13} /> Reset to Actual
                </button>
            </div>

            <div className="p-5">
                {/* Total invested banner */}
                <div className="flex items-center justify-between mb-5 p-3 bg-slate-900/50 rounded-xl border border-slate-700/40">
                    <span className="text-sm text-slate-400 font-semibold uppercase tracking-wide">Total Invested (Market Value)</span>
                    <span className="font-mono font-bold text-white text-lg">${fmtCurrency(totalInvested)}</span>
                </div>

                {/* Allocation progress bar */}
                <div className="mb-5">
                    <div className="flex justify-between items-center mb-1.5">
                        <span className="text-xs text-slate-400 font-semibold uppercase tracking-wide">Target Allocation Total</span>
                        <span className={`text-xs font-bold ${validationLabel.cls}`}>{validationLabel.text}</span>
                    </div>
                    <div className="h-2 w-full bg-slate-700/60 rounded-full overflow-hidden">
                        <div
                            className={`h-full rounded-full transition-all duration-300 ${isBalanced ? 'bg-green-500' : overAllocated ? 'bg-red-500' : 'bg-amber-400'}`}
                            style={{ width: `${Math.min(totalTargetPct, 100)}%` }}
                        />
                    </div>
                </div>

                {/* Asset rows */}
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-[10px] font-bold uppercase tracking-widest text-slate-500 border-b border-slate-700/50">
                                <th className="text-left pb-2 pr-4">Asset</th>
                                <th className="text-right pb-2 px-3">Market Value</th>
                                <th className="text-right pb-2 px-3">Current %</th>
                                <th className="text-center pb-2 px-3" style={{ minWidth: '180px' }}>Allocation Bar</th>
                                <th className="text-right pb-2 px-3">Target %</th>
                                <th className="text-right pb-2 px-3">Drift</th>
                                <th className="text-right pb-2 pl-3">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700/20">
                            {rows.map(row => {
                                const isExtra = row.currentValue === 0 && extraRows.some(e => e.id === row.id);
                                const drift = row.targetPct - row.currentPct;
                                const absDrift = Math.abs(drift);
                                const isDrifted = absDrift > DRIFT_THRESHOLD;
                                const driftColor = isDrifted
                                    ? (drift > 0 ? 'text-amber-400' : 'text-red-400')
                                    : 'text-slate-500';
                                const driftSign = drift > 0 ? '+' : '';

                                return (
                                    <tr key={row.id} className="hover:bg-slate-800/20 transition-colors group">
                                        {/* Ticker */}
                                        <td className="py-3 pr-4">
                                            {isExtra ? (
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        type="text"
                                                        className="input w-20 text-xs font-bold uppercase py-1 px-2"
                                                        placeholder="TICK"
                                                        maxLength={6}
                                                        value={extraRows.find(e => e.id === row.id)?.ticker ?? ''}
                                                        onChange={e => updateExtraTicker(row.id, e.target.value)}
                                                    />
                                                    <button
                                                        onClick={() => removeExtraRow(row.id)}
                                                        className="p-1 opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 rounded transition-all"
                                                    >
                                                        <Trash2 size={13} />
                                                    </button>
                                                </div>
                                            ) : (
                                                <span className="font-bold text-white">{row.ticker}</span>
                                            )}
                                        </td>

                                        {/* Market Value */}
                                        <td className="py-3 px-3 text-right font-mono text-slate-300 text-sm">
                                            {row.currentValue > 0 ? `$${fmtCurrency(row.currentValue)}` : <span className="text-slate-600 italic text-xs">—</span>}
                                        </td>

                                        {/* Current % */}
                                        <td className="py-3 px-3 text-right font-mono text-blue-300 font-semibold">
                                            {row.currentPct > 0 ? fmtPct(row.currentPct) : <span className="text-slate-600 italic text-xs">0%</span>}
                                        </td>

                                        {/* Visual bar — current vs target */}
                                        <td className="py-3 px-3">
                                            <div className="relative h-4 bg-slate-700/40 rounded-full overflow-hidden">
                                                {/* Current actual bar */}
                                                <div
                                                    className="absolute left-0 top-0 h-full bg-blue-500/50 rounded-full transition-all duration-300"
                                                    style={{ width: `${Math.min(row.currentPct, 100)}%` }}
                                                />
                                                {/* Target marker line */}
                                                <div
                                                    className="absolute top-0 h-full w-0.5 bg-white/60"
                                                    style={{ left: `${Math.min(row.targetPct, 100)}%` }}
                                                />
                                            </div>
                                            <div className="flex justify-between text-[9px] text-slate-600 mt-0.5 px-0.5">
                                                <span>0%</span>
                                                <span>100%</span>
                                            </div>
                                        </td>

                                        {/* Target % input */}
                                        <td className="py-3 px-3 text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                <input
                                                    type="number"
                                                    step="0.1"
                                                    min="0"
                                                    max="100"
                                                    className="input input-no-spinner w-16 text-right text-sm font-mono py-1 px-2"
                                                    value={row.targetPct || ''}
                                                    onChange={e => updateTarget(row.id, isExtra, e.target.value)}
                                                    placeholder="0"
                                                />
                                                <span className="text-slate-500 text-xs">%</span>
                                            </div>
                                        </td>

                                        {/* Drift */}
                                        <td className={`py-3 px-3 text-right font-mono text-sm font-semibold ${driftColor}`}>
                                            {row.currentPct > 0 || row.targetPct > 0
                                                ? `${driftSign}${fmtPct(drift)}`
                                                : <span className="text-slate-600">—</span>}
                                        </td>

                                        {/* Status badge */}
                                        <td className="py-3 pl-3 text-right">
                                            {row.targetPct === 0 && row.currentPct === 0 ? (
                                                <span className="text-slate-600 text-xs">—</span>
                                            ) : !isDrifted ? (
                                                <span className="flex items-center justify-end gap-1 text-[10px] font-bold text-green-400">
                                                    <CheckCircle size={11} /> On target
                                                </span>
                                            ) : (
                                                <span className="flex items-center justify-end gap-1 text-[10px] font-bold text-amber-400">
                                                    <AlertTriangle size={11} />
                                                    {drift > 0 ? 'Underweight' : 'Overweight'}
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {/* Add planned asset button */}
                <button
                    onClick={addExtraRow}
                    className="mt-3 flex items-center gap-2 justify-center w-full py-2 text-xs text-slate-500 hover:text-blue-400 border border-dashed border-slate-700 hover:border-blue-500/50 rounded-lg transition-colors"
                >
                    <Plus size={13} /> Add Planned Asset
                </button>

                {/* Rebalance action plan */}
                {isBalanced && rebalanceActions.length > 0 && (
                    <div className="mt-5 p-4 bg-slate-900/60 rounded-xl border border-blue-500/20">
                        <p className="text-xs font-bold uppercase tracking-wide text-blue-400 mb-3">
                            📋 Rebalance Action Plan
                        </p>
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                            {rebalanceActions.map(action => (
                                <div
                                    key={action.ticker}
                                    className={`p-2.5 rounded-lg border text-center ${action.delta > 0
                                        ? 'bg-green-500/8 border-green-500/20'
                                        : 'bg-red-500/8 border-red-500/20'}`}
                                >
                                    <p className="text-xs font-bold text-white mb-0.5">{action.ticker}</p>
                                    <p className={`text-sm font-mono font-bold ${action.delta > 0 ? 'text-green-400' : 'text-red-400'}`}>
                                        {action.delta > 0 ? 'Buy' : 'Sell'} ${fmtCurrency(Math.abs(action.delta))}
                                    </p>
                                </div>
                            ))}
                        </div>
                        <p className="text-[10px] text-slate-600 mt-2">Based on current market values. Does not account for transaction costs.</p>
                    </div>
                )}

                {/* Not-balanced notice */}
                {!isBalanced && totalTargetPct > 0 && (
                    <div className="mt-4 flex items-center gap-2 p-3 bg-amber-500/8 border border-amber-500/20 rounded-lg text-xs text-amber-400">
                        <AlertTriangle size={14} className="shrink-0" />
                        Adjust target percentages to sum to exactly 100% to see the rebalance action plan.
                    </div>
                )}
            </div>
        </div>
    );
};

export default PortfolioBalancer;
