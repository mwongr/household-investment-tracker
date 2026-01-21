import { useEffect, useState } from 'react';
import { Calendar, DollarSign } from 'lucide-react';
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
                const res = await fetch('http://localhost:3001/api/events', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ symbols: uniqueTickers })
                });

                if (res.ok) {
                    const data = await res.json();
                    const newEvents: CalendarEvent[] = [];
                    const now = new Date();
                    now.setHours(0, 0, 0, 0); // Start of today

                    data.forEach((item: any) => {
                        if (!item.success || !item.data) return;

                        const { symbol, data: summary } = item;
                        const calendar = summary.calendarEvents;
                        const details = summary.summaryDetail;

                        // 1. Earnings
                        if (calendar && calendar.earnings && calendar.earnings.earningsDate) {
                            const eDates = calendar.earnings.earningsDate;
                            if (eDates.length > 0) {
                                // Usually returns [start, end] or [date]. We take the first.
                                const eDate = new Date(eDates[0]);
                                if (eDate >= now) {
                                    newEvents.push({
                                        ticker: symbol,
                                        type: 'Earnings',
                                        date: eDate,
                                        details: `Est. EPS: ${calendar.earnings.revenueAverage || 'N/A'}`, // revenueAverage? EPS is separate usually. revenueAverage is revenue. revenueEstimate?
                                        // earningsEstimate? Let's genericize or check structure later. 
                                        // simpler: just show "Earnings Announcement"
                                        isEstimate: eDates.length > 1 // range implies estimate/unconfirmed
                                    });
                                }
                            }
                        }

                        // 2. Ex-Dividend
                        if (details && details.exDividendDate) {
                            const divDate = new Date(details.exDividendDate);
                            if (divDate >= now) {
                                newEvents.push({
                                    ticker: symbol,
                                    type: 'Ex-Dividend',
                                    date: divDate,
                                    details: `Yield: ${(details.dividendYield * 100).toFixed(2)}% | Rate: $${details.dividendRate}`,
                                    isEstimate: false
                                });
                            }
                        }
                    });

                    // Sort by date
                    newEvents.sort((a, b) => a.date.getTime() - b.date.getTime());
                    setEvents(newEvents);
                }
            } catch (error) {
                console.error("Failed to load events", error);
            } finally {
                setLoading(false);
            }
        };

        fetchEvents();
    }, [assets]); // Re-run if assets change (rarely on dashboard load)

    if (loading) return <div className="glass-panel p-6 animate-pulse h-64"></div>;

    if (events.length === 0) {
        return (
            <div className="glass-panel p-6">
                <h2 className="text-xl font-bold text-white mb-4">Upcoming Events</h2>
                <div className="text-slate-400 text-center py-8">No upcoming earnings or dividends found for your assets.</div>
            </div>
        );
    }

    return (
        <div className="glass-panel p-6 overflow-hidden">
            <h2 className="text-xl font-bold text-white mb-4">Upcoming Events (My Positions)</h2>
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="text-slate-400 border-b border-slate-700">
                            <th className="py-3 px-2 font-medium">Date</th>
                            <th className="py-3 px-2 font-medium">Ticker</th>
                            <th className="py-3 px-2 font-medium">Event</th>
                            <th className="py-3 px-2 font-medium text-right">Details</th>
                        </tr>
                    </thead>
                    <tbody>
                        {events.map((evt, idx) => (
                            <tr key={`${evt.ticker}-${evt.type}-${idx}`} className="border-b border-slate-700/50 hover:bg-slate-700/20 transition-colors">
                                <td className="py-3 px-2 text-white whitespace-nowrap">
                                    {evt.date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                </td>
                                <td className="py-3 px-2 font-bold text-emerald-400">{evt.ticker}</td>
                                <td className="py-3 px-2 text-white">
                                    <div className="flex items-center gap-2">
                                        {evt.type === 'Earnings' ? <Calendar size={16} className="text-blue-400" /> : <DollarSign size={16} className="text-green-400" />}
                                        {evt.type}
                                    </div>
                                </td>
                                <td className="py-3 px-2 text-slate-300 text-sm text-right">
                                    {evt.details}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default EventsTable;
