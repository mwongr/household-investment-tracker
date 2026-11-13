import React from 'react';
import { Calculator, RefreshCw } from 'lucide-react';
import type { Asset } from '../types';

const fmt2 = (n: number) =>
    n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

interface SimProjectedProps {
    summaryLabel: string;
    summaryValue: string;
    tradeProfit?: number;
    tradeProfitPct?: number;
    newBookCost: number;
    newMarketValue: number;
    newProfit: number;
    newProfitPercent: number;
    newAvg: number;
}

const SimProjected: React.FC<SimProjectedProps> = ({
    summaryLabel,
    summaryValue,
    tradeProfit,
    tradeProfitPct,
    newBookCost,
    newMarketValue,
    newProfit,
    newProfitPercent,
    newAvg,
}) => (
    <div className="bg-slate-900/75 border border-slate-700/80 rounded-xl p-2.5 text-xs space-y-1.5">
        <div className="flex justify-between items-center gap-2">
            <span className="text-slate-300">
                {summaryLabel}: <span className="text-white font-mono font-bold">{summaryValue}</span>
            </span>
            {tradeProfit !== undefined && tradeProfitPct !== undefined && (
                <span
                    className={`font-mono font-bold ${
                        tradeProfit >= 0 ? 'text-green-400' : 'text-red-400'
                    }`}
                >
                    {tradeProfit >= 0 ? '+' : '-'}${fmt2(Math.abs(tradeProfit))} ({tradeProfitPct >= 0 ? '+' : ''}
                    {tradeProfitPct.toFixed(2)}%)
                </span>
            )}
        </div>
        <div className="border-t border-slate-700/70 pt-1.5 space-y-1">
            <div className="flex justify-between">
                <span className="text-slate-400">New Book</span>
                <span className="text-white font-mono tabular-nums font-semibold">${fmt2(newBookCost)}</span>
            </div>
            <div className="flex justify-between">
                <span className="text-slate-400">New MV</span>
                <span className="text-white font-mono tabular-nums font-semibold">${fmt2(newMarketValue)}</span>
            </div>
            <div className="flex justify-between">
                <span className="text-slate-400">New P/L</span>
                <span
                    className={`font-mono tabular-nums font-bold ${
                        newProfit >= 0 ? 'text-green-400' : 'text-red-400'
                    }`}
                >
                    {newProfit >= 0 ? '+' : '-'}${fmt2(Math.abs(newProfit))} ({newProfitPercent.toFixed(2)}%)
                </span>
            </div>
            <div className="flex justify-between">
                <span className="text-slate-400">New Avg</span>
                <span className="text-blue-400 font-mono tabular-nums font-bold">${fmt2(newAvg)}</span>
            </div>
        </div>
    </div>
);

export interface AssetSimulatorsProps {
    asset: Asset;
    effectiveBookCost: number;
    impliedAvgCost: number;
    simTargetPrice: string;
    onSimTargetPriceChange: (val: string) => void;
    simSellPrice: string;
    onSimSellPriceChange: (val: string) => void;
    simSellShares: string;
    onSimSellSharesChange: (val: string) => void;
    simBuyAmount: string;
    onSimBuyAmountChange: (val: string) => void;
    simBuyShares: string;
    onSimBuySharesChange: (val: string) => void;
    stacked?: boolean;
}

