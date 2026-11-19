import type { Account, Asset, Transaction } from '../types';
import type {
    AccountIncomeGroup,
    AnnualPayoutPoint,
    DividendKpis,
    DividendMetadata,
    HoldingIncomeRow,
    MonthlyPayoutPoint,
    TaxTreatment,
    UpcomingPayout,
} from '../types/dividends';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

const CANADIAN_SUFFIXES = ['.TO', '.V', '.CN', '.NE'];

export function isCashDividend(tx: Transaction): boolean {
    return tx.type === 'Dividend' || tx.type === 'Dividend Income';
}

export function isReinvestedDividend(tx: Transaction): boolean {
    return tx.type === 'DRIP' || tx.type === 'Dividend Reinvested';
}

export function isAnyDividend(tx: Transaction): boolean {
    return isCashDividend(tx) || isReinvestedDividend(tx);
}

export function isCryptoSymbol(ticker: string): boolean {
    const upper = ticker.toUpperCase();
    return upper.endsWith('-USD') || upper.endsWith('-CAD');
}

export function isUsListedSecurity(ticker: string, currency?: string | null): boolean {
    const upper = ticker.trim().toUpperCase();
    if (!upper || isCryptoSymbol(upper)) return false;
    if (currency === 'USD') return true;
    if (CANADIAN_SUFFIXES.some((s) => upper.endsWith(s))) return false;
    return !upper.includes('.');
}

export function toCad(amount: number, currency: string | null | undefined, fxRate: number): number {
    const rate = fxRate > 0 ? fxRate : 1;
    return currency === 'USD' ? amount * rate : amount;
}

export function getTaxBucket(accountType: string): 'Tax-Free' | 'Retirement' | 'Non-Registered' {
    const norm = accountType.trim().toUpperCase();
    if (norm === 'TFSA' || norm === 'FHSA' || norm === 'RESP') {
        return 'Tax-Free';
    }
    if (
        norm === 'RRSP' ||
        norm === 'SPOUSAL RRSP' ||
        norm === 'LIRA' ||
        norm === 'RRIF' ||
        norm === 'LIF'
    ) {
        return 'Retirement';
    }
    return 'Non-Registered';
}

export function classifyTaxTreatment(accountType: string, isUsListed: boolean): TaxTreatment {
    if (!isUsListed) return 'none';
    const bucket = getTaxBucket(accountType);
    if (bucket === 'Tax-Free') return 'withholding-lost';
    if (bucket === 'Retirement') return 'treaty-exempt';
    return 'recoverable';
}

function resolveTxCurrency(
    tx: Transaction,
    assetCurrencyMap: Map<string, 'CAD' | 'USD'>
): 'CAD' | 'USD' {
    if (tx.currency === 'USD' || tx.currency === 'CAD') return tx.currency;
    const upper = (tx.ticker ?? '').trim().toUpperCase();
    const key = `${tx.accountId}:${upper}`;
    const fromAsset = assetCurrencyMap.get(key);
    if (fromAsset) return fromAsset;
    if (upper && !CANADIAN_SUFFIXES.some((s) => upper.endsWith(s)) && !upper.includes('.')) {
        return 'USD';
    }
    return 'CAD';
}

function buildAssetCurrencyMap(assets: Asset[]): Map<string, 'CAD' | 'USD'> {
    const map = new Map<string, 'CAD' | 'USD'>();
    for (const a of assets) {
        if (a.currency === 'USD' || a.currency === 'CAD') {
            map.set(`${a.accountId}:${a.ticker.trim().toUpperCase()}`, a.currency);
        }
    }
    return map;
}

