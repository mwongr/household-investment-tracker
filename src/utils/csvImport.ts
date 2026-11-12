import Papa from 'papaparse';
import type { Transaction, TransactionType } from '../types';

export type ImportMode = 'holdings' | 'transactions';

export interface ColumnMapping {
    ticker?: string;
    shares?: string;
    price?: string;
    type?: string;
    date?: string;
    amount?: string;
    commission?: string;
    currency?: string;
    notes?: string;
}

export interface ParsedHoldingRow {
    ticker: string;
    shares: number;
    averageCost: number;
    currency: 'CAD' | 'USD';
    currentPrice?: number;
}

export interface ValidatedRow {
    rowNumber: number;
    raw: Record<string, string>;
    isValid: boolean;
    errors: string[];
    transaction?: Omit<Transaction, 'id'>;
    holdingSummary?: {
        ticker: string;
        shares: number;
        averageCost: number;
        totalCost: number;
        currency: 'CAD' | 'USD';
    };
}

export interface CsvParseResult {
    headers: string[];
    rawRows: Record<string, string>[];
    detectedMode: ImportMode;
    mapping: ColumnMapping;
    validatedRows: ValidatedRow[];
    stats: {
        totalRows: number;
        validRows: number;
        invalidRows: number;
        totalEstimatedValue: number;
        tickersCount: number;
    };
}

const SYNONYMS: Record<keyof ColumnMapping, string[]> = {
    ticker: ['ticker', 'symbol', 'sym', 'security', 'holding', 'code', 'stock', 'asset', 'investment'],
    shares: ['shares', 'quantity', 'qty', 'units', 'count', 'holding size', 'vol', 'volume', 'position'],
    price: [
        'average cost',
        'avg cost',
        'average price',
        'avg price',
        'cost basis',
        'book cost',
        'price per share',
        'unit cost',
        'purchase price',
        'price',
        'cost',
        'price ($)',
    ],
    type: ['type', 'action', 'transaction type', 'activity type', 'trans type', 'description', 'activity', 'trans'],
    date: ['date', 'trade date', 'settlement date', 'activity date', 'trans date', 'transaction date', 'time', 'effective date'],
    amount: [
        'amount',
        'net amount',
        'gross amount',
        'total',
        'value',
        'total amount',
        'book value',
        'net',
        'cash amount',
        'transaction amount',
    ],
    commission: ['commission', 'comm', 'fee', 'fees', 'brokerage fee', 'charge'],
    currency: ['currency', 'curr', 'curr.', 'fx', 'cash currency', 'market currency'],
    notes: ['notes', 'memo', 'comment', 'remarks'],
};

/**
 * Clean and parse numeric values, handling $, commas, parenthesized negatives, etc.
 */
export const parseCleanNumber = (val: any): number => {
    if (val === null || val === undefined) return 0;
    if (typeof val === 'number') return isNaN(val) ? 0 : val;
    let s = String(val).trim();
    if (!s) return 0;

    // Check for parenthesized negative: (123.45) -> -123.45
    let negative = false;
    if (s.startsWith('(') && s.endsWith(')')) {
        negative = true;
        s = s.slice(1, -1);
    }
    // Remove $, CAD, USD, commas, spaces
    s = s.replace(/[^0-9.-]/g, '');
    const num = parseFloat(s);
    if (isNaN(num)) return 0;
    return negative ? -Math.abs(num) : num;
};

/**
 * Parse various date formats into YYYY-MM-DD
 */
