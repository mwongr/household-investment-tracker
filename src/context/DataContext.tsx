import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type {
    Member, Institution, Account, Asset, Transaction, NetWorthSnapshot, WatchlistItem,
    AcbAccount, AcbTransaction,
    BankAccount, Liability, MonthlyExpense, UserPreferences
} from '../types';
import { getDemoData } from '../data/demoData';

interface DataContextType {
    members: Member[];
    institutions: Institution[];
    accounts: Account[];
    assets: Asset[];
    transactions: Transaction[];
    netWorthHistory: NetWorthSnapshot[];
    lastUpdated: Date | null;
    backupPath: string;

    isDemoData: boolean;
    loadDemoData: () => void;
    clearAllData: () => void;
    setupHousehold: (memberName: string, institutionName: string, initialAccount: { name: string; type: string; cashBalance: number }) => void;

    addMember: (name: string) => void;
    updateMember: (id: string, name: string) => void;
    setBackupPath: (path: string) => void;
    deleteMember: (id: string) => void;

    addInstitution: (name: string) => void;
    updateInstitution: (id: string, name: string) => void;
    deleteInstitution: (id: string) => void;

    accountTypes: string[];
    addAccountType: (name: string) => void;
    updateAccountType: (oldName: string, newName: string) => void;
    deleteAccountType: (name: string) => void;

    addAccount: (account: Omit<Account, 'id'>) => Account;
    updateAccount: (id: string, updates: Partial<Account>) => void;
    deleteAccount: (id: string) => void;

    addTransaction: (transaction: Omit<Transaction, 'id'>) => void;
    addTransactions: (transactions: Omit<Transaction, 'id'>[], options?: { updateCashBalance?: boolean }) => void;
    updateTransaction: (id: string, transaction: Omit<Transaction, 'id'>) => void;
    deleteTransaction: (id: string) => void;
    renameTicker: (accountId: string, oldTicker: string, newTicker: string, newCurrency?: 'CAD' | 'USD') => void;

    updateAssetCustomBookCost: (assetId: string, customBookCost: number | null) => void;

    getAssetsByAccount: (accountId: string) => Asset[];
    refreshPrices: (range?: string) => Promise<void>;
    refreshAsset: (assetId: string, range?: string) => Promise<void>;

    watchlist: WatchlistItem[];
    watchlistLastUpdated: Date | null;
    addToWatchlist: (ticker: string) => Promise<void>;
    removeFromWatchlist: (id: string) => void;
    refreshWatchlist: (force: boolean) => Promise<void>;

    migrateCurrency: (originalTicker: string, newTicker: string, conversionDate: string, newUsdCostBasis: number, shares: number, accountId: string, manualClosePrice?: number) => Promise<void>;

    // ACB Tracking
    acbAccounts: AcbAccount[];
    acbTransactions: AcbTransaction[];
    addAcbAccount: (name: string) => void;
    deleteAcbAccount: (id: string) => void;
    addAcbTransaction: (transaction: Omit<AcbTransaction, 'id'>) => void;
    updateAcbTransaction: (id: string, transaction: Omit<AcbTransaction, 'id'>) => void;
    deleteAcbTransaction: (id: string) => void;

    // Net Worth Tracking
    bankAccounts: BankAccount[];
    addBankAccount: (bankAccount: Omit<BankAccount, 'id'>) => void;
    updateBankAccount: (id: string, bankAccount: Omit<BankAccount, 'id'>) => void;
    deleteBankAccount: (id: string) => void;

    liabilities: Liability[];
    addLiability: (liability: Omit<Liability, 'id'>) => void;
    updateLiability: (id: string, liability: Omit<Liability, 'id'>) => void;
    deleteLiability: (id: string) => void;

    monthlyExpenses: MonthlyExpense[];
    addMonthlyExpense: (expense: Omit<MonthlyExpense, 'id'>) => void;
    updateMonthlyExpense: (id: string, expense: Omit<MonthlyExpense, 'id'>) => void;
    deleteMonthlyExpense: (id: string) => void;

