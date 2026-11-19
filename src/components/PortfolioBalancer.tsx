import React, { useMemo } from 'react';
import { Sliders, AlertTriangle, CheckCircle, RotateCcw, Plus, Trash2 } from 'lucide-react';
import type { Asset, Account } from '../types';
import { useData } from '../context/DataContext';

interface BalancerRow {
    id: string;
    ticker: string;
    currentValue: number;
    currentPct: number;
    targetPct: number;
}

interface Props {
    account: Account;
    assets: Asset[];
    totalInvested: number;
}

const fmtCurrency = (n: number): string =>
    n.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtPct = (n: number): string => n.toFixed(2) + '%';

const DRIFT_THRESHOLD = 2;

const PortfolioBalancer: React.FC<Props> = ({ account, assets, totalInvested }) => {
    const { updateAccount } = useData();

    const targetPcts = useMemo(() => {
        if (account.targetPcts) return account.targetPcts;
        const init: Record<string, number> = {};
        assets.forEach(a => {
            const pct = totalInvested > 0 ? ((a.cadMarketValue || a.marketValue || 0) / totalInvested) * 100 : 0;
            init[a.id] = Math.round(pct * 10) / 10;
        });
        return init;
    }, [account.targetPcts, assets, totalInvested]);

    const extraRows = useMemo(() => account.extraRows || [], [account.extraRows]);

    const rows: BalancerRow[] = useMemo(() => {
        const assetRows: BalancerRow[] = assets.map(a => ({
            id: a.id,
            ticker: a.ticker,
            currentValue: a.cadMarketValue || a.marketValue || 0,
            currentPct: totalInvested > 0 ? ((a.cadMarketValue || a.marketValue || 0) / totalInvested) * 100 : 0,
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

    const updateTarget = (id: string, isExtra: boolean, val: string) => {
        const num = parseFloat(val);
        const v = isNaN(num) ? 0 : Math.max(0, Math.min(100, num));
        if (isExtra) {
            updateAccount(account.id, { extraRows: extraRows.map(r => (r.id === id ? { ...r, targetPct: v } : r)) });
        } else {
            updateAccount(account.id, { targetPcts: { ...targetPcts, [id]: v } });
        }
    };

    const addExtraRow = () => {
        updateAccount(account.id, {
            extraRows: [...extraRows, { id: `custom-${Date.now()}`, ticker: '', targetPct: 0 }],
        });
    };

    const removeExtraRow = (id: string) => {
        updateAccount(account.id, { extraRows: extraRows.filter(r => r.id !== id) });
    };

    const updateExtraTicker = (id: string, val: string) => {
        updateAccount(account.id, {
            extraRows: extraRows.map(r => (r.id === id ? { ...r, ticker: val.toUpperCase() } : r)),
        });
    };

    const resetToActual = () => {
        const next: Record<string, number> = {};
        assets.forEach(a => {
            const pct = totalInvested > 0 ? ((a.cadMarketValue || a.marketValue || 0) / totalInvested) * 100 : 0;
            next[a.id] = Math.round(pct * 10) / 10;
        });
        updateAccount(account.id, { targetPcts: next, extraRows: [] });
    };

    const rebalanceActions = useMemo(() => {
        if (!isBalanced || totalInvested <= 0) return [];
        return rows
            .map(row => {
                const targetValue = (row.targetPct / 100) * totalInvested;
                const delta = targetValue - row.currentValue;
                return { ticker: row.ticker, delta };
            })
            .filter(r => Math.abs(r.delta) > 0.5);
    }, [rows, isBalanced, totalInvested]);

    if (assets.length === 0) return null;

    const validationLabel = isBalanced
        ? { text: '✓ 100% — Balanced', cls: 'text-green-400' }
        : overAllocated
        ? { text: `${fmtPct(totalTargetPct)} — Over-allocated`, cls: 'text-red-400' }
        : { text: `${fmtPct(totalTargetPct)} — Under-allocated`, cls: 'text-amber-400' };

    return (
        <section className="bg-slate-800/95 border border-slate-700/90 rounded-2xl shadow-xl overflow-hidden mt-8">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4 bg-slate-900/80 border-b border-slate-700/80">
                <div className="flex items-center gap-3.5">
                    <div className="p-2.5 rounded-xl bg-blue-500/15 border border-blue-500/35 text-blue-400">
                        <Sliders size={20} />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-white tracking-tight">Account Balancer</h2>
                        <p className="text-xs text-slate-300">
                            Set target weights and see how far your holdings have drifted
                        </p>
                    </div>
                </div>
                <button
                    onClick={resetToActual}
                    className="flex items-center gap-2 text-xs font-semibold text-slate-200 hover:text-white bg-slate-800 hover:bg-slate-750 border border-slate-700 hover:border-slate-500 px-3 py-1.5 rounded-xl transition-colors"
                    title="Reset targets to current actual weights"
                >
                    <RotateCcw size={13} /> Reset to Actual
                </button>
            </div>

            <div className="p-5 space-y-5">
                {/* Total invested banner */}
                <div className="flex items-center justify-between p-3.5 bg-slate-900/75 rounded-xl border border-slate-700/80">
                    <span className="text-xs text-slate-300 font-bold uppercase tracking-wider">
                        Total Invested (Market Value)
                    </span>
                    <span className="font-mono tabular-nums font-bold text-white text-lg">
                        ${fmtCurrency(totalInvested)}
                    </span>
                </div>

                {/* Allocation progress bar */}
                <div className="space-y-2">
                    <div className="flex justify-between items-center">
                        <span className="text-xs text-slate-300 font-bold uppercase tracking-wider">
                            Target Allocation Total
                        </span>
                        <span className={`text-xs font-mono font-bold ${validationLabel.cls}`}>
                            {validationLabel.text}
                        </span>
                    </div>
                    <div className="h-2.5 w-full bg-slate-900 border border-slate-700 rounded-full overflow-hidden">
                        <div
                            className={`h-full rounded-full transition-all duration-300 ${
                                isBalanced ? 'bg-green-500' : overAllocated ? 'bg-red-500' : 'bg-amber-400'
                            }`}
                            style={{ width: `${Math.min(totalTargetPct, 100)}%` }}
                        />
                    </div>
                </div>

                {/* Asset rows */}
                <div className="overflow-x-auto bg-slate-900/50 border border-slate-700/80 rounded-xl">
                    <table className="w-full text-sm border-collapse">
                        <thead>
                            <tr className="bg-slate-900/90 text-xs font-bold uppercase tracking-wider text-slate-300 border-b border-slate-700/80">
                                <th className="text-left px-4 py-3">Asset</th>
                                <th className="text-right px-3 py-3">Market Value</th>
                                <th className="text-right px-3 py-3">Current %</th>
                                <th className="text-center px-3 py-3" style={{ minWidth: '180px' }}>
                                    Allocation Bar
                                </th>
                                <th className="text-right px-3 py-3">Target %</th>
                                <th className="text-right px-3 py-3">Drift</th>
                                <th className="text-right px-4 py-3">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700/50">
                            {rows.map(row => {
                                const isExtra = row.currentValue === 0 && extraRows.some(e => e.id === row.id);
                                const drift = row.targetPct - row.currentPct;
                                const absDrift = Math.abs(drift);
                                const isDrifted = absDrift > DRIFT_THRESHOLD;
                                const driftColor = isDrifted
                                    ? drift > 0
                                        ? 'text-amber-400'
                                        : 'text-red-400'
                                    : 'text-slate-300';
                                const driftSign = drift > 0 ? '+' : '';

                                return (
                                    <tr key={row.id} className="hover:bg-slate-800/60 transition-colors">
                                        <td className="px-4 py-3">
                                            {isExtra ? (
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        type="text"
                                                        className="w-24 bg-slate-900 border border-slate-700 text-white placeholder-slate-400 rounded-lg text-xs font-mono font-bold uppercase py-1.5 px-2.5 focus:outline-none focus:border-blue-500"
                                                        placeholder="TICKER"
                                                        maxLength={10}
                                                        value={extraRows.find(e => e.id === row.id)?.ticker ?? ''}
                                                        onChange={e => updateExtraTicker(row.id, e.target.value)}
                                                    />
                                                    <button
                                                        onClick={() => removeExtraRow(row.id)}
                                                        className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/15 rounded-lg transition-colors"
                                                        title="Remove planned asset"
                                                        aria-label="Remove planned asset"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            ) : (
                                                <span className="font-bold font-mono text-white">{row.ticker}</span>
                                            )}
                                        </td>

                                        <td className="px-3 py-3 text-right font-mono tabular-nums text-slate-200">
                                            {row.currentValue > 0 ? (
                                                `$${fmtCurrency(row.currentValue)}`
                                            ) : (
                                                <span className="text-slate-400">—</span>
                                            )}
                                        </td>

                                        <td className="px-3 py-3 text-right font-mono tabular-nums text-blue-400 font-semibold">
                                            {row.currentPct > 0 ? fmtPct(row.currentPct) : <span className="text-slate-400">0.00%</span>}
                                        </td>

                                        <td className="px-3 py-3">
                                            <div className="relative h-3.5 bg-slate-800 border border-slate-700 rounded-full overflow-hidden">
                                                <div
                                                    className="absolute left-0 top-0 h-full bg-blue-500/70 rounded-full transition-all duration-300"
                                                    style={{ width: `${Math.min(row.currentPct, 100)}%` }}
                                                />
                                                <div
                                                    className="absolute top-0 h-full w-0.5 bg-slate-50"
                                                    style={{ left: `${Math.min(row.targetPct, 100)}%` }}
                                                />
                                            </div>
                                            <div className="flex justify-between text-[11px] font-mono text-slate-400 mt-1 px-0.5">
                                                <span>0%</span>
                                                <span>100%</span>
                                            </div>
                                        </td>

                                        <td className="px-3 py-3 text-right">
                                            <div className="inline-flex items-center justify-end gap-1.5">
                                                <input
                                                    type="number"
                                                    step="0.1"
                                                    min="0"
                                                    max="100"
                                                    className="input-no-spinner w-16 bg-slate-900 border border-slate-700 text-white rounded-lg text-right text-sm font-mono tabular-nums py-1 px-2 focus:outline-none focus:border-blue-500"
                                                    value={row.targetPct || ''}
                                                    onChange={e => updateTarget(row.id, isExtra, e.target.value)}
                                                    placeholder="0"
                                                />
                                                <span className="text-slate-300 text-xs font-bold">%</span>
                                            </div>
                                        </td>

                                        <td className={`px-3 py-3 text-right font-mono tabular-nums text-sm font-bold ${driftColor}`}>
                                            {row.currentPct > 0 || row.targetPct > 0 ? (
                                                `${driftSign}${fmtPct(drift)}`
                                            ) : (
                                                <span className="text-slate-400">—</span>
                                            )}
                                        </td>

                                        <td className="px-4 py-3 text-right">
                                            {row.targetPct === 0 && row.currentPct === 0 ? (
                                                <span className="text-slate-400 text-xs">—</span>
                                            ) : !isDrifted ? (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-slate-900/80 border border-slate-700 text-green-400">
                                                    <CheckCircle size={12} /> On target
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-amber-500/15 border border-amber-500/35 text-amber-400">
                                                    <AlertTriangle size={12} />
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
                    className="flex items-center gap-2 justify-center w-full py-2.5 text-xs font-bold text-slate-300 hover:text-blue-400 border border-dashed border-slate-600 hover:border-blue-500/60 rounded-xl transition-colors"
                >
                    <Plus size={14} /> Add Planned Asset
                </button>

                {/* Rebalance action plan */}
                {isBalanced && rebalanceActions.length > 0 && (
                    <div className="p-4 bg-slate-900/75 rounded-xl border border-blue-500/35 space-y-3">
                        <p className="text-xs font-bold uppercase tracking-wider text-blue-400">
                            Rebalance Action Plan
                        </p>
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
                            {rebalanceActions.map(action => (
                                <div
                                    key={action.ticker}
                                    className="p-3 rounded-xl border bg-slate-800/90 border-slate-700/80 text-center"
                                >
                                    <p className="text-xs font-mono font-bold text-white mb-0.5">{action.ticker}</p>
                                    <p
                                        className={`text-sm font-mono tabular-nums font-bold ${
                                            action.delta > 0 ? 'text-green-400' : 'text-red-400'
                                        }`}
                                    >
                                        {action.delta > 0 ? 'Buy' : 'Sell'} ${fmtCurrency(Math.abs(action.delta))}
                                    </p>
                                </div>
                            ))}
                        </div>
                        <p className="text-xs text-slate-400">
                            Based on current market values. Does not account for transaction costs.
                        </p>
                    </div>
                )}

                {/* Not-balanced notice */}
                {!isBalanced && totalTargetPct > 0 && (
                    <div className="flex items-center gap-2.5 p-3.5 bg-amber-500/15 border border-amber-500/35 rounded-xl text-xs font-medium text-amber-400">
                        <AlertTriangle size={15} className="shrink-0" />
                        <span>Adjust target percentages to sum to exactly 100% to see the rebalance action plan.</span>
                    </div>
                )}
            </div>
        </section>
    );
};

export default PortfolioBalancer;
