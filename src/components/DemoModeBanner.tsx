import React, { useState } from 'react';
import { Sparkles, Trash2, X, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useData } from '../context/DataContext';

export const DemoModeBanner: React.FC = () => {
    const { isDemoData, clearAllData } = useData();
    const [dismissed, setDismissed] = useState(false);

    if (!isDemoData || dismissed) {
        return null;
    }

    const handleClear = () => {
        if (window.confirm('Clear all demo data and start with a fresh blank portfolio?')) {
            clearAllData();
        }
    };

    return (
        <aside
            aria-label="Demo mode announcement"
            className="mb-6 rounded-2xl bg-slate-800/95 border border-slate-700/90 p-4 shadow-lg"
        >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start sm:items-center gap-3 min-w-0">
                    <Sparkles size={18} className="text-amber-400 shrink-0" />
                    <div>
                        <div className="flex items-center gap-2">
                            <span
                                style={{ color: '#0f172a' }}
                                className="text-xs font-bold uppercase tracking-wider bg-amber-400 px-2.5 py-0.5 rounded-md"
                            >
                                Demo Mode
                            </span>
                            <span className="text-sm font-semibold text-white">
                                Exploring sample household portfolio
                            </span>
                        </div>
                        <p className="text-xs text-slate-300 mt-0.5">
                            All numbers, rebalancing tools, and tax scenarios are interactive. Ready for real investments?
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                    <button
                        onClick={handleClear}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-700 hover:border-red-500/40 text-red-400 hover:text-red-300 text-xs font-bold transition-colors"
                        title="Delete demo data and start fresh"
                    >
                        <Trash2 size={13} />
                        Clear Demo &amp; Start Fresh
                    </button>
                    <Link
                        to="/settings"
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-slate-300 hover:text-white text-xs font-semibold transition-colors"
                    >
                        Settings <ExternalLink size={12} />
                    </Link>
                    <button
                        onClick={() => setDismissed(true)}
                        className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800/50 transition-colors"
                        title="Hide banner for now"
                        aria-label="Dismiss banner"
                    >
                        <X size={16} />
                    </button>
                </div>
            </div>
        </aside>
    );
};
