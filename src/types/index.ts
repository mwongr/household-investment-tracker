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
  high52Week?: number; // Mock data for now
  low52Week?: number; // Mock data for now
  sparkline?: { price: number; date?: string }[];
  chartRange?: string; // e.g. '1mo', '3mo', '1y', '5y'
};

export type TransactionType = 'Buy' | 'Sell' | 'Deposit' | 'Withdrawal' | 'Dividend' | 'DRIP';

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
};
