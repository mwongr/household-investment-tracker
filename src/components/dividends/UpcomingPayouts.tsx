import React, { useMemo, useState } from 'react';
import { CalendarClock } from 'lucide-react';
import type { UpcomingPayout } from '../../types/dividends';

interface UpcomingPayoutsProps {
    payouts60: UpcomingPayout[];
    cutoff30Iso: string;
    metadataLoading: boolean;
}

const fmtCurrency = (val: number, currency: 'CAD' | 'USD') =>
    new Intl.NumberFormat('en-CA', {
        style: 'currency',
        currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(val);

function formatShortDate(iso: string | null): string {
    if (!iso) return '—';
    const d = new Date(`${iso}T00:00:00`);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export const UpcomingPayouts: React.FC<UpcomingPayoutsProps> = React.memo(
    ({ payouts60, cutoff30Iso, metadataLoading }) => {
        const [windowDays, setWindowDays] = useState<30 | 60>(60);

        const filtered = useMemo(() => {
            if (windowDays === 60) return payouts60;
            return payouts60.filter((p) => p.sortDate <= cutoff30Iso);
        }, [payouts60, windowDays, cutoff30Iso]);

        const totalCad = useMemo(
            () => filtered.reduce((sum, p) => sum + p.estimatedCad, 0),
            [filtered]
        );

        return (
            <section className="bg-slate-800/95 border border-slate-700/90 rounded-2xl p-5 flex flex-col">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                    <div className="flex items-center gap-2.5">
                        <CalendarClock size={18} className="text-blue-400" />
                        <div>
                            <h2 className="text-base font-bold text-white tracking-tight">
                                Upcoming Payouts
                            </h2>
                            <p className="text-xs text-slate-400">
                                {filtered.length > 0
                                    ? `Est. ${fmtCurrency(totalCad, 'CAD')} over next ${windowDays} days`
                                    : `Next ${windowDays} days dividend calendar`}
                            </p>
                        </div>
                    </div>

                    <div className="inline-flex rounded-lg border border-slate-700 bg-slate-900/70 p-0.5 text-xs">
                        <button
                            type="button"
                            onClick={() => setWindowDays(30)}
                            className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                                windowDays === 30
                                    ? 'bg-slate-700 text-white'
                                    : 'text-slate-400 hover:text-white'
                            }`}
                        >
                            30d
                        </button>
                        <button
                            type="button"
                            onClick={() => setWindowDays(60)}
                            className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                                windowDays === 60
                                    ? 'bg-slate-700 text-white'
                                    : 'text-slate-400 hover:text-white'
                            }`}
                        >
                            60d
                        </button>
                    </div>
                </div>

                {metadataLoading ? (
                    <div className="space-y-2.5">
                        <div className="h-12 bg-slate-700/50 rounded-xl animate-pulse" />
                        <div className="h-12 bg-slate-700/40 rounded-xl animate-pulse" />
                        <div className="h-12 bg-slate-700/30 rounded-xl animate-pulse" />
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="py-10 text-center text-sm text-slate-400 border border-dashed border-slate-700/80 rounded-xl">
                        No upcoming dividend payouts scheduled in the next {windowDays} days.
                    </div>
                ) : (
                    <div className="divide-y divide-slate-700/60">
                        {filtered.map((item) => (
                            <div
                                key={item.id}
                                className="py-3 first:pt-1 last:pb-1 flex items-center justify-between gap-3"
                            >
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="font-bold font-mono text-sm text-white">
                                            {item.ticker}
                                        </span>
                                        <span
                                            className={`px-2 py-0.5 rounded-full border bg-slate-900 text-[10px] font-semibold ${
                                                item.isEstimated
                                                    ? 'border-blue-500/40 text-blue-400'
                                                    : 'border-emerald-500/40 text-emerald-400'
                                            }`}
                                        >
                                            {item.isEstimated ? 'Estimated' : 'Confirmed'}
                                        </span>
                                        <span className="text-[11px] text-slate-400 truncate">
                                            {item.accountName}
                                        </span>
                                    </div>
                                    <div className="text-xs text-slate-400 mt-0.5 font-mono tabular-nums">
                                        Ex: {formatShortDate(item.exDividendDate)} · Pay:{' '}
                                        {formatShortDate(item.payDate)}
                                    </div>
                                </div>

                                <div className="text-right shrink-0">
                                    <p className="font-mono font-bold text-sm text-emerald-400 tabular-nums">
                                        {fmtCurrency(item.estimatedCad, 'CAD')}
                                    </p>
                                    {item.nativeCurrency === 'USD' && (
                                        <p className="font-mono text-[11px] text-slate-400 tabular-nums">
                                            {fmtCurrency(item.estimatedNative, 'USD')} USD
                                        </p>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </section>
        );
    }
);

UpcomingPayouts.displayName = 'UpcomingPayouts';
