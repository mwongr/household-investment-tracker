import { useState, useMemo } from 'react';
import { TrendingDown, RotateCcw, ChevronRight, AlertTriangle, CheckCircle } from 'lucide-react';
import type { Asset } from '../types';

interface Props {
    assets: Asset[];
}

const fmt  = (n: number) => n.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtP = (n: number) => (n >= 0 ? '+' : '') + n.toFixed(2) + '%';

const AverageDownCalc: React.FC<Props> = ({ assets }) => {
    const [selectedId, setSelectedId]       = useState<string | null>(null);
    const [newPrice, setNewPrice]           = useState('');
    const [newShares, setNewShares]         = useState(0);

    const maxNewShares = 10000;

    // Investable assets only (exclude cash-type)
    const investableAssets = assets.filter(a => a.quantity > 0 && a.averageCost > 0);

    const selected = investableAssets.find(a => a.id === selectedId) ?? null;

    const handleSelect = (asset: Asset) => {
        setSelectedId(asset.id);
        setNewPrice('');
        setNewShares(0);
    };

    const handleClear = () => {
        setSelectedId(null);
        setNewPrice('');
        setNewShares(0);
    };

    const result = useMemo(() => {
        if (!selected) return null;
        const np = parseFloat(newPrice);
        const ns = newShares;

        if (!np || np <= 0) return null;

        const cs  = selected.quantity;
        const cap = selected.averageCost;

        const totalShares    = cs + ns;
        const totalCost      = cs * cap + ns * np;
        const newAvgCost     = totalShares > 0 ? totalCost / totalShares : cap;
        const capitalNeeded  = ns * np;
        const savings        = (cap - newAvgCost) * totalShares;
        const pctReduction   = cap > 0 ? ((cap - newAvgCost) / cap) * 100 : 0;
        const isAveragingDown = np < cap;

        // Break-even: how far current price needs to rise to profit
        const breakEven      = newAvgCost;  // by definition
        const currentGap     = selected.currentPrice > 0 ? ((breakEven - selected.currentPrice) / selected.currentPrice) * 100 : null;

        return { newAvgCost, capitalNeeded, totalShares, savings, pctReduction, isAveragingDown, breakEven, currentGap };
    }, [selected, newPrice, newShares]);

    return (
        <div className="glass-panel overflow-hidden mt-8">
            {/* ── Header ── */}
            <div className="flex items-center justify-between p-5 border-b border-slate-700/50 bg-gradient-to-r from-blue-900/80 to-indigo-900/60">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-white/10 rounded-lg">
                        <TrendingDown size={20} className="text-white" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-white">Average Down Calculator</h2>
                        <p className="text-xs text-white/60">
                            {selected
                                ? `Analyzing ${selected.ticker} — click another asset to switch`
                                : 'Select a holding below to model an average-down scenario'}
                        </p>
                    </div>
                </div>
                {selected && (
                    <button
                        onClick={handleClear}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white/10 hover:bg-white/20 text-white/80 hover:text-white rounded-lg text-xs font-bold transition-colors"
                    >
                        <RotateCcw size={13} /> Reset
                    </button>
                )}
            </div>

            <div className="p-5 space-y-5">

                {/* ── Asset Picker ── */}
                {investableAssets.length === 0 ? (
                    <p className="text-slate-500 text-sm text-center py-6">No holdings in this account yet.</p>
                ) : (
                    <div>
                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
                            Holdings in this account — click one to model
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
                            {investableAssets.map(asset => {
                                const isDown   = asset.profitPercent < 0;
                                const isActive = selectedId === asset.id;
                                return (
                                    <button
                                        key={asset.id}
                                        onClick={() => handleSelect(asset)}
                                        className={`w-full text-left p-3 rounded-xl border transition-all flex items-center justify-between gap-2 ${
                                            isActive
                                                ? 'bg-blue-600/20 border-blue-500/60 shadow-lg shadow-blue-500/10'
                                                : 'bg-slate-800/50 border-slate-700/40 hover:border-slate-600/60 hover:bg-slate-800'
                                        }`}
                                    >
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-1.5 mb-0.5">
                                                {isDown
                                                    ? <AlertTriangle size={11} className="text-red-400 shrink-0" />
                                                    : <CheckCircle size={11} className="text-green-400 shrink-0" />}
                                                <span className="font-bold text-white text-sm">{asset.ticker}</span>
                                                {isDown && (
                                                    <span className="text-[10px] font-bold text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded-full">
                                                        Candidate
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-xs text-slate-400 truncate">
                                                {asset.quantity.toLocaleString()} shares @ ${fmt(asset.averageCost)}
                                            </p>
                                            <p className={`text-xs font-semibold mt-0.5 ${isDown ? 'text-red-400' : 'text-green-400'}`}>
                                                {fmtP(asset.profitPercent)} unrealized
                                            </p>
                                        </div>
                                        <ChevronRight size={14} className={isActive ? 'text-blue-400' : 'text-slate-600'} />
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* ── Calculator (shown when asset selected) ── */}
                {selected && (
                    <div className="border-t border-slate-700/50 pt-5">
                        {/* Selected context bar */}
                        <div className="flex flex-wrap items-center gap-3 mb-5 p-3 bg-slate-900/40 rounded-xl border border-slate-700/30 text-sm">
                            <span className="font-bold text-white">{selected.ticker}</span>
                            <span className="text-slate-500">·</span>
                            <span className="text-slate-400">{selected.quantity.toLocaleString()} shares held</span>
                            <span className="text-slate-500">·</span>
                            <span className="text-slate-400">Avg cost <span className="text-white font-mono">${fmt(selected.averageCost)}</span></span>
                            <span className="text-slate-500">·</span>
                            <span className="text-slate-400">Current price <span className="text-white font-mono">${fmt(selected.currentPrice)}</span></span>
                            <span className={`font-semibold ml-auto ${selected.profitPercent < 0 ? 'text-red-400' : 'text-green-400'}`}>
                                {fmtP(selected.profitPercent)} (${fmt(selected.profit)})
                            </span>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                            {/* ── Inputs ── */}
                            <div className="space-y-4">
                                {/* New Purchase Price */}
                                <div>
                                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">
                                        New Purchase Price
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="number" min="0" step="0.01"
                                            className="input input-no-spinner w-full"
                                            placeholder={`e.g. ${fmt(selected.currentPrice)}`}
                                            value={newPrice}
                                            onChange={e => setNewPrice(e.target.value)}
                                        />
                                    </div>
                                    {selected.currentPrice > 0 && (
                                        <button
                                            onClick={() => setNewPrice(selected.currentPrice.toFixed(2))}
                                            className="text-xs text-blue-400 hover:text-blue-300 mt-1 transition-colors"
                                        >
                                            Use current market price (${fmt(selected.currentPrice)})
                                        </button>
                                    )}
                                </div>

                                {/* New Shares Slider */}
                                <div>
                                    <div className="flex justify-between items-center mb-2">
                                        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                                            New Shares to Buy
                                        </label>
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="number" min="0" max={maxNewShares} step="1"
                                                className="input input-no-spinner w-20 text-right text-sm py-1 px-2"
                                                value={newShares}
                                                onChange={e => setNewShares(Math.max(0, Math.min(maxNewShares, parseInt(e.target.value) || 0)))}
                                            />
                                            <span className="text-xs text-slate-500">shares</span>
                                        </div>
                                    </div>
                                    <input
                                        type="range" min="0" max={maxNewShares} step="1"
                                        value={newShares}
                                        onChange={e => setNewShares(parseInt(e.target.value))}
                                        className="w-full accent-blue-500 cursor-pointer"
                                    />
                                    <div className="flex justify-between text-[10px] text-slate-600 mt-0.5">
                                        <span>0</span>
                                        <span>{(maxNewShares / 2).toLocaleString()}</span>
                                        <span>{maxNewShares.toLocaleString()}</span>
                                    </div>
                                </div>
                            </div>

                            {/* ── Outputs ── */}
                            <div>
                                {result ? (
                                    <div className="space-y-3">
                                        {/* New Average Cost — hero */}
                                        <div className={`p-4 rounded-xl border text-center ${result.isAveragingDown ? 'bg-green-500/8 border-green-500/20' : 'bg-amber-500/8 border-amber-500/20'}`}>
                                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">New Average Cost</p>
                                            <p className={`text-3xl font-bold font-mono ${result.isAveragingDown ? 'text-green-400' : 'text-amber-400'}`}>
                                                ${fmt(result.newAvgCost)}
                                            </p>
                                            <p className="text-xs text-slate-500 mt-1">
                                                was ${fmt(selected.averageCost)}
                                                {result.isAveragingDown
                                                    ? <span className="text-green-500 ml-1">↓ {result.pctReduction.toFixed(2)}% lower</span>
                                                    : <span className="text-amber-500 ml-1">↑ averaging up</span>}
                                            </p>
                                        </div>

                                        {/* Break-even context */}
                                        {result.currentGap !== null && result.isAveragingDown && (
                                            <div className="p-3 bg-blue-500/8 border border-blue-500/20 rounded-xl">
                                                <p className="text-xs font-semibold text-blue-300">Break-even analysis</p>
                                                <p className="text-xs text-slate-400 mt-0.5">
                                                    {selected.currentPrice < result.newAvgCost
                                                        ? <>Stock needs to rise <span className="text-white font-semibold">{Math.abs(result.currentGap).toFixed(1)}%</span> from ${fmt(selected.currentPrice)} to break even at ${fmt(result.newAvgCost)}</>
                                                        : <>Already above your new average — you'd be profitable immediately at current price</>}
                                                </p>
                                            </div>
                                        )}

                                        {/* Capital Required */}
                                        <div className="p-3.5 bg-slate-800/60 rounded-xl border border-slate-700/40 flex justify-between items-center">
                                            <div>
                                                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Capital Required</p>
                                                <p className="text-xs text-slate-500 mt-0.5">{newShares.toLocaleString()} shares × ${fmt(parseFloat(newPrice))}</p>
                                            </div>
                                            <span className="font-mono font-bold text-xl text-white">${fmt(result.capitalNeeded)}</span>
                                        </div>

                                        {/* Total Shares */}
                                        <div className="p-3.5 bg-slate-800/60 rounded-xl border border-slate-700/40 flex justify-between items-center">
                                            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Total Shares After</p>
                                            <span className="font-mono font-bold text-white">{result.totalShares.toLocaleString()}</span>
                                        </div>

                                        {/* Cost Reduction */}
                                        {result.isAveragingDown && newShares > 0 && (
                                            <div className="p-3.5 bg-slate-800/60 rounded-xl border border-slate-700/40 flex justify-between items-center">
                                                <div>
                                                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Avg Cost Reduction</p>
                                                    <p className="text-xs text-slate-500 mt-0.5">total savings vs. old average</p>
                                                </div>
                                                <span className="font-mono font-bold text-green-400">${fmt(result.savings)}</span>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="h-full flex items-center justify-center text-slate-600 text-sm italic bg-slate-900/30 rounded-xl p-8 text-center min-h-40">
                                        Enter a new purchase price and drag the slider to model your scenario
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AverageDownCalc;
