import { useState } from 'react';
import { Search } from 'lucide-react';

interface StockSearchProps {
    onSearch: (symbol: string) => void;
    isLoading: boolean;
}

const StockSearch = ({ onSearch, isLoading }: StockSearchProps) => {
    const [input, setInput] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (input.trim()) {
            onSearch(input.trim().toUpperCase());
        }
    };

    return (
        <form onSubmit={handleSubmit} className="flex gap-4 max-w-xl mx-auto mb-8">
            <div className="relative flex-1">
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Enter symbol (e.g., TD.TO)"
                    className="w-full bg-slate-800 border-slate-700 text-white placeholder-slate-400 rounded-lg px-4 py-3 pl-10 border focus:border-blue-500 focus:outline-none transition-colors"
                    disabled={isLoading}
                />
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            </div>
            <button
                type="submit"
                disabled={isLoading || !input}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-2 rounded-lg font-medium transition-colors"
            >
                {isLoading ? 'Searching...' : 'Search'}
            </button>
        </form>
    );
};

export default StockSearch;
