import type { Asset, Transaction } from '../types';
import type { QuoteResponse, StockAnalysisResponse } from '../types/api';

export function calculateCashImpact(tx: Partial<Transaction>): number {
    if (tx.ignoreCashImpact) return 0;
    const amount = tx.amount || 0;
    switch (tx.type) {
        case 'Buy':
            return -amount;
        case 'Sell':
        case 'Deposit':
        case 'Dividend':
        case 'Dividend Income':
        case 'Interest':
            return amount;
        case 'Withdrawal':
        case 'Fee':
            return -amount;
        case 'DRIP':
        case 'Dividend Reinvested':
        case 'Stock Split':
        default:
            return 0;
    }
}

function getSameDayOrder(tx: Transaction): number {
    if (tx.type === 'Buy' || tx.type === 'DRIP' || tx.type === 'Dividend Reinvested') return 0;
    if (tx.type === 'Sell') return 1;
    if (tx.type === 'Stock Split') return (tx.shares || 0) < 0 ? 2 : 3;
    return 4;
}

export function recalculateAssets(
    currentTransactions: Transaction[],
    previousAssets: Asset[],
    exchangeRate: number,
    ignoreCustomBookCostAdjustment = false
): Asset[] {
    const newAssetsMap = new Map<string, Asset>();

    const sorted = [...currentTransactions].sort((a, b) => {
        const timeDiff = new Date(a.date).getTime() - new Date(b.date).getTime();
        if (timeDiff !== 0) return timeDiff;
        return getSameDayOrder(a) - getSameDayOrder(b);
    });

    for (const tx of sorted) {
        if (!tx.ticker) continue;
        const key = `${tx.accountId}-${tx.ticker}`;
        if (!newAssetsMap.has(key)) {
            const existingAsset = previousAssets.find(
                (a) => a.accountId === tx.accountId && a.ticker === tx.ticker
            );

            newAssetsMap.set(key, {
                id: existingAsset?.id || crypto.randomUUID(),
                accountId: tx.accountId,
                ticker: tx.ticker,
                quantity: 0,
                averageCost: 0,
                totalCost: 0,
                customBookCost: existingAsset?.customBookCost,
                currentPrice: existingAsset?.currentPrice || tx.pricePerShare || 0,
                marketValue: 0,
                profit: 0,
                profitPercent: 0,
                todayChangePercent: existingAsset?.todayChangePercent || 0,
                todayChangeDollar: existingAsset?.todayChangeDollar || 0,
                high52Week: existingAsset?.high52Week,
                low52Week: existingAsset?.low52Week,
                sparkline: existingAsset?.sparkline,
                signal: existingAsset?.signal,
                rsi: existingAsset?.rsi,
                goldenCross: existingAsset?.goldenCross,
                currency: existingAsset?.currency || 'CAD',
                cadMarketValue: 0,
                cadTotalCost: 0,
                previousTicker: existingAsset?.previousTicker,
            });
        }

        const asset = newAssetsMap.get(key)!;

        if (tx.type === 'Buy' || tx.type === 'DRIP' || tx.type === 'Dividend Reinvested') {
            const totalCostOld = asset.averageCost * asset.quantity;
            const totalCostNew = totalCostOld + tx.amount;
            const newQty = asset.quantity + (tx.shares || 0);

            asset.quantity = newQty;
            asset.totalCost = totalCostNew;
            asset.averageCost = newQty > 0 ? totalCostNew / newQty : 0;

            if (tx.previousTicker) {
                asset.previousTicker = tx.previousTicker;
            }
        } else if (tx.type === 'Sell') {
            const newQty = Math.max(0, asset.quantity - (tx.shares || 0));
            const costOfSharesSold = (tx.shares || 0) * asset.averageCost;

            asset.quantity = newQty <= 0.000001 ? 0 : newQty;
            asset.totalCost = asset.quantity === 0 ? 0 : Math.max(0, asset.totalCost - costOfSharesSold);
        } else if (tx.type === 'Stock Split') {
            if (tx.splitFrom && tx.splitTo) {
                const newQty = (asset.quantity * tx.splitTo) / tx.splitFrom;
                asset.quantity = Math.max(0, newQty);
            } else {
                const newQty = asset.quantity + (tx.shares || 0);
                asset.quantity = newQty <= 0.000001 ? 0 : newQty;
            }
            asset.averageCost = asset.quantity > 0 ? asset.totalCost / asset.quantity : 0;
        }

        asset.marketValue = asset.quantity * asset.currentPrice;
        const effectiveBookCost =
            asset.customBookCost !== undefined && asset.customBookCost !== null
                ? asset.customBookCost
                : asset.totalCost;
        asset.cadTotalCost = asset.currency === 'USD' ? effectiveBookCost * exchangeRate : effectiveBookCost;
        asset.cadMarketValue = asset.currency === 'USD' ? asset.marketValue * exchangeRate : asset.marketValue;

        asset.profit = asset.cadMarketValue - asset.cadTotalCost;
        asset.profitPercent = asset.cadTotalCost > 0 ? (asset.profit / asset.cadTotalCost) * 100 : 0;

        const cp = asset.todayChangePercent || 0;
        const div = 1 + cp / 100;
        const pp = div !== 0 ? asset.currentPrice / div : asset.currentPrice;
        asset.todayChangeDollar = div !== 0 ? (asset.currentPrice - pp) * asset.quantity : 0;

        if (Number.isNaN(asset.todayChangeDollar) || !Number.isFinite(asset.todayChangeDollar)) {
            asset.todayChangeDollar = 0;
        }
    }

    return Array.from(newAssetsMap.values())
        .map((asset) => {
            if (asset.quantity <= 0.000001) return asset;

            const existingAsset = previousAssets.find((a) => a.id === asset.id);
            if (existingAsset?.customBookCost === undefined || existingAsset.customBookCost === null) {
                return asset;
            }

            if (ignoreCustomBookCostAdjustment) {
                const cadCost =
                    asset.currency === 'USD'
                        ? existingAsset.customBookCost * exchangeRate
                        : existingAsset.customBookCost;
                const impliedAvg =
                    asset.quantity > 0 ? existingAsset.customBookCost / asset.quantity : asset.averageCost;
                return {
                    ...asset,
                    customBookCost: existingAsset.customBookCost,
                    averageCost: impliedAvg,
                    cadTotalCost: cadCost,
                    profit: asset.cadMarketValue - cadCost,
                    profitPercent: cadCost > 0 ? ((asset.cadMarketValue - cadCost) / cadCost) * 100 : 0,
                };
            }

            const existingQty = existingAsset.quantity;
            const qtyChange = asset.quantity - existingQty;
            let newCustomBookCost = existingAsset.customBookCost;

            if (qtyChange < -0.000001 && existingQty > 0) {
                const userImpliedAvgCost = existingAsset.customBookCost / existingQty;
                const costReduction = Math.abs(qtyChange) * userImpliedAvgCost;
                newCustomBookCost = Number(newCustomBookCost) - Number(costReduction);
            } else if (qtyChange > 0.000001 || Math.abs(asset.totalCost - existingAsset.totalCost) > 0.01) {
                const transactionalCostDelta = asset.totalCost - existingAsset.totalCost;
                newCustomBookCost = Number(newCustomBookCost) + Number(transactionalCostDelta);
            }

            const effectiveBookCost = newCustomBookCost;
            const cadEffectiveBookCost =
                asset.currency === 'USD' ? effectiveBookCost * exchangeRate : effectiveBookCost;
            const impliedAvg = asset.quantity > 0 ? effectiveBookCost / asset.quantity : asset.averageCost;

            return {
                ...asset,
                customBookCost: newCustomBookCost,
                averageCost: impliedAvg,
                cadTotalCost: cadEffectiveBookCost,
                profit: asset.cadMarketValue - cadEffectiveBookCost,
                profitPercent:
                    cadEffectiveBookCost > 0
                        ? ((asset.cadMarketValue - cadEffectiveBookCost) / cadEffectiveBookCost) * 100
                        : 0,
            };
        })
        .filter((a) => a.quantity > 0.000001);
}

