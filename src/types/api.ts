import type {
    AcbAccount,
    AcbTransaction,
    Account,
    AnalysisData,
    Asset,
    BankAccount,
    Institution,
    Liability,
    Member,
    MonthlyExpense,
    NetWorthSnapshot,
    Transaction,
    UserPreferences,
    WatchlistItem,
} from './index';

export interface QuoteSparklinePoint {
    price: number;
    open: number;
    high: number;
    low: number;
    close: number;
    date: string;
}

export interface QuoteResponse {
    symbol: string;
    regularMarketPrice: number;
    regularMarketChangePercent?: number;
    fiftyTwoWeekHigh?: number;
    fiftyTwoWeekLow?: number;
    currency?: 'CAD' | 'USD' | string;
    volume?: number;
    sparkline?: QuoteSparklinePoint[];
    shortName?: string;
    source?: string;
    error?: string;
    isMock?: boolean;
}

export interface DetailedQuoteResponse {
    symbol: string;
    shortName?: string;
    price?: number;
    currency?: string;
    change?: number;
    changePercent?: number;
    dayHigh?: number;
    dayLow?: number;
    open?: number;
    prevClose?: number;
    bid?: number | null;
    ask?: number | null;
    volume?: number;
    avgVolume?: number | null;
    fiftyTwoWeekHigh?: number;
    fiftyTwoWeekLow?: number;
    marketCap?: number | null;
    peRatio?: number | null;
    error?: string;
}

export interface ExchangeRateResponse {
    rate: number;
}

export interface MigrateCurrencyResponse {
    success: boolean;
    transactions: Transaction[];
}

export interface HistoryPricesResponse {
    prices: Record<string, Array<{ date: string; close: number }>>;
}

export interface ScreenerQuote {
    symbol: string;
    shortName?: string;
    price?: number;
    change?: number;
    changePercent?: number;
}

export interface ScreenerResponse {
    title?: string;
    quotes: ScreenerQuote[];
}

export interface ServerStatePayload {
    members?: Member[];
    institutions?: Institution[];
    accountTypes?: string[];
    accounts?: Array<Account & { initialCashBalance?: number }>;
    transactions?: Transaction[];
    assets?: Asset[];
    netWorthHistory?: NetWorthSnapshot[];
    lastUpdated?: string | null;
    backupPath?: string;
    watchlist?: WatchlistItem[];
    watchlistLastUpdated?: string | null;
    acbAccounts?: AcbAccount[];
    acbTransactions?: AcbTransaction[];
    bankAccounts?: BankAccount[];
    liabilities?: Liability[];
    monthlyExpenses?: MonthlyExpense[];
    preferences?: UserPreferences;
    exchangeRate?: number;
    isDemoData?: boolean;
    savedAt?: string;
    allowDestructive?: boolean;
}

export type StockAnalysisResponse = AnalysisData;
