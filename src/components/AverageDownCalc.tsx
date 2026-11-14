import { useState, useMemo } from 'react';
import { TrendingDown, RotateCcw, ChevronRight, AlertTriangle, CheckCircle } from 'lucide-react';
import type { Asset } from '../types';

interface Props {
    assets: Asset[];
}

const fmt = (n: number) => n.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtP = (n: number) => (n >= 0 ? '+' : '') + n.toFixed(2) + '%';

const AverageDownCalc: React.FC<Props> = ({ assets }) => {
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [newPrice, setNewPrice] = useState('');
    const [newShares, setNewShares] = useState(0);

    const maxNewShares = 10000;

    const investableAssets = useMemo(
        () => assets.filter(a => a.quantity > 0 && a.averageCost > 0),
        [assets]
    );
    const selected = useMemo(
        () => investableAssets.find(a => a.id === selectedId) ?? null,
        [investableAssets, selectedId]
    );

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

        const cs = selected.quantity;
        const cap = selected.averageCost;

        const totalShares = cs + ns;
        const totalCost = cs * cap + ns * np;
        const newAvgCost = totalShares > 0 ? totalCost / totalShares : cap;
        const capitalNeeded = ns * np;
        const savings = (cap - newAvgCost) * totalShares;
        const pctReduction = cap > 0 ? ((cap - newAvgCost) / cap) * 100 : 0;
        const isAveragingDown = np < cap;

        const breakEven = newAvgCost;
        const currentGap =
            selected.currentPrice > 0 ? ((breakEven - selected.currentPrice) / selected.currentPrice) * 100 : null;

        return {
            newAvgCost,
            capitalNeeded,
            totalShares,
            savings,
            pctReduction,
            isAveragingDown,
            breakEven,
            currentGap,
        };
    }, [selected, newPrice, newShares]);

    return (
        <section className="bg-slate-800/95 border border-slate-700/90 rounded-2xl shadow-xl overflow-hidden mt-8">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4 bg-slate-900/80 border-b border-slate-700/80">
                <div className="flex items-center gap-3.5">
                    <div className="p-2.5 rounded-xl bg-blue-500/15 border border-blue-500/35 text-blue-400">
                        <TrendingDown size={20} />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-white tracking-tight">Average Down Calculator</h2>
                        <p className="text-xs text-slate-300">
                            {selected
                                ? `Analyzing ${selected.ticker} — click another holding to switch`
                                : 'Select a holding below to model an average-down scenario'}
                        </p>
                    </div>
                </div>
                {selected && (
                    <button
                        onClick={handleClear}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-750 border border-slate-700 hover:border-slate-500 text-slate-200 hover:text-white rounded-xl text-xs font-semibold transition-colors"
                    >
                        <RotateCcw size={13} /> Reset
                    </button>
                )}
            </div>

            <div className="p-5 space-y-5">
                {/* Asset Picker */}
                {investableAssets.length === 0 ? (
                    <p className="text-slate-300 text-sm text-center py-6">No holdings in this account yet.</p>
                ) : (
                    <div>
                        <p className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3">
                            Holdings in this account — click one to model
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2.5">
                            {investableAssets.map(asset => {
                                const isDown = asset.profitPercent < 0;
                                const isActive = selectedId === asset.id;
                                return (
                                    <button
                                        key={asset.id}
                                        onClick={() => handleSelect(asset)}
                                        className={`w-full text-left p-3.5 rounded-xl border transition-all flex items-center justify-between gap-2 ${
                                            isActive
                                                ? 'bg-blue-500/15 border-blue-500/60 shadow-sm'
                                                : 'bg-slate-900/70 border-slate-700/80 hover:border-slate-500'
                                        }`}
                                    >
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2 mb-0.5">
                                                {isDown ? (
                                                    <AlertTriangle size={12} className="text-red-400 shrink-0" />
                                                ) : (
                                                    <CheckCircle size={12} className="text-green-400 shrink-0" />
                                                )}
                                                <span className="font-bold font-mono text-white text-sm">
                                                    {asset.ticker}
                                                </span>
                                                {isDown && (
                                                    <span className="text-[11px] font-bold text-red-400 bg-red-500/15 border border-red-500/30 px-2 py-0.5 rounded-full">
                                                        Candidate
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-xs text-slate-300 font-mono truncate">
                                                {asset.quantity.toLocaleString()} shs @ ${fmt(asset.averageCost)}
                                            </p>
                                            <p
                                                className={`text-xs font-mono font-bold mt-0.5 ${
                                                    isDown ? 'text-red-400' : 'text-green-400'
                                                }`}
                                            >
                                                {fmtP(asset.profitPercent)} unrealized
                                            </p>
                                        </div>
                                        <ChevronRight
                                            size={15}
                                            className={isActive ? 'text-blue-400 shrink-0' : 'text-slate-400 shrink-0'}
                                        />
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Calculator */}
                {selected && (
                    <div className="border-t border-slate-700/80 pt-5 space-y-5">
                        <div className="flex flex-wrap items-center gap-3 p-3.5 bg-slate-900/75 rounded-xl border border-slate-700/80 text-sm">
                            <span className="font-bold font-mono text-white">{selected.ticker}</span>
                            <span className="text-slate-400">·</span>
                            <span className="text-slate-300">{selected.quantity.toLocaleString()} shares held</span>
                            <span className="text-slate-400">·</span>
                            <span className="text-slate-300">
                                Avg cost{' '}
                                <span className="text-white font-mono tabular-nums font-semibold">
                                    ${fmt(selected.averageCost)}
                                </span>
                            </span>
                            <span className="text-slate-400">·</span>
                            <span className="text-slate-300">
                                Current price{' '}
                                <span className="text-white font-mono tabular-nums font-semibold">
                                    ${fmt(selected.currentPrice)}
                                </span>
                            </span>
                            <span
                                className={`font-mono tabular-nums font-bold ml-auto ${
                                    selected.profitPercent < 0 ? 'text-red-400' : 'text-green-400'
                                }`}
                            >
                                {fmtP(selected.profitPercent)} (${fmt(selected.profit)})
                            </span>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Inputs */}
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                                        New Purchase Price ($)
                                    </label>
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        className="input-no-spinner w-full bg-slate-900 border border-slate-700 text-white placeholder-slate-400 rounded-xl px-3.5 py-2.5 text-sm font-mono tabular-nums focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                                        placeholder={`e.g. ${fmt(selected.currentPrice)}`}
                                        value={newPrice}
                                        onChange={e => setNewPrice(e.target.value)}
                                    />
                                    {selected.currentPrice > 0 && (
                                        <button
                                            type="button"
                                            onClick={() => setNewPrice(selected.currentPrice.toFixed(2))}
                                            className="text-xs font-semibold text-blue-400 hover:underline mt-1.5 inline-block"
                                        >
                                            Use current market price (${fmt(selected.currentPrice)})
                                        </button>
                                    )}
                                </div>

                                <div>
                                    <div className="flex justify-between items-center mb-2">
                                        <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                                            New Shares to Buy
                                        </label>
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="number"
                                                min="0"
                                                max={maxNewShares}
                                                step="1"
                                                className="input-no-spinner w-24 bg-slate-900 border border-slate-700 text-white rounded-lg text-right text-sm font-mono tabular-nums py-1 px-2.5 focus:outline-none focus:border-blue-500"
                                                value={newShares}
                                                onChange={e =>
                                                    setNewShares(
                                                        Math.max(0, Math.min(maxNewShares, parseInt(e.target.value) || 0))
                                                    )
                                                }
                                            />
                                            <span className="text-xs font-medium text-slate-300">shares</span>
                                        </div>
                                    </div>
                                    <input
                                        type="range"
                                        min="0"
                                        max={maxNewShares}
                                        step="1"
                                        value={newShares}
                                        onChange={e => setNewShares(parseInt(e.target.value))}
                                        className="w-full accent-blue-500 cursor-pointer"
                                    />
                                    <div className="flex justify-between text-xs font-mono text-slate-400 mt-1">
                                        <span>0</span>
                                        <span>{(maxNewShares / 2).toLocaleString()}</span>
                                        <span>{maxNewShares.toLocaleString()}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Outputs */}
                            <div>
                                {result ? (
                                    <div className="space-y-3">
                                        <div
                                            className={`p-4 rounded-xl border text-center ${
                                                result.isAveragingDown
                                                    ? 'bg-green-500/15 border-green-500/35'
                                                    : 'bg-amber-500/15 border-amber-500/35'
                                            }`}
                                        >
                                            <p className="text-xs font-bold uppercase tracking-wider text-slate-200 mb-1">
                                                New Average Cost
                                            </p>
                                            <p
                                                className={`text-3xl font-bold font-mono tabular-nums ${
                                                    result.isAveragingDown ? 'text-green-400' : 'text-amber-400'
                                                }`}
                                            >
                                                ${fmt(result.newAvgCost)}
                                            </p>
                                            <p className="text-xs text-slate-300 mt-1 font-mono">
                                                was ${fmt(selected.averageCost)}
                                                {result.isAveragingDown ? (
                                                    <span className="text-green-400 font-bold ml-1.5">
                                                        ↓ {result.pctReduction.toFixed(2)}% lower
                                                    </span>
                                                ) : (
                                                    <span className="text-amber-400 font-bold ml-1.5">
                                                        ↑ averaging up
                                                    </span>
                                                )}
                                            </p>
                                        </div>

                                        {result.currentGap !== null && result.isAveragingDown && (
                                            <div className="p-3.5 bg-blue-500/15 border border-blue-500/35 rounded-xl">
                                                <p className="text-xs font-bold text-blue-400 uppercase tracking-wider">
                                                    Break-even analysis
                                                </p>
                                                <p className="text-xs text-slate-200 mt-1">
                                                    {selected.currentPrice < result.newAvgCost ? (
                                                        <>
                                                            Stock needs to rise{' '}
                                                            <span className="text-white font-mono font-bold">
                                                                {Math.abs(result.currentGap).toFixed(1)}%
                                                            </span>{' '}
                                                            from ${fmt(selected.currentPrice)} to break even at $
                                                            {fmt(result.newAvgCost)}
                                                        </>
                                                    ) : (
                                                        <>
                                                            Already above your new average — profitable immediately at
                                                            current price
                                                        </>
                                                    )}
                                                </p>
                                            </div>
                                        )}

                                        <div className="p-3.5 bg-slate-900/75 rounded-xl border border-slate-700/80 flex justify-between items-center">
                                            <div>
                                                <p className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                                                    Capital Required
                                                </p>
                                                <p className="text-xs font-mono text-slate-400 mt-0.5">
                                                    {newShares.toLocaleString()} shares × ${fmt(parseFloat(newPrice))}
                                                </p>
                                            </div>
                                            <span className="font-mono tabular-nums font-bold text-xl text-white">
                                                ${fmt(result.capitalNeeded)}
                                            </span>
                                        </div>

                                        <div className="p-3.5 bg-slate-900/75 rounded-xl border border-slate-700/80 flex justify-between items-center">
                                            <p className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                                                Total Shares After
                                            </p>
                                            <span className="font-mono tabular-nums font-bold text-white">
                                                {result.totalShares.toLocaleString()}
                                            </span>
                                        </div>

                                        {result.isAveragingDown && newShares > 0 && (
                                            <div className="p-3.5 bg-slate-900/75 rounded-xl border border-slate-700/80 flex justify-between items-center">
                                                <div>
                                                    <p className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                                                        Avg Cost Reduction
                                                    </p>
                                                    <p className="text-xs text-slate-400 mt-0.5">
                                                        total savings vs. old average
                                                    </p>
                                                </div>
                                                <span className="font-mono tabular-nums font-bold text-lg text-green-400">
                                                    ${fmt(result.savings)}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="h-full flex items-center justify-center text-slate-300 text-sm bg-slate-900/50 border border-dashed border-slate-700 rounded-xl p-8 text-center min-h-[160px]">
                                        Enter a new purchase price and adjust shares to model your scenario
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </section>
    );
};

export default AverageDownCalc;
