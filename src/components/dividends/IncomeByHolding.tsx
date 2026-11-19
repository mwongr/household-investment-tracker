import React, { useMemo, useState } from 'react';
import { AlertTriangle, ArrowDown, ArrowUp, ArrowUpDown, Layers } from 'lucide-react';
import type { HoldingIncomeRow } from '../../types/dividends';
import { aggregateHoldingsByTicker } from '../../utils/dividendAnalytics';

interface IncomeByHoldingProps {
    rows: HoldingIncomeRow[];
    metadataLoading: boolean;
}

type SortKey =
    | 'ticker'
    | 'accountName'
    | 'projectedAnnualCad'
    | 'shareOfTotalPct'
    | 'currentYieldPct'
    | 'yieldOnCostPct';

type SortDir = 'asc' | 'desc';
type GroupingMode = 'ticker' | 'account';

const fmtCad = (val: number) =>
    new Intl.NumberFormat('en-CA', {
        style: 'currency',
        currency: 'CAD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(val);

export const IncomeByHolding: React.FC<IncomeByHoldingProps> = React.memo(
    ({ rows, metadataLoading }) => {
        const [sortKey, setSortKey] = useState<SortKey>('projectedAnnualCad');
        const [sortDir, setSortDir] = useState<SortDir>('desc');
        const [groupingMode, setGroupingMode] = useState<GroupingMode>('ticker');

        const payingRows = useMemo(
            () => rows.filter((r) => r.projectedAnnualCad > 0),
            [rows]
        );

        const aggregatedRows = useMemo(
            () => aggregateHoldingsByTicker(payingRows),
            [payingRows]
        );

        // Always compute concentration across aggregated tickers so multi-account holdings aren't understated
        const concentration = useMemo(() => {
            if (aggregatedRows.length === 0) return { topTicker: null, topPct: 0, top3Pct: 0 };
            const byIncome = [...aggregatedRows].sort(
                (a, b) => b.shareOfTotalPct - a.shareOfTotalPct
            );
            const top = byIncome[0]!;
            const top3Pct = byIncome
                .slice(0, 3)
                .reduce((sum, r) => sum + r.shareOfTotalPct, 0);
            return {
                topTicker: top.ticker,
                topPct: top.shareOfTotalPct,
                top3Pct,
            };
        }, [aggregatedRows]);

        const displayRows = groupingMode === 'ticker' ? aggregatedRows : payingRows;

        const sortedRows = useMemo(() => {
            const copy = [...displayRows];
            copy.sort((a, b) => {
                const av = a[sortKey];
                const bv = b[sortKey];
                let cmp = 0;
                if (typeof av === 'string' && typeof bv === 'string') {
                    cmp = av.localeCompare(bv);
                } else {
                    cmp = Number(av) - Number(bv);
                }
                return sortDir === 'asc' ? cmp : -cmp;
            });
            return copy;
        }, [displayRows, sortKey, sortDir]);

        const toggleSort = (key: SortKey) => {
            if (sortKey === key) {
                setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
            } else {
                setSortKey(key);
                setSortDir(key === 'ticker' || key === 'accountName' ? 'asc' : 'desc');
            }
        };

        const renderSortIcon = (key: SortKey) => {
            if (sortKey !== key) return <ArrowUpDown size={12} className="opacity-40" />;
            return sortDir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />;
        };

        const highConcentration =
            concentration.topPct >= 25 || (aggregatedRows.length >= 4 && concentration.top3Pct >= 60);

        return (
            <section className="bg-slate-800/95 border border-slate-700/90 rounded-2xl overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-700/80 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                        <Layers size={18} className="text-blue-400" />
                        <div>
                            <h2 className="text-base font-bold text-white tracking-tight">
                                Income by Holding &amp; Concentration
                            </h2>
                            <p className="text-xs text-slate-400">
                                Forward annual dividend contribution per position
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5">
                        {highConcentration && concentration.topTicker && (
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-blue-500/40 bg-slate-900 text-blue-400 text-xs font-medium">
                                <AlertTriangle size={13} />
                                <span>
                                    {concentration.topPct >= 25
                                        ? `${concentration.topTicker} drives ${concentration.topPct.toFixed(1)}% of income`
                                        : `Top 3 tickers drive ${concentration.top3Pct.toFixed(1)}% of income`}
                                </span>
                            </div>
                        )}

                        <div className="inline-flex rounded-lg border border-slate-700 bg-slate-900/70 p-0.5 text-xs">
                            <button
                                type="button"
                                onClick={() => setGroupingMode('ticker')}
                                className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                                    groupingMode === 'ticker'
                                        ? 'bg-slate-700 text-white'
                                        : 'text-slate-400 hover:text-white'
                                }`}
                            >
                                By Ticker
                            </button>
                            <button
                                type="button"
                                onClick={() => setGroupingMode('account')}
                                className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                                    groupingMode === 'account'
                                        ? 'bg-slate-700 text-white'
                                        : 'text-slate-400 hover:text-white'
                                }`}
                            >
                                By Account
                            </button>
                        </div>
                    </div>
                </div>

                {metadataLoading ? (
                    <div className="p-5 space-y-2.5">
                        <div className="h-9 bg-slate-700/50 rounded animate-pulse" />
                        <div className="h-9 bg-slate-700/40 rounded animate-pulse" />
                        <div className="h-9 bg-slate-700/30 rounded animate-pulse" />
                    </div>
                ) : sortedRows.length === 0 ? (
                    <div className="py-10 px-6 text-center text-sm text-slate-400">
                        No dividend-paying holdings found in your active positions.
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-slate-900/70 border-b border-slate-700/80 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                                <tr>
                                    <th className="px-5 py-3">
                                        <button
                                            type="button"
                                            onClick={() => toggleSort('ticker')}
                                            className="inline-flex items-center gap-1 hover:text-white"
                                        >
                                            Ticker {renderSortIcon('ticker')}
                                        </button>
                                    </th>
                                    <th className="px-4 py-3">
                                        <button
                                            type="button"
                                            onClick={() => toggleSort('accountName')}
                                            className="inline-flex items-center gap-1 hover:text-white"
                                        >
                                            {groupingMode === 'ticker' ? 'Accounts' : 'Account'}{' '}
                                            {renderSortIcon('accountName')}
                                        </button>
                                    </th>
                                    <th className="px-4 py-3 text-right">
                                        <button
                                            type="button"
                                            onClick={() => toggleSort('projectedAnnualCad')}
                                            className="inline-flex items-center gap-1 hover:text-white ml-auto"
                                        >
                                            Proj. Annual {renderSortIcon('projectedAnnualCad')}
                                        </button>
                                    </th>
                                    <th className="px-4 py-3 min-w-[150px]">
                                        <button
                                            type="button"
                                            onClick={() => toggleSort('shareOfTotalPct')}
                                            className="inline-flex items-center gap-1 hover:text-white"
                                        >
                                            % Share {renderSortIcon('shareOfTotalPct')}
                                        </button>
                                    </th>
                                    <th className="px-4 py-3 text-right">
                                        <button
                                            type="button"
                                            onClick={() => toggleSort('currentYieldPct')}
                                            className="inline-flex items-center gap-1 hover:text-white ml-auto"
                                        >
                                            Yield {renderSortIcon('currentYieldPct')}
                                        </button>
                                    </th>
                                    <th className="px-5 py-3 text-right">
                                        <button
                                            type="button"
                                            onClick={() => toggleSort('yieldOnCostPct')}
                                            className="inline-flex items-center gap-1 hover:text-white ml-auto"
                                        >
                                            YoC {renderSortIcon('yieldOnCostPct')}
                                        </button>
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-700/60 text-sm">
                                {sortedRows.map((row) => {
                                    const isConcentrated = row.shareOfTotalPct >= 25;
                                    return (
                                        <tr
                                            key={row.assetId}
                                            className="hover:bg-slate-750/50 transition-colors"
                                        >
                                            <td className="px-5 py-3 whitespace-nowrap">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-bold font-mono text-white">
                                                        {row.ticker}
                                                    </span>
                                                    {row.isEstimated && (
                                                        <span
                                                            title="Estimated from historical cadence"
                                                            className="px-1.5 py-0.5 rounded border border-slate-700 bg-slate-900 text-blue-400 text-[10px] font-semibold"
                                                        >
                                                            Est.
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-slate-300 whitespace-nowrap">
                                                <span className="text-xs font-medium">
                                                    {row.accountName}
                                                </span>
                                                {row.accountType !== 'Multiple' && (
                                                    <span className="ml-1.5 text-[11px] text-slate-400">
                                                        ({row.accountType})
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-right font-mono font-semibold text-emerald-400 tabular-nums whitespace-nowrap">
                                                {fmtCad(row.projectedAnnualCad)}
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2.5">
                                                    <div className="flex-1 h-1.5 rounded-full bg-slate-700/80 overflow-hidden">
                                                        <div
                                                            className={`h-full rounded-full ${
                                                                isConcentrated
                                                                    ? 'bg-blue-500'
                                                                    : 'bg-emerald-500'
                                                            }`}
                                                            style={{
                                                                width: `${Math.min(
                                                                    100,
                                                                    Math.max(2, row.shareOfTotalPct)
                                                                )}%`,
                                                            }}
                                                        />
                                                    </div>
                                                    <span
                                                        className={`font-mono text-xs tabular-nums w-12 text-right ${
                                                            isConcentrated
                                                                ? 'text-blue-400 font-semibold'
                                                                : 'text-slate-300'
                                                        }`}
                                                    >
                                                        {row.shareOfTotalPct.toFixed(1)}%
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-right font-mono text-slate-200 tabular-nums whitespace-nowrap">
                                                {row.currentYieldPct.toFixed(2)}%
                                            </td>
                                            <td className="px-5 py-3 text-right font-mono text-slate-200 tabular-nums whitespace-nowrap">
                                                {row.yieldOnCostPct > 0
                                                    ? `${row.yieldOnCostPct.toFixed(2)}%`
                                                    : '—'}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>
        );
    }
);

IncomeByHolding.displayName = 'IncomeByHolding';
