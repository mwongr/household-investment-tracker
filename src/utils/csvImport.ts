import Papa from 'papaparse';
import type { Transaction, TransactionType } from '../types';

export type ImportMode = 'holdings' | 'transactions';
export type BrokerPreset = 'wealthsimple' | 'questrade' | 'generic';

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
    brokerPreset: BrokerPreset;
    detectedAccountType?: string;
    detectedInstitution?: string;
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
    let trimmed = val.trim();
    if (!trimmed) return null;

    // Strip trailing timestamps like " 12:00:00 AM" or " 13:45:00"
    trimmed = trimmed.replace(/\s+\d{1,2}:\d{2}(:\d{2})?(\s*[a-zA-Z]{2})?$/, '');

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
        const first = parseInt(slashMatch[1], 10);
        const second = parseInt(slashMatch[2], 10);
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
 * Detect if CSV headers match a known Canadian/US brokerage export
 */
export const detectBrokerPreset = (headers: string[]): BrokerPreset => {
    const lower = headers.map(h => h.toLowerCase().trim().replace(/[_\s]+/g, ' '));

    // Wealthsimple signature: has "activity type", "activity sub type" or "net cash amount" with "account id"
    const hasWsActivity = lower.some(h => h.includes('activity type') || h.includes('activity subtype') || h.includes('activity sub type'));
    const hasWsCash = lower.some(h => h.includes('net cash amount'));
    const hasWsAccount = lower.some(h => h.includes('account id') || h.includes('account type'));
    if ((hasWsActivity && hasWsCash) || (hasWsCash && hasWsAccount)) {
        return 'wealthsimple';
    }

    // Questrade signature: has "transaction date", "settlement date", "account #" or "gross amount"
    const hasQtDate = lower.some(h => h.includes('transaction date'));
    const hasQtAccount = lower.some(h => h.includes('account #') || h.includes('account number'));
    const hasQtGross = lower.some(h => h.includes('gross amount') || h.includes('net amount'));
    if (hasQtDate && (hasQtAccount || hasQtGross)) {
        return 'questrade';
    }

    return 'generic';
};

/**
 * Map free-form text or brokerage actions to supported TransactionType
 */