export const parseDateToIso = (val: string): string | null => {
    if (!val || typeof val !== 'string') return null;
    const trimmed = val.trim();
    if (!trimmed) return null;

    // Direct YYYY-MM-DD or YYYY/MM/DD
    const isoMatch = trimmed.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
    if (isoMatch) {
        const y = isoMatch[1];
        const m = isoMatch[2].padStart(2, '0');
        const d = isoMatch[3].padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    // MM/DD/YYYY or DD/MM/YYYY
    const slashMatch = trimmed.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
    if (slashMatch) {
        let first = parseInt(slashMatch[1], 10);
        let second = parseInt(slashMatch[2], 10);
        const y = slashMatch[3];

        let m = first;
        let d = second;
        // If first is > 12, it must be DD/MM/YYYY
        if (first > 12 && second <= 12) {
            d = first;
            m = second;
        }
        return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }

    // Fallback to JS Date parser
    const parsed = new Date(trimmed);
    if (!isNaN(parsed.getTime())) {
        return parsed.toISOString().split('T')[0];
    }

    return null;
};

/**
 * Map free-form text or brokerage actions to supported TransactionType
 */
export const mapTransactionType = (val: string): TransactionType | null => {
    if (!val) return 'Buy';
    const s = val.trim().toLowerCase();

    if (/drip|reinvest/i.test(s)) return 'DRIP';
    if (/div|distribution/i.test(s)) return 'Dividend';
    if (/split/i.test(s)) return 'Stock Split';
    if (/sell|sold/i.test(s)) return 'Sell';
    if (/deposit|dep|contrib|contribution|eft/i.test(s)) return 'Deposit';
    if (/withdraw|w\/d|disbursement/i.test(s)) return 'Withdrawal';
    if (/buy|bot|purchase/i.test(s)) return 'Buy';

    return null;
};

/**
 * Automatically map CSV headers to column roles using synonyms and fuzzy matching
 */
export const detectColumnMapping = (headers: string[]): ColumnMapping => {
    const mapping: ColumnMapping = {};
    const lowerHeaders = headers.map(h => ({
        original: h,
        normalized: h.toLowerCase().trim().replace(/[_\s]+/g, ' '),
    }));

    (Object.keys(SYNONYMS) as (keyof ColumnMapping)[]).forEach(field => {
        const syns = SYNONYMS[field];
        // 1. Exact normalized match
        const exact = lowerHeaders.find(h => syns.includes(h.normalized));
        if (exact) {
            mapping[field] = exact.original;
            return;
        }
        // 2. Contains match
        const contains = lowerHeaders.find(h => syns.some(syn => h.normalized.includes(syn)));
        if (contains) {
            mapping[field] = contains.original;
            return;
        }
    });

    return mapping;
};

/**
 * Auto-detect whether the file is likely Holdings or Transactions
 */
export const detectImportMode = (mapping: ColumnMapping): ImportMode => {
    if (mapping.date || mapping.type) {
        return 'transactions';
    }
    const hasShares = Boolean(mapping.shares);
    const hasPrice = Boolean(mapping.price);
    const hasTicker = Boolean(mapping.ticker);
    if (hasTicker && hasShares && hasPrice) {
        return 'holdings';
    }
    return 'transactions';
};

/**
 * Validate and transform raw parsed CSV rows based on chosen mode and mapping
 */
export const validateAndTransformRows = (
    rawRows: Record<string, string>[],
    mode: ImportMode,
    mapping: ColumnMapping,
    accountId: string,
    defaultCurrency: 'CAD' | 'USD' = 'CAD',
    todayDateIso: string = new Date().toISOString().split('T')[0]
): ValidatedRow[] => {
    return rawRows.map((raw, idx) => {
        const rowNum = idx + 2; // Row 1 is header
        const errors: string[] = [];

        const rawTicker = (mapping.ticker ? raw[mapping.ticker] : '') || '';
        const rawShares = mapping.shares ? raw[mapping.shares] : '';
        const rawPrice = mapping.price ? raw[mapping.price] : '';
        const rawType = mapping.type ? raw[mapping.type] : '';
        const rawDate = mapping.date ? raw[mapping.date] : '';
        const rawAmount = mapping.amount ? raw[mapping.amount] : '';
        const rawCommission = mapping.commission ? raw[mapping.commission] : '';
        const rawCurrency = (mapping.currency ? raw[mapping.currency] : '') || '';

        const cleanTicker = rawTicker.trim().toUpperCase();
        let currency: 'CAD' | 'USD' = defaultCurrency;
        const currUpper = rawCurrency.trim().toUpperCase();
        if (currUpper === 'USD' || currUpper.includes('USD')) {
            currency = 'USD';
        } else if (currUpper === 'CAD' || currUpper.includes('CAD')) {
            currency = 'CAD';
        } else if (cleanTicker.endsWith('.TO') || cleanTicker.endsWith('.NE') || cleanTicker.endsWith('.CN') || cleanTicker.endsWith('.V')) {
            currency = 'CAD';
        }

        if (mode === 'holdings') {
            if (!cleanTicker) {
                errors.push('Missing Ticker symbol');
            }
            const shares = parseCleanNumber(rawShares);
            if (shares <= 0) {
                errors.push('Shares must be greater than 0');
            }
            const avgCost = parseCleanNumber(rawPrice);
            if (avgCost < 0) {
                errors.push('Average cost cannot be negative');
            }

            if (errors.length > 0) {
                return {
                    rowNumber: rowNum,
                    raw,
                    isValid: false,
                    errors,
                };
            }

            const totalCost = shares * avgCost;
            const transaction: Omit<Transaction, 'id'> = {
                accountId,
                ticker: cleanTicker,
                date: todayDateIso,
                type: 'Buy',
                shares,
                pricePerShare: avgCost,
                commission: 0,
                amount: totalCost,
                currency,
                ignoreCashImpact: true, // Default to not altering cash for initial holdings import
            };

            return {
                rowNumber: rowNum,
                raw,
                isValid: true,
                errors: [],
                transaction,
                holdingSummary: {
                    ticker: cleanTicker,
                    shares,
                    averageCost: avgCost,
                    totalCost,
                    currency,
                },
            };
        }

        // Transactions Mode
        const txType = mapTransactionType(rawType) || (cleanTicker ? 'Buy' : 'Deposit');
        const isCashOnly = txType === 'Deposit' || txType === 'Withdrawal';
        const isDividend = txType === 'Dividend' || txType === 'Dividend Income';
        const isDrip = txType === 'DRIP' || txType === 'Dividend Reinvested';
        const isStockSplit = txType === 'Stock Split';

        if (!isCashOnly && !cleanTicker) {
            errors.push(`Missing Ticker for ${txType} transaction`);
        }

        let dateIso = parseDateToIso(rawDate);
        if (!dateIso) {
            if (rawDate.trim()) {
                errors.push(`Invalid date format: "${rawDate}"`);
            } else {
                dateIso = todayDateIso; // fallback
            }
        }

        const shares = parseCleanNumber(rawShares);
        const price = parseCleanNumber(rawPrice);
        const commission = parseCleanNumber(rawCommission);
        let amount = Math.abs(parseCleanNumber(rawAmount));

        if (isCashOnly) {
            // Deposit / Withdrawal: dollar amount can be in Amount or Price column
            if (amount <= 0 && price > 0) {
                amount = price;
            }
            if (amount <= 0) {
                errors.push(`Please enter the ${txType.toLowerCase()} dollar amount in the Amount column`);
            }
        } else if (isDividend) {
            // Cash Dividend: payout amount can be in Amount column, or calculated from shares * price, or in Price
            if (amount <= 0 && price > 0) {
                if (shares > 0) {
                    amount = shares * price;
                } else {
                    amount = price;
                }
            }
            if (amount <= 0) {
                errors.push('Please enter the dividend payout amount in the Amount column');
            }
        } else if (isDrip) {
            // DRIP: Reinvested dividend buys new shares
            if (shares <= 0) {
                errors.push('DRIP requires the number of reinvested shares in the Shares column');
            }
            if (amount <= 0 && price > 0 && shares > 0) {
                amount = shares * price;
            }
            if (amount <= 0 && price <= 0) {
                errors.push('DRIP requires reinvestment price or total amount');
            }
        } else if (isStockSplit) {
            // Stock Split
        } else {
            // Buy or Sell
            if (shares <= 0) {
                errors.push('Shares must be greater than 0');
            }
            if (amount <= 0 && price > 0 && shares > 0) {
                amount = txType === 'Sell' ? Math.max(0, shares * price - commission) : (shares * price + commission);
            }
            if (amount <= 0 && price <= 0) {
                errors.push('Please provide price per share or total amount');
            }
        }

        if (errors.length > 0) {
            return {
                rowNumber: rowNum,
                raw,
                isValid: false,
                errors,
            };
        }

        const transaction: Omit<Transaction, 'id'> = {
            accountId,
            ticker: isCashOnly ? '' : cleanTicker,
            date: dateIso || todayDateIso,
            type: txType,
            shares: isCashOnly || isDividend ? 0 : shares,
            pricePerShare: isCashOnly ? 0 : isDividend ? (price > 0 ? price : (shares > 0 ? amount / shares : amount)) : price,
            commission,
            amount,
            currency,
            ignoreCashImpact: false,
        };

        return {
            rowNumber: rowNum,
            raw,
            isValid: true,
            errors: [],
            transaction,
        };
    });
};

/**
 * Parse CSV string or file content completely
 */
export const parseCsvContent = (
    content: string,
    accountId: string,
    forcedMode?: ImportMode,
    customMapping?: Partial<ColumnMapping>,
    defaultCurrency: 'CAD' | 'USD' = 'CAD'
): CsvParseResult => {
    const parsed = Papa.parse<Record<string, string>>(content, {
        header: true,
        skipEmptyLines: 'greedy',
    });

    const headers = parsed.meta.fields || [];
    const rawRows = parsed.data.filter(row => Object.values(row).some(v => v !== null && String(v).trim() !== ''));

    const autoMapping = detectColumnMapping(headers);
    const mapping: ColumnMapping = { ...autoMapping, ...customMapping };
    const detectedMode = forcedMode || detectImportMode(mapping);

    const validatedRows = validateAndTransformRows(rawRows, detectedMode, mapping, accountId, defaultCurrency);

    const validRows = validatedRows.filter(r => r.isValid);
    const uniqueTickers = new Set(
        validRows
            .map(r => r.transaction?.ticker || r.holdingSummary?.ticker)
            .filter(Boolean)
    );

    const totalEstimatedValue = validRows.reduce((sum, r) => {
        if (r.holdingSummary) return sum + r.holdingSummary.totalCost;
        if (r.transaction) return sum + (r.transaction.amount || 0);
        return sum;
    }, 0);

    return {
        headers,
        rawRows,
        detectedMode,
        mapping,
        validatedRows,
        stats: {
            totalRows: validatedRows.length,
            validRows: validRows.length,
            invalidRows: validatedRows.length - validRows.length,
            totalEstimatedValue,
            tickersCount: uniqueTickers.size,
        },
    };
};

/**
 * Sample CSV Templates content
 */
export const SAMPLE_HOLDINGS_CSV = `Ticker,Shares,Average Cost,Currency
XEQT.TO,100,28.50,CAD
VFV.TO,50,118.25,CAD
AAPL,25,185.00,USD
MSFT,15,420.50,USD`;

export const SAMPLE_TRANSACTIONS_CSV = `Date,Type,Ticker,Shares,Price,Commission,Amount,Currency,Notes
2024-01-15,Deposit,,,,0.00,5000.00,CAD,Initial bank transfer into account
2024-01-16,Buy,XEQT.TO,100,28.50,0.00,2850.00,CAD,Buy 100 shares of XEQT
2024-02-01,Buy,VFV.TO,50,118.25,0.00,5912.50,CAD,Buy 50 shares of VFV
2024-03-10,Buy,AAPL,25,185.00,4.95,4629.95,USD,Tech stock purchase
2024-03-31,Dividend,XEQT.TO,,,0.00,45.50,CAD,Quarterly cash dividend payout
2024-04-15,DRIP,XEQT.TO,2,28.60,0.00,57.20,CAD,Dividend reinvested for 2 new shares
2024-05-01,Deposit,,,,0.00,1000.00,CAD,Monthly recurring deposit
2024-06-20,Sell,VFV.TO,10,125.00,0.00,1250.00,CAD,Partial profit take
2024-07-01,Withdrawal,,,,0.00,500.00,CAD,Cash withdrawal to bank chequing`;

/**
 * Triggers a browser download of a sample CSV file
 */
export const downloadSampleCsv = (type: 'holdings' | 'transactions') => {
    const isHoldings = type === 'holdings';
    const content = isHoldings ? SAMPLE_HOLDINGS_CSV : SAMPLE_TRANSACTIONS_CSV;
    const filename = isHoldings ? 'sample_holdings_template.csv' : 'sample_transactions_template.csv';

    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};
