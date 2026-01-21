import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface ScreenerQuote {
    symbol: string;
    shortName: string;
    price: number;
    change: number;
    changePercent: number;
}

interface ScreenerWidgetProps {
    title: string;
    type: string;
}

const ScreenerWidget = ({ title, type }: ScreenerWidgetProps) => {
    const [quotes, setQuotes] = useState<ScreenerQuote[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchScreener = async () => {
            try {
                const res = await fetch(`http://localhost:3001/api/screener?type=${type}`);
                if (res.ok) {
                    const data = await res.json();
                    setQuotes(data.quotes.slice(0, 5)); // Limit to 5 for widget
                }
            } catch (error) {
                console.error("Screener load failed", error);
            } finally {
                setLoading(false);
            }
        };
        fetchScreener();
    }, [type]);

    if (loading) return <div className="glass-panel p-6 h-64 animate-pulse"></div>;

    return (
        <div className="glass-panel p-6">
            <h3 className="text-xl font-bold mb-4 text-white">{title}</h3>
            <div className="space-y-3">
                {quotes.map((q) => (
                    <div key={q.symbol} className="flex justify-between items-center p-2 rounded hover:bg-slate-700/50 transition-colors">
                        <div className="flex-1 min-w-0 mr-4">
                            <div className="font-semibold text-white">{q.symbol}</div>
                            <div className="text-xs text-slate-400 break-words">{q.shortName}</div>
                        </div>
                        <div className="text-right">
                            <div className="text-white">${q.price.toFixed(2)}</div>
                            <div className={`text-xs flex items-center justify-end gap-1 ${q.change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                {q.change > 0 ? <TrendingUp size={12} /> : q.change < 0 ? <TrendingDown size={12} /> : <Minus size={12} />}
                                {q.changePercent.toFixed(2)}%
                            </div>
                        </div>
                    </div>
                ))}
                {quotes.length === 0 && <div className="text-slate-500 text-sm">No data available</div>}
            </div>
        </div>
    );
};

export default ScreenerWidget;