export const mapTransactionType = (val: string): TransactionType | null => {
    if (!val) return 'Buy';
    const s = val.trim().toLowerCase();

    if (/drip|reinvest/i.test(s)) return 'Dividend Reinvested';
    if (/div|distribution/i.test(s)) return 'Dividend Income';
    if (/split/i.test(s)) return 'Stock Split';
    if (/sell|sold/i.test(s)) return 'Sell';
    if (/interest|lending int/i.test(s)) return 'Interest';
    if (/fee|charge/i.test(s)) return 'Fee';
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
 * Helper to ensure Canadian stocks listed on TSX carry the .TO suffix
 */
const normalizeTickerSymbol = (symbol: string, currency: 'CAD' | 'USD'): string => {
    let t = symbol.trim().toUpperCase();
    if (!t) return '';
    // If it already has an exchange suffix like .TO, .CN, .NE, .V, .VN
    if (/\.(TO|CN|NE|V|VN)$/.test(t)) {
        return t;
    }
    // Append .TO if currency is CAD and no suffix
    if (currency === 'CAD') {
        return `${t}.TO`;
    }
    return t;
};

/**
 * Native parser for Wealthsimple Activity exports
 */
export const parseWealthsimpleRow = (
    raw: Record<string, string>,
    rowNum: number,
    accountId: string,
    todayDateIso: string
): ValidatedRow | null => {
    const activityType = (raw.activity_type || raw['Activity Type'] || '').trim();
    const activitySubType = (raw.activity_sub_type || raw['Activity Sub Type'] || raw.activity_subtype || '').trim().toUpperCase();
    const rawDate = raw.effective_date || raw['Effective Date'] || raw.settlement_date || raw['Settlement Date'] || '';
    const date = parseDateToIso(rawDate) || todayDateIso;
    const rawSymbol = (raw.symbol || raw.Symbol || '').trim();
    const currency: 'CAD' | 'USD' = (raw.currency || 'CAD').toUpperCase().includes('USD') ? 'USD' : 'CAD';
    const quantity = Math.abs(parseCleanNumber(raw.quantity));
    const unitPrice = Math.abs(parseCleanNumber(raw.unit_price));
    const commission = Math.abs(parseCleanNumber(raw.commission));
    const netCash = parseCleanNumber(raw.net_cash_amount);
    const absCash = Math.abs(netCash);

    const cleanTicker = normalizeTickerSymbol(rawSymbol, currency);
    const lowerAct = activityType.toLowerCase();

    // 1. Trades (Buy / Sell)
    if (lowerAct === 'trade') {
        const isBuy = activitySubType === 'BUY' || netCash < 0;
        const type: TransactionType = isBuy ? 'Buy' : 'Sell';
        const amount = absCash > 0 ? absCash : quantity * unitPrice;

        if (!cleanTicker) return { rowNumber: rowNum, raw, isValid: false, errors: ['Missing symbol for trade'] };
        if (quantity <= 0) return { rowNumber: rowNum, raw, isValid: false, errors: ['Quantity must be greater than 0'] };

        return {
            rowNumber: rowNum,
            raw,
            isValid: true,
            errors: [],
            transaction: {
                accountId,
                ticker: cleanTicker,
                date,
                type,
                shares: quantity,
                pricePerShare: unitPrice,
                commission,
                amount,
                currency,
                ignoreCashImpact: false,
            },
        };
    }

    // 2. Money Movement (Deposit / Withdrawal)
    if (lowerAct === 'moneymovement' || lowerAct === 'money movement') {
        const isDeposit = netCash >= 0;
        const type: TransactionType = isDeposit ? 'Deposit' : 'Withdrawal';
        const amount = absCash;

        if (amount <= 0) return null;

        return {
            rowNumber: rowNum,
            raw,
            isValid: true,
            errors: [],
            transaction: {
                accountId,
                ticker: '',
                date,
                type,
                shares: 0,
                pricePerShare: 0,
                commission: 0,
                amount,
                currency,
                ignoreCashImpact: false,
            },
        };
    }

    // 3. Dividend
    if (lowerAct === 'dividend') {
        const amount = absCash > 0 ? absCash : (unitPrice > 0 ? unitPrice : quantity);
        if (!cleanTicker) return { rowNumber: rowNum, raw, isValid: false, errors: ['Missing symbol for dividend'] };

        return {
            rowNumber: rowNum,
            raw,
            isValid: true,
            errors: [],
            transaction: {
                accountId,
                ticker: cleanTicker,
                date,
                type: 'Dividend Income',
                shares: 0,
                pricePerShare: 0,
                commission: 0,
                amount,
                currency,
                ignoreCashImpact: false,
            },
        };
    }

    // 4. Interest (Stock lending or cash interest)
    if (lowerAct === 'interest') {
        const amount = absCash;
        if (amount <= 0) return null;

        return {
            rowNumber: rowNum,
            raw,
            isValid: true,
            errors: [],
            transaction: {
                accountId,
                ticker: cleanTicker || '',
                date,
                type: 'Interest',
                shares: 0,
                pricePerShare: 0,
                commission: 0,
                amount,
                currency,
                ignoreCashImpact: false,
            },
        };
    }

    // 5. Corporate Actions (Split, etc.)
    if (
        lowerAct.includes('corporateaction') ||
        lowerAct.includes('corporate action') ||
        lowerAct.includes('legacycorporateaction') ||
        lowerAct.includes('legacy corporate action')
    ) {
        const desc = (raw.description || '').toUpperCase();
        if (desc.includes('SPLIT')) {
            return {
                rowNumber: rowNum,
                raw,
                isValid: true,
                errors: [],
                transaction: {
                    accountId,
                    ticker: cleanTicker,
                    date,
                    type: 'Stock Split',
                    shares: quantity,
                    pricePerShare: 0,
                    commission: 0,
                    amount: 0,
                    currency,
                    ignoreCashImpact: false,
                },
            };
        }
        return null; // Skip non-dilutive reorganizations, spin-offs, name changes, listing changes
    }

    // 6. Fees / Charges
    if (lowerAct === 'fee' || lowerAct === 'charge' || lowerAct === 'commission') {
        const amount = absCash;
        if (amount <= 0) return null;

        return {
            rowNumber: rowNum,
            raw,
            isValid: true,
            errors: [],
            transaction: {
                accountId,
                ticker: cleanTicker || '',
                date,
                type: 'Fee',
                shares: 0,
                pricePerShare: 0,
                commission: amount,
                amount,
                currency,
                ignoreCashImpact: false,
            },
        };
    }

    return null;
};

/**
 * Native parser for Questrade Activity exports
 */
export const parseQuestradeRow = (
    raw: Record<string, string>,
    rowNum: number,
    accountId: string,
    todayDateIso: string
): ValidatedRow | null => {
    const rawAction = (raw.Action || raw.action || '').trim();
    const activityType = (raw['Activity Type'] || raw.activity_type || '').trim();
    const rawDate = raw['Transaction Date'] || raw['Settlement Date'] || raw.date || '';
    const date = parseDateToIso(rawDate) || todayDateIso;
    const rawSymbol = (raw.Symbol || raw.symbol || '').trim();
    const description = (raw.Description || raw.description || '').trim();
    const currency: 'CAD' | 'USD' = (raw.Currency || 'CAD').toUpperCase().includes('USD') ? 'USD' : 'CAD';
    const rawQuantity = parseCleanNumber(raw.Quantity);
    const quantity = Math.abs(rawQuantity);
    const unitPrice = Math.abs(parseCleanNumber(raw.Price));
    const commission = Math.abs(parseCleanNumber(raw.Commission));
    const netAmount = parseCleanNumber(raw['Net Amount']);
    const absNet = Math.abs(netAmount);

    let cleanTicker = rawSymbol.toUpperCase();
    if (!cleanTicker && description) {
        const symMatch = description.match(/Symbol[:\s-]+([A-Za-z0-9.]+)/i);
        if (symMatch) cleanTicker = symMatch[1].toUpperCase();
    }
    cleanTicker = normalizeTickerSymbol(cleanTicker, currency);

    const actionUpper = rawAction.toUpperCase();
    const actLower = activityType.toLowerCase();
    const descLower = description.toLowerCase();

    // 1. Dividends
    if (actLower === 'dividends' || descLower.includes('dist on') || descLower.includes('cash dividend') || actionUpper === 'DIV') {
        const amount = absNet > 0 ? absNet : (unitPrice > 0 ? unitPrice : quantity);
        if (!cleanTicker) return { rowNumber: rowNum, raw, isValid: false, errors: ['Missing symbol for dividend'] };

        return {
            rowNumber: rowNum,
            raw,
            isValid: true,
            errors: [],
            transaction: {
                accountId,
                ticker: cleanTicker,
                date,
                type: 'Dividend Income',
                shares: 0,
                pricePerShare: unitPrice,
                commission: 0,
                amount,
                currency,
                ignoreCashImpact: false,
            },
        };
    }

    // 2. Dividend Reinvestment (REI / DRIP)
    if (actionUpper === 'REI' || actLower === 'dividend reinvestment' || descLower.includes('reinv@')) {
        let shares = quantity;
        let price = unitPrice;
        if (price === 0 && descLower.includes('reinv@c$')) {
            const m = description.match(/REINV@C?\$([0-9.]+)/i);
            if (m) price = parseFloat(m[1]);
        }
        const amount = absNet > 0 ? absNet : shares * price;

        return {
            rowNumber: rowNum,
            raw,
            isValid: true,
            errors: [],
            transaction: {
                accountId,
                ticker: cleanTicker,
                date,
                type: 'Dividend Reinvested',
                shares,
                pricePerShare: price || (shares > 0 ? amount / shares : 0),
                commission: 0,
                amount,
                currency,
                ignoreCashImpact: false,
            },
        };
    }

    // 3. Deposits / Contributions (CON)
    if (actionUpper === 'CON' || actLower === 'deposits' || descLower.includes('cont ') || descLower.includes('deposit')) {
        const amount = absNet;
        if (amount <= 0) return null;

        return {
            rowNumber: rowNum,
            raw,
            isValid: true,
            errors: [],
            transaction: {
                accountId,
                ticker: '',
                date,
                type: 'Deposit',
                shares: 0,
                pricePerShare: 0,
                commission: 0,
                amount,
                currency,
                ignoreCashImpact: false,
            },
        };
    }

    // 4. Withdrawals
    if (actionUpper === 'W/D' || actLower === 'withdrawals' || descLower.includes('withdrawal')) {
        const amount = absNet;
        if (amount <= 0) return null;

        return {
            rowNumber: rowNum,
            raw,
            isValid: true,
            errors: [],
            transaction: {
                accountId,
                ticker: '',
                date,
                type: 'Withdrawal',
                shares: 0,
                pricePerShare: 0,
                commission: 0,
                amount,
                currency,
                ignoreCashImpact: false,
            },
        };
    }

    // 5. Interest & Securities Lending (LFJ / Fees and rebates)
    if (actionUpper === 'LFJ' || descLower.includes('securities lending') || actLower === 'fees and rebates' || actLower === 'interest') {
        const amount = absNet;
        if (amount <= 0) return null;

        return {
            rowNumber: rowNum,
            raw,
            isValid: true,
            errors: [],
            transaction: {
                accountId,
                ticker: cleanTicker || '',
                date,
                type: 'Interest',
                shares: 0,
                pricePerShare: 0,
                commission: 0,
                amount,
                currency,
                ignoreCashImpact: false,
            },
        };
    }

    // 6. Buy Trade
    if (actionUpper === 'BUY' || (actLower === 'trades' && (rawQuantity > 0 || netAmount < 0))) {
        const shares = quantity;
        const price = unitPrice;
        const amount = absNet > 0 ? absNet : shares * price + commission;

        if (!cleanTicker) return { rowNumber: rowNum, raw, isValid: false, errors: ['Missing symbol for Buy'] };
        if (shares <= 0) return { rowNumber: rowNum, raw, isValid: false, errors: ['Shares must be greater than 0'] };

        return {
            rowNumber: rowNum,
            raw,
            isValid: true,
            errors: [],
            transaction: {
                accountId,
                ticker: cleanTicker,
                date,
                type: 'Buy',
                shares,
                pricePerShare: price,
                commission,
                amount,
                currency,
                ignoreCashImpact: false,
            },
        };
    }

    // 7. Sell Trade
    if (actionUpper === 'SELL' || (actLower === 'trades' && (rawQuantity < 0 || netAmount > 0))) {
        const shares = quantity;
        const price = unitPrice;
        const amount = absNet > 0 ? absNet : Math.max(0, shares * price - commission);

        if (!cleanTicker) return { rowNumber: rowNum, raw, isValid: false, errors: ['Missing symbol for Sell'] };
        if (shares <= 0) return { rowNumber: rowNum, raw, isValid: false, errors: ['Shares must be greater than 0'] };

        return {
            rowNumber: rowNum,
            raw,
            isValid: true,
            errors: [],
            transaction: {
                accountId,
                ticker: cleanTicker,
                date,
                type: 'Sell',
                shares,
                pricePerShare: price,
                commission,
                amount,
                currency,
                ignoreCashImpact: false,
            },
        };
    }

    // 8. Stock Splits (REV)
    if (actionUpper === 'REV' || descLower.includes('reverse split') || descLower.includes('split')) {
        return {
            rowNumber: rowNum,
            raw,
            isValid: true,
            errors: [],
            transaction: {
                accountId,
                ticker: cleanTicker,
                date,
                type: 'Stock Split',
                shares: quantity,
                pricePerShare: 0,
                commission: 0,
                amount: 0,
                currency,
                ignoreCashImpact: false,
            },
        };
    }

    // 9. Cash In Lieu (CIL)
    if (actionUpper === 'CIL') {
        const amount = absNet;
        return {
            rowNumber: rowNum,
            raw,
            isValid: true,
            errors: [],
            transaction: {
                accountId,
                ticker: cleanTicker,
                date,
                type: 'Dividend Income',
                shares: 0,
                pricePerShare: 0,
                commission: 0,
                amount,
                currency,
                ignoreCashImpact: false,
            },
        };
    }

    return null;
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
                ignoreCashImpact: true,
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
        const rawSharesNum = parseCleanNumber(rawShares);
        const shares = Math.abs(rawSharesNum);
        const price = Math.abs(parseCleanNumber(rawPrice));
        const commission = Math.abs(parseCleanNumber(rawCommission));
        let amount = Math.abs(parseCleanNumber(rawAmount));

        let txType = mapTransactionType(rawType);
        if (!txType) {
            const rawLower = String(rawType || '').toLowerCase();
            const descLower = String(raw.description || raw.Description || '').toLowerCase();
            if (rawSharesNum < 0 || rawLower.includes('sell') || descLower.includes('sold')) {
                txType = 'Sell';
            } else if (rawSharesNum > 0 || rawLower.includes('buy') || descLower.includes('bought')) {
                txType = 'Buy';
            } else if (cleanTicker) {
                txType = 'Buy';
            } else {
                txType = 'Deposit';
            }
        }

        // Non-dilutive administrative corporate actions (e.g. spinoff, name change, code change)
        const isCorpAction = /corporate|reorgan|spin|change|listing/i.test(rawType || '') ||
                             /corporate|reorgan|spin|change|listing/i.test(raw.description || '');
        if (isCorpAction && !txType.includes('Split') && amount <= 0 && price <= 0) {
            // Administrative row, skip safely
            return {
                rowNumber: rowNum,
                raw,
                isValid: true,
                errors: [],
            };
        }

        const isCashOnly = txType === 'Deposit' || txType === 'Withdrawal' || txType === 'Interest' || txType === 'Fee';
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
                dateIso = todayDateIso;
            }
        }

        if (isCashOnly) {
            if (amount <= 0 && price > 0) {
                amount = price;
            }
            if (amount <= 0) {
                errors.push(`Please enter the ${txType.toLowerCase()} dollar amount in the Amount column`);
            }
        } else if (isDividend) {
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

    const brokerPreset = detectBrokerPreset(headers);
    let detectedAccountType: string | undefined;
    let detectedInstitution: string | undefined;

    // Detect Account Type & Institution
    if (brokerPreset === 'wealthsimple') {
        detectedInstitution = 'Wealthsimple';
        const rawType = rawRows[0]?.account_type || rawRows[0]?.['Account Type'] || '';
        if (/tfsa/i.test(rawType)) detectedAccountType = 'TFSA';
        else if (/rrsp/i.test(rawType)) detectedAccountType = 'RRSP';
        else if (/non[- ]?registered|personal/i.test(rawType)) detectedAccountType = 'Margin';
    } else if (brokerPreset === 'questrade') {
        detectedInstitution = 'Questrade';
        const rawType = rawRows[0]?.['Account Type'] || rawRows[0]?.account_type || '';
        if (/tfsa/i.test(rawType)) detectedAccountType = 'TFSA';
        else if (/rrsp/i.test(rawType)) detectedAccountType = 'RRSP';
        else if (/margin/i.test(rawType)) detectedAccountType = 'Margin';
    }

    const autoMapping = detectColumnMapping(headers);
    const mapping: ColumnMapping = { ...autoMapping, ...customMapping };
    const detectedMode = forcedMode || (brokerPreset !== 'generic' ? 'transactions' : detectImportMode(mapping));

    let validatedRows: ValidatedRow[] = [];
    const todayDateIso = new Date().toISOString().split('T')[0];

    const isManualMapping = Object.keys(customMapping || {}).length > 0;

    // If native broker preset detected and not forced into holdings mode
    if (brokerPreset === 'wealthsimple' && forcedMode !== 'holdings' && !isManualMapping) {
        validatedRows = rawRows
            .map((r, i) => parseWealthsimpleRow(r, i + 2, accountId, todayDateIso))
            .filter((r): r is ValidatedRow => r !== null);
    } else if (brokerPreset === 'questrade' && forcedMode !== 'holdings' && !isManualMapping) {
        validatedRows = rawRows
            .map((r, i) => parseQuestradeRow(r, i + 2, accountId, todayDateIso))
            .filter((r): r is ValidatedRow => r !== null);
    } else {
        validatedRows = validateAndTransformRows(rawRows, detectedMode, mapping, accountId, defaultCurrency, todayDateIso);
    }

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
        brokerPreset,
        detectedAccountType,
        detectedInstitution,
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