export function computeYtd(
    transactions: Transaction[],
    assets: Asset[],
    today: Date,
    fxRate: number
): { ytdTotalCad: number; ytdCashCad: number; ytdReinvestedCad: number } {
    const currentYear = today.getFullYear();
    const assetCurrencyMap = buildAssetCurrencyMap(assets);
    let ytdCashCad = 0;
    let ytdReinvestedCad = 0;

    for (const tx of transactions) {
        if (!isAnyDividend(tx) || tx.amount <= 0) continue;
        const d = new Date(tx.date);
        if (Number.isNaN(d.getTime()) || d.getFullYear() !== currentYear) continue;
        if (d.getTime() > today.getTime()) continue;

        const currency = resolveTxCurrency(tx, assetCurrencyMap);
        const cad = toCad(tx.amount, currency, fxRate);
        if (isCashDividend(tx)) {
            ytdCashCad += cad;
        } else {
            ytdReinvestedCad += cad;
        }
    }

    return {
        ytdTotalCad: ytdCashCad + ytdReinvestedCad,
        ytdCashCad,
        ytdReinvestedCad,
    };
}

export function computeMonthlyPayouts(
    transactions: Transaction[],
    assets: Asset[],
    year: number,
    fxRate: number
): MonthlyPayoutPoint[] {
    const assetCurrencyMap = buildAssetCurrencyMap(assets);
    const points: MonthlyPayoutPoint[] = MONTH_NAMES.map((month, idx) => ({
        monthIndex: idx,
        month,
        current: 0,
        previous: 0,
        currentCash: 0,
        currentReinvested: 0,
        previousCash: 0,
        previousReinvested: 0,
    }));

    for (const tx of transactions) {
        if (!isAnyDividend(tx) || tx.amount <= 0) continue;
        const d = new Date(tx.date);
        if (Number.isNaN(d.getTime())) continue;
        const txYear = d.getFullYear();
        if (txYear !== year && txYear !== year - 1) continue;

        const monthIdx = d.getMonth();
        const pt = points[monthIdx];
        if (!pt) continue;

        const cad = toCad(tx.amount, resolveTxCurrency(tx, assetCurrencyMap), fxRate);
        const isCash = isCashDividend(tx);

        if (txYear === year) {
            pt.current += cad;
            if (isCash) pt.currentCash += cad;
            else pt.currentReinvested += cad;
        } else {
            pt.previous += cad;
            if (isCash) pt.previousCash += cad;
            else pt.previousReinvested += cad;
        }
    }

    return points;
}

export function computeAnnualPayouts(
    transactions: Transaction[],
    assets: Asset[],
    fxRate: number
): AnnualPayoutPoint[] {
    const assetCurrencyMap = buildAssetCurrencyMap(assets);
    const byYear = new Map<string, AnnualPayoutPoint>();

    for (const tx of transactions) {
        if (!isAnyDividend(tx) || tx.amount <= 0) continue;
        const d = new Date(tx.date);
        if (Number.isNaN(d.getTime())) continue;

        const year = String(d.getFullYear());
        const entry = byYear.get(year) ?? { year, total: 0, cash: 0, reinvested: 0 };
        const cad = toCad(tx.amount, resolveTxCurrency(tx, assetCurrencyMap), fxRate);

        entry.total += cad;
        if (isCashDividend(tx)) {
            entry.cash += cad;
        } else {
            entry.reinvested += cad;
        }
        byYear.set(year, entry);
    }

    return Array.from(byYear.values()).sort((a, b) => a.year.localeCompare(b.year));
}

