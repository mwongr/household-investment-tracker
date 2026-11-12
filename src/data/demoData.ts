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
        { id: 'demo-member-1', name: 'Alex Chen' },
        { id: 'demo-member-2', name: 'Jordan Chen' }
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
            cashBalance: 1450.00,
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
            cashBalance: 3200.00,
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
            name: 'Jordan TFSA (WS)',
            cashBalance: 980.00,
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
            cashBalance: 5500.00,
            targetPcts: {
                'demo-asset-9': 50,
                'demo-asset-10': 50
            }
        }
    ];

    const transactions: Transaction[] = [
        // Alex TFSA
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

        // Alex RRSP
        {
            id: 'tx-7',
            accountId: 'demo-acc-2',
            type: 'Deposit',
            amount: 15000.00,
            date: '2024-01-15T09:00:00.000Z',
            currency: 'CAD'
        },
        {
            id: 'tx-8',
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
            id: 'tx-9',
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
            id: 'tx-10',
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

        // Jordan TFSA
        {
            id: 'tx-11',
            accountId: 'demo-acc-3',
            type: 'Deposit',
            amount: 8000.00,
            date: '2024-01-20T09:00:00.000Z',
            currency: 'CAD'
        },
        {
            id: 'tx-12',
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
            id: 'tx-13',
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

        // Joint Margin
        {
            id: 'tx-14',
            accountId: 'demo-acc-4',
            type: 'Deposit',
            amount: 15000.00,
            date: '2024-02-01T09:00:00.000Z',
            currency: 'CAD'
        },
        {
            id: 'tx-15',
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
            id: 'tx-16',
            accountId: 'demo-acc-4',
            ticker: 'CSU.TO',
            type: 'Buy',
            shares: 1,
            pricePerShare: 3650.00,
            amount: 3659.99,
            commission: 9.99,
            date: '2024-03-01T14:00:00.000Z',
            currency: 'CAD'
        }
    ];

    const assets: Asset[] = [
        {
            id: 'demo-asset-1',
            accountId: 'demo-acc-1',
            ticker: 'XEQT.TO',
            name: 'iShares Core Equity ETF Portfolio',
            quantity: 152,
            averageCost: 28.51,
            currentPrice: 33.40,
            totalCost: 4333.20,
            marketValue: 5076.80,
            cadMarketValue: 5076.80,
            profit: 743.60,
            profitPercent: 17.16,
            todayChangePercent: 0.42,
            todayChangeDollar: 21.28,
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
            quantity: 40,
            averageCost: 118.25,
            currentPrice: 144.10,
            totalCost: 4730.00,
            marketValue: 5764.00,
            cadMarketValue: 5764.00,
            profit: 1034.00,
            profitPercent: 21.86,
            todayChangePercent: 0.85,
            todayChangeDollar: 48.80,
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
            quantity: 12,
            averageCost: 405.00,
            currentPrice: 432.50,
            totalCost: 4860.00,
            marketValue: 5190.00,
            cadMarketValue: 5190.00 * exchangeRate,
            profit: 330.00,
            profitPercent: 6.79,
            todayChangePercent: -0.35,
            todayChangeDollar: -18.15,
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
            quantity: 80,
            averageCost: 44.50,
            currentPrice: 49.20,
            totalCost: 3560.00,
            marketValue: 3936.00,
            cadMarketValue: 3936.00,
            profit: 376.00,
            profitPercent: 10.56,
            todayChangePercent: 0.30,
            todayChangeDollar: 11.75,
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
            quantity: 15,
            averageCost: 168.00,
            currentPrice: 183.40,
            totalCost: 2520.00,
            marketValue: 2751.00,
            cadMarketValue: 2751.00 * exchangeRate,
            profit: 231.00,
            profitPercent: 9.17,
            todayChangePercent: -0.62,
            todayChangeDollar: -17.15,
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
            quantity: 60,
            averageCost: 81.50,
            currentPrice: 79.80,
            totalCost: 4890.00,
            marketValue: 4788.00,
            cadMarketValue: 4788.00,
            profit: -102.00,
            profitPercent: -2.09,
            todayChangePercent: -0.25,
            todayChangeDollar: -12.00,
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
            name: 'Electric Vehicle Financing',
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
        { date: '2024-07-01', value: -192500 },
        { date: '2024-08-01', value: -187000 },
        { date: '2024-09-01', value: -181200 },
        { date: '2024-10-01', value: -174500 },
        { date: '2024-11-01', value: -168000 }
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
