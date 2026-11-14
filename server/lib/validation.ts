import path from 'path';
import { z } from 'zod';
import { APP_ROOT } from '../config.js';

export const SymbolSchema = z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9.\-=^]{1,15}$/, 'Invalid ticker symbol');

export const RangeSchema = z.enum([
    '1d', '5d', '1mo', '3mo', '6mo', '1y', '2y', '5y', '10y', 'ytd', 'max',
]);

export const IsoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD date');

export const ScreenerTypeSchema = z
    .enum([
        'day_gainers',
        'day_losers',
        'most_actives',
        'most_shorted_stocks',
        'undervalued_growth_stocks',
        'growth_technology_stocks',
        'aggressive_small_caps',
    ])
    .default('most_actives');

export function isInsideDir(target: string, parent: string): boolean {
    const normTarget = path.resolve(target).toLowerCase();
    const normParent = path.resolve(parent).toLowerCase();
    if (normTarget === normParent) return true;
    const prefix = normParent.endsWith(path.sep) ? normParent : normParent + path.sep;
    return normTarget.startsWith(prefix);
}

/**
 * Validates and normalizes a user-configured backup directory path.
 * Blocks relative paths, UNC/device paths, system directories, and app-internal paths.
 */
export function sanitizeBackupDir(input: string, appRoot: string = APP_ROOT): string | null {
    const trimmed = input.trim();
    if (!trimmed) return null;
    if (trimmed.length > 260 || trimmed.includes('\0')) {
        throw new Error('Invalid backup path');
    }
    if (/^\\\\[?.]\\/.test(trimmed) || trimmed.startsWith('\\\\') || trimmed.startsWith('//')) {
        throw new Error('UNC and device paths are not allowed for backup');
    }
    if (!path.isAbsolute(trimmed)) {
        throw new Error('Backup path must be an absolute path');
    }
    const resolved = path.resolve(trimmed);
    const allowedAppBackups = path.join(appRoot, 'backups');
    if (isInsideDir(resolved, appRoot) && !isInsideDir(resolved, allowedAppBackups)) {
        throw new Error('Backup path cannot be inside the application directory');
    }
    const sysRoot = process.env.SystemRoot ?? 'C:\\Windows';
    if (isInsideDir(resolved, sysRoot)) {
        throw new Error('Backup path cannot be inside the Windows system directory');
    }
    return resolved;
}

const BackupPathSchema = z
    .string()
    .max(260)
    .refine(
        (val) => {
            if (!val.trim()) return true;
            try {
                sanitizeBackupDir(val);
                return true;
            } catch {
                return false;
            }
        },
        { message: 'Invalid or disallowed backupPath' }
    );

const MemberSchema = z.object({ id: z.string().min(1), name: z.string() });
const InstitutionSchema = z.object({ id: z.string().min(1), name: z.string() });

const AccountSchema = z.object({
    id: z.string().min(1),
    memberId: z.string(),
    institutionId: z.string(),
    type: z.string(),
    name: z.string(),
    cashBalance: z.number().finite(),
    targetPcts: z.record(z.string(), z.number().finite()).optional(),
    extraRows: z
        .array(z.object({ id: z.string(), ticker: z.string(), targetPct: z.number().finite() }))
        .optional(),
});

const SparklinePointSchema = z.object({
    price: z.number(),
    date: z.string().optional(),
    open: z.number().optional(),
    high: z.number().optional(),
    low: z.number().optional(),
    close: z.number().optional(),
});

const AssetSchema = z.object({
    id: z.string().min(1),
    accountId: z.string().min(1),
    ticker: z.string().min(1),
    name: z.string().optional(),
    quantity: z.number().finite(),
    averageCost: z.number().finite(),
    currentPrice: z.number().finite(),
    marketValue: z.number().finite(),
    totalCost: z.number().finite(),
    cadTotalCost: z.number().finite().optional(),
    customBookCost: z.number().finite().nullable().optional(),
    profit: z.number().finite(),
    profitPercent: z.number().finite(),
    todayChangePercent: z.number().finite(),
    todayChangeDollar: z.number().finite(),
    high52Week: z.number().finite().nullable().optional(),
    low52Week: z.number().finite().nullable().optional(),
    sparkline: z.array(SparklinePointSchema).optional(),
    chartRange: z.string().optional(),
    currency: z.enum(['CAD', 'USD']).optional(),
    cadMarketValue: z.number().finite(),
    signal: z.enum(['buy', 'sell', 'neutral']).optional(),
    rsi: z.number().finite().nullable().optional(),
    goldenCross: z.boolean().optional(),
    previousTicker: z.string().optional(),
});

const TransactionSchema = z.object({
    id: z.string().min(1),
    accountId: z.string().min(1),
    assetId: z.string().optional(),
    ticker: z.string().optional(),
    date: z.string().min(1),
    type: z.enum([
        'Buy',
        'Sell',
        'Deposit',
        'Withdrawal',
        'Dividend',
        'Dividend Income',
        'DRIP',
        'Dividend Reinvested',
        'Interest',
        'Fee',
        'Stock Split',
    ]),
    shares: z.number().finite().optional(),
    pricePerShare: z.number().finite().optional(),
    amount: z.number().finite(),
    commission: z.number().finite().optional(),
    currency: z.enum(['CAD', 'USD']).optional(),
    previousTicker: z.string().optional(),
    ignoreCashImpact: z.boolean().optional(),
    splitFrom: z.number().finite().optional(),
    splitTo: z.number().finite().optional(),
});