export function computeHoldingIncome(
    assets: Asset[],
    accounts: Account[],
    metadataMap: Map<string, DividendMetadata>,
    fxRate: number
): HoldingIncomeRow[] {
    const accountMap = new Map<string, Account>(accounts.map((a) => [a.id, a]));
    const rows: HoldingIncomeRow[] = [];

    for (const asset of assets) {
        if (asset.quantity <= 0) continue;
        const ticker = asset.ticker.trim().toUpperCase();
        if (!ticker || isCryptoSymbol(ticker)) continue;

        const meta = metadataMap.get(ticker);
        const account = accountMap.get(asset.accountId);
        const accountName = account?.name ?? 'Unknown Account';
        const accountType = account?.type ?? 'Other';

        const currency: 'CAD' | 'USD' =
            asset.currency === 'USD' || meta?.currency === 'USD' ? 'USD' : 'CAD';
        const isUsListed = isUsListedSecurity(ticker, currency);
        const taxTreatment = classifyTaxTreatment(accountType, isUsListed);

        const annualRatePerShare =
            meta?.forwardAnnualRate ?? meta?.trailingAnnualRate ?? 0;

        const cadMarketValue =
            asset.cadMarketValue > 0
                ? asset.cadMarketValue
                : toCad(asset.marketValue || asset.quantity * asset.currentPrice, currency, fxRate);

        const rawCost =
            asset.customBookCost !== undefined && asset.customBookCost > 0
                ? asset.customBookCost
                : asset.cadTotalCost !== undefined && asset.cadTotalCost > 0
                    ? asset.cadTotalCost
                    : toCad(asset.totalCost, currency, fxRate);
        const cadCostBasis = Math.max(0, rawCost);

        const projectedAnnualCad =
            annualRatePerShare > 0
                ? toCad(annualRatePerShare * asset.quantity, meta?.currency ?? currency, fxRate)
                : 0;

        const currentYieldPct =
            cadMarketValue > 0 && projectedAnnualCad > 0
                ? (projectedAnnualCad / cadMarketValue) * 100
                : meta?.forwardYield != null
                    ? meta.forwardYield * 100
                    : meta?.trailingYield != null
                        ? meta.trailingYield * 100
                        : 0;

        const yieldOnCostPct =
            cadCostBasis > 0 && projectedAnnualCad > 0
                ? (projectedAnnualCad / cadCostBasis) * 100
                : 0;

        rows.push({
            assetId: asset.id,
            ticker,
            name: asset.name ?? ticker,
            accountId: asset.accountId,
            accountName,
            accountType,
            currency,
            isUsListed,
            taxTreatment,
            shares: asset.quantity,
            cadMarketValue,
            cadCostBasis,
            annualRatePerShare,
            projectedAnnualCad,
            shareOfTotalPct: 0,
            currentYieldPct,
            yieldOnCostPct,
            frequency: meta?.frequency ?? null,
            isEstimated: meta?.isEstimated ?? false,
            source: meta?.source ?? 'none',
        });
    }

    const totalProjected = rows.reduce((sum, r) => sum + r.projectedAnnualCad, 0);
    if (totalProjected > 0) {
        for (const r of rows) {
            r.shareOfTotalPct = (r.projectedAnnualCad / totalProjected) * 100;
        }
    }

    return rows.sort((a, b) => b.projectedAnnualCad - a.projectedAnnualCad);
}

/**
 * Aggregates holding income rows by ticker across all accounts,
 * summing projected annual income and % share while computing weighted Yield and Yield on Cost.
 */
