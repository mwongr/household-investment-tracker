import React, { useMemo, useState, useEffect } from 'react';
import { X, Check, AlertTriangle, ListPlus } from 'lucide-react';
import { useData } from '../context/DataContext';
import type { AcbTransaction, AcbTransactionType, Transaction } from '../types';

interface ImportAcbTxModalProps {
    isOpen: boolean;
    onClose: () => void;
    acbAccountId: string;
    acbAccountName: string;
    initialTicker?: string | null;
    onImported: (importedTickers: string[]) => void;
}

const MAPPABLE_TYPES = new Set<Transaction['type']>([
    'Buy',
    'Sell',
    'DRIP',
    'Dividend Reinvested',
    'Stock Split',
]);

function mapTransactionType(type: Transaction['type']): AcbTransactionType | null {
    switch (type) {
        case 'Buy':
            return 'Buy';
        case 'Sell':
            return 'Sell';
        case 'DRIP':
        case 'Dividend Reinvested':
            return 'Reinvested Dividend';
        case 'Stock Split':
            return 'Split';
        default:
            return null;
    }
}

function normalizeDate(dateStr: string): string {
    return dateStr ? dateStr.split('T')[0] : '';
}

function buildAcbPayload(
    tx: Transaction,
    acbAccountId: string,
    accountName: string,
    convertUsdToCad: boolean,
    exchangeRate: number
): Omit<AcbTransaction, 'id'> | null {
    const mappedType = mapTransactionType(tx.type);
    const ticker = tx.ticker?.trim().toUpperCase();
    if (!mappedType || !ticker) return null;

    const isUsd = tx.currency === 'USD';
    const fx = isUsd && convertUsdToCad ? exchangeRate : 1;
    const round2 = (n: number) => Math.round(n * 100) / 100;
    const round4 = (n: number) => Math.round(n * 10000) / 10000;

    const memoParts = [`Imported from ${accountName}`];
    if (isUsd && convertUsdToCad) {
        memoParts.push(`USD->CAD @ ${exchangeRate.toFixed(4)}`);
    } else if (isUsd) {
        memoParts.push('USD');
    }

    const base: Omit<AcbTransaction, 'id'> = {
        acbAccountId,
        sourceTransactionId: tx.id,
        ticker,
        date: normalizeDate(tx.date),
        type: mappedType,
        memo: memoParts.join(' • '),
    };

    if (mappedType === 'Buy' || mappedType === 'Sell') {
        const shares = tx.shares ?? 0;
        const rawPrice =
            tx.pricePerShare !== undefined
                ? tx.pricePerShare
                : shares > 0
                  ? Math.max(0, (tx.amount - (tx.commission ?? 0)) / shares)
                  : 0;
        return {
            ...base,
            shares,
            pricePerShare: round4(rawPrice * fx),
            commission: tx.commission ? round2(tx.commission * fx) : 0,
        };
    }

    if (mappedType === 'Reinvested Dividend') {
        const rawAmount =
            tx.amount || (tx.shares && tx.pricePerShare ? tx.shares * tx.pricePerShare : 0);
        return {
            ...base,
            reinvestedAmount: round2(rawAmount * fx),
            reinvestedShares: tx.shares ?? 0,
        };
    }

    // Split
    return {
        ...base,
        splitFrom: tx.splitFrom ?? 1,
        splitTo: tx.splitTo ?? 1,
    };
}

const fmt2 = (n: number) =>
    n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmt4 = (n: number) =>
    n.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 });

