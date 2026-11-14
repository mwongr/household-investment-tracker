import type { Account, Asset, NetWorthSnapshot, Transaction } from '../types';

export interface PortfolioHistoryPoint {
    name: string;
    value: number;
}

export interface HistoricalQuote {
    date: string;
    close: number;
}

const getLocalToday = (): string => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
};

const getSameDayOrder = (tx: Transaction): number => {
    if (tx.type === 'Buy' || tx.type === 'DRIP' || tx.type === 'Dividend Reinvested') return 0;
    if (tx.type === 'Sell') return 1;
    if (tx.type === 'Stock Split') return (tx.shares || 0) < 0 ? 2 : 3;
    return 4;
};

const getTxCashDelta = (tx: Transaction, currency: 'CAD' | 'USD', fxRate: number): number => {
    if (tx.ignoreCashImpact) return 0;
    const rawAmount = tx.amount || 0;
    const amount = currency === 'USD' ? rawAmount * fxRate : rawAmount;
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

const getQuoteOnOrBefore = (quotes: HistoricalQuote[] | undefined, date: string): number | null => {
    if (!quotes || quotes.length === 0) return null;
    if (date < quotes[0].date) return null;

    let lo = 0;
    let hi = quotes.length - 1;
    while (lo < hi) {
        const mid = (lo + hi + 1) >> 1;
        if (quotes[mid].date <= date) {
            lo = mid;
        } else {
            hi = mid - 1;
        }
    }
    return quotes[lo].close > 0 ? quotes[lo].close : null;
};

const daysBetween = (a: string, b: string): number => {
    const t1 = Date.parse(`${a}T00:00:00Z`);
    const t2 = Date.parse(`${b}T00:00:00Z`);
    return Number.isFinite(t1) && Number.isFinite(t2) ? Math.max(0, (t2 - t1) / 86400000) : 0;
};

/**
 * Builds a chronological portfolio value series.
 * Reconstructs historical positions from imported transactions, values them using
 * split-unadjusted historical market prices when available (with smooth fallback
 * interpolation to live prices), merges any recorded daily snapshots, and ends
 * with today's live totalValue.
 */
export function buildPortfolioHistory({
    transactions,
    assets,
    accounts,
    netWorthHistory,
    totalValue,
    isDemoData,
    historicalPrices,
}: {
    transactions: Transaction[];
    assets: Asset[];
    accounts: Account[];
    netWorthHistory: NetWorthSnapshot[];
    totalValue: number;
    isDemoData: boolean;
    historicalPrices?: Record<string, HistoricalQuote[]>;
}): PortfolioHistoryPoint[] {
    const today = getLocalToday();

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

    const getTxCurrency = (tx: Transaction): 'CAD' | 'USD' => {
        if (tx.currency === 'USD' || tx.currency === 'CAD') return tx.currency;
        if (tx.ticker) {
            const live = liveAssetMap.get(`${tx.accountId}-${tx.ticker}`);
            if (live?.currency === 'USD' || live?.currency === 'CAD') return live.currency;
        }
        return 'CAD';
    };

    // Align historical cash with actual current cashBalance (accounts may have an opening balance prior to CSV start)
    const totalCash = accounts.reduce((sum, a) => sum + a.cashBalance, 0);
    let simulatedEndCash = 0;
    for (const tx of filteredTxs) {
        simulatedEndCash += getTxCashDelta(tx, getTxCurrency(tx), fxRate);
    }
    const openingCashOffset = totalCash - simulatedEndCash;

    // Precompute the last transaction date per position key for fallback price interpolation
    const lastTxDateByKey = new Map<string, string>();
    for (const tx of filteredTxs) {
        if (tx.ticker) {
            lastTxDateByKey.set(`${tx.accountId}-${tx.ticker}`, tx.date);
        }
    }

    // Build evaluation dates: all transaction dates + any weekly historical quote dates in range
    const firstTxDate = filteredTxs[0].date;
    const dateSet = new Set<string>();
    for (const tx of filteredTxs) {
        if (tx.date && tx.date < today) dateSet.add(tx.date);
    }
    if (historicalPrices) {
        for (const quotes of Object.values(historicalPrices)) {
            for (const q of quotes) {
                if (q.date >= firstTxDate && q.date < today) {
                    dateSet.add(q.date);
                }
            }
        }
    }
    const evalDates = Array.from(dateSet).sort((a, b) => a.localeCompare(b));

    const positions = new Map<
        string,
        { ticker: string; qty: number; price: number; currency: 'CAD' | 'USD'; pendingSplitValue: number; lastTxDate: string }
    >();
    let runningCash = openingCashOffset;
    const historyByDate = new Map<string, number>();

    let txIdx = 0;
    for (const currentDate of evalDates) {
        while (txIdx < filteredTxs.length && filteredTxs[txIdx].date <= currentDate) {
            const tx = filteredTxs[txIdx];
            const txCurrency = getTxCurrency(tx);
            runningCash += getTxCashDelta(tx, txCurrency, fxRate);

            if (tx.ticker) {
                const key = `${tx.accountId}-${tx.ticker}`;
                const liveAsset = liveAssetMap.get(key);
                const pos = positions.get(key) || {
                    ticker: tx.ticker,
                    qty: 0,
                    price: 0,
                    currency: txCurrency,
                    pendingSplitValue: 0,
                    lastTxDate: tx.date,
                };
                pos.lastTxDate = tx.date;

                if (tx.type === 'Buy' || tx.type === 'DRIP' || tx.type === 'Dividend Reinvested') {
                    const shares = tx.shares || 0;
                    const txPrice =
                        tx.pricePerShare && tx.pricePerShare > 0
                            ? tx.pricePerShare
                            : shares > 0 && tx.amount > 0
                                ? tx.amount / shares
                                : 0;

                    if (txPrice > 0 && shares > 0) {
                        const prevTotal = pos.qty * pos.price;
                        const newTotal = prevTotal + shares * txPrice;
                        pos.qty += shares;
                        pos.price = pos.qty > 0 ? newTotal / pos.qty : txPrice;
                    } else {
                        pos.qty += shares;
                    }
                    pos.pendingSplitValue = 0;
                } else if (tx.type === 'Sell') {
                    const shares = tx.shares || 0;
                    const newQty = Math.max(0, pos.qty - shares);
                    pos.qty = newQty <= 0.000001 ? 0 : newQty;
                    pos.pendingSplitValue = 0;
                } else if (tx.type === 'Stock Split') {
                    const livePrice = liveAsset?.currentPrice || 0;
                    const prevValue = pos.qty * (pos.price || livePrice);
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

            txIdx++;
        }

        let assetsValue = 0;
        for (const [key, pos] of positions.entries()) {
            if (pos.qty <= 0) continue;
            const liveAsset = liveAssetMap.get(key);
            const marketQuote = getQuoteOnOrBefore(historicalPrices?.[pos.ticker], currentDate);

            let effectivePrice = marketQuote ?? (pos.price > 0 ? pos.price : (liveAsset?.currentPrice || 0));

            // If no market quote is available for this date and we're past the position's final tx,
            // smoothly interpolate toward the live price to avoid a sudden cliff on today's point.
            if (marketQuote === null && liveAsset && liveAsset.currentPrice > 0 && pos.price > 0) {
                const finalTxDate = lastTxDateByKey.get(key) || pos.lastTxDate;
                if (currentDate > finalTxDate && finalTxDate < today) {
                    const totalSpan = daysBetween(finalTxDate, today);
                    const elapsed = daysBetween(finalTxDate, currentDate);
                    if (totalSpan > 0) {
                        const t = Math.min(1, elapsed / totalSpan);
                        effectivePrice = pos.price + (liveAsset.currentPrice - pos.price) * t;
                    }
                }
            }

            const val = pos.qty * effectivePrice;
            assetsValue += pos.currency === 'USD' ? val * fxRate : val;
        }
        historyByDate.set(currentDate, Math.max(0, assetsValue + runningCash));
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
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([name, value]) => ({ name, value }));
}
