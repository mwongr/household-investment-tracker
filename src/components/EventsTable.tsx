import { useEffect, useState } from 'react';
import { Calendar, DollarSign, CalendarClock } from 'lucide-react';
import type { Asset } from '../types';

interface EventsTableProps {
    assets: Asset[];
}

interface CalendarEvent {
    ticker: string;
    type: 'Earnings' | 'Ex-Dividend';
    date: Date;
    details: string;
    isEstimate: boolean;
}

interface EventsApiItem {
    symbol: string;
    success: boolean;
    data?: {
        calendarEvents?: {
            earnings?: {
                earningsDate?: string[];
                revenueAverage?: number | string;
            };
        };
        summaryDetail?: {
            exDividendDate?: string;
            dividendYield?: number;
            dividendRate?: number;
        };
    };
}

const EventsTable = ({ assets }: EventsTableProps) => {
    const [events, setEvents] = useState<CalendarEvent[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchEvents = async () => {
            const uniqueTickers = Array.from(new Set(assets.map(a => a.ticker)));
            if (uniqueTickers.length === 0) {
                setLoading(false);
                return;
            }

            try {
                const res = await fetch('/api/events', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ symbols: uniqueTickers })
                });

                if (res.ok) {
                    const data: EventsApiItem[] = await res.json();
                    const newEvents: CalendarEvent[] = [];
                    const now = new Date();
                    now.setHours(0, 0, 0, 0);

                    data.forEach((item) => {
                        if (!item.success || !item.data) return;

                        const { symbol, data: summary } = item;
                        const calendar = summary.calendarEvents;
                        const details = summary.summaryDetail;

                        if (calendar?.earnings?.earningsDate?.length) {
                            const eDates = calendar.earnings.earningsDate;
                            const eDate = new Date(eDates[0]);
                            if (eDate >= now) {
                                newEvents.push({
                                    ticker: symbol,
                                    type: 'Earnings',
                                    date: eDate,
                                    details: `Est. Revenue: ${calendar.earnings.revenueAverage || 'N/A'}`,
                                    isEstimate: eDates.length > 1
                                });
                            }
                        }

                        if (details?.exDividendDate) {
                            const divDate = new Date(details.exDividendDate);
                            if (divDate >= now) {
                                const yieldStr = details.dividendYield != null
                                    ? `${(details.dividendYield * 100).toFixed(2)}%`
                                    : '—';
                                const rateStr = details.dividendRate != null
                                    ? `$${details.dividendRate}`
                                    : '—';
                                newEvents.push({
                                    ticker: symbol,
                                    type: 'Ex-Dividend',
                                    date: divDate,
                                    details: `Yield: ${yieldStr} | Rate: ${rateStr}`,
                                    isEstimate: false
                                });
                            }
                        }
                    });

                    newEvents.sort((a, b) => a.date.getTime() - b.date.getTime());
                    setEvents(newEvents);
                }
            } catch (error) {
                console.error('Failed to load events', error);
            } finally {
                setLoading(false);
            }
        };

        fetchEvents();
    }, [assets]);

    if (loading) {
        return (
            <div className="bg-slate-800/95 border border-slate-700/90 rounded-2xl p-6 shadow-xl animate-pulse h-56" />
        );
    }

    return (
        <section className="bg-slate-800/95 border border-slate-700/90 rounded-2xl shadow-xl overflow-hidden">
            <div className="px-6 py-4 bg-slate-900/80 border-b border-slate-700/80 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-blue-500/15 border border-blue-500/35 text-blue-400">
                        <CalendarClock size={18} />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-white tracking-tight">
                            Upcoming Events (My Positions)
                        </h2>
                        <p className="text-xs text-slate-300">Upcoming earnings &amp; ex-dividend dates</p>
                    </div>
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold font-mono bg-slate-800 border border-slate-700 text-slate-300">
                    {events.length}
                </span>
            </div>

            {events.length === 0 ? (
                <div className="text-slate-300 text-sm text-center py-10 px-6">
                    No upcoming earnings or dividends found for your current holdings.
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-900/90 border-b border-slate-700/80">
                            <tr>
                                <th className="px-6 py-3 text-xs font-bold uppercase tracking-wider text-slate-300">Date</th>
                                <th className="px-6 py-3 text-xs font-bold uppercase tracking-wider text-slate-300">Ticker</th>
                                <th className="px-6 py-3 text-xs font-bold uppercase tracking-wider text-slate-300">Event</th>
                                <th className="px-6 py-3 text-xs font-bold uppercase tracking-wider text-slate-300 text-right">Details</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700/60 text-sm">
                            {events.map((evt, idx) => (
                                <tr key={`${evt.ticker}-${evt.type}-${idx}`} className="hover:bg-slate-750/60 transition-colors">
                                    <td className="px-6 py-3.5 text-white font-medium whitespace-nowrap font-mono tabular-nums">
                                        {evt.date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                    </td>
                                    <td className="px-6 py-3.5 font-bold font-mono text-green-400">{evt.ticker}</td>
                                    <td className="px-6 py-3.5">
                                        <span
                                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border ${
                                                evt.type === 'Earnings'
                                                    ? 'bg-blue-500/15 border-blue-500/35 text-blue-400'
                                                    : 'bg-green-500/15 border-green-500/35 text-green-400'
                                            }`}
                                        >
                                            {evt.type === 'Earnings' ? <Calendar size={13} /> : <DollarSign size={13} />}
                                            {evt.type}
                                        </span>
                                    </td>
                                    <td className="px-6 py-3.5 text-slate-300 text-sm font-mono tabular-nums text-right">
                                        {evt.details}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </section>
    );
};

export default EventsTable;