export const ImportAcbTxModal: React.FC<ImportAcbTxModalProps> = ({
    isOpen,
    onClose,
    acbAccountId,
    acbAccountName,
    initialTicker,
    onImported,
}) => {
    const {
        accounts,
        members,
        transactions,
        acbTransactions,
        addAcbTransactions,
        exchangeRate,
    } = useData();

    // Prioritize Cash / Margin accounts at the top, while still showing all accounts
    const sortedAccounts = useMemo(() => {
        const isPriority = (type: string) => {
            const t = type.toLowerCase();
            return t === 'cash' || t === 'margin' || t.includes('non-reg');
        };
        return [...accounts].sort((a, b) => {
            const aPrio = isPriority(a.type) ? 0 : 1;
            const bPrio = isPriority(b.type) ? 0 : 1;
            if (aPrio !== bPrio) return aPrio - bPrio;
            return a.name.localeCompare(b.name);
        });
    }, [accounts]);

    const [sourceAccountId, setSourceAccountId] = useState<string>('');
    const [filterTicker, setFilterTicker] = useState<string>('All');
    const [filterType, setFilterType] = useState<string>('All');
    const [filterYear, setFilterYear] = useState<string>('All');
    const [hideImported, setHideImported] = useState<boolean>(false);
    const [convertUsdToCad, setConvertUsdToCad] = useState<boolean>(true);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    // Initialize defaults when modal opens
    useEffect(() => {
        if (!isOpen) return;
        const defaultAccId = sortedAccounts[0]?.id ?? '';
        setSourceAccountId(prev =>
            prev && sortedAccounts.some(a => a.id === prev) ? prev : defaultAccId
        );
        setFilterType('All');
        setFilterYear('All');
        setSelectedIds(new Set());
    }, [isOpen, sortedAccounts]);

    // Sync ticker filter with active ticker when account changes or modal opens
    const eligibleAccountTxs = useMemo(() => {
        if (!sourceAccountId) return [];
        return transactions
            .filter(
                tx =>
                    tx.accountId === sourceAccountId &&
                    MAPPABLE_TYPES.has(tx.type) &&
                    Boolean(tx.ticker?.trim())
            )
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [transactions, sourceAccountId]);

    const availableTickers = useMemo(() => {
        const set = new Set(
            eligibleAccountTxs.map(tx => tx.ticker!.trim().toUpperCase())
        );
        return Array.from(set).sort();
    }, [eligibleAccountTxs]);

    const availableYears = useMemo(() => {
        const set = new Set(
            eligibleAccountTxs.map(tx => normalizeDate(tx.date).substring(0, 4)).filter(Boolean)
        );
        return Array.from(set).sort().reverse();
    }, [eligibleAccountTxs]);

    useEffect(() => {
        if (!isOpen) return;
        if (initialTicker && availableTickers.includes(initialTicker.toUpperCase())) {
            setFilterTicker(initialTicker.toUpperCase());
        } else {
            setFilterTicker('All');
        }
        setSelectedIds(new Set());
    }, [isOpen, sourceAccountId, initialTicker, availableTickers]);

    // Duplicate detection sets for the target ACB account
    const { importedSourceIds, softMatchKeys } = useMemo(() => {
        const exactIds = new Set<string>();
        const softKeys = new Set<string>();
        for (const t of acbTransactions) {
            if (t.acbAccountId !== acbAccountId) continue;
            if (t.sourceTransactionId) {
                exactIds.add(t.sourceTransactionId);
            } else {
                softKeys.add(`${normalizeDate(t.date)}|${t.ticker.toUpperCase()}|${t.type}`);
            }
        }
        return { importedSourceIds: exactIds, softMatchKeys: softKeys };
    }, [acbTransactions, acbAccountId]);

    const filteredTxs = useMemo(() => {
        return eligibleAccountTxs.filter(tx => {
            const ticker = tx.ticker!.trim().toUpperCase();
            const mappedType = mapTransactionType(tx.type);
            const year = normalizeDate(tx.date).substring(0, 4);
            const isImported = importedSourceIds.has(tx.id);

            if (hideImported && isImported) return false;
            if (filterTicker !== 'All' && ticker !== filterTicker) return false;
            if (filterType !== 'All' && mappedType !== filterType) return false;
            if (filterYear !== 'All' && year !== filterYear) return false;
            return true;
        });
    }, [
        eligibleAccountTxs,
        filterTicker,
        filterType,
        filterYear,
        hideImported,
        importedSourceIds,
    ]);

    const selectableVisibleIds = useMemo(
        () => filteredTxs.filter(tx => !importedSourceIds.has(tx.id)).map(tx => tx.id),
        [filteredTxs, importedSourceIds]
    );

    const allVisibleSelected =
        selectableVisibleIds.length > 0 &&
        selectableVisibleIds.every(id => selectedIds.has(id));

    const hasUsdInView = useMemo(
        () => filteredTxs.some(tx => tx.currency === 'USD'),
        [filteredTxs]
    );

    if (!isOpen) return null;

    const getMemberName = (memberId: string) =>
        members.find(m => m.id === memberId)?.name || 'Unknown';

    const selectedAccount = accounts.find(a => a.id === sourceAccountId);

    const toggleOne = (id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const toggleAllVisible = () => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (allVisibleSelected) {
                selectableVisibleIds.forEach(id => next.delete(id));
            } else {
                selectableVisibleIds.forEach(id => next.add(id));
            }
            return next;
        });
    };

    const handleImport = () => {
        const accountName = selectedAccount?.name || 'Portfolio Account';
        const chosen = eligibleAccountTxs.filter(
            tx => selectedIds.has(tx.id) && !importedSourceIds.has(tx.id)
        );
        const payloads = chosen
            .map(tx =>
                buildAcbPayload(tx, acbAccountId, accountName, convertUsdToCad, exchangeRate)
            )
            .filter((p): p is Omit<AcbTransaction, 'id'> => p !== null);

        if (payloads.length > 0) {
            addAcbTransactions(payloads);
            const importedTickers = Array.from(new Set(payloads.map(p => p.ticker)));
            onImported(importedTickers);
        }
        onClose();
    };

    const selectClass =
        'w-full bg-slate-900 border border-slate-700 text-white rounded-xl px-3 py-2 text-sm font-medium focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20';

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800 rounded-2xl w-full max-w-4xl max-h-[90vh] border border-slate-700 shadow-2xl flex flex-col overflow-hidden">
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-700/80 flex justify-between items-center bg-slate-900/60">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-500/15 border border-blue-500/35 rounded-xl text-blue-400">
                            <ListPlus size={20} />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-white">
                                Import Transactions into {acbAccountName}
                            </h3>
                            <p className="text-xs text-slate-300">
                                Choose existing trades from a portfolio account to add to your ACB history
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 bg-slate-900 border border-slate-700 rounded-lg text-slate-300 hover:text-white transition-colors"
                        aria-label="Close modal"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Filters */}
                <div className="p-5 border-b border-slate-700/80 bg-slate-900/30 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        <div>
                            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                                Source Account
                            </label>
                            <select
                                className={selectClass}
                                value={sourceAccountId}
                                onChange={e => setSourceAccountId(e.target.value)}
                            >
                                {sortedAccounts.length === 0 ? (
                                    <option value="">No accounts found</option>
                                ) : (
                                    sortedAccounts.map(acc => (
                                        <option key={acc.id} value={acc.id}>
                                            {acc.name} — {getMemberName(acc.memberId)} ({acc.type})
                                        </option>
                                    ))
                                )}
                            </select>
                        </div>

                        <div>
                            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                                Ticker
                            </label>
                            <select
                                className={`${selectClass} font-mono`}
                                value={filterTicker}
                                onChange={e => setFilterTicker(e.target.value)}
                            >
                                <option value="All">All Tickers</option>
                                {availableTickers.map(t => (
                                    <option key={t} value={t}>
                                        {t}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                                ACB Type
                            </label>
                            <select
                                className={selectClass}
                                value={filterType}
                                onChange={e => setFilterType(e.target.value)}
                            >
                                <option value="All">All Relevant Types</option>
                                <option value="Buy">Buy</option>
                                <option value="Sell">Sell</option>
                                <option value="Reinvested Dividend">Reinvested Dividend (DRIP)</option>
                                <option value="Split">Split</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                                Year
                            </label>
                            <select
                                className={`${selectClass} font-mono`}
                                value={filterYear}
                                onChange={e => setFilterYear(e.target.value)}
                            >
                                <option value="All">All Years</option>
                                {availableYears.map(y => (
                                    <option key={y} value={y}>
                                        {y}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                        <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-300 cursor-pointer select-none">
                            <input
                                type="checkbox"
                                className="accent-blue-500 rounded"
                                checked={hideImported}
                                onChange={e => setHideImported(e.target.checked)}
                            />
                            Hide already imported
                        </label>

                        {hasUsdInView && (
                            <label className="inline-flex items-center gap-2 text-xs font-medium text-amber-300 cursor-pointer select-none">
                                <input
                                    type="checkbox"
                                    className="accent-blue-500 rounded"
                                    checked={convertUsdToCad}
                                    onChange={e => setConvertUsdToCad(e.target.checked)}
                                />
                                Convert USD to CAD using current rate (1 USD = {exchangeRate.toFixed(4)} CAD)
                            </label>
                        )}
                    </div>
                </div>

                {/* Transactions Table */}
                <div className="flex-1 overflow-y-auto">
                    {filteredTxs.length === 0 ? (
                        <div className="p-12 text-center text-slate-400 text-sm">
                            {sortedAccounts.length === 0
                                ? 'No portfolio accounts exist yet.'
                                : 'No matching Buy, Sell, DRIP, or Split transactions found for the selected filters.'}
                        </div>
                    ) : (
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-slate-900/80 sticky top-0 z-10 border-b border-slate-700/80">
                                <tr className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                                    <th className="py-3 px-4 w-10">
                                        <input
                                            type="checkbox"
                                            className="accent-blue-500 cursor-pointer"
                                            checked={allVisibleSelected}
                                            disabled={selectableVisibleIds.length === 0}
                                            onChange={toggleAllVisible}
                                            aria-label="Select all visible transactions"
                                        />
                                    </th>
                                    <th className="py-3 px-3">Date</th>
                                    <th className="py-3 px-3">Ticker</th>
                                    <th className="py-3 px-3">Type</th>
                                    <th className="py-3 px-3">Details</th>
                                    <th className="py-3 px-4 text-right">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-700/60 text-sm">
                                {filteredTxs.map(tx => {
                                    const ticker = tx.ticker!.trim().toUpperCase();
                                    const date = normalizeDate(tx.date);
                                    const mappedType = mapTransactionType(tx.type)!;
                                    const isImported = importedSourceIds.has(tx.id);
                                    const isSoftMatch =
                                        !isImported &&
                                        softMatchKeys.has(`${date}|${ticker}|${mappedType}`);
                                    const isChecked = selectedIds.has(tx.id);
                                    const isUsd = tx.currency === 'USD';
                                    const fx = isUsd && convertUsdToCad ? exchangeRate : 1;

                                    return (
                                        <tr
                                            key={tx.id}
                                            onClick={() => {
                                                if (!isImported) toggleOne(tx.id);
                                            }}
                                            className={`transition-colors ${
                                                isImported
                                                    ? 'opacity-50 bg-slate-900/30 cursor-not-allowed'
                                                    : isChecked
                                                      ? 'bg-blue-500/10 hover:bg-blue-500/15 cursor-pointer'
                                                      : 'hover:bg-slate-700/30 cursor-pointer'
                                            }`}
                                        >
                                            <td
                                                className="py-3 px-4"
                                                onClick={e => e.stopPropagation()}
                                            >
                                                <input
                                                    type="checkbox"
                                                    className="accent-blue-500 cursor-pointer disabled:cursor-not-allowed"
                                                    checked={isChecked}
                                                    disabled={isImported}
                                                    onChange={() => toggleOne(tx.id)}
                                                    aria-label={`Select ${ticker} ${mappedType} on ${date}`}
                                                />
                                            </td>
                                            <td className="py-3 px-3 font-mono text-xs text-slate-200 whitespace-nowrap">
                                                {date}
                                            </td>
                                            <td className="py-3 px-3 whitespace-nowrap">
                                                <span className="font-mono font-bold text-white">
                                                    {ticker}
                                                </span>
                                                {isUsd && (
                                                    <span className="ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
                                                        USD
                                                    </span>
                                                )}
                                            </td>
                                            <td className="py-3 px-3 text-slate-200 whitespace-nowrap">
                                                <span>{mappedType}</span>
                                                {tx.type !== mappedType && (
                                                    <span className="ml-1.5 text-[11px] text-slate-400">
                                                        ({tx.type})
                                                    </span>
                                                )}
                                            </td>
                                            <td className="py-3 px-3 font-mono text-xs text-slate-300">
                                                {(mappedType === 'Buy' || mappedType === 'Sell') && (
                                                    <span>
                                                        {tx.shares ?? 0} shs @ $
                                                        {fmt4((tx.pricePerShare ?? 0) * fx)}
                                                        {(tx.commission ?? 0) > 0 &&
                                                            ` (+$${fmt2((tx.commission ?? 0) * fx)} comm)`}
                                                    </span>
                                                )}
                                                {mappedType === 'Reinvested Dividend' && (
                                                    <span>
                                                        {tx.shares ?? 0} shs • $
                                                        {fmt2((tx.amount ?? 0) * fx)} reinvested
                                                    </span>
                                                )}
                                                {mappedType === 'Split' && (
                                                    <span>
                                                        {tx.splitTo ?? 1}-for-{tx.splitFrom ?? 1}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="py-3 px-4 text-right whitespace-nowrap">
                                                {isImported ? (
                                                    <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-lg bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                                                        <Check size={12} /> Imported
                                                    </span>
                                                ) : isSoftMatch ? (
                                                    <span
                                                        className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-lg bg-amber-500/15 text-amber-300 border border-amber-500/30"
                                                        title="An ACB entry with the same date, ticker, and type already exists"
                                                    >
                                                        <AlertTriangle size={12} /> Possible match
                                                    </span>
                                                ) : (
                                                    <span className="text-xs text-slate-400">Ready</span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-slate-700/80 bg-slate-900/60 flex flex-wrap justify-between items-center gap-3">
                    <span className="text-xs text-slate-300 font-medium">
                        {selectedIds.size === 0
                            ? 'Select transactions above to import'
                            : `${selectedIds.size} transaction${selectedIds.size === 1 ? '' : 's'} selected`}
                    </span>
                    <div className="flex items-center gap-2.5">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 bg-slate-900 hover:bg-slate-750 border border-slate-700 text-slate-200 hover:text-white rounded-xl text-sm font-semibold transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={handleImport}
                            disabled={selectedIds.size === 0}
                            style={{ color: '#ffffff' }}
                            className="inline-flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-45 disabled:cursor-not-allowed rounded-xl text-sm font-semibold transition-colors"
                        >
                            <ListPlus size={16} />
                            Import Selected ({selectedIds.size})
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
