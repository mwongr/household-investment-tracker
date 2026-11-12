import type {
    Member, Institution, Account, Asset, Transaction, NetWorthSnapshot, WatchlistItem,
    AcbAccount, AcbTransaction, BankAccount, Liability, MonthlyExpense
} from '../types';

export interface DemoDataSet {
    members: Member[];
    institutions: Institution[];
    accounts: Account[];
    assets: Asset[];
    transactions: Transaction[];
    netWorthHistory: NetWorthSnapshot[];
    watchlist: WatchlistItem[];
    bankAccounts: BankAccount[];
    liabilities: Liability[];
    monthlyExpenses: MonthlyExpense[];
    acbAccounts: AcbAccount[];
    acbTransactions: AcbTransaction[];
}

export function getDemoData(exchangeRate: number = 1.38): DemoDataSet {
    const members: Member[] = [
        { id: 'demo-member-1', name: 'Alex Miller' },
        { id: 'demo-member-2', name: 'Sarah Miller' }
    ];

    const institutions: Institution[] = [
        { id: 'demo-inst-1', name: 'Wealthsimple' },
        { id: 'demo-inst-2', name: 'Questrade' },
        { id: 'demo-inst-3', name: 'TD Direct Investing' }
    ];

    const accounts: Account[] = [
        {
            id: 'demo-acc-1',
            memberId: 'demo-member-1',
            institutionId: 'demo-inst-1',
            type: 'TFSA',
            name: 'Alex TFSA (WS)',
            cashBalance: 3850.00,
            targetPcts: {
                'demo-asset-1': 50,
                'demo-asset-2': 30,
                'demo-asset-3': 20
            }
        },
        {
            id: 'demo-acc-2',
            memberId: 'demo-member-1',
            institutionId: 'demo-inst-2',
            type: 'RRSP',
            name: 'Alex RRSP (QT)',
            cashBalance: 4200.00,
            targetPcts: {
                'demo-asset-4': 40,
                'demo-asset-5': 35,
                'demo-asset-6': 25
            }
        },
        {
            id: 'demo-acc-3',
            memberId: 'demo-member-2',
            institutionId: 'demo-inst-1',
            type: 'TFSA',
            name: 'Sarah TFSA (WS)',
            cashBalance: 2150.00,
            targetPcts: {
                'demo-asset-7': 60,
                'demo-asset-8': 40
            }
        },
        {
            id: 'demo-acc-4',
            memberId: 'demo-member-1',
            institutionId: 'demo-inst-3',
            type: 'Margin',
            name: 'Joint Taxable Margin (TD)',
            cashBalance: 5300.00,
            targetPcts: {
                'demo-asset-9': 50,
                'demo-asset-10': 50
            }
        }
    ];

    const transactions: Transaction[] = [
        // ─── 2024 TRANSACTIONS ───
        // Alex TFSA (demo-acc-1)
        {
            id: 'tx-1',
            accountId: 'demo-acc-1',
            type: 'Deposit',
            amount: 12000.00,
            date: '2024-01-10T09:00:00.000Z',
            currency: 'CAD'
        },
        {
            id: 'tx-2',
            accountId: 'demo-acc-1',
            ticker: 'XEQT.TO',
            type: 'Buy',
            shares: 150,
            pricePerShare: 28.50,
            amount: 4275.00,
            commission: 0,
            date: '2024-01-12T10:30:00.000Z',
            currency: 'CAD'
        },
        {
            id: 'tx-3',
            accountId: 'demo-acc-1',
            ticker: 'VFV.TO',
            type: 'Buy',
            shares: 40,
            pricePerShare: 118.25,
            amount: 4730.00,
            commission: 0,
            date: '2024-02-05T11:00:00.000Z',
            currency: 'CAD'
        },
        {
            id: 'tx-4',
            accountId: 'demo-acc-1',
            ticker: 'XEQT.TO',
            type: 'Dividend',
            amount: 68.50,
            date: '2024-03-31T16:00:00.000Z',
            currency: 'CAD'
        },
        {
            id: 'tx-5',
            accountId: 'demo-acc-1',
            ticker: 'XEQT.TO',
            type: 'DRIP',
            shares: 2,
            pricePerShare: 29.10,
            amount: 58.20,
            commission: 0,
            date: '2024-04-15T10:00:00.000Z',
            currency: 'CAD'
        },
        {
            id: 'tx-6',
            accountId: 'demo-acc-1',
            ticker: 'AAPL',
            type: 'Buy',
            shares: 15,
            pricePerShare: 185.00,
            amount: 2775.00,
            commission: 0,
            date: '2024-06-15T14:30:00.000Z',
            currency: 'USD'
        },
        {
            id: 'tx-7',
            accountId: 'demo-acc-1',
            ticker: 'VFV.TO',
            type: 'Dividend',
            amount: 35.20,
            date: '2024-09-15T16:00:00.000Z',
            currency: 'CAD'
        },
        {
            id: 'tx-8',
            accountId: 'demo-acc-1',
            type: 'Deposit',
            amount: 1500.00,
            date: '2024-12-15T09:00:00.000Z',
            currency: 'CAD'
        },

        // Alex RRSP (demo-acc-2)
        {
            id: 'tx-9',
            accountId: 'demo-acc-2',
            type: 'Deposit',
            amount: 15000.00,
            date: '2024-01-15T09:00:00.000Z',
            currency: 'CAD'
        },
        {
            id: 'tx-10',
            accountId: 'demo-acc-2',
            ticker: 'MSFT',
            type: 'Buy',
            shares: 12,
            pricePerShare: 405.00,
            amount: 4864.95,
            commission: 4.95,
            date: '2024-01-20T10:15:00.000Z',
            currency: 'USD'
        },
        {
            id: 'tx-11',
            accountId: 'demo-acc-2',
            ticker: 'XEI.TO',
            type: 'Buy',
            shares: 100,
            pricePerShare: 25.80,
            amount: 2580.00,
            commission: 0,
            date: '2024-02-18T11:45:00.000Z',
            currency: 'CAD'
        },
        {
            id: 'tx-12',
            accountId: 'demo-acc-2',
            ticker: 'AMZN',
            type: 'Buy',
            shares: 10,
            pricePerShare: 172.00,
            amount: 1724.95,
            commission: 4.95,
            date: '2024-05-10T13:00:00.000Z',
            currency: 'USD'
        },
        {
            id: 'tx-13',
            accountId: 'demo-acc-2',
            ticker: 'XEI.TO',
            type: 'Dividend',
            amount: 48.00,
            date: '2024-11-20T16:00:00.000Z',
            currency: 'CAD'
        },

        // Sarah TFSA (demo-acc-3)
        {
            id: 'tx-14',
            accountId: 'demo-acc-3',
            type: 'Deposit',
            amount: 8000.00,
            date: '2024-01-20T09:00:00.000Z',
            currency: 'CAD'
        },
        {
            id: 'tx-15',
            accountId: 'demo-acc-3',
            ticker: 'VDY.TO',
            type: 'Buy',
            shares: 80,
            pricePerShare: 44.50,
            amount: 3560.00,
            commission: 0,
            date: '2024-01-25T10:00:00.000Z',
            currency: 'CAD'
        },
        {
            id: 'tx-16',
            accountId: 'demo-acc-3',
            ticker: 'GOOGL',
            type: 'Buy',
            shares: 15,
            pricePerShare: 168.00,
            amount: 2520.00,
            commission: 0,
            date: '2024-03-15T15:00:00.000Z',
            currency: 'USD'
        },
        {
            id: 'tx-17',
            accountId: 'demo-acc-3',
            ticker: 'VDY.TO',
            type: 'Buy',
            shares: 20,
            pricePerShare: 45.20,
            amount: 904.00,
            commission: 0,
            date: '2024-10-10T11:00:00.000Z',
            currency: 'CAD'
        },

        // Joint Margin (demo-acc-4)
        {
            id: 'tx-18',
            accountId: 'demo-acc-4',
            type: 'Deposit',
            amount: 15000.00,
            date: '2024-02-01T09:00:00.000Z',
            currency: 'CAD'
        },
        {
            id: 'tx-19',
            accountId: 'demo-acc-4',
            ticker: 'TD.TO',
            type: 'Buy',
            shares: 60,
            pricePerShare: 81.50,
            amount: 4899.99,
            commission: 9.99,
            date: '2024-02-10T11:00:00.000Z',
            currency: 'CAD'
        },
        {
            id: 'tx-20',
            accountId: 'demo-acc-4',
            ticker: 'CSU.TO',
            type: 'Buy',
            shares: 1,
            pricePerShare: 3650.00,
            amount: 3659.99,
            commission: 9.99,
            date: '2024-03-01T14:00:00.000Z',
            currency: 'CAD'
        },

        // ─── 2025 TRANSACTIONS ───
        // Alex TFSA (demo-acc-1)
        {
            id: 'tx-21',
            accountId: 'demo-acc-1',
            type: 'Deposit',
            amount: 3000.00,
            date: '2025-01-15T09:00:00.000Z',
            currency: 'CAD'
        },
        {
            id: 'tx-22',
            accountId: 'demo-acc-1',
            ticker: 'XEQT.TO',
            type: 'Buy',
            shares: 50,
            pricePerShare: 30.20,
            amount: 1510.00,
            commission: 0,
            date: '2025-01-16T10:15:00.000Z',
            currency: 'CAD'
        },
        {
            id: 'tx-23',
            accountId: 'demo-acc-1',
            ticker: 'XEQT.TO',
            type: 'Dividend',
            amount: 82.00,
            date: '2025-03-31T16:00:00.000Z',
            currency: 'CAD'
        },
        {
            id: 'tx-24',
            accountId: 'demo-acc-1',
            ticker: 'XEQT.TO',
            type: 'DRIP',
            shares: 2,
            pricePerShare: 30.80,
            amount: 61.60,
            commission: 0,
            date: '2025-04-15T10:00:00.000Z',
            currency: 'CAD'
        },
        {
            id: 'tx-25',
            accountId: 'demo-acc-1',
            ticker: 'VFV.TO',
            type: 'Dividend',
            amount: 42.50,
            date: '2025-09-30T16:00:00.000Z',
            currency: 'CAD'
        },

        // Alex RRSP (demo-acc-2)
        {
            id: 'tx-26',
            accountId: 'demo-acc-2',
            type: 'Deposit',
            amount: 4000.00,
            date: '2025-05-20T09:00:00.000Z',
            currency: 'CAD'
        },
        {
            id: 'tx-27',
            accountId: 'demo-acc-2',
            ticker: 'MSFT',
            type: 'Buy',
            shares: 5,
            pricePerShare: 418.00,
            amount: 2094.95,
            commission: 4.95,
            date: '2025-05-25T11:30:00.000Z',
            currency: 'USD'
        },

        // Sarah TFSA (demo-acc-3)
        {
            id: 'tx-28',
            accountId: 'demo-acc-3',
            type: 'Deposit',
            amount: 3000.00,
            date: '2025-02-10T09:00:00.000Z',
            currency: 'CAD'
        },
        {
            id: 'tx-29',
            accountId: 'demo-acc-3',
            ticker: 'VDY.TO',
            type: 'Buy',
            shares: 30,
            pricePerShare: 46.00,
            amount: 1380.00,
            commission: 0,
            date: '2025-02-12T10:30:00.000Z',
            currency: 'CAD'
        },
        {
            id: 'tx-30',
            accountId: 'demo-acc-3',
            ticker: 'GOOGL',
            type: 'Buy',
            shares: 5,
            pricePerShare: 174.00,
            amount: 870.00,
            commission: 0,
            date: '2025-11-10T14:00:00.000Z',
            currency: 'USD'
        },

        // Joint Margin (demo-acc-4)
        {
            id: 'tx-31',
            accountId: 'demo-acc-4',
            ticker: 'TD.TO',
            type: 'Dividend',
            amount: 61.20,
            date: '2025-07-15T16:00:00.000Z',
            currency: 'CAD'
        },

        // ─── 2026 TRANSACTIONS ───
        // Alex TFSA (demo-acc-1)
        {
            id: 'tx-32',
            accountId: 'demo-acc-1',
            type: 'Deposit',
            amount: 3500.00,
            date: '2026-01-15T09:00:00.000Z',
            currency: 'CAD'
        },
        {
            id: 'tx-33',
            accountId: 'demo-acc-1',
            ticker: 'VFV.TO',
            type: 'Buy',
            shares: 15,
            pricePerShare: 138.50,
            amount: 2077.50,
            commission: 0,
            date: '2026-01-20T10:45:00.000Z',
            currency: 'CAD'
        },
        {
            id: 'tx-34',
            accountId: 'demo-acc-1',
            ticker: 'XEQT.TO',
            type: 'Dividend',
            amount: 95.00,
            date: '2026-03-31T16:00:00.000Z',
            currency: 'CAD'
        },
        {
            id: 'tx-35',
            accountId: 'demo-acc-1',
            ticker: 'VFV.TO',
            type: 'Dividend',
            amount: 46.80,
            date: '2026-08-10T16:00:00.000Z',
            currency: 'CAD'
        },

        // Alex RRSP (demo-acc-2)
        {
            id: 'tx-36',
            accountId: 'demo-acc-2',
            type: 'Deposit',
            amount: 2500.00,
            date: '2026-05-15T09:00:00.000Z',
            currency: 'CAD'
        },

        // Sarah TFSA (demo-acc-3)
        {
            id: 'tx-37',
            accountId: 'demo-acc-3',
            type: 'Deposit',
            amount: 3500.00,
            date: '2026-02-10T09:00:00.000Z',
            currency: 'CAD'
        },
        {
            id: 'tx-38',
            accountId: 'demo-acc-3',
            ticker: 'VDY.TO',
            type: 'Dividend',
            amount: 52.40,
            date: '2026-10-15T16:00:00.000Z',
            currency: 'CAD'
        },

        // Joint Margin (demo-acc-4)
        {
            id: 'tx-39',
            accountId: 'demo-acc-4',
            ticker: 'TD.TO',
            type: 'Buy',
            shares: 15,
            pricePerShare: 80.20,
            amount: 1212.99,
            commission: 9.99,
            date: '2026-06-20T11:00:00.000Z',
            currency: 'CAD'
        }
    ];

    const assets: Asset[] = [
        {
            id: 'demo-asset-1',
            accountId: 'demo-acc-1',
            ticker: 'XEQT.TO',
            name: 'iShares Core Equity ETF Portfolio',
            quantity: 204,
            averageCost: 28.95,
            currentPrice: 33.40,
            totalCost: 5904.80,
            marketValue: 6813.60,
            cadMarketValue: 6813.60,
            profit: 908.80,
            profitPercent: 15.39,
            todayChangePercent: 0.42,
            todayChangeDollar: 28.60,
            currency: 'CAD',
            sparkline: [
                { price: 31.8 }, { price: 32.1 }, { price: 32.5 }, { price: 32.9 }, { price: 33.4 }
            ]
        },
        {
            id: 'demo-asset-2',
            accountId: 'demo-acc-1',
            ticker: 'VFV.TO',
            name: 'Vanguard S&P 500 Index ETF',
            quantity: 55,
            averageCost: 123.77,
            currentPrice: 144.10,
            totalCost: 6807.50,
            marketValue: 7925.50,
            cadMarketValue: 7925.50,
            profit: 1118.00,
            profitPercent: 16.42,
            todayChangePercent: 0.85,
            todayChangeDollar: 67.10,
            currency: 'CAD',
            sparkline: [
                { price: 138.0 }, { price: 139.5 }, { price: 141.2 }, { price: 142.8 }, { price: 144.1 }
            ]
        },
        {
            id: 'demo-asset-3',
            accountId: 'demo-acc-1',
            ticker: 'AAPL',
            name: 'Apple Inc.',
            quantity: 15,
            averageCost: 185.00,
            currentPrice: 228.00,
            totalCost: 2775.00,
            marketValue: 3420.00,
            cadMarketValue: 3420.00 * exchangeRate,
            profit: 645.00,
            profitPercent: 23.24,
            todayChangePercent: 1.15,
            todayChangeDollar: 39.30,
            currency: 'USD',
            sparkline: [
                { price: 216.0 }, { price: 220.5 }, { price: 224.0 }, { price: 225.8 }, { price: 228.0 }
            ]
        },
        {
            id: 'demo-asset-4',
            accountId: 'demo-acc-2',
            ticker: 'MSFT',
            name: 'Microsoft Corporation',
            quantity: 17,
            averageCost: 408.82,
            currentPrice: 432.50,
            totalCost: 6950.00,
            marketValue: 7352.50,
            cadMarketValue: 7352.50 * exchangeRate,
            profit: 402.50,
            profitPercent: 5.79,
            todayChangePercent: -0.35,
            todayChangeDollar: -25.70,
            currency: 'USD',
            sparkline: [
                { price: 420.0 }, { price: 425.0 }, { price: 435.0 }, { price: 430.0 }, { price: 432.5 }
            ]
        },
        {
            id: 'demo-asset-5',
            accountId: 'demo-acc-2',
            ticker: 'XEI.TO',
            name: 'iShares S&P/TSX Composite High Dividend',
            quantity: 100,
            averageCost: 25.80,
            currentPrice: 27.60,
            totalCost: 2580.00,
            marketValue: 2760.00,
            cadMarketValue: 2760.00,
            profit: 180.00,
            profitPercent: 6.98,
            todayChangePercent: 0.18,
            todayChangeDollar: 5.00,
            currency: 'CAD',
            sparkline: [
                { price: 26.5 }, { price: 26.9 }, { price: 27.2 }, { price: 27.4 }, { price: 27.6 }
            ]
        },
        {
            id: 'demo-asset-6',
            accountId: 'demo-acc-2',
            ticker: 'AMZN',
            name: 'Amazon.com Inc.',
            quantity: 10,
            averageCost: 172.00,
            currentPrice: 209.00,
            totalCost: 1720.00,
            marketValue: 2090.00,
            cadMarketValue: 2090.00 * exchangeRate,
            profit: 370.00,
            profitPercent: 21.51,
            todayChangePercent: 1.45,
            todayChangeDollar: 30.30,
            currency: 'USD',
            sparkline: [
                { price: 195.0 }, { price: 198.0 }, { price: 202.0 }, { price: 206.0 }, { price: 209.0 }
            ]
        },
        {
            id: 'demo-asset-7',
            accountId: 'demo-acc-3',
            ticker: 'VDY.TO',
            name: 'Vanguard Canadian High Dividend Yield ETF',
            quantity: 130,
            averageCost: 44.95,
            currentPrice: 49.20,
            totalCost: 5844.00,
            marketValue: 6396.00,
            cadMarketValue: 6396.00,
            profit: 552.00,
            profitPercent: 9.45,
            todayChangePercent: 0.30,
            todayChangeDollar: 19.10,
            currency: 'CAD',
            sparkline: [
                { price: 47.0 }, { price: 47.8 }, { price: 48.4 }, { price: 48.9 }, { price: 49.2 }
            ]
        },
        {
            id: 'demo-asset-8',
            accountId: 'demo-acc-3',
            ticker: 'GOOGL',
            name: 'Alphabet Inc. Class A',
            quantity: 20,
            averageCost: 169.50,
            currentPrice: 183.40,
            totalCost: 3390.00,
            marketValue: 3668.00,
            cadMarketValue: 3668.00 * exchangeRate,
            profit: 278.00,
            profitPercent: 8.20,
            todayChangePercent: -0.62,
            todayChangeDollar: -22.80,
            currency: 'USD',
            sparkline: [
                { price: 175.0 }, { price: 178.0 }, { price: 181.0 }, { price: 184.0 }, { price: 183.4 }
            ]
        },
        {
            id: 'demo-asset-9',
            accountId: 'demo-acc-4',
            ticker: 'TD.TO',
            name: 'Toronto-Dominion Bank',
            quantity: 75,
            averageCost: 81.24,
            currentPrice: 79.80,
            totalCost: 6093.00,
            marketValue: 5985.00,
            cadMarketValue: 5985.00,
            profit: -108.00,
            profitPercent: -1.77,
            todayChangePercent: -0.25,
            todayChangeDollar: -15.00,
            currency: 'CAD',
            sparkline: [
                { price: 82.0 }, { price: 81.2 }, { price: 80.5 }, { price: 79.5 }, { price: 79.8 }
            ]
        },
        {
            id: 'demo-asset-10',
            accountId: 'demo-acc-4',
            ticker: 'CSU.TO',
            name: 'Constellation Software Inc.',
            quantity: 1,
            averageCost: 3650.00,
            currentPrice: 4420.00,
            totalCost: 3650.00,
            marketValue: 4420.00,
            cadMarketValue: 4420.00,
            profit: 770.00,
            profitPercent: 21.10,
            todayChangePercent: 0.92,
            todayChangeDollar: 40.25,
            currency: 'CAD',
            sparkline: [
                { price: 4100.0 }, { price: 4220.0 }, { price: 4310.0 }, { price: 4380.0 }, { price: 4420.0 }
            ]
        }
    ];

    const watchlist: WatchlistItem[] = [
        {
            id: 'NVDA',
            ticker: 'NVDA',
            name: 'NVIDIA Corporation',
            price: 145.20,
            changePercent: 2.35,
            high52Week: 149.77,
            low52Week: 45.12,
            volume: 48200000,
            avgVolume: 52000000
        },
        {
            id: 'ENB.TO',
            ticker: 'ENB.TO',
            name: 'Enbridge Inc.',
            price: 54.80,
            changePercent: 0.55,
            high52Week: 56.40,
            low52Week: 43.20,
            volume: 6200000,
            avgVolume: 7100000
        },
        {
            id: 'SHOP.TO',
            ticker: 'SHOP.TO',
            name: 'Shopify Inc.',
            price: 112.50,
            changePercent: -1.20,
            high52Week: 124.00,
            low52Week: 68.50,
            volume: 1800000,
            avgVolume: 2200000
        },
        {
            id: 'COST',
            ticker: 'COST',
            name: 'Costco Wholesale Corp.',
            price: 915.00,
            changePercent: 0.78,
            high52Week: 940.00,
            low52Week: 560.00,
            volume: 1400000,
            avgVolume: 1600000
        }
    ];

    const bankAccounts: BankAccount[] = [
        {
            id: 'bank-1',
            memberId: 'demo-member-1',
            name: 'High-Interest Savings (EQ Bank)',
            balance: 14500.00
        },
        {
            id: 'bank-2',
            memberId: 'joint',
            name: 'Everyday Chequing (TD)',
            balance: 4200.00
        }
    ];

    const liabilities: Liability[] = [
        {
            id: 'liab-1',
            memberId: 'joint',
            name: 'Primary Home Mortgage (5-yr Fixed)',
            balance: 295000.00
        },
        {
            id: 'liab-2',
            memberId: 'demo-member-1',
            name: 'Vehicle Financing',
            balance: 8500.00
        }
    ];

    const monthlyExpenses: MonthlyExpense[] = [
        {
            id: 'exp-1',
            memberId: 'joint',
            name: 'Mortgage Principal & Interest',
            amount: 2150.00,
            category: 'Housing'
        },
        {
            id: 'exp-2',
            memberId: 'joint',
            name: 'Groceries & Household Supplies',
            amount: 850.00,
            category: 'Food'
        },
        {
            id: 'exp-3',
            memberId: 'joint',
            name: 'Utilities & Internet',
            amount: 295.00,
            category: 'Utilities'
        },
        {
            id: 'exp-4',
            memberId: 'demo-member-1',
            name: 'Car Insurance',
            amount: 185.00,
            category: 'Transportation'
        }
    ];

    const netWorthHistory: NetWorthSnapshot[] = [
        { date: '2024-06-01', value: -198000 },
        { date: '2024-12-01', value: -188000 },
        { date: '2025-06-01', value: -176000 },
        { date: '2025-12-01', value: -162000 },
        { date: '2026-06-01', value: -148000 },
        { date: '2026-11-01', value: -135000 }
    ];

    const acbAccounts: AcbAccount[] = [
        {
            id: 'acb-acc-1',
            name: 'TD Non-Registered Taxable'
        }
    ];

    const acbTransactions: AcbTransaction[] = [
        {
            id: 'acb-tx-1',
            acbAccountId: 'acb-acc-1',
            ticker: 'TD.TO',
            date: '2024-02-10',
            type: 'Buy',
            shares: 60,
            pricePerShare: 81.50,
            commission: 9.99,
            memo: 'Initial taxable buy'
        },
        {
            id: 'acb-tx-2',
            acbAccountId: 'acb-acc-1',
            ticker: 'CSU.TO',
            date: '2024-03-01',
            type: 'Buy',
            shares: 1,
            pricePerShare: 3650.00,
            commission: 9.99,
            memo: 'Tech blue chip addition'
        },
        {
            id: 'acb-tx-3',
            acbAccountId: 'acb-acc-1',
            ticker: 'TD.TO',
            date: '2025-07-15',
            type: 'Return of Capital',
            amount: 45.00,
            memo: 'Annual tax adjustment'
        },
        {
            id: 'acb-tx-4',
            acbAccountId: 'acb-acc-1',
            ticker: 'TD.TO',
            date: '2026-06-20',
            type: 'Buy',
            shares: 15,
            pricePerShare: 80.20,
            commission: 9.99,
            memo: 'Dip purchase'
        }
    ];

    return {
        members,
        institutions,
        accounts,
        assets,
        transactions,
        netWorthHistory,
        watchlist,
        bankAccounts,
        liabilities,
        monthlyExpenses,
        acbAccounts,
        acbTransactions
    };
}
