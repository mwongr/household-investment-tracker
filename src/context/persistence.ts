import { useEffect, useRef } from 'react';
import { apiFetch, apiPostJson } from '../api/client';
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
import type { ServerStatePayload } from '../types/api';

export const STORAGE_KEY = 'wealth-tracker-storage';
export const INITIAL_ACCOUNT_TYPES: string[] = [
    'TFSA',
    'RRSP',
    'FHSA',
    'Margin',
    'Cash',
    'Crypto',
    'Other',
];

const DEFAULT_PREFERENCES: UserPreferences = {
    enableNetWorth: true,
    enableTaxOptimizer: true,
    enableAcbTracker: true,
};

export interface PersistedState {
    members: Member[];
    institutions: Institution[];
    accountTypes: string[];
    accounts: Account[];
    transactions: Transaction[];
    assets: Asset[];
    netWorthHistory: NetWorthSnapshot[];
    lastUpdated: Date | null;
    backupPath: string;
    watchlist: WatchlistItem[];
    watchlistLastUpdated: Date | null;
    acbAccounts: AcbAccount[];
    acbTransactions: AcbTransaction[];
    bankAccounts: BankAccount[];
    liabilities: Liability[];
    monthlyExpenses: MonthlyExpense[];
    preferences: UserPreferences;
    exchangeRate: number;
    isDemoData: boolean;
    savedAt?: string;
}

export function normalizePayload(parsed: ServerStatePayload | null | undefined): PersistedState {
    const p = parsed ?? {};
    const accounts: Account[] = Array.isArray(p.accounts)
        ? p.accounts.map((acc) => ({
              ...acc,
              cashBalance: acc.cashBalance !== undefined ? acc.cashBalance : acc.initialCashBalance || 0,
          }))
        : [];

    let accountTypes = INITIAL_ACCOUNT_TYPES;
    if (Array.isArray(p.accountTypes) && p.accountTypes.length > 0) {
        accountTypes = p.accountTypes;
    } else if (accounts.length > 0) {
        const usedTypes = accounts.map((a) => a.type).filter(Boolean);
        accountTypes = Array.from(new Set([...INITIAL_ACCOUNT_TYPES, ...usedTypes]));
    }

    const netWorthHistory = Array.isArray(p.netWorthHistory)
        ? p.netWorthHistory.filter((h) => !Number.isNaN(h.value) && h.value !== null)
        : [];

    return {
        members: Array.isArray(p.members) ? p.members : [],
        institutions: Array.isArray(p.institutions) ? p.institutions : [],
        accountTypes,
        accounts,
        transactions: Array.isArray(p.transactions) ? p.transactions : [],
        assets: Array.isArray(p.assets) ? p.assets : [],
        netWorthHistory,
        lastUpdated: p.lastUpdated ? new Date(p.lastUpdated) : null,
        backupPath: typeof p.backupPath === 'string' ? p.backupPath : '',
        watchlist: Array.isArray(p.watchlist) ? p.watchlist : [],
        watchlistLastUpdated: p.watchlistLastUpdated ? new Date(p.watchlistLastUpdated) : null,
        acbAccounts: Array.isArray(p.acbAccounts) ? p.acbAccounts : [],
        acbTransactions: Array.isArray(p.acbTransactions) ? p.acbTransactions : [],
        bankAccounts: Array.isArray(p.bankAccounts) ? p.bankAccounts : [],
        liabilities: Array.isArray(p.liabilities) ? p.liabilities : [],
        monthlyExpenses: Array.isArray(p.monthlyExpenses) ? p.monthlyExpenses : [],
        preferences: p.preferences ? { ...DEFAULT_PREFERENCES, ...p.preferences } : DEFAULT_PREFERENCES,
        exchangeRate: typeof p.exchangeRate === 'number' && p.exchangeRate > 0 ? p.exchangeRate : 1.0,
        isDemoData: Boolean(p.isDemoData),
        savedAt: p.savedAt,
    };
}

export function loadInitialState(): PersistedState {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return normalizePayload(null);
        return normalizePayload(JSON.parse(raw) as ServerStatePayload);
    } catch {
        return normalizePayload(null);
    }
}

export function toSyncPayload(state: PersistedState, savedAt: string): ServerStatePayload {
    return {
        members: state.members,
        institutions: state.institutions,
        accountTypes: state.accountTypes,
        accounts: state.accounts,
        transactions: state.transactions,
        assets: state.assets,
        netWorthHistory: state.netWorthHistory,
        lastUpdated: state.lastUpdated ? state.lastUpdated.toISOString() : null,
        backupPath: state.backupPath,
        watchlist: state.watchlist,
        watchlistLastUpdated: state.watchlistLastUpdated
            ? state.watchlistLastUpdated.toISOString()
            : null,
        acbAccounts: state.acbAccounts,
        acbTransactions: state.acbTransactions,
        bankAccounts: state.bankAccounts,
        liabilities: state.liabilities,
        monthlyExpenses: state.monthlyExpenses,
        preferences: state.preferences,
        exchangeRate: state.exchangeRate,
        isDemoData: state.isDemoData,
        savedAt,
    };
}

function isLocalEmpty(s: PersistedState): boolean {
    return (
        s.members.length === 0 &&
        s.accounts.length === 0 &&
        s.transactions.length === 0 &&
        s.assets.length === 0
    );
}

function hasServerData(s: ServerStatePayload): boolean {
    return Boolean(
        (s.members && s.members.length > 0) ||
            (s.accounts && s.accounts.length > 0) ||
            (s.transactions && s.transactions.length > 0) ||
            (s.assets && s.assets.length > 0)
    );
}

export function useServerSync(
    state: PersistedState,
    onHydrate: (hydrated: PersistedState) => void
): void {
    const hydratedRef = useRef(false);
    const initialStateRef = useRef(state);
    const onHydrateRef = useRef(onHydrate);

    useEffect(() => {
        onHydrateRef.current = onHydrate;
    }, [onHydrate]);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const serverData = await apiFetch<ServerStatePayload>('/api/state');
                if (cancelled) return;
                const local = initialStateRef.current;
                const localTime = local.savedAt ? Date.parse(local.savedAt) : 0;
                const serverTime = serverData.savedAt ? Date.parse(serverData.savedAt) : 0;

                const shouldAdopt =
                    hasServerData(serverData) &&
                    (isLocalEmpty(local) || (!Number.isNaN(serverTime) && serverTime > localTime));

                if (shouldAdopt) {
                    const normalized = normalizePayload(serverData);
                    onHydrateRef.current(normalized);
                }
            } catch {
                // Server may be offline during standalone frontend preview
            } finally {
                if (!cancelled) {
                    hydratedRef.current = true;
                }
            }
        })();

        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        if (!hydratedRef.current) return;
        const savedAt = new Date().toISOString();
        const payload = toSyncPayload(state, savedAt);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));

        const timer = setTimeout(() => {
            apiPostJson('/api/sync', payload).catch((err) =>
                console.warn('Sync failed (server might be down):', err)
            );
        }, 2000);

        return () => clearTimeout(timer);
    }, [state]);
}
