import React from 'react';
import { CalendarDays, Coins, Percent, TrendingUp } from 'lucide-react';
import type { DividendKpis } from '../../types/dividends';

interface DividendKpiStripProps {
    kpis: DividendKpis;
    metadataLoading: boolean;
}

const fmtCad = (val: number) =>
    new Intl.NumberFormat('en-CA', {
        style: 'currency',
        currency: 'CAD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(val);

export const DividendKpiStrip: React.FC<DividendKpiStripProps> = React.memo(
    ({ kpis, metadataLoading }) => {
        return (
            <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                <div className="bg-slate-800/95 border border-slate-700/90 rounded-2xl p-5">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                            YTD Dividends Received
                        </span>
                        <Coins size={16} className="text-blue-400" />
                    </div>
                    <p className="text-2xl font-bold text-white font-mono tabular-nums">
                        {fmtCad(kpis.ytdTotalCad)}
                    </p>
                    <p className="text-xs text-slate-400 mt-1.5 font-mono tabular-nums">
                        Cash {fmtCad(kpis.ytdCashCad)} · DRIP {fmtCad(kpis.ytdReinvestedCad)}
                    </p>
                </div>

                <div className="bg-slate-800/95 border border-slate-700/90 rounded-2xl p-5">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                            Projected Annual Income
                        </span>
                        <TrendingUp size={16} className="text-blue-400" />
                    </div>
                    {metadataLoading ? (
                        <div className="h-8 w-32 bg-slate-700/60 rounded animate-pulse my-1" />
                    ) : (
                        <p className="text-2xl font-bold text-white font-mono tabular-nums">
                            {fmtCad(kpis.projectedAnnualCad)}
                        </p>
                    )}
                    <p className="text-xs text-slate-400 mt-1.5">
                        {kpis.payingHoldingsCount} paying{' '}
                        {kpis.payingHoldingsCount === 1 ? 'position' : 'positions'}
                        {kpis.estimatedHoldingsCount > 0 &&
                            ` · ${kpis.estimatedHoldingsCount} estimated`}
                    </p>
                </div>

                <div className="bg-slate-800/95 border border-slate-700/90 rounded-2xl p-5">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                            Average Monthly Income
                        </span>
                        <CalendarDays size={16} className="text-blue-400" />
                    </div>
                    {metadataLoading ? (
                        <div className="h-8 w-28 bg-slate-700/60 rounded animate-pulse my-1" />
                    ) : (
                        <p className="text-2xl font-bold text-white font-mono tabular-nums">
                            {fmtCad(kpis.averageMonthlyCad)}
                        </p>
                    )}
                    <p className="text-xs text-slate-400 mt-1.5">Forward 12-month run rate ÷ 12</p>
                </div>

                <div className="bg-slate-800/95 border border-slate-700/90 rounded-2xl p-5">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                            Portfolio Yield &amp; YoC
                        </span>
                        <Percent size={16} className="text-blue-400" />
                    </div>
                    {metadataLoading ? (
                        <div className="h-8 w-36 bg-slate-700/60 rounded animate-pulse my-1" />
                    ) : (
                        <div className="flex items-baseline gap-3">
                            <p className="text-2xl font-bold text-white font-mono tabular-nums">
                                {kpis.portfolioYieldPct.toFixed(2)}%
                            </p>
                            <span className="text-xs text-slate-400 font-mono tabular-nums">
                                YoC {kpis.yieldOnCostPct.toFixed(2)}%
                            </span>
                        </div>
                    )}
                    <p className="text-xs text-slate-400 mt-1.5">
                        Weighted yield vs. cost basis
                    </p>
                </div>
            </section>
        );
    }
);

DividendKpiStrip.displayName = 'DividendKpiStrip';
