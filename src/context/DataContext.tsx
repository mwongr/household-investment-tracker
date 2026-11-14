import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import { apiFetch, apiPostJson } from '../api/client';
import { getDemoData } from '../data/demoData';
import { applyMarketData, calculateCashImpact, recalculateAssets } from '../domain/portfolio';
import type {
    AcbAccount,
    AcbTransaction,
    Account,
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
} from '../types';
import type {
    DetailedQuoteResponse,
    ExchangeRateResponse,
    MigrateCurrencyResponse,
    QuoteResponse,
    StockAnalysisResponse,
} from '../types/api';
import {
    INITIAL_ACCOUNT_TYPES,
    loadInitialState,
    STORAGE_KEY,
    toSyncPayload,
    useServerSync,
    type PersistedState,
} from './persistence';

export interface DataState {
    members: Member[];
    institutions: Institution[];
    accountTypes: string[];
    accounts: Account[];
    assets: Asset[];
    transactions: Transaction[];
    netWorthHistory: NetWorthSnapshot[];
    lastUpdated: Date | null;
    backupPath: string;
    isDemoData: boolean;
    watchlist: WatchlistItem[];
    watchlistLastUpdated: Date | null;
    acbAccounts: AcbAccount[];
    acbTransactions: AcbTransaction[];
    bankAccounts: BankAccount[];
    liabilities: Liability[];
    monthlyExpenses: MonthlyExpense[];
    preferences: UserPreferences;
    exchangeRate: number;
}

export interface DataActions {
    loadDemoData: () => void;
    clearAllData: () => void;
    setupHousehold: (
        memberName: string,
        institutionName: string,
        initialAccount: { name: string; type: string; cashBalance: number }
    ) => { memberId: string; institutionId: string; accountId: string };
    addMember: (name: string) => Member;
    updateMember: (id: string, name: string) => void;
    deleteMember: (id: string) => void;
    setBackupPath: (path: string) => void;
    addInstitution: (name: string) => Institution;
    updateInstitution: (id: string, name: string) => void;
    deleteInstitution: (id: string) => void;
    addAccountType: (name: string) => void;
    updateAccountType: (oldName: string, newName: string) => void;
    deleteAccountType: (name: string) => void;
    addAccount: (account: Omit<Account, 'id'>) => Account;
    updateAccount: (id: string, updates: Partial<Account>) => void;
    deleteAccount: (id: string) => void;
    addTransaction: (transaction: Omit<Transaction, 'id'>) => void;
    addTransactions: (
        transactions: Omit<Transaction, 'id'>[],
        options?: { updateCashBalance?: boolean }
    ) => void;
    updateTransaction: (id: string, transaction: Omit<Transaction, 'id'>) => void;
    deleteTransaction: (id: string) => void;
    renameTicker: (
        accountId: string,
        oldTicker: string,
        newTicker: string,
        newCurrency?: 'CAD' | 'USD'
    ) => void;
    updateAssetCustomBookCost: (assetId: string, customBookCost: number | null) => void;
    getAssetsByAccount: (accountId: string) => Asset[];
    refreshPrices: (range?: string) => Promise<void>;
    refreshAsset: (assetId: string, range?: string) => Promise<void>;
    addToWatchlist: (ticker: string) => Promise<void>;
    removeFromWatchlist: (id: string) => void;
    refreshWatchlist: (force: boolean) => Promise<void>;
    migrateCurrency: (
        originalTicker: string,
        newTicker: string,
        conversionDate: string,
        newUsdCostBasis: number,
        shares: number,
        accountId: string,
        manualClosePrice?: number
    ) => Promise<void>;
    addAcbAccount: (name: string) => void;
    deleteAcbAccount: (id: string) => void;
    addAcbTransaction: (transaction: Omit<AcbTransaction, 'id'>) => void;
    addAcbTransactions: (transactions: Omit<AcbTransaction, 'id'>[]) => void;
    updateAcbTransaction: (id: string, transaction: Omit<AcbTransaction, 'id'>) => void;
    deleteAcbTransaction: (id: string) => void;
    deleteAcbTicker: (acbAccountId: string, ticker: string) => void;
    addBankAccount: (bankAccount: Omit<BankAccount, 'id'>) => void;
    updateBankAccount: (id: string, bankAccount: Omit<BankAccount, 'id'>) => void;
    deleteBankAccount: (id: string) => void;
    addLiability: (liability: Omit<Liability, 'id'>) => void;
    updateLiability: (id: string, liability: Omit<Liability, 'id'>) => void;
    deleteLiability: (id: string) => void;
    addMonthlyExpense: (expense: Omit<MonthlyExpense, 'id'>) => void;
    updateMonthlyExpense: (id: string, expense: Omit<MonthlyExpense, 'id'>) => void;
    deleteMonthlyExpense: (id: string) => void;
    updatePreferences: (updates: Partial<UserPreferences>) => void;
}

