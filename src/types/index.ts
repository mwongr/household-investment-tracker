export type Member = {
  id: string;
  name: string;
};

export type Institution = {
  id: string;
  name: string;
};

export type AccountType = 'TFSA' | 'RRSP' | 'Margin' | 'Cash' | 'Crypto' | 'Other';

export type Account = {
  id: string;
  memberId: string;
  institutionId: string;
  type: AccountType;
  name: string;
  cashBalance: number;
  // We might calculate "available cash" by taking initial + deposits - withdrawals - net_purchases + net_sales
  // For simplicity MVP, let's track a current "cashBalance" or just use initial and derive.
  // Let's store availableCash as a derived or tracked field. For now, user requested "Initial Cash Balance". 
  // We'll treat cash as a special asset or just a field.
};

export type AssetType = 'Stock' | 'ETF' | 'Crypto' | 'Cash' | 'Other';

export type Asset = {
  id: string;
  accountId: string;
  ticker: string; // e.g., AAPL, BTC
  name?: string; // e.g., Apple Inc.
  // Calculated fields (not always stored, but useful for UI)
  quantity: number;
  averageCost: number;
  currentPrice: number;
  marketValue: number;
  totalCost: number;
  customBookCost?: number; // Manual override for book cost
  profit: number; // $
  profitPercent: number; // %
  todayChangePercent: number;
  todayChangeDollar: number;
  high52Week?: number; // Mock data for now
  low52Week?: number; // Mock data for now
  sparkline?: { price: number; date?: string }[];
  chartRange?: string; // e.g. '1mo', '3mo', '1y', '5y'
};

export type TransactionType = 'Buy' | 'Sell' | 'Deposit' | 'Withdrawal' | 'Dividend' | 'Dividend Income' | 'DRIP' | 'Dividend Reinvested' | 'Stock Split';

export type Transaction = {
  id: string;
  accountId: string;
  assetId?: string; // If null, it's a pure cash transaction (deposit/withdraw)
  ticker?: string; // Redundant but useful history
  date: string; // ISO date
  type: TransactionType;
  shares?: number; // For buy/sell
  pricePerShare?: number; // For buy/sell
  amount: number; // Total value of transaction (shares * price + comms)
  commission: number;
};

export type NetWorthSnapshot = {
  date: string; // YYYY-MM-DD
  value: number;
};

export type WatchlistItem = {
  id: string; // Ticker symbol can be the ID, or uuid
  ticker: string;
  name?: string;
  price: number;
  changePercent: number;
  high52Week: number;
  low52Week: number;
  volume: number;
  avgVolume: number;
  sparkline?: { price: number; date?: string }[];
  signal?: TaSignal;
  rsi?: number | null;
  goldenCross?: boolean;
};

// --- ACB Tracking Types ---

export type AcbTransactionType =
  | 'Buy'
  | 'Sell'
  | 'Return of Capital'
  | 'Capital Gains Dividend'
  | 'Reinvested Dividend'
  | 'Reinvested Capital Gains Distribution'
  | 'Split';

export type AcbAccount = {
  id: string;
  name: string;
};

export type AcbTransaction = {
  id: string;
  acbAccountId: string;
  ticker: string;
  date: string;
  type: AcbTransactionType;
  memo?: string;

  // Buy / Sell
  shares?: number;
  pricePerShare?: number;
  commission?: number;

  // Return of Capital / Capital Gains Dividend (total amount)
  amount?: number;

  // Capital Gains Dividend (alternative by share)
  amountPerShare?: boolean;

  // Reinvested Dividend / Reinvested Capital Gains Distribution
  reinvestedAmount?: number;
  reinvestedShares?: number;

  // Split
  splitFrom?: number;
  splitTo?: number;
};

// --- Net Worth Tracking Types ---

export type BankAccount = {
  id: string;
  memberId: string | 'joint'; // 'joint' or specific member ID
  name: string;
  balance: number;
};

export type Liability = {
  id: string;
  memberId: string | 'joint';
  name: string;
  balance: number;
};

export type MonthlyExpense = {
  id: string;
  memberId: string | 'joint';
  name: string;
  amount: number;
  category: string;
};

// --- Technical Analysis Types ---