    preferences: UserPreferences;
    updatePreferences: (updates: Partial<UserPreferences>) => void;
    exchangeRate: number;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

const INITIAL_ACCOUNT_TYPES: string[] = ['TFSA', 'RRSP', 'FHSA', 'Margin', 'Cash', 'Crypto', 'Other'];

const STORAGE_KEY = 'wealth-tracker-storage';

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    // Initialize State from LocalStorage (defaults to blank clean slate)
    const [members, setMembers] = useState<Member[]>(() => {
        const saved = localStorage.getItem(STORAGE_KEY);
        return saved && JSON.parse(saved).members ? JSON.parse(saved).members : [];
    });
    const [institutions, setInstitutions] = useState<Institution[]>(() => {
        const saved = localStorage.getItem(STORAGE_KEY);
        return saved && JSON.parse(saved).institutions ? JSON.parse(saved).institutions : [];
    });
    const [accountTypes, setAccountTypes] = useState<string[]>(() => {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed.accountTypes) && parsed.accountTypes.length > 0) {
                return parsed.accountTypes;
            }
            if (Array.isArray(parsed.accounts)) {
                const usedTypes = parsed.accounts.map((a: Account) => a.type).filter(Boolean);
                return Array.from(new Set([...INITIAL_ACCOUNT_TYPES, ...usedTypes]));
            }
        }
        return INITIAL_ACCOUNT_TYPES;
    });
    const [accounts, setAccounts] = useState<Account[]>(() => {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            const parsed = JSON.parse(saved);
            if (parsed.accounts) {
                // Migration: Ensure cashBalance exists (migrating from initialCashBalance)
                return parsed.accounts.map((acc: any) => ({
                    ...acc,
                    cashBalance: acc.cashBalance !== undefined ? acc.cashBalance : (acc.initialCashBalance || 0)
                }));
            }
        }
        return [];
    });
    const [isDemoData, setIsDemoData] = useState<boolean>(() => {
        const saved = localStorage.getItem(STORAGE_KEY);
        return saved ? Boolean(JSON.parse(saved).isDemoData) : false;
    });
    const [transactions, setTransactions] = useState<Transaction[]>(() => {
        const saved = localStorage.getItem(STORAGE_KEY);
        return saved ? JSON.parse(saved).transactions : [];
    });

    // Assets are derived from transactions + initial state
    const [assets, setAssets] = useState<Asset[]>(() => {
        const saved = localStorage.getItem(STORAGE_KEY);
        return saved ? JSON.parse(saved).assets : [];
    });

    const [netWorthHistory, setNetWorthHistory] = useState<NetWorthSnapshot[]>(() => {
        const saved = localStorage.getItem(STORAGE_KEY);
        const history = saved && JSON.parse(saved).netWorthHistory ? JSON.parse(saved).netWorthHistory : [];
        // Filter out any corrupted NaN values
        return history.filter((h: NetWorthSnapshot) => !isNaN(h.value) && h.value !== null);
    });

    const [lastUpdated, setLastUpdated] = useState<Date | null>(() => {
        const saved = localStorage.getItem(STORAGE_KEY);
        return saved && JSON.parse(saved).lastUpdated ? new Date(JSON.parse(saved).lastUpdated) : null;
    });

    const [backupPath, setBackupPath] = useState<string>(() => {
        const saved = localStorage.getItem(STORAGE_KEY);
        return saved ? (JSON.parse(saved).backupPath || '') : '';
    });

    const [watchlist, setWatchlist] = useState<WatchlistItem[]>(() => {
        const saved = localStorage.getItem(STORAGE_KEY);
        return saved ? (JSON.parse(saved).watchlist || []) : [];
    });

    const [watchlistLastUpdated, setWatchlistLastUpdated] = useState<Date | null>(() => {
        const saved = localStorage.getItem(STORAGE_KEY);
        return saved && JSON.parse(saved).watchlistLastUpdated ? new Date(JSON.parse(saved).watchlistLastUpdated) : null;
    });

    const [acbAccounts, setAcbAccounts] = useState<AcbAccount[]>(() => {
        const saved = localStorage.getItem(STORAGE_KEY);
        return saved ? (JSON.parse(saved).acbAccounts || []) : [];
    });

    const [acbTransactions, setAcbTransactions] = useState<AcbTransaction[]>(() => {
        const saved = localStorage.getItem(STORAGE_KEY);
        return saved ? (JSON.parse(saved).acbTransactions || []) : [];
    });

    const [bankAccounts, setBankAccounts] = useState<BankAccount[]>(() => {
        const saved = localStorage.getItem(STORAGE_KEY);
        return saved ? (JSON.parse(saved).bankAccounts || []) : [];
    });

    const [liabilities, setLiabilities] = useState<Liability[]>(() => {
        const saved = localStorage.getItem(STORAGE_KEY);
        return saved ? (JSON.parse(saved).liabilities || []) : [];
    });

    const [monthlyExpenses, setMonthlyExpenses] = useState<MonthlyExpense[]>(() => {
        const saved = localStorage.getItem(STORAGE_KEY);
        return saved ? (JSON.parse(saved).monthlyExpenses || []) : [];
    });

    const [preferences, setPreferences] = useState<UserPreferences>(() => {
        const saved = localStorage.getItem(STORAGE_KEY);
        const defaults = { enableNetWorth: true, enableTaxOptimizer: true, enableAcbTracker: true };
        return saved && JSON.parse(saved).preferences ? { ...defaults, ...JSON.parse(saved).preferences } : defaults;
    });

    const [exchangeRate, setExchangeRate] = useState<number>(() => {
        const saved = localStorage.getItem(STORAGE_KEY);
        return saved && JSON.parse(saved).exchangeRate ? JSON.parse(saved).exchangeRate : 1.0;
    });

    // Track if we need to auto-refresh after adding new asset
    const pendingRefreshRef = useRef(false);

    // Save to LocalStorage whenever state changes AND Sync to Server
    useEffect(() => {
        const state = {
            members,
            institutions,
            accountTypes,
            accounts,
            transactions,
            assets,
            netWorthHistory,
            lastUpdated,
            backupPath,
            watchlist,
            watchlistLastUpdated,
            acbAccounts,
            acbTransactions,
            bankAccounts,
            liabilities,
            monthlyExpenses,
            preferences,
            exchangeRate,
            isDemoData
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));

        // Sync to local server for persistence/backup support
        const timer = setTimeout(() => {
            fetch('http://localhost:3001/api/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(state)
            }).catch(e => console.warn('Sync failed (server might be down):', e));
        }, 2000); // 2 second debounce
        return () => clearTimeout(timer);
    }, [members, institutions, accountTypes, accounts, transactions, assets, lastUpdated, backupPath, watchlist, watchlistLastUpdated, acbAccounts, acbTransactions, bankAccounts, liabilities, monthlyExpenses, preferences, exchangeRate, isDemoData]);

    // Real Market Data Refresh - defined early so it can be used in useEffect
    const refreshPrices = useCallback(async (range: string = '1mo') => {
        // Fetch exchange rate first
        try {
            const exRes = await fetch('/api/exchange-rate');
            if (exRes.ok) {
                const exData = await exRes.json();
                if (exData.rate) {
                    setExchangeRate(exData.rate);
                }
            }
        } catch (e) {
            console.error('Failed to fetch exchange rate', e);
        }

        const uniqueTickers = Array.from(new Set(assets.map(a => a.ticker))).filter(Boolean);

        // We'll update assets in a batch
        const newAssetDataMap = new Map<string, any>();

        await Promise.all(uniqueTickers.map(async (ticker) => {
            const asset = assets.find(a => a.ticker === ticker);
            const seedPrice = asset ? (asset.averageCost > 0 ? asset.averageCost : (asset.currentPrice > 0 ? asset.currentPrice : 100)) : 100;

            try {
                const response = await fetch(`/api/quote?symbol=${ticker}&seedPrice=${seedPrice}&range=${range}`);
                if (response.ok) {
                    const data = await response.json();
                    if (data) {
                        try {
                            const resAnalysis = await fetch(`/api/stocks/${ticker}/analysis`);
                            const dataAnalysis: any = resAnalysis.ok ? await resAnalysis.json() : {};
                            newAssetDataMap.set(ticker, { ...data, analysis: dataAnalysis });
                        } catch (e) {
                            newAssetDataMap.set(ticker, { ...data, analysis: {} });
                        }
                    }
                }
            } catch (error) {
                console.error("Failed to fetch price for", ticker, error);
            }
        }));

        setAssets(prev => prev.map(asset => {
            const marketData = newAssetDataMap.get(asset.ticker);
            if (!marketData) return asset;

            const currentPrice = marketData.regularMarketPrice || asset.currentPrice;
            const marketValue = asset.quantity * currentPrice;
            const effectiveBookCost = asset.customBookCost !== undefined && asset.customBookCost !== null ? asset.customBookCost : asset.totalCost;

            const todayChangePercent = marketData.regularMarketChangePercent || 0;
            // Robust calculation: Change = Price - PrevClose
            // Price = PrevClose * (1 + change/100) => PrevClose = Price / (1 + change/100)
            const divisor = 1 + (todayChangePercent / 100);
            const prevPrice = divisor !== 0 ? currentPrice / divisor : currentPrice; 
            const todayChangeDollar = divisor !== 0 ? (currentPrice - prevPrice) * asset.quantity : 0;

            const currency = marketData.currency || asset.currency || 'CAD';
            const cadMarketValue = currency === 'USD' ? marketValue * exchangeRate : marketValue;
            const cadEffectiveBookCost = currency === 'USD' ? effectiveBookCost * exchangeRate : effectiveBookCost;

            return {
                ...asset,
                currency: currency,
                currentPrice: currentPrice,
                marketValue: marketValue,
                cadMarketValue: cadMarketValue,
                cadTotalCost: cadEffectiveBookCost,
                profit: cadMarketValue - cadEffectiveBookCost,
                profitPercent: cadEffectiveBookCost > 0 ? ((cadMarketValue - cadEffectiveBookCost) / cadEffectiveBookCost) * 100 : 0,
                high52Week: marketData.fiftyTwoWeekHigh,
                low52Week: marketData.fiftyTwoWeekLow,
                todayChangePercent: todayChangePercent,
                todayChangeDollar: todayChangeDollar,
                sparkline: marketData.sparkline,
                chartRange: range,
                signal: marketData.analysis?.signal,
                rsi: marketData.analysis?.indicators?.rsi,
                goldenCross: marketData.analysis?.indicators?.goldenCross
            };
        }));

        setLastUpdated(new Date());

    }, [assets]); // We only update assets here. Snapshotting is handled by useEffect.

    const refreshAsset = useCallback(async (assetId: string, range: string = '1mo') => {
        const asset = assets.find(a => a.id === assetId);
        if (!asset) return;

        const seedPrice = asset.averageCost > 0 ? asset.averageCost : (asset.currentPrice > 0 ? asset.currentPrice : 100);

        try {
            const response = await fetch(`/api/quote?symbol=${asset.ticker}&seedPrice=${seedPrice}&range=${range}`);
            if (response.ok) {
                const data = await response.json();
                if (data) {
                    let dataAnalysis: any = {};
                    try {
                        const resAnalysis = await fetch(`/api/stocks/${asset.ticker}/analysis`);
                        dataAnalysis = resAnalysis.ok ? await resAnalysis.json() : {};
                    } catch(e) {}
                    
                    setAssets(prev => prev.map(a => {
                        if (a.id !== assetId) return a;

                        const currentPrice = data.regularMarketPrice || a.currentPrice;
                        const marketValue = a.quantity * currentPrice;
                        const effectiveBookCost = a.customBookCost !== undefined && a.customBookCost !== null ? a.customBookCost : a.totalCost;

                        const todayChangePercent = data.regularMarketChangePercent || 0;
                        const divisor = 1 + (todayChangePercent / 100);
                        const prevPrice = divisor !== 0 ? currentPrice / divisor : currentPrice;
                        const todayChangeDollar = divisor !== 0 ? a.quantity * (currentPrice - prevPrice) : 0;

                        return {
                            ...a,
                            currentPrice: currentPrice,
                            marketValue: marketValue,
                            profit: marketValue - effectiveBookCost,
                            profitPercent: effectiveBookCost > 0 ? ((marketValue - effectiveBookCost) / effectiveBookCost) * 100 : 0,
                            high52Week: data.fiftyTwoWeekHigh,
                            low52Week: data.fiftyTwoWeekLow,
                            todayChangePercent: todayChangePercent,
                            todayChangeDollar: todayChangeDollar,
                            sparkline: data.sparkline,
                            chartRange: range,
                            signal: dataAnalysis.signal,
                            rsi: dataAnalysis.indicators?.rsi,
                            goldenCross: dataAnalysis.indicators?.goldenCross
                        };
                    }));
                }
            }
        } catch (error) {
            console.error("Failed to fetch price for", asset.ticker, error);
        }
    }, [assets]);

    // Snapshot Effect separately to avoid complex dep chains? 
    // No, let's keep it simple. When prices refresh, we save the snapshot.
    useEffect(() => {
        // Calculate Total Net Worth
        const totalAssetValue = assets.reduce((sum, a) => sum + a.marketValue, 0);
        const totalCash = accounts.reduce((sum, a) => sum + a.cashBalance, 0);
        const currentNetWorth = totalAssetValue + totalCash;

        if (isNaN(currentNetWorth) || currentNetWorth === 0) return; // Don't save zero/NaN states

        const today = new Date().toISOString().split('T')[0];

        setNetWorthHistory(prev => {
            const hasToday = prev.find(p => p.date === today);
            if (hasToday) {
                // Update today's entry (taking last value of the day)
                return prev.map(p => p.date === today ? { ...p, value: currentNetWorth } : p);
            } else {
                // Add new entry
                return [...prev, { date: today, value: currentNetWorth }];
            }
        });
    }, [assets, accounts]); // Updates whenever assets (prices/qty) or accounts (cash) change. 
    // This essentially "Autosaves" the daily value.


    // Auto-refresh prices when new assets are added
    useEffect(() => {
        if (pendingRefreshRef.current && assets.length > 0) {
            pendingRefreshRef.current = false;
            refreshPrices();
        }
    }, [assets, refreshPrices]);

    const addMember = (name: string) => {
        setMembers(prev => [...prev, { id: uuidv4(), name }]);
    };

    const updateMember = (id: string, name: string) => {
        setMembers(prev => prev.map(m => m.id === id ? { ...m, name } : m));
    };

    const deleteMember = (id: string) => {
        setMembers(prev => prev.filter(m => m.id !== id));
    };

    const addInstitution = (name: string) => {
        setInstitutions(prev => [...prev, { id: uuidv4(), name }]);
    };

    const updateInstitution = (id: string, name: string) => {
        setInstitutions(prev => prev.map(i => i.id === id ? { ...i, name } : i));
    };

    const deleteInstitution = (id: string) => {
        setInstitutions(prev => prev.filter(i => i.id !== id));
    };

    const addAccountType = (name: string) => {
        const trimmed = name.trim();
        if (!trimmed) return;
        setAccountTypes(prev =>
            prev.some(t => t.toLowerCase() === trimmed.toLowerCase()) ? prev : [...prev, trimmed]
        );
    };

    const updateAccountType = (oldName: string, newName: string) => {
        const trimmed = newName.trim();
        if (!trimmed) return;
        setAccountTypes(prev => {
            const exists = prev.some(t => t !== oldName && t.toLowerCase() === trimmed.toLowerCase());
            if (exists) return prev;
            return prev.map(t => (t === oldName ? trimmed : t));
        });
        setAccounts(prev => prev.map(a => (a.type === oldName ? { ...a, type: trimmed } : a)));
    };

    const deleteAccountType = (name: string) => {
        setAccountTypes(prev => prev.filter(t => t !== name));
    };

    const addAccount = (account: Omit<Account, 'id'>): Account => {
        const newAccount = { ...account, id: uuidv4() };
        setAccounts(prev => [...prev, newAccount]);
        return newAccount;
    };

    const updateAccount = (id: string, updates: Partial<Account>) => {
        setAccounts(accounts.map(a => a.id === id ? { ...a, ...updates } : a));
    };

    const deleteAccount = (id: string) => {
        setAccounts(accounts.filter(a => a.id !== id));
    };

    const calculateCashImpact = (tx: Partial<Transaction>) => {
        if (tx.ignoreCashImpact) return 0;
        const amount = tx.amount || 0;
        switch (tx.type) {
            case 'Buy': return -amount;
            case 'Sell': return amount;
            case 'Deposit': return amount;
            case 'Withdrawal': return -amount;
            case 'Dividend':
            case 'Dividend Income': return amount;
            case 'Interest': return amount;
            case 'Fee': return -amount;
            case 'DRIP':
            case 'Dividend Reinvested': return 0; // Cash in (Div) immediately out (Buy Shares)
            case 'Stock Split': return 0;
            default: return 0;
        }
    };

    const addTransaction = (tx: Omit<Transaction, 'id'>) => {
        const newTx = { ...tx, id: uuidv4() };
        const isNewAsset = !assets.some(a => a.accountId === tx.accountId && a.ticker === tx.ticker);

        setTransactions(prev => {
            const updatedInfo = [...prev, newTx];
            recalculateAssets(updatedInfo, newTx.type === 'Stock Split');
            return updatedInfo;
        });

        // Update Cash Balance
        const impact = calculateCashImpact(newTx);
        if (impact !== 0) {
            setAccounts(prev => prev.map(a => a.id === tx.accountId ? { ...a, cashBalance: a.cashBalance + impact } : a));
        }

        // Flag for auto-refresh if this is a new asset
        if (isNewAsset && tx.ticker) {
            pendingRefreshRef.current = true;
        }
    };

    const addTransactions = (newTxs: Omit<Transaction, 'id'>[], options?: { updateCashBalance?: boolean }) => {
        if (!newTxs || newTxs.length === 0) return;
        const updateCash = options?.updateCashBalance ?? true;
        const createdTxs: Transaction[] = newTxs.map(tx => ({ ...tx, id: uuidv4() }));

        const existingAccountTickers = new Set(assets.map(a => `${a.accountId}-${a.ticker}`));
        const hasNewAsset = createdTxs.some(tx => tx.ticker && !existingAccountTickers.has(`${tx.accountId}-${tx.ticker}`));

        setTransactions(prev => {
            const updated = [...prev, ...createdTxs];
            const hasSplit = createdTxs.some(t => t.type === 'Stock Split');
            recalculateAssets(updated, hasSplit);
            return updated;
        });

        if (updateCash) {
            const accountCashDeltas: Record<string, number> = {};
            for (const tx of createdTxs) {
                const impact = calculateCashImpact(tx);
                if (impact !== 0) {
                    accountCashDeltas[tx.accountId] = (accountCashDeltas[tx.accountId] || 0) + impact;
                }
            }

            if (Object.keys(accountCashDeltas).length > 0) {
                setAccounts(prev => prev.map(a => {
                    const delta = accountCashDeltas[a.id];
                    if (delta !== undefined && delta !== 0) {
                        return { ...a, cashBalance: a.cashBalance + delta };
                    }
                    return a;
                }));
            }
        }

        if (hasNewAsset) {
            pendingRefreshRef.current = true;
        }
    };

    const updateTransaction = (id: string, tx: Omit<Transaction, 'id'>) => {
        const oldTx = transactions.find(t => t.id === id);
        if (!oldTx) return;

        setTransactions(prev => {
            const updated = prev.map(t => t.id === id ? { ...tx, id } : t);
            recalculateAssets(updated, tx.type === 'Stock Split' || oldTx.type === 'Stock Split');
            return updated;
        });

        // Update Cash Balance
        const oldImpact = calculateCashImpact(oldTx);
        const newImpact = calculateCashImpact(tx);

        if (oldImpact !== newImpact || oldTx.accountId !== tx.accountId) {
            setAccounts(prev => prev.map(a => {
                let balance = a.cashBalance;
                if (a.id === oldTx.accountId) balance -= oldImpact; // Revert
                if (a.id === tx.accountId) balance += newImpact; // Apply
                return { ...a, cashBalance: balance };
            }));
        }
    };

    const deleteTransaction = (id: string) => {
        const txToDelete = transactions.find(t => t.id === id);

        setTransactions(prev => {
            const updated = prev.filter(t => t.id !== id);
            recalculateAssets(updated, txToDelete?.type === 'Stock Split');
            return updated;
        });

        if (txToDelete) {
            const impact = calculateCashImpact(txToDelete);
            if (impact !== 0) {
                setAccounts(prev => prev.map(a => a.id === txToDelete.accountId ? { ...a, cashBalance: a.cashBalance - impact } : a));
            }
        }
    };

    const renameTicker = (accountId: string, oldTicker: string, newTicker: string, newCurrency?: 'CAD' | 'USD') => {
        const cleanOld = oldTicker.trim().toUpperCase();
        const cleanNew = newTicker.trim().toUpperCase();
        if (!cleanOld || !cleanNew || cleanOld === cleanNew) return;

        setTransactions(prev => {
            const updated = prev.map(tx => {
                if (tx.accountId === accountId && tx.ticker && tx.ticker.trim().toUpperCase() === cleanOld) {
                    return {
                        ...tx,
                        ticker: cleanNew,
                        currency: newCurrency || tx.currency,
                        previousTicker: cleanOld,
                    };
                }
                return tx;
            });
            recalculateAssets(updated);
            return updated;
        });

        pendingRefreshRef.current = true;
    };

    // Completely rebuild assets from transactions to ensure consistency on edits/deletes
    const recalculateAssets = (currentTransactions: Transaction[], ignoreCustomBookCostAdjustment: boolean = false) => {
        const newAssetsMap = new Map<string, Asset>();

        // Sort by date asc
        const sorted = [...currentTransactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        for (const tx of sorted) {
            const key = `${tx.accountId}-${tx.ticker}`;
            if (!newAssetsMap.has(key)) {
                // Find existing asset to preserve ID and market data
                const existingAsset = assets.find(a => a.accountId === tx.accountId && a.ticker === tx.ticker);

                newAssetsMap.set(key, {
                    id: existingAsset?.id || uuidv4(),
                    accountId: tx.accountId,
                    ticker: tx.ticker!,
                    quantity: 0,
                    averageCost: 0,
                    totalCost: 0,
                    customBookCost: existingAsset?.customBookCost, // Preserve custom book cost
                    // Preserve existing market data if available
                    currentPrice: existingAsset?.currentPrice || tx.pricePerShare || 0,
                    marketValue: 0,
                    profit: 0,
                    profitPercent: 0,
                    todayChangePercent: existingAsset?.todayChangePercent || 0,
                    todayChangeDollar: existingAsset?.todayChangeDollar || 0,
                    high52Week: existingAsset?.high52Week,
                    low52Week: existingAsset?.low52Week,
                    sparkline: existingAsset?.sparkline,
                    signal: existingAsset?.signal,
                    rsi: existingAsset?.rsi,
                    goldenCross: existingAsset?.goldenCross,
                    currency: existingAsset?.currency || 'CAD',
                    cadMarketValue: 0,
                    cadTotalCost: 0,
                    previousTicker: existingAsset?.previousTicker,
                });
            }

            const asset = newAssetsMap.get(key)!;

            // No mock data initialization. 
            // If data is missing, we wait for a real price refresh.
            if (!asset.high52Week && !asset.low52Week) {
                // Initialize with undefined/null or leave as is to show "N/A"
            }

            if (tx.type === 'Buy' || tx.type === 'DRIP' || tx.type === 'Dividend Reinvested') {
                const totalCostOld = asset.averageCost * asset.quantity;
                const totalCostNew = totalCostOld + tx.amount;
                const newQty = asset.quantity + (tx.shares || 0);

                asset.quantity = newQty;
                asset.totalCost = totalCostNew;
                asset.averageCost = newQty > 0 ? totalCostNew / newQty : 0;
                
                if (tx.previousTicker) {
                    asset.previousTicker = tx.previousTicker;
                }

                // Custom book cost logic removed to prevent double-counting on recalculation

            } else if (tx.type === 'Sell') {
                const newQty = asset.quantity - (tx.shares || 0);
                const costOfSharesSold = (tx.shares || 0) * asset.averageCost;

                asset.quantity = newQty;
                asset.totalCost -= costOfSharesSold;

                // Custom book cost logic removed to prevent double-counting on recalculation

            } else if (tx.type === 'Stock Split') {
                if (tx.splitFrom && tx.splitTo) {
                    const newQty = (asset.quantity * tx.splitTo) / tx.splitFrom;
                    asset.quantity = newQty;
                } else {
                    const newQty = asset.quantity + (tx.shares || 0);
                    asset.quantity = newQty;
                }
                asset.averageCost = asset.quantity > 0 ? asset.totalCost / asset.quantity : 0;
            }

            asset.marketValue = asset.quantity * asset.currentPrice;
            // Use custom book cost if set, otherwise use calculated totalCost
            const effectiveBookCost = asset.customBookCost !== undefined && asset.customBookCost !== null ? asset.customBookCost : asset.totalCost;
            asset.cadTotalCost = asset.currency === 'USD' ? effectiveBookCost * exchangeRate : effectiveBookCost;
            asset.cadMarketValue = asset.currency === 'USD' ? asset.marketValue * exchangeRate : asset.marketValue;
            
            asset.profit = asset.cadMarketValue - asset.cadTotalCost;
            asset.profitPercent = asset.cadTotalCost > 0 ? (asset.profit / asset.cadTotalCost) * 100 : 0;

            // Recalculate Day $ Change
            const cp = asset.todayChangePercent || 0;
            const div = 1 + (cp / 100);
            const pp = div !== 0 ? asset.currentPrice / div : asset.currentPrice;
            asset.todayChangeDollar = div !== 0 ? (asset.currentPrice - pp) * asset.quantity : 0;

            // Final safety check
            if (isNaN(asset.todayChangeDollar) || !isFinite(asset.todayChangeDollar)) {
                asset.todayChangeDollar = 0;
            }
        }

        // Post-processing: Adjust Custom Book Cost based on quantity changes
        // This ensures that if a user sets a Custom Book Cost, it dynamically updates when they Sell or Buy more.
        const processedAssets = Array.from(newAssetsMap.values()).map(asset => {
            if (asset.quantity <= 0.000001) return asset; // Skip zero/dust

            const existingAsset = assets.find(a => a.id === asset.id);

            // Only adjust if there was a pre-existing Custom Book Cost
            if (existingAsset?.customBookCost !== undefined && existingAsset.customBookCost !== null) {
                if (ignoreCustomBookCostAdjustment) {
                    return {
                        ...asset,
                        customBookCost: existingAsset.customBookCost,
                        profit: asset.cadMarketValue - (asset.currency === 'USD' ? existingAsset.customBookCost * exchangeRate : existingAsset.customBookCost),
                        profitPercent: (asset.currency === 'USD' ? existingAsset.customBookCost * exchangeRate : existingAsset.customBookCost) > 0 ? ((asset.cadMarketValue - (asset.currency === 'USD' ? existingAsset.customBookCost * exchangeRate : existingAsset.customBookCost)) / (asset.currency === 'USD' ? existingAsset.customBookCost * exchangeRate : existingAsset.customBookCost)) * 100 : 0
                    };
                }

                const existingQty = existingAsset.quantity;
                const newQty = asset.quantity;
                const qtyChange = newQty - existingQty;

                let newCustomBookCost = existingAsset.customBookCost;

                if (qtyChange < -0.000001 && existingQty > 0) {
                    // SELL (or Withdrawal): Reduce Custom Book Cost proportionally based on the USER's implied average
                    // We use the User's Average because we are removing a portion of *their* defined value.
                    const userImpliedAvgCost = existingAsset.customBookCost / existingQty;
                    const costReduction = Math.abs(qtyChange) * userImpliedAvgCost;
                    newCustomBookCost = Number(newCustomBookCost) - Number(costReduction);

                } else if (qtyChange > 0.000001 || Math.abs(asset.totalCost - existingAsset.totalCost) > 0.01) {
                    // BUY (or Cost Adjustment): Increase Custom Book Cost by the Transactional Cost of the new/changed leg.
                    const transactionalCostDelta = asset.totalCost - existingAsset.totalCost;
                    newCustomBookCost = Number(newCustomBookCost) + Number(transactionalCostDelta);
                }

                // If no meaningful change, keep existing value (already set in newCustomBookCost init)

                // Update the asset with the calculate custom cost
                const effectiveBookCost = newCustomBookCost;
                const cadEffectiveBookCost = asset.currency === 'USD' ? effectiveBookCost * exchangeRate : effectiveBookCost;

                return {
                    ...asset,
                    customBookCost: newCustomBookCost,
                    cadTotalCost: cadEffectiveBookCost,
                    // Recalculate profit metadata based on new adjusted custom cost
                    profit: asset.cadMarketValue - cadEffectiveBookCost,
                    profitPercent: cadEffectiveBookCost > 0 ? ((asset.cadMarketValue - cadEffectiveBookCost) / cadEffectiveBookCost) * 100 : 0
                };
            }

            return asset;
        }).filter(a => a.quantity > 0.000001);

        setAssets(processedAssets);
    };

    const getAssetsByAccount = (accountId: string) => {
        return assets.filter(a => a.accountId === accountId);
    };

    const updateAssetCustomBookCost = (assetId: string, customBookCost: number | null) => {
        setAssets(prev => prev.map(asset => {
            if (asset.id === assetId) {
                const effectiveBookCost = customBookCost !== null && customBookCost !== undefined ? customBookCost : asset.totalCost;
                return {
                    ...asset,
                    customBookCost: customBookCost !== null ? customBookCost : undefined,
                    profit: asset.marketValue - effectiveBookCost,
                    profitPercent: effectiveBookCost > 0 ? ((asset.marketValue - effectiveBookCost) / effectiveBookCost) * 100 : 0
                };
            }
            return asset;
        }));
    };

    const addToWatchlist = async (ticker: string) => {
        const upperTicker = ticker.toUpperCase();
        if (watchlist.some(w => w.ticker === upperTicker)) return;

        try {
            // Fetch detailed data for accurate real-time price and metadata
            const resDetailed = await fetch(`/api/quote-detailed?symbol=${upperTicker}`);
            if (!resDetailed.ok) throw new Error('Failed to fetch details');
            const dataDetailed = await resDetailed.json();

            // Fetch chart data for sparkline
            const resChart = await fetch(`/api/quote?symbol=${upperTicker}`);
            const dataChart = resChart.ok ? await resChart.json() : {};

            const resAnalysis = await fetch(`/api/stocks/${upperTicker}/analysis`);
            const dataAnalysis: any = resAnalysis.ok ? await resAnalysis.json() : {};

            if (dataDetailed.error) throw new Error(dataDetailed.error);

            const newItem: WatchlistItem = {
                id: uuidv4(),
                ticker: dataDetailed.symbol || upperTicker,
                name: dataDetailed.shortName || dataChart.shortName || '',
                price: dataDetailed.price !== undefined ? dataDetailed.price : dataChart.regularMarketPrice,
                changePercent: dataDetailed.changePercent !== undefined ? dataDetailed.changePercent : dataChart.regularMarketChangePercent,
                high52Week: dataDetailed.fiftyTwoWeekHigh || dataChart.fiftyTwoWeekHigh,
                low52Week: dataDetailed.fiftyTwoWeekLow || dataChart.fiftyTwoWeekLow,
                volume: dataDetailed.volume || dataChart.volume,
                avgVolume: dataDetailed.avgVolume || 0,
                sparkline: dataChart.sparkline,
                signal: dataAnalysis.signal,
                rsi: dataAnalysis.indicators?.rsi,
                goldenCross: dataAnalysis.indicators?.goldenCross
            };
            setWatchlist(prev => [...prev, newItem]);
        } catch (e) {
            console.error("Failed to add to watchlist", e);
            alert("Could not add " + ticker + ". Check symbol or try again.");
        }
    };

    const removeFromWatchlist = (id: string) => {
        setWatchlist(prev => prev.filter(w => w.id !== id));
    };

    const migrateCurrency = async (originalTicker: string, newTicker: string, conversionDate: string, newUsdCostBasis: number, shares: number, accountId: string, manualClosePrice?: number) => {
        try {
            const response = await fetch('/api/portfolio/migrate-currency', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ originalTicker, newTicker, conversionDate, newUsdCostBasis, shares, accountId, manualClosePrice })
            });
            if (response.ok) {
                const data = await response.json();
                if (data.transactions) {
                    // Update transactions directly. recalculateAssets will be called in the next effect or we can force it
                    setTransactions(prev => {
                        const updated = [...prev, ...data.transactions];
                        recalculateAssets(updated);
                        return updated;
                    });
                }
            } else {
                const errorData = await response.json();
                const error = new Error(errorData.error || 'Migration failed');
                if (errorData.requiresManualPrice) {
                    (error as any).requiresManualPrice = true;
                }
                throw error;
            }
        } catch (error) {
            console.error(error);
            throw error;
        }
    };

    const refreshWatchlist = useCallback(async (force: boolean = false) => {
        // Only refresh if forced, or if data is older than 60 minutes
        const ONE_HOURMs = 60 * 60 * 1000;
        const now = new Date();
        const shouldRefresh = force || !watchlistLastUpdated || (now.getTime() - watchlistLastUpdated.getTime()) > ONE_HOURMs;

        if (!shouldRefresh) {
            console.log("Watchlist data is recent. Skipping auto-refresh to save API hits.");
            return;
        }

        const uniqueTickers = watchlist.map(w => w.ticker);
        const newWatchlistDataMap = new Map<string, any>();

        await Promise.all(uniqueTickers.map(async (ticker) => {
            try {
                // Fetch BOTH detailed (for price/name accuracy), standard (for sparkline) and analysis (for TA labels)
                const [resDetailed, resQuote, resAnalysis] = await Promise.all([
                    fetch(`/api/quote-detailed?symbol=${ticker}`),
                    fetch(`/api/quote?symbol=${ticker}`),
                    fetch(`/api/stocks/${ticker}/analysis`)
                ]);

                const dataDetailed = resDetailed.ok ? await resDetailed.json() : {};
                const dataQuote = resQuote.ok ? await resQuote.json() : {};
                const dataAnalysis: any = resAnalysis.ok ? await resAnalysis.json() : {};

                if (!dataQuote.error || !dataDetailed.error) {
                    newWatchlistDataMap.set(ticker, {
                        fetchedName: dataDetailed.shortName || dataDetailed.symbol,
                        price: dataDetailed.price !== undefined ? dataDetailed.price : dataQuote.regularMarketPrice,
                        changePercent: dataDetailed.changePercent !== undefined ? dataDetailed.changePercent : dataQuote.regularMarketChangePercent,
                        high52Week: dataDetailed.fiftyTwoWeekHigh || dataQuote.fiftyTwoWeekHigh,
                        low52Week: dataDetailed.fiftyTwoWeekLow || dataQuote.fiftyTwoWeekLow,
                        volume: dataDetailed.volume || dataQuote.volume,
                        avgVolume: dataDetailed.avgVolume,
                        sparkline: dataQuote.sparkline,
                        signal: dataAnalysis.signal,
                        rsi: dataAnalysis.indicators?.rsi,
                        goldenCross: dataAnalysis.indicators?.goldenCross
                    });
                }
            } catch (error) {
                console.error("Failed to fetch watchlist price for", ticker, error);
            }
        }));

        setWatchlist(prev => prev.map(item => {
            const data = newWatchlistDataMap.get(item.ticker);
            if (!data) return item;

            return {
                ...item,
                name: data.fetchedName || item.name,
                price: data.price,
                changePercent: data.changePercent,
                high52Week: data.high52Week,
                low52Week: data.low52Week,
                volume: data.volume,
                avgVolume: data.avgVolume !== undefined ? data.avgVolume : item.avgVolume,
                sparkline: data.sparkline || item.sparkline,
                signal: data.signal !== undefined ? data.signal : item.signal,
                rsi: data.rsi !== undefined ? data.rsi : item.rsi,
                goldenCross: data.goldenCross !== undefined ? data.goldenCross : item.goldenCross
            };
        }));
        setWatchlistLastUpdated(new Date());
    }, [watchlist, watchlistLastUpdated]);

    // ACB Tracking Methods
    const addAcbAccount = (name: string) => {
        setAcbAccounts([...acbAccounts, { id: uuidv4(), name }]);
    };

    const deleteAcbAccount = (id: string) => {
        setAcbAccounts(acbAccounts.filter(a => a.id !== id));
        // Also delete transactions for this account
        setAcbTransactions(acbTransactions.filter(t => t.acbAccountId !== id));
    };

    const addAcbTransaction = (tx: Omit<AcbTransaction, 'id'>) => {
        setAcbTransactions([...acbTransactions, { ...tx, id: uuidv4() }]);
    };

    const updateAcbTransaction = (id: string, tx: Omit<AcbTransaction, 'id'>) => {
        setAcbTransactions(prev => prev.map(t => t.id === id ? { ...tx, id } : t));
    };

    const deleteAcbTransaction = (id: string) => {
        setAcbTransactions(acbTransactions.filter(t => t.id !== id));
    };

    // Net Worth Tracking Methods
    const addBankAccount = (bank: Omit<BankAccount, 'id'>) => setBankAccounts(prev => [...prev, { ...bank, id: uuidv4() }]);
    const updateBankAccount = (id: string, bank: Omit<BankAccount, 'id'>) => setBankAccounts(prev => prev.map(b => b.id === id ? { ...bank, id } : b));
    const deleteBankAccount = (id: string) => setBankAccounts(prev => prev.filter(b => b.id !== id));

    const addLiability = (liability: Omit<Liability, 'id'>) => setLiabilities(prev => [...prev, { ...liability, id: uuidv4() }]);
    const updateLiability = (id: string, liability: Omit<Liability, 'id'>) => setLiabilities(prev => prev.map(l => l.id === id ? { ...liability, id } : l));
    const deleteLiability = (id: string) => setLiabilities(prev => prev.filter(l => l.id !== id));

    const addMonthlyExpense = (expense: Omit<MonthlyExpense, 'id'>) => setMonthlyExpenses(prev => [...prev, { ...expense, id: uuidv4() }]);
    const updateMonthlyExpense = (id: string, expense: Omit<MonthlyExpense, 'id'>) => setMonthlyExpenses(prev => prev.map(e => e.id === id ? { ...expense, id } : e));
    const deleteMonthlyExpense = (id: string) => setMonthlyExpenses(prev => prev.filter(e => e.id !== id));

    // Demo Data & Reset Actions
    const loadDemoData = useCallback(() => {
        const demo = getDemoData(exchangeRate);
        setMembers(demo.members);
        setInstitutions(demo.institutions);
        setAccounts(demo.accounts);
        setAssets(demo.assets);
        setTransactions(demo.transactions);
        setNetWorthHistory(demo.netWorthHistory);
        setWatchlist(demo.watchlist);
        setBankAccounts(demo.bankAccounts);
        setLiabilities(demo.liabilities);
        setMonthlyExpenses(demo.monthlyExpenses);
        setAcbAccounts(demo.acbAccounts);
        setAcbTransactions(demo.acbTransactions);
        setIsDemoData(true);
        setLastUpdated(new Date());
    }, [exchangeRate]);

    const clearAllData = useCallback(() => {
        setMembers([]);
        setInstitutions([]);
        setAccounts([]);
        setAssets([]);
        setTransactions([]);
        setNetWorthHistory([]);
        setWatchlist([]);
        setBankAccounts([]);
        setLiabilities([]);
        setMonthlyExpenses([]);
        setAcbAccounts([]);
        setAcbTransactions([]);
        setIsDemoData(false);
        setLastUpdated(null);

        const emptyState = {
            members: [],
            institutions: [],
            accountTypes: INITIAL_ACCOUNT_TYPES,
            accounts: [],
            transactions: [],
            assets: [],
            netWorthHistory: [],
            lastUpdated: null,
            backupPath,
            watchlist: [],
            watchlistLastUpdated: null,
            acbAccounts: [],
            acbTransactions: [],
            bankAccounts: [],
            liabilities: [],
            monthlyExpenses: [],
            preferences,
            exchangeRate,
            isDemoData: false
        };

        localStorage.setItem(STORAGE_KEY, JSON.stringify(emptyState));

        // Sync empty state to server
        fetch('http://localhost:3001/api/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(emptyState)
        }).catch(e => console.warn('Sync failed on clearAllData:', e));
    }, [backupPath, preferences, exchangeRate]);

    const setupHousehold = useCallback((
        memberName: string,
        institutionName: string,
        initialAccount: { name: string; type: string; cashBalance: number }
    ) => {
        const memberId = uuidv4();
        const instId = uuidv4();
        const accId = uuidv4();

        const newMember: Member = { id: memberId, name: memberName };
        const newInst: Institution = { id: instId, name: institutionName };
        const newAcc: Account = {
            id: accId,
            memberId,
            institutionId: instId,
            name: initialAccount.name,
            type: initialAccount.type,
            cashBalance: initialAccount.cashBalance || 0
        };

        setMembers([newMember]);
        setInstitutions([newInst]);
        setAccounts([newAcc]);
        setAssets([]);
        setTransactions([]);
        setIsDemoData(false);
    }, []);

    return (
        <DataContext.Provider value={{
            members,
            institutions,
            accounts,
            assets,
            transactions,
            netWorthHistory,
            isDemoData,
            loadDemoData,
            clearAllData,
            setupHousehold,
            addMember,
            updateMember,
            deleteMember,
            addInstitution,
            updateInstitution,
            deleteInstitution,
            accountTypes,
            addAccountType,
            updateAccountType,
            deleteAccountType,
            addAccount,
            updateAccount,
            deleteAccount,
            addTransaction,
            addTransactions,
            updateTransaction,
            deleteTransaction,
            renameTicker,
            updateAssetCustomBookCost,
            getAssetsByAccount,
            refreshPrices,
            refreshAsset,
            lastUpdated,
            backupPath,
            setBackupPath,
            watchlist,
            watchlistLastUpdated,
            addToWatchlist,
            removeFromWatchlist,
            refreshWatchlist,
            migrateCurrency,
            acbAccounts,
            acbTransactions,
            addAcbAccount,
            deleteAcbAccount,
            addAcbTransaction,
            updateAcbTransaction,
            deleteAcbTransaction,
            bankAccounts,
            addBankAccount,
            updateBankAccount,
            deleteBankAccount,
            liabilities,
            addLiability,
            updateLiability,
            deleteLiability,
            monthlyExpenses,
            addMonthlyExpense,
            updateMonthlyExpense,
            deleteMonthlyExpense,
            preferences,
            updatePreferences: (updates) => setPreferences(prev => ({ ...prev, ...updates })),
            exchangeRate
        }}>
            {children}
        </DataContext.Provider>
    );
};

export const useData = () => {
    const context = useContext(DataContext);
    if (!context) {
        throw new Error('useData must be used within a DataProvider');
    }
    return context;
};
