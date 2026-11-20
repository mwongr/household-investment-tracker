export type PayoutFrequency = 'monthly' | 'quarterly' | 'semi-annual' | 'annual' | 'irregular';

export interface PayoutPoint {
    date: string; // YYYY-MM-DD
    amountPerShare: number | null;
    totalAmount: number;
}

export interface MinimalTx {
    accountId: string;
    ticker?: string;
    previousTicker?: string;
    date: string;
    type: string;
    shares?: number;
    amount: number;
    splitFrom?: number;
    splitTo?: number;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function toIsoDay(dateStr: string): string {
    if (!dateStr) return '';
    const idx = dateStr.indexOf('T');
    return idx >= 0 ? dateStr.slice(0, idx) : dateStr.slice(0, 10);
}

function median(values: number[]): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    if (sorted.length % 2 === 1) {
        return sorted[mid]!;
    }
    return (sorted[mid - 1]! + sorted[mid]!) / 2;
}

export function paymentsPerYear(frequency: PayoutFrequency): number {
    switch (frequency) {
        case 'monthly':
            return 12;
        case 'quarterly':
            return 4;
        case 'semi-annual':
            return 2;
        case 'annual':
            return 1;
        case 'irregular':
            return 1;
    }
}

export function inferCadence(
    dates: string[]
): { frequency: PayoutFrequency; intervalDays: number } | null {
    const uniqueDays = Array.from(new Set(dates.map(toIsoDay).filter(Boolean))).sort();
    if (uniqueDays.length < 2) return null;

    const gaps: number[] = [];
    for (let i = 1; i < uniqueDays.length; i++) {
        const prev = Date.parse(`${uniqueDays[i - 1]}T00:00:00Z`);
        const curr = Date.parse(`${uniqueDays[i]}T00:00:00Z`);
        if (!Number.isFinite(prev) || !Number.isFinite(curr)) continue;
        const diffDays = Math.round((curr - prev) / MS_PER_DAY);
        if (diffDays > 0) gaps.push(diffDays);
    }

    if (gaps.length === 0) return null;

    const medGap = median(gaps);
    let frequency: PayoutFrequency;
    if (medGap <= 45) {
        frequency = 'monthly';
    } else if (medGap <= 110) {
        frequency = 'quarterly';
    } else if (medGap <= 200) {
        frequency = 'semi-annual';
    } else if (medGap <= 400) {
        frequency = 'annual';
    } else {
        frequency = 'irregular';
    }

    return { frequency, intervalDays: Math.round(medGap) };
}

/**
 * Computes how many shares of `ticker` were held in `accountId` on `isoDate` (inclusive),
 * accounting for Buy, Sell, DRIP, Dividend Reinvested, Stock Split, and previousTicker migrations.
 */
export function sharesHeldOn(
    txs: MinimalTx[],
    accountId: string,
    ticker: string,
    isoDate: string
): number {
    const targetDay = toIsoDay(isoDate);
    const upperTicker = ticker.toUpperCase();

    const relevant = txs
        .filter((tx) => {
            if (tx.accountId !== accountId) return false;
            const txDay = toIsoDay(tx.date);
            if (!txDay || txDay > targetDay) return false;
            const txTicker = (tx.ticker ?? '').toUpperCase();
            const prevTicker = (tx.previousTicker ?? '').toUpperCase();
            return txTicker === upperTicker || prevTicker === upperTicker;
        })
        .sort((a, b) => toIsoDay(a.date).localeCompare(toIsoDay(b.date)));

    let shares = 0;
    for (const tx of relevant) {
        const txTicker = (tx.ticker ?? '').toUpperCase();
        if (txTicker !== upperTicker) continue;

        if (tx.type === 'Buy' || tx.type === 'DRIP' || tx.type === 'Dividend Reinvested') {
            shares += tx.shares ?? 0;
        } else if (tx.type === 'Sell') {
            shares = Math.max(0, shares - (tx.shares ?? 0));
        } else if (tx.type === 'Stock Split') {
            const from = tx.splitFrom ?? 1;
            const to = tx.splitTo ?? 1;
            if (from > 0 && to > 0) {
                shares = shares * (to / from);
            }
        }
    }

    return shares;
}

export function isDividendTransaction(tx: MinimalTx): boolean {
    return (
        tx.type === 'Dividend' ||
        tx.type === 'Dividend Income' ||
        tx.type === 'DRIP' ||
        tx.type === 'Dividend Reinvested'
    );
}

/**
 * Aggregates historical dividend transactions for `ticker` by payout date,
 * normalizing per-share amounts using the shares held in each account on that date.
 */