const NetWorthSnapshotSchema = z.object({
    date: z.string(),
    value: z.number().finite(),
});

const WatchlistItemSchema = z.object({
    id: z.string().min(1),
    ticker: z.string().min(1),
    name: z.string().optional(),
    price: z.number().finite().optional(),
    changePercent: z.number().finite().optional(),
    high52Week: z.number().finite().nullable().optional(),
    low52Week: z.number().finite().nullable().optional(),
    volume: z.number().finite().nullable().optional(),
    avgVolume: z.number().finite().nullable().optional(),
    sparkline: z.array(SparklinePointSchema).optional(),
    signal: z.enum(['buy', 'sell', 'neutral']).optional(),
    rsi: z.number().finite().nullable().optional(),
    goldenCross: z.boolean().optional(),
});

const AcbAccountSchema = z.object({ id: z.string().min(1), name: z.string() });
const AcbTransactionSchema = z.object({
    id: z.string().min(1),
    acbAccountId: z.string().min(1),
    sourceTransactionId: z.string().optional(),
    ticker: z.string().min(1),
    date: z.string(),
    type: z.enum([
        'Buy',
        'Sell',
        'Return of Capital',
        'Capital Gains Dividend',
        'Reinvested Dividend',
        'Reinvested Capital Gains Distribution',
        'Split',
    ]),
    memo: z.string().optional(),
    shares: z.number().finite().optional(),
    pricePerShare: z.number().finite().optional(),
    commission: z.number().finite().optional(),
    amount: z.number().finite().optional(),
    amountPerShare: z.boolean().optional(),
    reinvestedAmount: z.number().finite().optional(),
    reinvestedShares: z.number().finite().optional(),
    splitFrom: z.number().finite().optional(),
    splitTo: z.number().finite().optional(),
});

const BankAccountSchema = z.object({
    id: z.string().min(1),
    memberId: z.string(),
    name: z.string(),
    balance: z.number().finite(),
});

const LiabilitySchema = z.object({
    id: z.string().min(1),
    memberId: z.string(),
    name: z.string(),
    balance: z.number().finite(),
});

const MonthlyExpenseSchema = z.object({
    id: z.string().min(1),
    memberId: z.string(),
    name: z.string(),
    amount: z.number().finite(),
    category: z.string(),
});

const UserPreferencesSchema = z.object({
    enableNetWorth: z.boolean(),
    enableTaxOptimizer: z.boolean(),
    enableAcbTracker: z.boolean(),
});

export const SyncPayloadSchema = z
    .object({
        members: z.array(MemberSchema),
        institutions: z.array(InstitutionSchema),
        accountTypes: z.array(z.string()),
        accounts: z.array(AccountSchema),
        transactions: z.array(TransactionSchema),
        assets: z.array(AssetSchema),
        netWorthHistory: z.array(NetWorthSnapshotSchema),
        lastUpdated: z.string().nullable(),
        backupPath: BackupPathSchema,
        watchlist: z.array(WatchlistItemSchema),
        watchlistLastUpdated: z.string().nullable(),
        acbAccounts: z.array(AcbAccountSchema),
        acbTransactions: z.array(AcbTransactionSchema),
        bankAccounts: z.array(BankAccountSchema),
        liabilities: z.array(LiabilitySchema),
        monthlyExpenses: z.array(MonthlyExpenseSchema),
        preferences: UserPreferencesSchema,
        exchangeRate: z.number().finite().positive(),
        isDemoData: z.boolean(),
        savedAt: z.string().datetime().optional(),
        allowDestructive: z.boolean().optional(),
    })
    .strict();

export type SyncPayload = z.infer<typeof SyncPayloadSchema>;

export const MigrateCurrencySchema = z.object({
    originalTicker: SymbolSchema,
    newTicker: SymbolSchema,
    conversionDate: IsoDateSchema,
    newUsdCostBasis: z.coerce.number().finite().nonnegative(),
    shares: z.coerce.number().finite().positive(),
    accountId: z.string().trim().min(1),
    manualClosePrice: z
        .union([z.coerce.number().finite().positive(), z.literal(''), z.null(), z.undefined()])
        .optional()
        .transform((v) => (v === '' || v === null || v === undefined ? undefined : Number(v))),
});

export const EventsBodySchema = z.object({
    symbols: z.array(SymbolSchema).min(1).max(50),
});

export const HistoryPricesBodySchema = z.object({
    tickers: z.array(SymbolSchema).max(100),
    startDate: IsoDateSchema.optional(),
});

export const TaxScenarioBodySchema = z.object({
    annualIncome: z.coerce.number().finite().nonnegative(),
    quebecTaxableIncome: z.coerce.number().finite().nonnegative().optional(),
    rrspContribution: z.coerce.number().finite().nonnegative(),
    totalRefund: z.coerce.number().finite(),
    craRefund: z.coerce.number().finite().nullable().optional(),
    rqRefund: z.coerce.number().finite().nullable().optional(),
    effectiveRate: z.coerce.number().finite(),
    isSpousal: z.boolean().optional(),
    attributionDate: z.string().nullable().optional(),
});

const TaxBracketSchema = z.object({
    minIncome: z.number().finite().nonnegative(),
    maxIncome: z.number().nullable(),
    rate: z.number().finite().min(0).max(1),
});

export const TaxSettingsBodySchema = z.object({
    federalBrackets: z.array(TaxBracketSchema).min(1),
    provincialBrackets: z.array(TaxBracketSchema).min(1),
    abatement: z.number().finite().min(0).max(1),
    applyAbatement: z.boolean().optional(),
});