export function applyMarketData(
    asset: Asset,
    quote: QuoteResponse,
    analysis: Partial<StockAnalysisResponse> | undefined,
    exchangeRate: number,
    range: string
): Asset {
    const currentPrice = quote.regularMarketPrice || asset.currentPrice;
    const marketValue = asset.quantity * currentPrice;
    const effectiveBookCost =
        asset.customBookCost !== undefined && asset.customBookCost !== null
            ? asset.customBookCost
            : asset.totalCost;

    const todayChangePercent = quote.regularMarketChangePercent || 0;
    const divisor = 1 + todayChangePercent / 100;
    const prevPrice = divisor !== 0 ? currentPrice / divisor : currentPrice;
    const todayChangeDollar = divisor !== 0 ? (currentPrice - prevPrice) * asset.quantity : 0;

    const currency: 'CAD' | 'USD' =
        quote.currency === 'USD' ? 'USD' : quote.currency === 'CAD' ? 'CAD' : asset.currency || 'CAD';
    const cadMarketValue = currency === 'USD' ? marketValue * exchangeRate : marketValue;
    const cadEffectiveBookCost = currency === 'USD' ? effectiveBookCost * exchangeRate : effectiveBookCost;

    return {
        ...asset,
        currency,
        currentPrice,
        marketValue,
        cadMarketValue,
        cadTotalCost: cadEffectiveBookCost,
        profit: cadMarketValue - cadEffectiveBookCost,
        profitPercent:
            cadEffectiveBookCost > 0
                ? ((cadMarketValue - cadEffectiveBookCost) / cadEffectiveBookCost) * 100
                : 0,
        high52Week: quote.fiftyTwoWeekHigh,
        low52Week: quote.fiftyTwoWeekLow,
        todayChangePercent,
        todayChangeDollar,
        sparkline: quote.sparkline,
        chartRange: range,
        signal: analysis?.signal,
        rsi: analysis?.indicators?.rsi,
        goldenCross: analysis?.indicators?.goldenCross,
    };
}