export function buildTransactionHistory(txs: MinimalTx[], ticker: string): PayoutPoint[] {
    const upperTicker = ticker.toUpperCase();
    const divTxs = txs.filter(
        (tx) =>
            isDividendTransaction(tx) &&
            (tx.ticker ?? '').toUpperCase() === upperTicker &&
            tx.amount > 0
    );

    if (divTxs.length === 0) return [];

    const byDate = new Map<
        string,
        { totalAmount: number; perShareSamples: number[] }
    >();

    for (const tx of divTxs) {
        const day = toIsoDay(tx.date);
        if (!day) continue;
        const held = sharesHeldOn(txs, tx.accountId, upperTicker, day);
        const entry = byDate.get(day) ?? { totalAmount: 0, perShareSamples: [] };
        entry.totalAmount += tx.amount;
        if (held > 0) {
            entry.perShareSamples.push(tx.amount / held);
        }
        byDate.set(day, entry);
    }

    return Array.from(byDate.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, info]) => ({
            date,
            totalAmount: info.totalAmount,
            amountPerShare:
                info.perShareSamples.length > 0 ? median(info.perShareSamples) : null,
        }));
}

function addMonthsUtc(date: Date, months: number): Date {
    const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    const targetMonth = d.getUTCMonth() + months;
    d.setUTCMonth(targetMonth);
    return d;
}

function advanceDateByCadence(
    lastDate: Date,
    frequency: PayoutFrequency,
    intervalDays: number
): Date {
    switch (frequency) {
        case 'monthly':
            return addMonthsUtc(lastDate, 1);
        case 'quarterly':
            return addMonthsUtc(lastDate, 3);
        case 'semi-annual':
            return addMonthsUtc(lastDate, 6);
        case 'annual':
            return addMonthsUtc(lastDate, 12);
        case 'irregular':
            return new Date(lastDate.getTime() + Math.max(1, intervalDays) * MS_PER_DAY);
    }
}

export function estimateNextPayout(
    points: PayoutPoint[],
    today: Date = new Date()
): { nextPayDate: string; amountPerShare: number | null; frequency: PayoutFrequency } | null {
    if (points.length === 0) return null;

    const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date));
    const cadence = inferCadence(sorted.map((p) => p.date));
    if (!cadence) return null;

    const lastPoint = sorted[sorted.length - 1]!;
    const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
    let candidate = new Date(`${lastPoint.date}T00:00:00Z`);

    // Roll forward until strictly after today (safety cap to avoid infinite loops)
    let guard = 0;
    while (candidate.getTime() <= todayUtc && guard < 120) {
        candidate = advanceDateByCadence(candidate, cadence.frequency, cadence.intervalDays);
        guard++;
    }

    const recentPerShare = sorted
        .slice(-4)
        .map((p) => p.amountPerShare)
        .filter((v): v is number => v !== null && v > 0);

    const amountPerShare = recentPerShare.length > 0 ? median(recentPerShare) : null;

    return {
        nextPayDate: candidate.toISOString().slice(0, 10),
        amountPerShare,
        frequency: cadence.frequency,
    };
}

/**
 * Counts how many valid per-share payouts fall within the trailing 12 months (365 days ending on `today`).
 */
export function countTtmPayouts(
    points: PayoutPoint[],
    today: Date = new Date()
): number {
    if (points.length === 0) return 0;
    const todayIso = today.toISOString().slice(0, 10);
    const cutoffIso = new Date(today.getTime() - 365 * MS_PER_DAY).toISOString().slice(0, 10);

    let count = 0;
    for (const p of points) {
        if (p.date >= cutoffIso && p.date <= todayIso && p.amountPerShare !== null && p.amountPerShare > 0) {
            count++;
        }
    }
    return count;
}

/**
 * Sums per-share payouts over the trailing 12 months (365 days ending on `today`).
 * Returns null if no valid per-share payouts exist in the window.
 */
export function computeTtmPerShare(
    points: PayoutPoint[],
    today: Date = new Date()
): number | null {
    if (points.length === 0) return null;
    const todayIso = today.toISOString().slice(0, 10);
    const cutoffIso = new Date(today.getTime() - 365 * MS_PER_DAY).toISOString().slice(0, 10);

    let sum = 0;
    let count = 0;
    for (const p of points) {
        if (p.date >= cutoffIso && p.date <= todayIso && p.amountPerShare !== null && p.amountPerShare > 0) {
            sum += p.amountPerShare;
            count++;
        }
    }

    return count > 0 ? sum : null;
}

/**
 * Returns true if TTM payouts vary significantly (max / min > 1.35),
 * e.g. Canadian all-in-one ETFs like XEQT.TO with larger Jun/Dec distributions.
 */
export function hasUnevenPayouts(
    points: PayoutPoint[],
    today: Date = new Date()
): boolean {
    const todayIso = today.toISOString().slice(0, 10);
    const cutoffIso = new Date(today.getTime() - 365 * MS_PER_DAY).toISOString().slice(0, 10);

    const amounts = points
        .filter(
            (p) =>
                p.date >= cutoffIso &&
                p.date <= todayIso &&
                p.amountPerShare !== null &&
                p.amountPerShare > 0
        )
        .map((p) => p.amountPerShare as number);

    if (amounts.length < 2) return false;
    const min = Math.min(...amounts);
    const max = Math.max(...amounts);
    return min > 0 && max / min > 1.35;
}