const AssetSimulators: React.FC<AssetSimulatorsProps> = ({
    asset,
    effectiveBookCost,
    impliedAvgCost,
    simTargetPrice,
    onSimTargetPriceChange,
    simSellPrice,
    onSimSellPriceChange,
    simSellShares,
    onSimSellSharesChange,
    simBuyAmount,
    onSimBuyAmountChange,
    simBuyShares,
    onSimBuySharesChange,
    stacked = false,
}) => {
    const computeSellProjection = (sharesNum: number, sellPriceUsed: number) => {
        const profit = (sellPriceUsed - impliedAvgCost) * sharesNum;
        const profitPercent =
            impliedAvgCost > 0 ? ((sellPriceUsed - impliedAvgCost) / impliedAvgCost) * 100 : 0;
        const newQuantity = asset.quantity - sharesNum;
        const newBookCost = effectiveBookCost - sharesNum * impliedAvgCost;
        const newMarketValue = newQuantity * asset.currentPrice;
        const newAvg = newQuantity > 0 ? newBookCost / newQuantity : impliedAvgCost;
        const newProfit = newMarketValue - newBookCost;
        const newProfitPercent = Math.abs(newBookCost) > 0.01 ? (newProfit / newBookCost) * 100 : 0;
        return { profit, profitPercent, newBookCost, newMarketValue, newAvg, newProfit, newProfitPercent };
    };

    const computeBuyProjection = (sharesNum: number, costVal: number) => {
        const newQuantity = asset.quantity + sharesNum;
        const newBookCost = effectiveBookCost + costVal;
        const newAvg = newQuantity > 0 ? newBookCost / newQuantity : impliedAvgCost;
        const newMarketValue = newQuantity * asset.currentPrice;
        const newProfit = newMarketValue - newBookCost;
        const newProfitPercent = Math.abs(newBookCost) > 0.01 ? (newProfit / newBookCost) * 100 : 0;
        return { newBookCost, newMarketValue, newAvg, newProfit, newProfitPercent };
    };

    const targetPriceVal = simTargetPrice ? parseFloat(simTargetPrice) : NaN;
    const sellPriceUsed =
        !isNaN(targetPriceVal) && targetPriceVal > 0 ? targetPriceVal : asset.currentPrice || 1;

    return (
        <div className={`grid grid-cols-1 ${stacked ? '' : 'md:grid-cols-2'} gap-5`}>
            {/* Sell Simulator */}
            <div className="space-y-2.5">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                    <Calculator size={13} className="text-blue-400" />
                    <span>Sell Simulator</span>
                </h4>

                <div className="relative">
                    <span className="absolute left-3 top-2 text-slate-300 text-xs font-semibold">$</span>
                    <input
                        type="number"
                        className="bg-slate-900 border border-slate-700 rounded-xl pl-6 pr-3 py-1.5 text-xs text-white placeholder-slate-400 w-full font-mono focus:outline-none focus:border-blue-500 input-no-spinner"
                        placeholder={`Target Price (Cur: $${asset.currentPrice.toFixed(2)})`}
                        value={simTargetPrice}
                        onChange={e => onSimTargetPriceChange(e.target.value)}
                    />
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                        <div className="relative">
                            <span className="absolute left-3 top-2 text-slate-300 text-xs font-semibold">$</span>
                            <input
                                type="number"
                                className="bg-slate-900 border border-slate-700 rounded-xl pl-6 pr-2 py-1.5 text-xs text-white placeholder-slate-400 w-full font-mono focus:outline-none focus:border-blue-500 input-no-spinner"
                                placeholder="Sell Amount"
                                value={simSellPrice}
                                onChange={e => onSimSellPriceChange(e.target.value)}
                            />
                        </div>
                        {simSellPrice &&
                            (() => {
                                const amountVal = parseFloat(simSellPrice);
                                if (isNaN(amountVal) || amountVal <= 0) return null;
                                const sharesNum = amountVal / sellPriceUsed;
                                const proj = computeSellProjection(sharesNum, sellPriceUsed);
                                return (
                                    <SimProjected
                                        summaryLabel="Sells"
                                        summaryValue={`${sharesNum.toFixed(2)} sh`}
                                        tradeProfit={proj.profit}
                                        tradeProfitPct={proj.profitPercent}
                                        newBookCost={proj.newBookCost}
                                        newMarketValue={proj.newMarketValue}
                                        newProfit={proj.newProfit}
                                        newProfitPercent={proj.newProfitPercent}
                                        newAvg={proj.newAvg}
                                    />
                                );
                            })()}
                    </div>

                    <div className="space-y-2">
                        <div className="relative">
                            <input
                                type="number"
                                className="bg-slate-900 border border-slate-700 rounded-xl pl-3 pr-10 py-1.5 text-xs text-white placeholder-slate-400 w-full font-mono focus:outline-none focus:border-blue-500 input-no-spinner"
                                placeholder="Shares"
                                value={simSellShares}
                                onChange={e => onSimSellSharesChange(e.target.value)}
                            />
                            <button
                                type="button"
                                className="absolute right-1.5 top-1 text-[11px] font-bold bg-slate-800 border border-slate-700 text-slate-200 hover:text-white px-2 py-0.5 rounded-lg transition-colors"
                                onClick={() => onSimSellSharesChange(asset.quantity.toString())}
                            >
                                All
                            </button>
                        </div>
                        {simSellShares &&
                            (() => {
                                const sharesVal = parseFloat(simSellShares);
                                if (isNaN(sharesVal) || sharesVal <= 0) return null;
                                const proceeds = sharesVal * sellPriceUsed;
                                const proj = computeSellProjection(sharesVal, sellPriceUsed);
                                return (
                                    <SimProjected
                                        summaryLabel="Proc"
                                        summaryValue={`$${fmt2(proceeds)}`}
                                        tradeProfit={proj.profit}
                                        tradeProfitPct={proj.profitPercent}
                                        newBookCost={proj.newBookCost}
                                        newMarketValue={proj.newMarketValue}
                                        newProfit={proj.newProfit}
                                        newProfitPercent={proj.newProfitPercent}
                                        newAvg={proj.newAvg}
                                    />
                                );
                            })()}
                    </div>
                </div>
            </div>

            {/* Buy Simulator */}
            <div className="space-y-2.5">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                    <RefreshCw size={13} className="text-green-400" />
                    <span>Buy Simulator</span>
                </h4>
                <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                        <div className="relative">
                            <span className="absolute left-3 top-2 text-slate-300 text-xs font-semibold">$</span>
                            <input
                                type="number"
                                className="bg-slate-900 border border-slate-700 rounded-xl pl-6 pr-2 py-1.5 text-xs text-white placeholder-slate-400 w-full font-mono focus:outline-none focus:border-blue-500 input-no-spinner"
                                placeholder="Invest Amount"
                                value={simBuyAmount}
                                onChange={e => onSimBuyAmountChange(e.target.value)}
                            />
                        </div>
                        {simBuyAmount &&
                            (() => {
                                const investVal = parseFloat(simBuyAmount);
                                if (isNaN(investVal) || investVal <= 0) return null;
                                const sharesNum = investVal / (asset.currentPrice || 1);
                                const proj = computeBuyProjection(sharesNum, investVal);
                                return (
                                    <SimProjected
                                        summaryLabel="Buys"
                                        summaryValue={`${sharesNum.toFixed(2)} sh`}
                                        newBookCost={proj.newBookCost}
                                        newMarketValue={proj.newMarketValue}
                                        newProfit={proj.newProfit}
                                        newProfitPercent={proj.newProfitPercent}
                                        newAvg={proj.newAvg}
                                    />
                                );
                            })()}
                    </div>

                    <div className="space-y-2">
                        <input
                            type="number"
                            className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-400 w-full font-mono focus:outline-none focus:border-blue-500 input-no-spinner"
                            placeholder="Shares"
                            value={simBuyShares}
                            onChange={e => onSimBuySharesChange(e.target.value)}
                        />
                        {simBuyShares &&
                            (() => {
                                const sharesVal = parseFloat(simBuyShares);
                                if (isNaN(sharesVal) || sharesVal <= 0) return null;
                                const costVal = sharesVal * asset.currentPrice;
                                const proj = computeBuyProjection(sharesVal, costVal);
                                return (
                                    <SimProjected
                                        summaryLabel="Cost"
                                        summaryValue={`$${fmt2(costVal)}`}
                                        newBookCost={proj.newBookCost}
                                        newMarketValue={proj.newMarketValue}
                                        newProfit={proj.newProfit}
                                        newProfitPercent={proj.newProfitPercent}
                                        newAvg={proj.newAvg}
                                    />
                                );
                            })()}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AssetSimulators;
