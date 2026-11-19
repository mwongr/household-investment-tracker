export type PayoutFrequency = 'monthly' | 'quarterly' | 'semi-annual' | 'annual' | 'irregular';

export interface DividendMetadata {
    symbol: string;
    currency: string | null;
    forwardAnnualRate: number | null;
    trailingAnnualRate: number | null;
    trailingYield: number | null;
    forwardYield: number | null;
    exDividendDate: string | null;
    payDate: string | null;
    amountPerPayment: number | null;
    frequency: PayoutFrequency | null;
    isEstimated: boolean;
    source: 'yahoo' | 'yahoo-history' | 'transactions' | 'none';
    error?: string;
}

export interface DividendMetadataResponse {
    items: DividendMetadata[];
    fetchedAt: string;
}

export type TaxTreatment = 'withholding-lost' | 'treaty-exempt' | 'recoverable' | 'none';

export interface HoldingIncomeRow {
    assetId: string;
    ticker: string;
    name: string;
    accountId: string;
    accountName: string;
    accountType: string;
    currency: 'CAD' | 'USD';
    isUsListed: boolean;
    taxTreatment: TaxTreatment;
    shares: number;
    cadMarketValue: number;
    cadCostBasis: number;
    annualRatePerShare: number;
    projectedAnnualCad: number;
    shareOfTotalPct: number;
    currentYieldPct: number;
    yieldOnCostPct: number;
    frequency: PayoutFrequency | null;
    isEstimated: boolean;
    source: DividendMetadata['source'];
}

export interface AccountIncomeGroup {
    accountType: string;
    taxBucket: 'Tax-Free' | 'Retirement' | 'Non-Registered';
    projectedAnnualCad: number;
    ytdCad: number;
    shareOfTotalPct: number;
    holdingsCount: number;
    hasUsWithholdingWarning: boolean;
    hasTreatyExemptUs: boolean;
    usPayers: Array<{
        ticker: string;
        accountName: string;
        projectedAnnualCad: number;
        taxTreatment: TaxTreatment;
    }>;
}

export interface MonthlyPayoutPoint {
    monthIndex: number; // 0..11
    month: string;      // 'Jan'..'Dec'
    current: number;
    previous: number;
    currentCash: number;
    currentReinvested: number;
    previousCash: number;
    previousReinvested: number;
}

export interface AnnualPayoutPoint {
    year: string;
    total: number;
    cash: number;
    reinvested: number;
}

export interface UpcomingPayout {
    id: string;
    ticker: string;
    accountName: string;
    accountType: string;
    shares: number;
    exDividendDate: string | null;
    payDate: string | null;
    sortDate: string;
    nativeCurrency: 'CAD' | 'USD';
    estimatedNative: number;
    estimatedCad: number;
    isEstimated: boolean;
    frequency: PayoutFrequency | null;
}

export interface DividendKpis {
    ytdTotalCad: number;
    ytdCashCad: number;
    ytdReinvestedCad: number;
    projectedAnnualCad: number;
    averageMonthlyCad: number;
    portfolioYieldPct: number;
    yieldOnCostPct: number;
    estimatedHoldingsCount: number;
    payingHoldingsCount: number;
}
