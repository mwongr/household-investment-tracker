import type { Account, Asset, NetWorthSnapshot, Transaction } from '../types';

export interface PortfolioHistoryPoint {
    name: string;
    value: number;
}

const getSameDayOrder = (tx: Transaction): number => {
    if (tx.type === 'Buy' || tx.type === 'DRIP' || tx.type === 'Dividend Reinvested') return 0;
    if (tx.type === 'Sell') return 1;
    if (tx.type === 'Stock Split') return (tx.shares || 0) < 0 ? 2 : 3;
    return 4;
};

const getTxCashDelta = (tx: Transaction): number => {
    if (tx.ignoreCashImpact) return 0;
    const amount = tx.amount || 0;
    switch (tx.type) {
        case 'Buy':
        case 'Withdrawal':
        case 'Fee':
            return -amount;
        case 'Sell':
        case 'Deposit':
        case 'Dividend':
        case 'Dividend Income':
        case 'Interest':
            return amount;
        default:
            return 0;
    }
};

/**
 * Builds a chronological portfolio value series.
 * Reconstructs historical dates from imported transactions (cost/trade prices + cash flow),
 * then merges any recorded daily snapshots and ends with today's live totalValue.
 */
export function buildPortfolioHistory({
    transactions,
    assets,
    accounts,
    netWorthHistory,
    totalValue,
    isDemoData,
}: {
    transactions: Transaction[];
    assets: Asset[];
    accounts: Account[];
    netWorthHistory: NetWorthSnapshot[];
    totalValue: number;
    isDemoData: boolean;
}): PortfolioHistoryPoint[] {
    const today = new Date().toISOString().split('T')[0];

    // Demo mode or no transactions: use stored netWorthHistory directly
    if (isDemoData || transactions.length === 0) {
        const sortedHistory = [...netWorthHistory]
            .sort((a, b) => a.date.localeCompare(b.date))
            .map(entry => ({ name: entry.date, value: entry.value }));

        if (sortedHistory.length === 0 && totalValue > 0) {
            sortedHistory.push({ name: today, value: totalValue });
        }
        return sortedHistory;
    }

    const validAccountIds = new Set(accounts.map(a => a.id));
    const filteredTxs = transactions
        .filter(tx => validAccountIds.size === 0 || validAccountIds.has(tx.accountId))
        .sort((a, b) => {
            const dateCmp = a.date.localeCompare(b.date);
            if (dateCmp !== 0) return dateCmp;
            return getSameDayOrder(a) - getSameDayOrder(b);
        });

    if (filteredTxs.length === 0) {
        return totalValue > 0 ? [{ name: today, value: totalValue }] : [];
    }

    // Infer USD->CAD FX rate from live assets if available
    let fxRate = 1.38;
    const usdAsset = assets.find(a => a.currency === 'USD' && a.marketValue > 0 && (a.cadMarketValue || 0) > 0);
    if (usdAsset && usdAsset.cadMarketValue) {
        fxRate = usdAsset.cadMarketValue / usdAsset.marketValue;
    }

    const liveAssetMap = new Map<string, Asset>();
    for (const a of assets) {
        liveAssetMap.set(`${a.accountId}-${a.ticker}`, a);
    }

    // Align historical cash with actual current cashBalance (accounts may have an opening balance prior to CSV start)
    const totalCash = accounts.reduce((sum, a) => sum + a.cashBalance, 0);
    let simulatedEndCash = 0;
    for (const tx of filteredTxs) {
        simulatedEndCash += getTxCashDelta(tx);
    }
    const openingCashOffset = totalCash - simulatedEndCash;

    const positions = new Map<
        string,
        { qty: number; price: number; currency: 'CAD' | 'USD'; pendingSplitValue: number }
    >();
    let runningCash = openingCashOffset;
    const historyByDate = new Map<string, number>();

    let i = 0;
    while (i < filteredTxs.length) {
        const currentDate = filteredTxs[i].date;

        while (i < filteredTxs.length && filteredTxs[i].date === currentDate) {
            const tx = filteredTxs[i];
            runningCash += getTxCashDelta(tx);

            if (tx.ticker) {
                const key = `${tx.accountId}-${tx.ticker}`;
                const liveAsset = liveAssetMap.get(key);
                const pos = positions.get(key) || {
                    qty: 0,
                    price: 0,
                    currency: (tx.currency || liveAsset?.currency || 'CAD') as 'CAD' | 'USD',
                    pendingSplitValue: 0,
                };

                if (tx.type === 'Buy' || tx.type === 'DRIP' || tx.type === 'Dividend Reinvested') {
                    const shares = tx.shares || 0;
                    pos.qty += shares;
                    if (tx.pricePerShare && tx.pricePerShare > 0) {
                        pos.price = tx.pricePerShare;
                    } else if (shares > 0 && tx.amount > 0) {
                        pos.price = tx.amount / shares;
                    }
                    pos.pendingSplitValue = 0;
                } else if (tx.type === 'Sell') {
                    const shares = tx.shares || 0;
                    const newQty = Math.max(0, pos.qty - shares);
                    pos.qty = newQty <= 0.000001 ? 0 : newQty;
                    if (tx.pricePerShare && tx.pricePerShare > 0) {
                        pos.price = tx.pricePerShare;
                    }
                    pos.pendingSplitValue = 0;
                } else if (tx.type === 'Stock Split') {
                    const prevValue = pos.qty * (pos.price || liveAsset?.currentPrice || 0);
                    if (tx.splitFrom && tx.splitTo) {
                        const newQty = (pos.qty * tx.splitTo) / tx.splitFrom;
                        pos.qty = Math.max(0, newQty);
                        if (pos.qty > 0 && prevValue > 0) {
                            pos.price = prevValue / pos.qty;
                        }
                    } else {
                        const newQty = pos.qty + (tx.shares || 0);
                        if (newQty <= 0.000001) {
                            if (prevValue > 0) {
                                pos.pendingSplitValue = prevValue;
                            }
                            pos.qty = 0;
                        } else {
                            const preservedValue = prevValue > 0 ? prevValue : pos.pendingSplitValue;
                            pos.qty = newQty;
                            if (preservedValue > 0) {
                                pos.price = preservedValue / newQty;
                            }
                            pos.pendingSplitValue = 0;
                        }
                    }
                }

                positions.set(key, pos);
            }

            i++;
        }

        if (currentDate && currentDate < today) {
            let assetsValue = 0;
            for (const [key, pos] of positions.entries()) {
                if (pos.qty <= 0) continue;
                const liveAsset = liveAssetMap.get(key);
                const effectivePrice = pos.price > 0 ? pos.price : (liveAsset?.currentPrice || 0);
                const val = pos.qty * effectivePrice;
                assetsValue += pos.currency === 'USD' ? val * fxRate : val;
            }
            historyByDate.set(currentDate, Math.max(0, assetsValue + runningCash));
        }
    }

    // Merge recorded snapshots (keep recorded snapshots if user has accumulated multi-day live history)
    for (const entry of netWorthHistory) {
        if (entry.date && entry.value > 0) {
            historyByDate.set(entry.date, entry.value);
        }
    }

    // Always ensure today's point reflects the live totalValue
    if (totalValue > 0) {
        historyByDate.set(today, totalValue);
    }

    return Array.from(historyByDate.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([name, value]) => ({ name, value }));
}