export type DataContextType = DataState & DataActions;

const DataStateContext = createContext<DataState | undefined>(undefined);
const DataActionsContext = createContext<DataActions | undefined>(undefined);

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const initial = useMemo(() => loadInitialState(), []);

    const [members, setMembers] = useState<Member[]>(initial.members);
    const [institutions, setInstitutions] = useState<Institution[]>(initial.institutions);
    const [accountTypes, setAccountTypes] = useState<string[]>(initial.accountTypes);
    const [accounts, setAccounts] = useState<Account[]>(initial.accounts);
    const [isDemoData, setIsDemoData] = useState<boolean>(initial.isDemoData);
    const [transactions, setTransactions] = useState<Transaction[]>(initial.transactions);
    const [assets, setAssets] = useState<Asset[]>(initial.assets);
    const [netWorthHistory, setNetWorthHistory] = useState<NetWorthSnapshot[]>(initial.netWorthHistory);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(initial.lastUpdated);
    const [backupPath, setBackupPath] = useState<string>(initial.backupPath);
    const [watchlist, setWatchlist] = useState<WatchlistItem[]>(initial.watchlist);
    const [watchlistLastUpdated, setWatchlistLastUpdated] = useState<Date | null>(
        initial.watchlistLastUpdated
    );
    const [acbAccounts, setAcbAccounts] = useState<AcbAccount[]>(initial.acbAccounts);
    const [acbTransactions, setAcbTransactions] = useState<AcbTransaction[]>(initial.acbTransactions);
    const [bankAccounts, setBankAccounts] = useState<BankAccount[]>(initial.bankAccounts);
    const [liabilities, setLiabilities] = useState<Liability[]>(initial.liabilities);
    const [monthlyExpenses, setMonthlyExpenses] = useState<MonthlyExpense[]>(initial.monthlyExpenses);
    const [preferences, setPreferences] = useState<UserPreferences>(initial.preferences);
    const [exchangeRate, setExchangeRate] = useState<number>(initial.exchangeRate);

    const pendingRefreshRef = useRef(false);
    const assetsRef = useRef(assets);
    const transactionsRef = useRef(transactions);
    const exchangeRateRef = useRef(exchangeRate);
    const watchlistRef = useRef(watchlist);
    const watchlistLastUpdatedRef = useRef(watchlistLastUpdated);

    useEffect(() => {
        assetsRef.current = assets;
        transactionsRef.current = transactions;
        exchangeRateRef.current = exchangeRate;
        watchlistRef.current = watchlist;
        watchlistLastUpdatedRef.current = watchlistLastUpdated;
    }, [assets, transactions, exchangeRate, watchlist, watchlistLastUpdated]);

    const fullState = useMemo<PersistedState>(
        () => ({
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
            isDemoData,
            savedAt: initial.savedAt,
        }),
        [
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
            isDemoData,
            initial.savedAt,
        ]
    );

    const handleHydrate = useCallback((hydrated: PersistedState) => {
        setMembers(hydrated.members);
        setInstitutions(hydrated.institutions);
        setAccountTypes(hydrated.accountTypes);
        setAccounts(hydrated.accounts);
        setTransactions(hydrated.transactions);
        setAssets(hydrated.assets);
        setNetWorthHistory(hydrated.netWorthHistory);
        setLastUpdated(hydrated.lastUpdated);
        setBackupPath(hydrated.backupPath);
        setWatchlist(hydrated.watchlist);
        setWatchlistLastUpdated(hydrated.watchlistLastUpdated);
        setAcbAccounts(hydrated.acbAccounts);
        setAcbTransactions(hydrated.acbTransactions);
        setBankAccounts(hydrated.bankAccounts);
        setLiabilities(hydrated.liabilities);
        setMonthlyExpenses(hydrated.monthlyExpenses);
        setPreferences(hydrated.preferences);
        setExchangeRate(hydrated.exchangeRate);
        setIsDemoData(hydrated.isDemoData);
    }, []);

    useServerSync(fullState, handleHydrate);

    const refreshPrices = useCallback(async (range = '1mo') => {
        let activeRate = exchangeRateRef.current;
        try {
            const exData = await apiFetch<ExchangeRateResponse>('/api/exchange-rate');
            if (exData.rate) {
                activeRate = exData.rate;
                setExchangeRate(exData.rate);
            }
        } catch (err) {
            console.error('Failed to fetch exchange rate', err);
        }

        const currentAssets = assetsRef.current;
        const uniqueTickers = Array.from(new Set(currentAssets.map((a) => a.ticker))).filter(Boolean);
        const marketMap = new Map<
            string,
            { quote: QuoteResponse; analysis?: StockAnalysisResponse }
        >();

        await Promise.all(
            uniqueTickers.map(async (ticker) => {
                try {
                    const [quote, analysis] = await Promise.all([
                        apiFetch<QuoteResponse>(
                            `/api/quote?symbol=${encodeURIComponent(ticker)}&range=${encodeURIComponent(range)}`
                        ),
                        apiFetch<StockAnalysisResponse>(
                            `/api/stocks/${encodeURIComponent(ticker)}/analysis`
                        ).catch(() => undefined),
                    ]);
                    marketMap.set(ticker, { quote, analysis });
                } catch (err) {
                    console.error('Failed to fetch price for', ticker, err);
                }
            })
        );

        setAssets((prev) =>
            prev.map((asset) => {
                const entry = marketMap.get(asset.ticker);
                if (!entry) return asset;
                return applyMarketData(asset, entry.quote, entry.analysis, activeRate, range);
            })
        );

        setLastUpdated(new Date());
    }, []);

    const refreshAsset = useCallback(async (assetId: string, range = '1mo') => {
        const asset = assetsRef.current.find((a) => a.id === assetId);
        if (!asset) return;

        try {
            const [quote, analysis] = await Promise.all([
                apiFetch<QuoteResponse>(
                    `/api/quote?symbol=${encodeURIComponent(asset.ticker)}&range=${encodeURIComponent(range)}`
                ),
                apiFetch<StockAnalysisResponse>(
                    `/api/stocks/${encodeURIComponent(asset.ticker)}/analysis`
                ).catch(() => undefined),
            ]);

            setAssets((prev) =>
                prev.map((a) =>
                    a.id === assetId
                        ? applyMarketData(a, quote, analysis, exchangeRateRef.current, range)
                        : a
                )
            );
        } catch (err) {
            console.error('Failed to fetch price for', asset.ticker, err);
        }
    }, []);

    // Autosave daily net worth snapshot when asset prices or account cash balances change
    useEffect(() => {
        const totalAssetValue = assets.reduce((sum, a) => sum + a.marketValue, 0);
        const totalCash = accounts.reduce((sum, a) => sum + a.cashBalance, 0);
        const currentNetWorth = totalAssetValue + totalCash;

        if (Number.isNaN(currentNetWorth) || currentNetWorth === 0) return;

        const today = new Date().toISOString().split('T')[0]!;
        setNetWorthHistory((prev) => {
            const hasToday = prev.some((p) => p.date === today);
            if (hasToday) {
                return prev.map((p) => (p.date === today ? { ...p, value: currentNetWorth } : p));
            }
            return [...prev, { date: today, value: currentNetWorth }];
        });
    }, [assets, accounts]);

    useEffect(() => {
        if (pendingRefreshRef.current && assets.length > 0) {
            pendingRefreshRef.current = false;
            refreshPrices();
        }
    }, [assets, refreshPrices]);

    // Clean up orphaned transactions/assets when an account is removed
    useEffect(() => {
        const validAccountIds = new Set(accounts.map((a) => a.id));
        setTransactions((prev) => {
            const filtered = prev.filter((t) => validAccountIds.has(t.accountId));
            return filtered.length === prev.length ? prev : filtered;
        });
        setAssets((prev) => {
            const filtered = prev.filter((a) => validAccountIds.has(a.accountId));
            return filtered.length === prev.length ? prev : filtered;
        });
    }, [accounts]);

    const addMember = useCallback((name: string): Member => {
        const newMember = { id: crypto.randomUUID(), name: name.trim() };
        setMembers((prev) => [...prev, newMember]);
        return newMember;
    }, []);

    const updateMember = useCallback((id: string, name: string) => {
        setMembers((prev) => prev.map((m) => (m.id === id ? { ...m, name } : m)));
    }, []);

    const deleteMember = useCallback((id: string) => {
        setMembers((prev) => prev.filter((m) => m.id !== id));
    }, []);

    const addInstitution = useCallback((name: string): Institution => {
        const newInst = { id: crypto.randomUUID(), name: name.trim() };
        setInstitutions((prev) => [...prev, newInst]);
        return newInst;
    }, []);

    const updateInstitution = useCallback((id: string, name: string) => {
        setInstitutions((prev) => prev.map((i) => (i.id === id ? { ...i, name } : i)));
    }, []);

    const deleteInstitution = useCallback((id: string) => {
        setInstitutions((prev) => prev.filter((i) => i.id !== id));
    }, []);

    const addAccountType = useCallback((name: string) => {
        const trimmed = name.trim();
        if (!trimmed) return;
        setAccountTypes((prev) =>
            prev.some((t) => t.toLowerCase() === trimmed.toLowerCase()) ? prev : [...prev, trimmed]
        );
    }, []);

    const updateAccountType = useCallback((oldName: string, newName: string) => {
        const trimmed = newName.trim();
        if (!trimmed) return;
        setAccountTypes((prev) => {
            const exists = prev.some((t) => t !== oldName && t.toLowerCase() === trimmed.toLowerCase());
            if (exists) return prev;
            return prev.map((t) => (t === oldName ? trimmed : t));
        });
        setAccounts((prev) => prev.map((a) => (a.type === oldName ? { ...a, type: trimmed } : a)));
    }, []);

    const deleteAccountType = useCallback((name: string) => {
        setAccountTypes((prev) => prev.filter((t) => t !== name));
    }, []);

    const addAccount = useCallback((account: Omit<Account, 'id'>): Account => {
        const newAccount = { ...account, id: crypto.randomUUID() };
        setAccounts((prev) => [...prev, newAccount]);
        return newAccount;
    }, []);

    const updateAccount = useCallback((id: string, updates: Partial<Account>) => {
        setAccounts((prev) => prev.map((a) => (a.id === id ? { ...a, ...updates } : a)));
    }, []);

    const deleteAccount = useCallback((id: string) => {
        setAccounts((prev) => prev.filter((a) => a.id !== id));
        setTransactions((prev) => prev.filter((t) => t.accountId !== id));
        setAssets((prev) => prev.filter((a) => a.accountId !== id));
    }, []);

    const addTransaction = useCallback((tx: Omit<Transaction, 'id'>) => {
        const newTx: Transaction = { ...tx, id: crypto.randomUUID() };
        const isNewAsset = !assetsRef.current.some(
            (a) => a.accountId === tx.accountId && a.ticker === tx.ticker
        );

        const nextTransactions = [...transactionsRef.current, newTx];
        setTransactions(nextTransactions);
        setAssets(
            recalculateAssets(
                nextTransactions,
                assetsRef.current,
                exchangeRateRef.current,
                newTx.type === 'Stock Split'
            )
        );

        const impact = calculateCashImpact(newTx);
        if (impact !== 0) {
            setAccounts((prev) =>
                prev.map((a) =>
                    a.id === tx.accountId ? { ...a, cashBalance: a.cashBalance + impact } : a
                )
            );
        }

        if (isNewAsset && tx.ticker) {
            pendingRefreshRef.current = true;
        }
    }, []);

    const addTransactions = useCallback(
        (newTxs: Omit<Transaction, 'id'>[], options?: { updateCashBalance?: boolean }) => {
            if (!newTxs || newTxs.length === 0) return;
            const updateCash = options?.updateCashBalance ?? true;
            const createdTxs: Transaction[] = newTxs.map((tx) => ({
                ...tx,
                id: crypto.randomUUID(),
            }));

            const existingAccountTickers = new Set(
                assetsRef.current.map((a) => `${a.accountId}-${a.ticker}`)
            );
            const hasNewAsset = createdTxs.some(
                (tx) => tx.ticker && !existingAccountTickers.has(`${tx.accountId}-${tx.ticker}`)
            );

            const nextTransactions = [...transactionsRef.current, ...createdTxs];
            const hasSplit = createdTxs.some((t) => t.type === 'Stock Split');
            setTransactions(nextTransactions);
            setAssets(
                recalculateAssets(
                    nextTransactions,
                    assetsRef.current,
                    exchangeRateRef.current,
                    hasSplit
                )
            );

            if (updateCash) {
                const accountCashDeltas: Record<string, number> = {};
                for (const tx of createdTxs) {
                    const impact = calculateCashImpact(tx);
                    if (impact !== 0) {
                        accountCashDeltas[tx.accountId] =
                            (accountCashDeltas[tx.accountId] || 0) + impact;
                    }
                }

                if (Object.keys(accountCashDeltas).length > 0) {
                    setAccounts((prev) =>
                        prev.map((a) => {
                            const delta = accountCashDeltas[a.id];
                            return delta ? { ...a, cashBalance: a.cashBalance + delta } : a;
                        })
                    );
                }
            }

            if (hasNewAsset) {
                pendingRefreshRef.current = true;
            }
        },
        []
    );

    const updateTransaction = useCallback((id: string, tx: Omit<Transaction, 'id'>) => {
        const oldTx = transactionsRef.current.find((t) => t.id === id);
        if (!oldTx) return;

        const nextTransactions = transactionsRef.current.map((t) =>
            t.id === id ? { ...tx, id } : t
        );
        setTransactions(nextTransactions);
        setAssets(
            recalculateAssets(
                nextTransactions,
                assetsRef.current,
                exchangeRateRef.current,
                tx.type === 'Stock Split' || oldTx.type === 'Stock Split'
            )
        );

        const oldImpact = calculateCashImpact(oldTx);
        const newImpact = calculateCashImpact(tx);
        if (oldImpact !== newImpact || oldTx.accountId !== tx.accountId) {
            setAccounts((prev) =>
                prev.map((a) => {
                    let balance = a.cashBalance;
                    if (a.id === oldTx.accountId) balance -= oldImpact;
                    if (a.id === tx.accountId) balance += newImpact;
                    return { ...a, cashBalance: balance };
                })
            );
        }
    }, []);

    const deleteTransaction = useCallback((id: string) => {
        const txToDelete = transactionsRef.current.find((t) => t.id === id);
        const nextTransactions = transactionsRef.current.filter((t) => t.id !== id);
        setTransactions(nextTransactions);
        setAssets(
            recalculateAssets(
                nextTransactions,
                assetsRef.current,
                exchangeRateRef.current,
                txToDelete?.type === 'Stock Split'
            )
        );

        if (txToDelete) {
            const impact = calculateCashImpact(txToDelete);
            if (impact !== 0) {
                setAccounts((prev) =>
                    prev.map((a) =>
                        a.id === txToDelete.accountId
                            ? { ...a, cashBalance: a.cashBalance - impact }
                            : a
                    )
                );
            }
        }
    }, []);

    const renameTicker = useCallback(
        (
            accountId: string,
            oldTicker: string,
            newTicker: string,
            newCurrency?: 'CAD' | 'USD'
        ) => {
            const cleanOld = oldTicker.trim().toUpperCase();
            const cleanNew = newTicker.trim().toUpperCase();
            if (!cleanOld || !cleanNew || cleanOld === cleanNew) return;

            const nextTransactions = transactionsRef.current.map((tx) => {
                if (
                    tx.accountId === accountId &&
                    tx.ticker &&
                    tx.ticker.trim().toUpperCase() === cleanOld
                ) {
                    return {
                        ...tx,
                        ticker: cleanNew,
                        currency: newCurrency || tx.currency,
                        previousTicker: cleanOld,
                    };
                }
                return tx;
            });
            setTransactions(nextTransactions);
            setAssets(
                recalculateAssets(nextTransactions, assetsRef.current, exchangeRateRef.current)
            );
            pendingRefreshRef.current = true;
        },
        []
    );

    const getAssetsByAccount = useCallback(
        (accountId: string) => assets.filter((a) => a.accountId === accountId),
        [assets]
    );

    const updateAssetCustomBookCost = useCallback(
        (assetId: string, customBookCost: number | null) => {
            const rate = exchangeRateRef.current;
            setAssets((prev) =>
                prev.map((asset) => {
                    if (asset.id !== assetId) return asset;
                    const effectiveBookCost =
                        customBookCost !== null && customBookCost !== undefined
                            ? customBookCost
                            : asset.totalCost;
                    const cadEffectiveBookCost =
                        asset.currency === 'USD' ? effectiveBookCost * rate : effectiveBookCost;
                    const impliedAvgCost =
                        asset.quantity > 0 ? effectiveBookCost / asset.quantity : 0;
                    return {
                        ...asset,
                        customBookCost: customBookCost !== null ? customBookCost : undefined,
                        averageCost: impliedAvgCost,
                        cadTotalCost: cadEffectiveBookCost,
                        profit: asset.cadMarketValue - cadEffectiveBookCost,
                        profitPercent:
                            cadEffectiveBookCost > 0
                                ? ((asset.cadMarketValue - cadEffectiveBookCost) /
                                      cadEffectiveBookCost) *
                                  100
                                : 0,
                    };
                })
            );
        },
        []
    );

    const addToWatchlist = useCallback(async (ticker: string) => {
        const upperTicker = ticker.trim().toUpperCase();
        if (!upperTicker || watchlistRef.current.some((w) => w.ticker === upperTicker)) return;

        const [dataDetailed, dataChart, dataAnalysis] = await Promise.all([
            apiFetch<DetailedQuoteResponse>(
                `/api/quote-detailed?symbol=${encodeURIComponent(upperTicker)}`
            ),
            apiFetch<QuoteResponse>(`/api/quote?symbol=${encodeURIComponent(upperTicker)}`).catch(
                () => ({}) as Partial<QuoteResponse>
            ),
            apiFetch<StockAnalysisResponse>(
                `/api/stocks/${encodeURIComponent(upperTicker)}/analysis`
            ).catch(() => undefined),
        ]);

        if (dataDetailed.error) {
            throw new Error(dataDetailed.error);
        }

        const newItem: WatchlistItem = {
            id: crypto.randomUUID(),
            ticker: dataDetailed.symbol || upperTicker,
            name: dataDetailed.shortName || dataChart.shortName || '',
            price: dataDetailed.price ?? dataChart.regularMarketPrice ?? 0,
            changePercent: dataDetailed.changePercent ?? dataChart.regularMarketChangePercent ?? 0,
            high52Week: dataDetailed.fiftyTwoWeekHigh ?? dataChart.fiftyTwoWeekHigh ?? 0,
            low52Week: dataDetailed.fiftyTwoWeekLow ?? dataChart.fiftyTwoWeekLow ?? 0,
            volume: dataDetailed.volume ?? dataChart.volume ?? 0,
            avgVolume: dataDetailed.avgVolume ?? 0,
            sparkline: dataChart.sparkline,
            signal: dataAnalysis?.signal,
            rsi: dataAnalysis?.indicators?.rsi,
            goldenCross: dataAnalysis?.indicators?.goldenCross,
        };
        setWatchlist((prev) => [...prev, newItem]);
    }, []);

    const removeFromWatchlist = useCallback((id: string) => {
        setWatchlist((prev) => prev.filter((w) => w.id !== id));
    }, []);

    const refreshWatchlist = useCallback(async (force = false) => {
        const ONE_HOUR_MS = 60 * 60 * 1000;
        const last = watchlistLastUpdatedRef.current;
        if (!force && last && Date.now() - last.getTime() <= ONE_HOUR_MS) {
            return;
        }

        const uniqueTickers = watchlistRef.current.map((w) => w.ticker);
        const newMap = new Map<string, Partial<WatchlistItem>>();

        await Promise.all(
            uniqueTickers.map(async (ticker) => {
                try {
                    const [dataDetailed, dataQuote, dataAnalysis] = await Promise.all([
                        apiFetch<DetailedQuoteResponse>(
                            `/api/quote-detailed?symbol=${encodeURIComponent(ticker)}`
                        ).catch(() => ({}) as Partial<DetailedQuoteResponse>),
                        apiFetch<QuoteResponse>(
                            `/api/quote?symbol=${encodeURIComponent(ticker)}`
                        ).catch(() => ({}) as Partial<QuoteResponse>),
                        apiFetch<StockAnalysisResponse>(
                            `/api/stocks/${encodeURIComponent(ticker)}/analysis`
                        ).catch(() => undefined),
                    ]);

                    if (!dataQuote.error || !dataDetailed.error) {
                        newMap.set(ticker, {
                            name: dataDetailed.shortName || dataDetailed.symbol,
                            price: dataDetailed.price ?? dataQuote.regularMarketPrice,
                            changePercent:
                                dataDetailed.changePercent ?? dataQuote.regularMarketChangePercent,
                            high52Week: dataDetailed.fiftyTwoWeekHigh ?? dataQuote.fiftyTwoWeekHigh,
                            low52Week: dataDetailed.fiftyTwoWeekLow ?? dataQuote.fiftyTwoWeekLow,
                            volume: dataDetailed.volume ?? dataQuote.volume,
                            avgVolume: dataDetailed.avgVolume ?? undefined,
                            sparkline: dataQuote.sparkline,
                            signal: dataAnalysis?.signal,
                            rsi: dataAnalysis?.indicators?.rsi,
                            goldenCross: dataAnalysis?.indicators?.goldenCross,
                        });
                    }
                } catch (err) {
                    console.error('Failed to fetch watchlist price for', ticker, err);
                }
            })
        );

        setWatchlist((prev) =>
            prev.map((item) => {
                const data = newMap.get(item.ticker);
                if (!data) return item;
                return {
                    ...item,
                    name: data.name || item.name,
                    price: data.price ?? item.price,
                    changePercent: data.changePercent ?? item.changePercent,
                    high52Week: data.high52Week ?? item.high52Week,
                    low52Week: data.low52Week ?? item.low52Week,
                    volume: data.volume ?? item.volume,
                    avgVolume: data.avgVolume !== undefined ? data.avgVolume : item.avgVolume,
                    sparkline: data.sparkline || item.sparkline,
                    signal: data.signal !== undefined ? data.signal : item.signal,
                    rsi: data.rsi !== undefined ? data.rsi : item.rsi,
                    goldenCross:
                        data.goldenCross !== undefined ? data.goldenCross : item.goldenCross,
                };
            })
        );
        setWatchlistLastUpdated(new Date());
    }, []);

    const migrateCurrency = useCallback(
        async (
            originalTicker: string,
            newTicker: string,
            conversionDate: string,
            newUsdCostBasis: number,
            shares: number,
            accountId: string,
            manualClosePrice?: number
        ) => {
            const data = await apiPostJson<MigrateCurrencyResponse>(
                '/api/portfolio/migrate-currency',
                {
                    originalTicker,
                    newTicker,
                    conversionDate,
                    newUsdCostBasis,
                    shares,
                    accountId,
                    manualClosePrice,
                }
            );
            if (data.transactions) {
                const nextTransactions = [...transactionsRef.current, ...data.transactions];
                setTransactions(nextTransactions);
                setAssets(
                    recalculateAssets(nextTransactions, assetsRef.current, exchangeRateRef.current)
                );
            }
        },
        []
    );

    const addAcbAccount = useCallback((name: string) => {
        setAcbAccounts((prev) => [...prev, { id: crypto.randomUUID(), name }]);
    }, []);

    const deleteAcbAccount = useCallback((id: string) => {
        setAcbAccounts((prev) => prev.filter((a) => a.id !== id));
        setAcbTransactions((prev) => prev.filter((t) => t.acbAccountId !== id));
    }, []);

    const addAcbTransaction = useCallback((tx: Omit<AcbTransaction, 'id'>) => {
        setAcbTransactions((prev) => [...prev, { ...tx, id: crypto.randomUUID() }]);
    }, []);

    const addAcbTransactions = useCallback((txs: Omit<AcbTransaction, 'id'>[]) => {
        const withIds = txs.map((tx) => ({ ...tx, id: crypto.randomUUID() }));
        setAcbTransactions((prev) => [...prev, ...withIds]);
    }, []);

    const updateAcbTransaction = useCallback((id: string, tx: Omit<AcbTransaction, 'id'>) => {
        setAcbTransactions((prev) => prev.map((t) => (t.id === id ? { ...tx, id } : t)));
    }, []);

    const deleteAcbTransaction = useCallback((id: string) => {
        setAcbTransactions((prev) => prev.filter((t) => t.id !== id));
    }, []);

    const deleteAcbTicker = useCallback((acbAccountId: string, ticker: string) => {
        setAcbTransactions((prev) =>
            prev.filter((t) => !(t.acbAccountId === acbAccountId && t.ticker === ticker))
        );
    }, []);

    const addBankAccount = useCallback((bank: Omit<BankAccount, 'id'>) => {
        setBankAccounts((prev) => [...prev, { ...bank, id: crypto.randomUUID() }]);
    }, []);

    const updateBankAccount = useCallback((id: string, bank: Omit<BankAccount, 'id'>) => {
        setBankAccounts((prev) => prev.map((b) => (b.id === id ? { ...bank, id } : b)));
    }, []);

    const deleteBankAccount = useCallback((id: string) => {
        setBankAccounts((prev) => prev.filter((b) => b.id !== id));
    }, []);

    const addLiability = useCallback((liability: Omit<Liability, 'id'>) => {
        setLiabilities((prev) => [...prev, { ...liability, id: crypto.randomUUID() }]);
    }, []);

    const updateLiability = useCallback((id: string, liability: Omit<Liability, 'id'>) => {
        setLiabilities((prev) => prev.map((l) => (l.id === id ? { ...liability, id } : l)));
    }, []);

    const deleteLiability = useCallback((id: string) => {
        setLiabilities((prev) => prev.filter((l) => l.id !== id));
    }, []);

    const addMonthlyExpense = useCallback((expense: Omit<MonthlyExpense, 'id'>) => {
        setMonthlyExpenses((prev) => [...prev, { ...expense, id: crypto.randomUUID() }]);
    }, []);

    const updateMonthlyExpense = useCallback((id: string, expense: Omit<MonthlyExpense, 'id'>) => {
        setMonthlyExpenses((prev) => prev.map((e) => (e.id === id ? { ...expense, id } : e)));
    }, []);

    const deleteMonthlyExpense = useCallback((id: string) => {
        setMonthlyExpenses((prev) => prev.filter((e) => e.id !== id));
    }, []);

    const updatePreferences = useCallback((updates: Partial<UserPreferences>) => {
        setPreferences((prev) => ({ ...prev, ...updates }));
    }, []);

    const loadDemoData = useCallback(() => {
        const demo = getDemoData(exchangeRateRef.current);
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
    }, []);

    const clearAllData = useCallback(() => {
        setMembers([]);
        setInstitutions([]);
        setAccountTypes(INITIAL_ACCOUNT_TYPES);
        setAccounts([]);
        setAssets([]);
        setTransactions([]);
        setNetWorthHistory([]);
        setWatchlist([]);
        setWatchlistLastUpdated(null);
        setBankAccounts([]);
        setLiabilities([]);
        setMonthlyExpenses([]);
        setAcbAccounts([]);
        setAcbTransactions([]);
        setIsDemoData(false);
        setLastUpdated(null);

        const emptyPersisted: PersistedState = {
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
            isDemoData: false,
        };

        const payload = {
            ...toSyncPayload(emptyPersisted, new Date().toISOString()),
            allowDestructive: true,
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
        apiPostJson('/api/sync', payload).catch((err) =>
            console.warn('Sync failed on clearAllData:', err)
        );
    }, [backupPath, preferences, exchangeRate]);

    const setupHousehold = useCallback(
        (
            memberName: string,
            institutionName: string,
            initialAccount: { name: string; type: string; cashBalance: number }
        ) => {
            const memberId = crypto.randomUUID();
            const instId = crypto.randomUUID();
            const accId = crypto.randomUUID();

            const newMember: Member = { id: memberId, name: memberName };
            const newInst: Institution = { id: instId, name: institutionName };
            const newAcc: Account = {
                id: accId,
                memberId,
                institutionId: instId,
                name: initialAccount.name,
                type: initialAccount.type,
                cashBalance: initialAccount.cashBalance || 0,
            };

            setMembers([newMember]);
            setInstitutions([newInst]);
            setAccounts([newAcc]);
            setAssets([]);
            setTransactions([]);
            setIsDemoData(false);

            return { memberId, institutionId: instId, accountId: accId };
        },
        []
    );

    const stateValue = useMemo<DataState>(
        () => ({
            members,
            institutions,
            accountTypes,
            accounts,
            assets,
            transactions,
            netWorthHistory,
            lastUpdated,
            backupPath,
            isDemoData,
            watchlist,
            watchlistLastUpdated,
            acbAccounts,
            acbTransactions,
            bankAccounts,
            liabilities,
            monthlyExpenses,
            preferences,
            exchangeRate,
        }),
        [
            members,
            institutions,
            accountTypes,
            accounts,
            assets,
            transactions,
            netWorthHistory,
            lastUpdated,
            backupPath,
            isDemoData,
            watchlist,
            watchlistLastUpdated,
            acbAccounts,
            acbTransactions,
            bankAccounts,
            liabilities,
            monthlyExpenses,
            preferences,
            exchangeRate,
        ]
    );

    const actionsValue = useMemo<DataActions>(
        () => ({
            loadDemoData,
            clearAllData,
            setupHousehold,
            addMember,
            updateMember,
            deleteMember,
            setBackupPath,
            addInstitution,
            updateInstitution,
            deleteInstitution,
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
            addToWatchlist,
            removeFromWatchlist,
            refreshWatchlist,
            migrateCurrency,
            addAcbAccount,
            deleteAcbAccount,
            addAcbTransaction,
            addAcbTransactions,
            updateAcbTransaction,
            deleteAcbTransaction,
            deleteAcbTicker,
            addBankAccount,
            updateBankAccount,
            deleteBankAccount,
            addLiability,
            updateLiability,
            deleteLiability,
            addMonthlyExpense,
            updateMonthlyExpense,
            deleteMonthlyExpense,
            updatePreferences,
        }),
        [
            loadDemoData,
            clearAllData,
            setupHousehold,
            addMember,
            updateMember,
            deleteMember,
            addInstitution,
            updateInstitution,
            deleteInstitution,
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
            addToWatchlist,
            removeFromWatchlist,
            refreshWatchlist,
            migrateCurrency,
            addAcbAccount,
            deleteAcbAccount,
            addAcbTransaction,
            addAcbTransactions,
            updateAcbTransaction,
            deleteAcbTransaction,
            deleteAcbTicker,
            addBankAccount,
            updateBankAccount,
            deleteBankAccount,
            addLiability,
            updateLiability,
            deleteLiability,
            addMonthlyExpense,
            updateMonthlyExpense,
            deleteMonthlyExpense,
            updatePreferences,
        ]
    );

    return (
        <DataStateContext.Provider value={stateValue}>
            <DataActionsContext.Provider value={actionsValue}>
                {children}
            </DataActionsContext.Provider>
        </DataStateContext.Provider>
    );
};

export const useDataState = (): DataState => {
    const context = useContext(DataStateContext);
    if (!context) {
        throw new Error('useDataState must be used within a DataProvider');
    }
    return context;
};

export const useDataActions = (): DataActions => {
    const context = useContext(DataActionsContext);
    if (!context) {
        throw new Error('useDataActions must be used within a DataProvider');
    }
    return context;
};

export const useData = (): DataContextType => {
    const state = useDataState();
    const actions = useDataActions();
    return useMemo(() => ({ ...state, ...actions }), [state, actions]);
};
