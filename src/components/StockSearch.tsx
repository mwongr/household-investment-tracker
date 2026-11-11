import { useState } from 'react';
import { Search, X, Loader2 } from 'lucide-react';

interface StockSearchProps {
    onSearch: (symbol: string) => void;
    isLoading: boolean;
    quickTickers?: string[];
    activeTicker?: string;
}

const StockSearch = ({ onSearch, isLoading, quickTickers = [], activeTicker }: StockSearchProps) => {
    const [input, setInput] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (input.trim()) {
            onSearch(input.trim().toUpperCase());
        }
    };

    return (
        <div className="space-y-3">
            <form
                onSubmit={handleSubmit}
                className="flex flex-col sm:flex-row gap-2.5 bg-slate-800/95 border border-slate-700/90 rounded-2xl p-2 shadow-lg focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 transition-all"
            >
                <div className="relative flex-1 flex items-center">
                    <Search className="absolute left-3.5 text-slate-400 pointer-events-none" size={18} />
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value.toUpperCase())}
                        placeholder="Search ticker symbol (e.g., AAPL, TD.TO, XEQT.TO)"
                        className="w-full bg-transparent text-white placeholder-slate-400 pl-10 pr-9 py-2.5 text-sm font-medium focus:outline-none"
                        disabled={isLoading}
                        aria-label="Search stock ticker symbol"
                    />
                    {input && !isLoading && (
                        <button
                            type="button"
                            onClick={() => setInput('')}
                            className="absolute right-2.5 p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-700/70 transition-colors"
                            title="Clear search"
                            aria-label="Clear search"
                        >
                            <X size={15} />
                        </button>
                    )}
                </div>
                <button
                    type="submit"
                    disabled={isLoading || !input.trim()}
                    style={{ color: '#ffffff' }}
                    className="inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-45 disabled:cursor-not-allowed px-6 py-2.5 rounded-xl text-sm font-semibold shadow-sm transition-all shrink-0"
                >
                    {isLoading ? (
                        <>
                            <Loader2 size={16} className="animate-spin" />
                            <span>Searching...</span>
                        </>
                    ) : (
                        <span>Lookup Quote</span>
                    )}
                </button>
            </form>

            {quickTickers.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 px-1">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                        Quick lookup:
                    </span>
                    {quickTickers.map((sym) => {
                        const isActive = activeTicker === sym;
                        return (
                            <button
                                key={sym}
                                type="button"
                                disabled={isLoading}
                                onClick={() => {
                                    setInput(sym);
                                    onSearch(sym);
                                }}
                                style={isActive ? { color: '#ffffff' } : undefined}
                                className={`px-2.5 py-1 rounded-lg text-xs font-semibold font-mono transition-all border ${
                                    isActive
                                        ? 'bg-blue-600 border-blue-500 shadow-sm'
                                        : 'bg-slate-800 border-slate-700 text-slate-200 hover:border-blue-500/60 hover:bg-slate-750'
                                }`}
                            >
                                {sym}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default StockSearch;