export function aggregateHoldingsByTicker(rows: HoldingIncomeRow[]): HoldingIncomeRow[] {
    const grouped = new Map<
        string,
        {
            rows: HoldingIncomeRow[];
            accountNames: Set<string>;
            accountTypes: Set<string>;
            shares: number;
            cadMarketValue: number;
            cadCostBasis: number;
            projectedAnnualCad: number;
            shareOfTotalPct: number;
            isEstimated: boolean;
        }
    >();

    for (const row of rows) {
        const existing = grouped.get(row.ticker);
        if (!existing) {
            grouped.set(row.ticker, {
                rows: [row],
                accountNames: new Set([row.accountName]),
                accountTypes: new Set([row.accountType]),
                shares: row.shares,
                cadMarketValue: row.cadMarketValue,
                cadCostBasis: row.cadCostBasis,
                projectedAnnualCad: row.projectedAnnualCad,
                shareOfTotalPct: row.shareOfTotalPct,
                isEstimated: row.isEstimated,
            });
        } else {
            existing.rows.push(row);
            existing.accountNames.add(row.accountName);
            existing.accountTypes.add(row.accountType);
            existing.shares += row.shares;
            existing.cadMarketValue += row.cadMarketValue;
            existing.cadCostBasis += row.cadCostBasis;
            existing.projectedAnnualCad += row.projectedAnnualCad;
            existing.shareOfTotalPct += row.shareOfTotalPct;
            existing.isEstimated = existing.isEstimated || row.isEstimated;
        }
    }

    const result: HoldingIncomeRow[] = [];
    for (const [ticker, g] of grouped.entries()) {
        const first = g.rows[0]!;
        const accountName =
            g.accountNames.size === 1
                ? Array.from(g.accountNames)[0]!
                : `${g.accountNames.size} accounts`;
        const accountType =
            g.accountTypes.size === 1 ? Array.from(g.accountTypes)[0]! : 'Multiple';

        const currentYieldPct =
            g.cadMarketValue > 0 && g.projectedAnnualCad > 0
                ? (g.projectedAnnualCad / g.cadMarketValue) * 100
                : first.currentYieldPct;
        const yieldOnCostPct =
            g.cadCostBasis > 0 && g.projectedAnnualCad > 0
                ? (g.projectedAnnualCad / g.cadCostBasis) * 100
                : 0;

        result.push({
            ...first,
            assetId: `ticker:${ticker}`,
            accountId: g.rows.length === 1 ? first.accountId : 'multiple',
            accountName,
            accountType,
            shares: g.shares,
            cadMarketValue: g.cadMarketValue,
            cadCostBasis: g.cadCostBasis,
            projectedAnnualCad: g.projectedAnnualCad,
            shareOfTotalPct: g.shareOfTotalPct,
            currentYieldPct,
            yieldOnCostPct,
            isEstimated: g.isEstimated,
        });
    }

    return result.sort((a, b) => b.projectedAnnualCad - a.projectedAnnualCad);
}

export function groupByAccount(
    rows: HoldingIncomeRow[],
    accounts: Account[],
    transactions: Transaction[],
    assets: Asset[],
    today: Date,
    fxRate: number
): AccountIncomeGroup[] {
    const accountMap = new Map<string, Account>(accounts.map((a) => [a.id, a]));
    const assetCurrencyMap = buildAssetCurrencyMap(assets);
    const currentYear = today.getFullYear();

    const groups = new Map<string, AccountIncomeGroup>();

    const ensureGroup = (accountType: string): AccountIncomeGroup => {
        const existing = groups.get(accountType);
        if (existing) return existing;
        const created: AccountIncomeGroup = {
            accountType,
            taxBucket: getTaxBucket(accountType),
            projectedAnnualCad: 0,
            ytdCad: 0,
            shareOfTotalPct: 0,
            holdingsCount: 0,
            hasUsWithholdingWarning: false,
            hasTreatyExemptUs: false,
            usPayers: [],
        };
        groups.set(accountType, created);
        return created;
    };

    for (const row of rows) {
        if (row.projectedAnnualCad <= 0) continue;
        const g = ensureGroup(row.accountType);
        g.projectedAnnualCad += row.projectedAnnualCad;
        g.holdingsCount += 1;

        if (row.isUsListed) {
            if (row.taxTreatment === 'withholding-lost') {
                g.hasUsWithholdingWarning = true;
            } else if (row.taxTreatment === 'treaty-exempt') {
                g.hasTreatyExemptUs = true;
            }
            g.usPayers.push({
                ticker: row.ticker,
                accountName: row.accountName,
                projectedAnnualCad: row.projectedAnnualCad,
                taxTreatment: row.taxTreatment,
            });
        }
    }

    for (const tx of transactions) {
        if (!isAnyDividend(tx) || tx.amount <= 0) continue;
        const d = new Date(tx.date);
        if (Number.isNaN(d.getTime()) || d.getFullYear() !== currentYear) continue;
        if (d.getTime() > today.getTime()) continue;

        const accType = accountMap.get(tx.accountId)?.type ?? 'Other';
        const g = ensureGroup(accType);
        g.ytdCad += toCad(tx.amount, resolveTxCurrency(tx, assetCurrencyMap), fxRate);
    }

    const totalProjected = Array.from(groups.values()).reduce(
        (sum, g) => sum + g.projectedAnnualCad,
        0
    );

    const result = Array.from(groups.values());
    if (totalProjected > 0) {
        for (const g of result) {
            g.shareOfTotalPct = (g.projectedAnnualCad / totalProjected) * 100;
        }
    }

    return result.sort((a, b) => b.projectedAnnualCad - a.projectedAnnualCad);
}