export interface OhlcvBar {
  time: number; // Unix timestamp
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface EmaSeries {
  time: number;
  ema50: number | null;
  ema200: number | null;
}

export interface MacdResult {
  MACD: number | null;
  signal: number | null;
  histogram: number | null;
}

export interface TaIndicators {
  ema50: number | null;
  ema200: number | null;
  rsi: number | null;
  macd: MacdResult;
  goldenCross: boolean;
}

export type TaSignal = 'buy' | 'sell' | 'neutral';

export interface AnalysisData {
  ticker: string;
  currentPrice: number;
  currency: string;
  indicators: TaIndicators;
  signal: TaSignal;
  priceTargets: PriceTargets;
  ohlcv: OhlcvBar[];
  emaSeries: EmaSeries[];
  fetchedAt: string;
}

export interface PriceTargets {
  bollingerUpper: number | null;
  bollingerMiddle: number | null;
  suggestedBuyPrice: number | null;   // Lower Bollinger Band
  suggestedSellPrice: number | null;  // Upper Bollinger Band
  high52w: number | null;
  low52w: number | null;
  fibEntry: number | null;            // 61.8% Fibonacci retracement entry
}

// --- Tax Bracket Optimizer Types ---

export interface TaxBracket {
  minIncome: number;    // Lower bound of this bracket (inclusive)
  maxIncome: number;    // Upper bound of this bracket (exclusive; use Infinity for the top bracket)
  rate: number;         // Marginal rate as a decimal (e.g. 0.26 for 26%)
}

export interface LayerCakeSegment {
  label: string;            // e.g. "$55,868 – $111,733"
  amount: number;           // Dollar amount of income in this layer
  federalRate: number;      // Effective federal rate (after abatement)
  provincialRate: number;
  combinedRate: number;     // effectiveFederal + provincial
  isShielded: boolean;      // Whether the RRSP contribution covers this layer
  partialShield: number;    // 0–1 fraction of layer covered by RRSP shield
}

export interface OptimizationResult {
  federalTaxableIncome: number;         // Input: federal taxable income
  quebecTaxableIncome: number;          // Input: Quebec taxable income (may differ)
  taxableIncome: number;                // New federal taxable after RRSP
  totalRefund: number;
  craRefund: number;                    // Federal portion of refund (CRA)
  rqRefund: number;                     // Provincial portion of refund (Revenu Québec)
  effectiveTaxSavingsPercentage: number;
  remainingRoomInCurrentBracket: number;
  currentCombinedRate: number;          // Rate BEFORE RRSP
  newCombinedRate: number;              // Rate AFTER RRSP
  sweetSpotContribution: number;
  layers: LayerCakeSegment[];
  diminishingReturns: boolean;          // Rate after RRSP < 30%
  bracketCrossed: boolean;              // Contribution crossed a bracket boundary
}

export interface TaxScenario {
  id: string;
  savedAt: string;
  annualIncome: number;                 // federalTaxableIncome
  quebecTaxableIncome?: number;
  rrspContribution: number;
  totalRefund: number;
  craRefund?: number;
  rqRefund?: number;
  effectiveRate: number;
  isSpousal: boolean;
  attributionDate?: string;             // ISO — contribution date for 3-yr rule tracking
  notes?: string;
}

export interface TaxSettings {
  federalBrackets: TaxBracket[];
  provincialBrackets: TaxBracket[];
  abatement: number;
}

// ─── Stock Comparison Tool ────────────────────────────────────────────────────

export type CompareRange = '1mo' | '6mo' | '1y' | '5y' | 'ytd';

export interface CompareSymbolSummary {
  currentPrice: number;    // Latest raw price
  firstPrice: number;      // Price at start of comparison period
  totalReturn: number;     // % return for the period (dividend-adjusted)
}

export interface CompareApiResponse {
  dates:     string[];                                // 'YYYY-MM-DD' aligned trading dates
  series:    Record<string, (number | null)[]>;       // symbol → normalized % values
  summary:   Record<string, CompareSymbolSummary>;    // symbol → summary row
  errors:    Record<string, string>;                  // symbol → error message (if any)
  range:     CompareRange;
  fetchedAt: string;
}