export function buildUpcomingPayouts(
    rows: HoldingIncomeRow[],
    metadataMap: Map<string, DividendMetadata>,
    today: Date,
    windowDays: number,
    fxRate: number
): UpcomingPayout[] {
    const startIso = today.toISOString().slice(0, 10);
    const endDate = new Date(today.getTime() + windowDays * 24 * 60 * 60 * 1000);
    const endIso = endDate.toISOString().slice(0, 10);

    const upcoming: UpcomingPayout[] = [];

    for (const row of rows) {
        const meta = metadataMap.get(row.ticker);
        if (!meta) continue;

        const sortDate = meta.payDate ?? meta.exDividendDate;
        if (!sortDate || sortDate < startIso || sortDate > endIso) continue;

        const perShare = meta.amountPerPayment ?? 0;
        if (perShare <= 0) continue;

        const nativeCurrency: 'CAD' | 'USD' =
            meta.currency === 'USD' || row.currency === 'USD' ? 'USD' : 'CAD';
        const estimatedNative = perShare * row.shares;
        const estimatedCad = toCad(estimatedNative, nativeCurrency, fxRate);

        upcoming.push({
            id: `${row.assetId}:${sortDate}`,
            ticker: row.ticker,
            accountName: row.accountName,
            accountType: row.accountType,
            shares: row.shares,
            exDividendDate: meta.exDividendDate,
            payDate: meta.payDate,
            sortDate,
            nativeCurrency,
            estimatedNative,
            estimatedCad,
            isEstimated: meta.isEstimated,
            frequency: meta.frequency,
        });
    }

    return upcoming.sort((a, b) => a.sortDate.localeCompare(b.sortDate));
}

export function computeKpis(
    rows: HoldingIncomeRow[],
    ytd: { ytdTotalCad: number; ytdCashCad: number; ytdReinvestedCad: number }
): DividendKpis {
    const projectedAnnualCad = rows.reduce((sum, r) => sum + r.projectedAnnualCad, 0);
    const totalMarketValueCad = rows.reduce((sum, r) => sum + r.cadMarketValue, 0);
    const totalCostBasisCad = rows.reduce((sum, r) => sum + r.cadCostBasis, 0);
    const payingRows = rows.filter((r) => r.projectedAnnualCad > 0);
    const estimatedHoldingsCount = payingRows.filter((r) => r.isEstimated).length;

    return {
        ytdTotalCad: ytd.ytdTotalCad,
        ytdCashCad: ytd.ytdCashCad,
        ytdReinvestedCad: ytd.ytdReinvestedCad,
        projectedAnnualCad,
        averageMonthlyCad: projectedAnnualCad / 12,
        portfolioYieldPct:
            totalMarketValueCad > 0 ? (projectedAnnualCad / totalMarketValueCad) * 100 : 0,
        yieldOnCostPct:
            totalCostBasisCad > 0 ? (projectedAnnualCad / totalCostBasisCad) * 100 : 0,
        estimatedHoldingsCount,
        payingHoldingsCount: payingRows.length,
    };
}
