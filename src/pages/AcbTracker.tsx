import React, { useState, useMemo } from 'react';
import { useData } from '../context/DataContext';
import { Calculator, Plus, Trash2, ChevronRight, X, ChevronDown, Download, Pencil, ListPlus, LayoutGrid, List, ArrowLeft } from 'lucide-react';
import type { AcbTransactionType, AcbTransaction } from '../types';
import { ImportAcbTxModal } from '../components/ImportAcbTxModal';
import '../styles/shared.css';

interface AcbHistoryRow {
    tx: AcbTransaction;
    sharesChange: number;
    sharesAfter: number;
    acbChange: number;
    acbAfter: number;
    acbPerShare: number;
    capitalGainOrLoss: number;
}

interface AcbTxFormState {
    ticker?: string;
    type: AcbTransactionType;
    date: string;
    memo?: string;
    shares?: number | string;
    pricePerShare?: number | string;
    commission?: number | string;
    amount?: number | string;
    amountPerShare?: boolean;
    reinvestedAmount?: number | string;
    reinvestedShares?: number | string;
    splitFrom?: number | string;
    splitTo?: number | string;
}

const fmt2 = (n: number) =>
    n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmt4 = (n: number) =>
    n.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 });

// Format shares to maximum 4 decimals while trimming trailing zeroes
const formatShares = (value: number) => {
    if (Math.abs(value - Math.round(value)) < 0.0001) {
        return Math.round(value).toLocaleString();
    }
    const num = Number(value.toFixed(4));
    return num.toLocaleString(undefined, { maximumFractionDigits: 4 });
};

const getRowPriceAndAmount = (row: AcbHistoryRow) => {
    const tx = row.tx;
    if (tx.type === 'Buy') {
        const price =
            tx.pricePerShare !== undefined
                ? tx.pricePerShare
                : tx.shares
                  ? (row.acbChange - (tx.commission ?? 0)) / tx.shares
                  : 0;
        const amount = (tx.shares ?? 0) * (tx.pricePerShare ?? 0) + (tx.commission ?? 0);
        return {
            price: price ? `$${fmt4(price)}` : '—',
            rawPrice: price,
            amount: amount ? `$${fmt2(amount)}` : '—',
            rawAmount: amount,
            commission: tx.commission,
        };
    }
    if (tx.type === 'Sell') {
        const price = tx.pricePerShare ?? 0;
        const amount = (tx.shares ?? 0) * (tx.pricePerShare ?? 0) - (tx.commission ?? 0);
        return {
            price: price ? `$${fmt4(price)}` : '—',
            rawPrice: price,
            amount: amount ? `$${fmt2(amount)}` : '—',
            rawAmount: amount,
            commission: tx.commission,
        };
    }
    if (tx.type === 'Reinvested Dividend' || tx.type === 'Reinvested Capital Gains Distribution') {
        const price =
            tx.reinvestedShares && tx.reinvestedAmount
                ? tx.reinvestedAmount / tx.reinvestedShares
                : 0;
        return {
            price: price ? `$${fmt4(price)}` : '—',
            rawPrice: price,
            amount: tx.reinvestedAmount ? `$${fmt2(tx.reinvestedAmount)}` : '—',
            rawAmount: tx.reinvestedAmount ?? 0,
        };
    }
    if (tx.type === 'Return of Capital' || tx.type === 'Capital Gains Dividend') {
        const price = tx.amountPerShare && tx.amount ? tx.amount : 0;
        return {
            price: price ? `$${fmt4(price)}` : '—',
            rawPrice: price,
            amount: tx.amount ? `$${fmt2(tx.amount)}` : '—',
            rawAmount: tx.amount ?? 0,
        };
    }
    return {
        price: '—',
        rawPrice: 0,
        amount: '—',
        rawAmount: 0,
    };
};

const getSameDayOrder = (tx: AcbTransaction) => {
    switch (tx.type) {
        case 'Buy':
        case 'Reinvested Dividend':
        case 'Reinvested Capital Gains Distribution':
            return 0;
        case 'Sell':
            return 1;
        case 'Split':
            return (tx.shares || 0) < 0 ? 2 : 3;
        default:
            return 4;
    }
};

function computeAcbHistory(txs: AcbTransaction[]) {
    const sorted = [...txs].sort((a, b) => {
        const dateDiff = new Date(a.date).getTime() - new Date(b.date).getTime();
        if (dateDiff !== 0) return dateDiff;
        return getSameDayOrder(a) - getSameDayOrder(b);
    });
    const rows: AcbHistoryRow[] = [];
    let runningShares = 0;
    let runningAcb = 0;
    let totalCg = 0;

    for (const tx of sorted) {
        let sharesChange = 0;
        let acbChange = 0;
        let capitalGainOrLoss = 0;

        switch (tx.type) {
            case 'Buy':
                sharesChange = tx.shares || 0;
                acbChange = (tx.shares || 0) * (tx.pricePerShare || 0) + (tx.commission || 0);
                break;
            case 'Sell': {
                sharesChange = -(tx.shares || 0);
                const costFraction = runningShares > 0 ? (tx.shares || 0) / runningShares : 0;
                acbChange = -(costFraction * runningAcb);
                const proceeds = (tx.shares || 0) * (tx.pricePerShare || 0) - (tx.commission || 0);
                capitalGainOrLoss = proceeds + acbChange;
                break;
            }
            case 'Return of Capital':
                acbChange = -(tx.amount || 0);
                if (runningAcb + acbChange < 0) {
                    capitalGainOrLoss = -(runningAcb + acbChange);
                    acbChange = -runningAcb;
                }
                break;
            case 'Capital Gains Dividend':
                if (tx.amountPerShare && tx.amount) {
                    capitalGainOrLoss = tx.amount * runningShares;
                } else {
                    capitalGainOrLoss = tx.amount || 0;
                }
                break;
            case 'Reinvested Dividend':
            case 'Reinvested Capital Gains Distribution':
                sharesChange = tx.reinvestedShares || 0;
                acbChange = tx.reinvestedAmount || 0;
                break;
            case 'Split': {
                if (tx.splitFrom && tx.splitTo) {
                    const newShares = (runningShares * tx.splitTo) / tx.splitFrom;
                    sharesChange = newShares - runningShares;
                } else if (tx.shares) {
                    sharesChange = tx.shares;
                }
                break;
            }
        }

        runningShares += sharesChange;
        runningAcb += acbChange;
        totalCg += capitalGainOrLoss;

        if (Math.abs(runningShares) < 0.0001) runningShares = 0;
        if (Math.abs(runningAcb) < 0.0001) runningAcb = 0;

        rows.push({
            tx,
            sharesChange,
            sharesAfter: runningShares,
            acbChange,
            acbAfter: runningAcb,
            acbPerShare: runningShares > 0 ? runningAcb / runningShares : 0,
            capitalGainOrLoss,
        });
    }

    return {
        rows,
        shares: runningShares,
        acb: runningAcb,
        acbPerShare: runningShares > 0 ? runningAcb / runningShares : 0,
        cg: totalCg,
    };
}

const AcbTracker = () => {
    const {
        acbAccounts,
        acbTransactions,
        addAcbAccount,
        deleteAcbAccount,
        addAcbTransaction,
        updateAcbTransaction,
        deleteAcbTransaction,
        deleteAcbTicker,
    } = useData();
    const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
    const [selectedTicker, setSelectedTicker] = useState<string | null>(null);
    const [holdingsView, setHoldingsView] = useState<'table' | 'cards'>('table');

    // Modals
    const [isAddAccountModalOpen, setIsAddAccountModalOpen] = useState(false);
    const [newAccountName, setNewAccountName] = useState('');
    const [isAddTxModalOpen, setIsAddTxModalOpen] = useState(false);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [editingTxId, setEditingTxId] = useState<string | null>(null);

    // Transaction Form State
    const [txForm, setTxForm] = useState<AcbTxFormState>({
        type: 'Buy',
        date: new Date().toISOString().split('T')[0],
        memo: '',
    });

    // Filtering
    const [selectedYear, setSelectedYear] = useState<string>('All');

    // Derived Data
    const selectedAccount = acbAccounts.find(a => a.id === selectedAccountId);

    const tickersInAccount = useMemo(() => {
        if (!selectedAccountId) return [];
        const txs = acbTransactions.filter(t => t.acbAccountId === selectedAccountId);
        return Array.from(new Set(txs.map(t => t.ticker))).sort();
    }, [acbTransactions, selectedAccountId]);

    const historyRows = useMemo(() => {
        if (!selectedAccountId || !selectedTicker) return [];
        const txs = acbTransactions.filter(
            t => t.acbAccountId === selectedAccountId && t.ticker === selectedTicker
        );
        return computeAcbHistory(txs).rows.reverse();
    }, [acbTransactions, selectedAccountId, selectedTicker]);

    const filteredRows = useMemo(() => {
        if (selectedYear === 'All') return historyRows;
        return historyRows.filter(row => row.tx.date.startsWith(selectedYear));
    }, [historyRows, selectedYear]);

    const availableYears = useMemo(() => {
        const years = Array.from(new Set(historyRows.map(r => r.tx.date.substring(0, 4))));
        return years.sort().reverse();
    }, [historyRows]);

    const yearSummary = useMemo(() => {
        if (!selectedYear || selectedYear === 'All') return null;

        let totalGains = 0;
        let dividends = 0;
        let buys = 0;
        let sells = 0;

        for (const row of filteredRows) {
            if (row.tx.type === 'Sell') {
                totalGains += row.capitalGainOrLoss;
                sells++;
            } else if (row.tx.type === 'Capital Gains Dividend') {
                totalGains += row.capitalGainOrLoss;
                dividends++;
            } else if (row.tx.type === 'Buy') {
                buys++;
            }
        }

        return { totalGains, dividends, buys, sells };
    }, [filteredRows, selectedYear]);

    const accountSummaries = useMemo(() => {
        if (!selectedAccountId) return [];
        return tickersInAccount.map(ticker => {
            const txs = acbTransactions.filter(t => t.acbAccountId === selectedAccountId && t.ticker === ticker);
            const summary = computeAcbHistory(txs);
            return {
                ticker,
                shares: summary.shares,
                acb: summary.acb,
                acbPerShare: summary.acbPerShare,
                cg: summary.cg,
            };
        });
    }, [tickersInAccount, acbTransactions, selectedAccountId]);

    const allAccountOverviews = useMemo(() => {
        return acbAccounts.map(account => {
            const accTxs = acbTransactions.filter(t => t.acbAccountId === account.id);
            const tickers = Array.from(new Set(accTxs.map(t => t.ticker))).sort();
            let totalAcb = 0;
            let totalCg = 0;
            let activeCount = 0;

            for (const ticker of tickers) {
                const summary = computeAcbHistory(accTxs.filter(t => t.ticker === ticker));
                totalAcb += summary.acb;
                totalCg += summary.cg;
                if (summary.shares > 0) activeCount++;
            }

            return {
                account,
                tickers,
                activeCount,
                txCount: accTxs.length,
                totalAcb,
                totalCg,
            };
        });
    }, [acbAccounts, acbTransactions]);

    // Handlers
    const handleAddAccount = (e: React.FormEvent) => {
        e.preventDefault();
        if (newAccountName.trim()) {
            addAcbAccount(newAccountName.trim());
            setNewAccountName('');
            setIsAddAccountModalOpen(false);
        }
    };

    const handleAddTransaction = (e: React.FormEvent) => {
        e.preventDefault();
        const normalizedTicker = txForm.ticker?.trim().toUpperCase();
        if (selectedAccountId && normalizedTicker && txForm.date && txForm.type) {
            const cleanNumber = (val: number | string | undefined) =>
                val === '' || val === undefined || val === null ? undefined : Number(val);

            const payload: Omit<AcbTransaction, 'id'> = {
                acbAccountId: selectedAccountId,
                ticker: normalizedTicker,
                date: txForm.date,
                type: txForm.type,
                memo: txForm.memo,
                shares: cleanNumber(txForm.shares),
                pricePerShare: cleanNumber(txForm.pricePerShare),
                commission: cleanNumber(txForm.commission),
                amount: cleanNumber(txForm.amount),
                amountPerShare: txForm.amountPerShare,
                reinvestedAmount: cleanNumber(txForm.reinvestedAmount),
                reinvestedShares: cleanNumber(txForm.reinvestedShares),
                splitFrom: cleanNumber(txForm.splitFrom),
                splitTo: cleanNumber(txForm.splitTo),
            };

            if (editingTxId) {
                updateAcbTransaction(editingTxId, payload);
            } else {
                addAcbTransaction(payload);
            }

            setIsAddTxModalOpen(false);
            setEditingTxId(null);
            setTxForm({
                type: 'Buy',
                date: new Date().toISOString().split('T')[0],
                memo: '',
                ticker: normalizedTicker,
            });
            setSelectedTicker(normalizedTicker);
        }
    };

    const openEditModal = (tx: AcbTransaction) => {
        setTxForm({ ...tx });
        setEditingTxId(tx.id);
        setIsAddTxModalOpen(true);
    };

    const handleExportCsv = () => {
        if (!selectedTicker || filteredRows.length === 0) return;

        const headers = [
            'Date',
            'Transaction',
            'Memo',
            'Price/Share',
            'Amount',
            'Shares Change',
            'Shares Balance',
            'ACB Change',
            'Total ACB',
            'ACB/Share',
            'Capital Gain/Loss',
        ];

        const formatNumber = (num: number) => num.toFixed(4);

        const rows = filteredRows.map(row => {
            const info = getRowPriceAndAmount(row);
            return [
                row.tx.date,
                row.tx.type,
                `"${row.tx.memo?.replace(/"/g, '""') || ''}"`,
                formatNumber(info.rawPrice),
                formatNumber(info.rawAmount),
                formatNumber(row.sharesChange),
                formatNumber(row.sharesAfter),
                formatNumber(row.acbChange),
                formatNumber(row.acbAfter),
                formatNumber(row.acbPerShare),
                formatNumber(row.capitalGainOrLoss),
            ].join(',');
        });

        const csvContent = [headers.join(','), ...rows].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute(
            'download',
            `acb_history_${selectedTicker.replace(/[^a-z0-9]/gi, '_')}_${selectedYear}.csv`
        );
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const inputClass =
        'w-full bg-slate-900 border border-slate-700 text-white placeholder-slate-400 rounded-xl px-3.5 py-2 text-sm font-medium focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20';

    return (
        <div className="space-y-6 pb-12">
            {/* Page Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                    <div className="p-3 bg-blue-500/15 rounded-2xl border border-blue-500/35 text-blue-400 shadow-sm">
                        <Calculator size={24} />
                    </div>
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">ACB Tracker</h1>
                        <p className="text-sm text-slate-300 mt-0.5">
                            Track Adjusted Cost Base, Return of Capital &amp; capital gains for non-registered accounts
                        </p>
                    </div>
                </div>
                <button
                    onClick={() => setIsAddAccountModalOpen(true)}
                    style={{ color: '#ffffff' }}
                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 rounded-xl text-sm font-semibold shadow-sm transition-colors self-start sm:self-auto"
                >
                    <Plus size={17} /> New ACB Account
                </button>
            </div>

            <div className="flex flex-col lg:flex-row items-start gap-6">
                {/* Left Sidebar: Accounts */}
                <aside className="w-full lg:w-72 shrink-0 flex flex-col gap-3 lg:sticky lg:top-24">
                    <div className="flex justify-between items-center bg-slate-800/95 px-4 py-3.5 rounded-2xl border border-slate-700/90 shadow-xl">
                        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-200 flex items-center gap-2">
                            <Calculator size={16} className="text-blue-400" />
                            <span>ACB Accounts</span>
                        </h2>
                        <button
                            onClick={() => setIsAddAccountModalOpen(true)}
                            className="p-1.5 bg-blue-500/15 border border-blue-500/35 text-blue-400 hover:bg-blue-500/25 rounded-lg transition-colors"
                            title="Add ACB Account"
                            aria-label="Add ACB Account"
                        >
                            <Plus size={16} />
                        </button>
                    </div>

                    <div className="flex flex-col gap-2">
                        {acbAccounts.length === 0 ? (
                            <div className="text-center p-6 bg-slate-800/95 rounded-2xl border border-dashed border-slate-700 space-y-3">
                                <p className="text-slate-300 text-sm">No tracking accounts yet.</p>
                                <button
                                    onClick={() => setIsAddAccountModalOpen(true)}
                                    style={{ color: '#ffffff' }}
                                    className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-500 rounded-xl text-xs font-semibold transition-colors"
                                >
                                    <Plus size={14} /> Create Account
                                </button>
                            </div>
                        ) : (
                            acbAccounts.map(account => {
                                const isActive = selectedAccountId === account.id;
                                return (
                                    <div
                                        key={account.id}
                                        onClick={() => {
                                            setSelectedAccountId(account.id);
                                            setSelectedTicker(null);
                                        }}
                                        className={`p-3.5 rounded-xl border cursor-pointer transition-all flex justify-between items-center group ${
                                            isActive
                                                ? 'bg-blue-500/15 border-blue-500 shadow-sm'
                                                : 'bg-slate-800/95 border-slate-700/90 hover:border-slate-500'
                                        }`}
                                    >
                                        <span
                                            className={`font-semibold text-sm truncate ${
                                                isActive ? 'text-blue-400' : 'text-white'
                                            }`}
                                        >
                                            {account.name}
                                        </span>
                                        <div className="flex items-center gap-1.5 shrink-0">
                                            <button
                                                onClick={e => {
                                                    e.stopPropagation();
                                                    if (
                                                        confirm(
                                                            `Delete account ${account.name} and all its transactions?`
                                                        )
                                                    ) {
                                                        deleteAcbAccount(account.id);
                                                        if (selectedAccountId === account.id) {
                                                            setSelectedAccountId(null);
                                                        }
                                                    }
                                                }}
                                                className="p-1.5 hover:bg-red-500/15 text-slate-400 hover:text-red-400 rounded-lg transition-colors"
                                                title={`Delete ${account.name}`}
                                                aria-label={`Delete ${account.name}`}
                                            >
                                                <Trash2 size={15} />
                                            </button>
                                            <ChevronRight
                                                size={16}
                                                className={isActive ? 'text-blue-400' : 'text-slate-400'}
                                            />
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </aside>

                {/* Main Content Area */}
                <div className="flex-1 min-w-0 w-full flex flex-col gap-6">
                    {!selectedAccountId ? (
                        allAccountOverviews.length === 0 ? (
                            <div className="flex flex-col items-center justify-center bg-slate-800/95 rounded-2xl border border-dashed border-slate-700 p-12 min-h-[320px] text-center shadow-xl">
                                <div className="p-4 rounded-2xl bg-slate-900/75 border border-slate-700/80 text-blue-400 mb-4">
                                    <Calculator size={36} />
                                </div>
                                <h3 className="text-xl font-bold text-white mb-2">Adjusted Cost Base Tracker</h3>
                                <p className="max-w-md text-sm text-slate-300 mb-5">
                                    Create an ACB account to start tracking your adjusted cost base, stock splits, and capital gains for non-registered investments.
                                </p>
                                <button
                                    onClick={() => setIsAddAccountModalOpen(true)}
                                    style={{ color: '#ffffff' }}
                                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 rounded-xl text-sm font-semibold shadow-sm transition-colors"
                                >
                                    <Plus size={17} /> Create First ACB Account
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                {/* Household Overview Strip */}
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                    <div className="bg-slate-800/95 border border-slate-700/90 rounded-2xl p-4 shadow-lg">
                                        <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                                            ACB Accounts
                                        </p>
                                        <p className="text-2xl font-bold font-mono tabular-nums text-white">
                                            {allAccountOverviews.length}
                                        </p>
                                    </div>
                                    <div className="bg-slate-800/95 border border-slate-700/90 rounded-2xl p-4 shadow-lg">
                                        <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                                            Combined Total ACB
                                        </p>
                                        <p className="text-2xl font-bold font-mono tabular-nums text-white">
                                            $
                                            {fmt2(
                                                allAccountOverviews.reduce((sum, o) => sum + o.totalAcb, 0)
                                            )}
                                        </p>
                                    </div>
                                    <div className="bg-slate-800/95 border border-slate-700/90 rounded-2xl p-4 shadow-lg">
                                        <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                                            Combined Realized CG
                                        </p>
                                        {(() => {
                                            const totalCg = allAccountOverviews.reduce(
                                                (sum, o) => sum + o.totalCg,
                                                0
                                            );
                                            return (
                                                <p
                                                    className={`text-2xl font-bold font-mono tabular-nums ${
                                                        totalCg >= 0 ? 'text-green-400' : 'text-red-400'
                                                    }`}
                                                >
                                                    {totalCg >= 0 ? '+' : '-'}${fmt2(Math.abs(totalCg))}
                                                </p>
                                            );
                                        })()}
                                    </div>
                                </div>

                                {/* Account Cards */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {allAccountOverviews.map(
                                        ({ account, tickers, activeCount, txCount, totalAcb, totalCg }) => (
                                            <div
                                                key={account.id}
                                                onClick={() => {
                                                    setSelectedAccountId(account.id);
                                                    setSelectedTicker(null);
                                                }}
                                                className="p-5 bg-slate-800/95 border border-slate-700/90 hover:border-blue-500/70 rounded-2xl shadow-lg cursor-pointer transition-all group flex flex-col justify-between gap-4"
                                            >
                                                <div className="flex items-start justify-between gap-3">
                                                    <div>
                                                        <h3 className="text-lg font-bold text-white group-hover:text-blue-400 transition-colors">
                                                            {account.name}
                                                        </h3>
                                                        <p className="text-xs text-slate-400 mt-0.5">
                                                            {tickers.length} {tickers.length === 1 ? 'stock' : 'stocks'} ({activeCount} active) • {txCount} {txCount === 1 ? 'transaction' : 'transactions'}
                                                        </p>
                                                    </div>
                                                    <div className="flex items-center gap-1 shrink-0">
                                                        <button
                                                            onClick={e => {
                                                                e.stopPropagation();
                                                                if (
                                                                    confirm(
                                                                        `Delete account ${account.name} and all its transactions?`
                                                                    )
                                                                ) {
                                                                    deleteAcbAccount(account.id);
                                                                }
                                                            }}
                                                            className="p-1.5 hover:bg-red-500/15 text-slate-400 hover:text-red-400 rounded-lg transition-colors"
                                                            title={`Delete ${account.name}`}
                                                            aria-label={`Delete ${account.name}`}
                                                        >
                                                            <Trash2 size={15} />
                                                        </button>
                                                        <ChevronRight
                                                            size={18}
                                                            className="text-slate-400 group-hover:text-blue-400 transition-colors"
                                                        />
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-2 gap-3 bg-slate-900/65 border border-slate-700/70 rounded-xl p-3.5">
                                                    <div>
                                                        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">
                                                            Total ACB
                                                        </p>
                                                        <p className="font-mono tabular-nums font-bold text-base text-white">
                                                            ${fmt2(totalAcb)}
                                                        </p>
                                                    </div>
                                                    <div>
                                                        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">
                                                            Realized CG
                                                        </p>
                                                        <p
                                                            className={`font-mono tabular-nums font-bold text-base ${
                                                                totalCg >= 0 ? 'text-green-400' : 'text-red-400'
                                                            }`}
                                                        >
                                                            {totalCg >= 0 ? '+' : '-'}${fmt2(Math.abs(totalCg))}
                                                        </p>
                                                    </div>
                                                </div>

                                                {tickers.length > 0 && (
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {tickers.slice(0, 6).map(t => (
                                                            <span
                                                                key={t}
                                                                className="text-xs font-mono font-semibold px-2 py-0.5 rounded-md bg-slate-900 border border-slate-700 text-slate-200"
                                                            >
                                                                {t}
                                                            </span>
                                                        ))}
                                                        {tickers.length > 6 && (
                                                            <span className="text-xs font-medium px-2 py-0.5 text-slate-400">
                                                                +{tickers.length - 6} more
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        )
                                    )}
                                </div>
                            </div>
                        )
                    ) : (
                        <>
                            <div className="flex flex-wrap justify-between items-center gap-4">
                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={() => {
                                            setSelectedAccountId(null);
                                            setSelectedTicker(null);
                                        }}
                                        className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-750 border border-slate-700 hover:border-slate-500 text-slate-200 hover:text-white rounded-xl text-xs font-semibold transition-colors"
                                        title="Back to all ACB accounts"
                                    >
                                        <ArrowLeft size={15} /> All Accounts
                                    </button>
                                    <h2 className="text-2xl font-bold text-white tracking-tight">
                                        {selectedAccount?.name}
                                    </h2>
                                </div>
                                <div className="flex flex-wrap items-center gap-2.5">
                                    <div
                                        className="inline-flex items-center bg-slate-900 border border-slate-700 rounded-xl p-1"
                                        role="group"
                                        aria-label="Holdings view mode"
                                    >
                                        <button
                                            type="button"
                                            onClick={() => setHoldingsView('table')}
                                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                                                holdingsView === 'table'
                                                    ? 'bg-blue-600 text-white shadow-sm'
                                                    : 'text-slate-300 hover:text-white'
                                            }`}
                                            title="Table View"
                                        >
                                            <List size={14} /> Table
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setHoldingsView('cards')}
                                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                                                holdingsView === 'cards'
                                                    ? 'bg-blue-600 text-white shadow-sm'
                                                    : 'text-slate-300 hover:text-white'
                                            }`}
                                            title="Card View"
                                        >
                                            <LayoutGrid size={14} /> Cards
                                        </button>
                                    </div>
                                    <button
                                        onClick={() => setIsImportModalOpen(true)}
                                        className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-750 border border-slate-600 hover:border-slate-500 text-slate-100 rounded-xl text-sm font-semibold shadow-sm transition-colors"
                                    >
                                        <ListPlus size={17} className="text-blue-400" /> Import from Account
                                    </button>
                                    <button
                                        onClick={() => {
                                            setEditingTxId(null);
                                            setTxForm({
                                                type: 'Buy',
                                                date: new Date().toISOString().split('T')[0],
                                                memo: '',
                                                ticker: selectedTicker || '',
                                            });
                                            setIsAddTxModalOpen(true);
                                        }}
                                        style={{ color: '#ffffff' }}
                                        className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 rounded-xl text-sm font-semibold shadow-sm transition-colors"
                                    >
                                        <Plus size={17} /> Add Transaction
                                    </button>
                                </div>
                            </div>

                            {/* Securities Summary (Table or Card View) */}
                            {accountSummaries.length === 0 ? (
                                <div className="p-6 bg-slate-800/95 rounded-2xl border border-slate-700/90 text-slate-300 text-sm w-full">
                                    No securities tracked in this account yet. Add a transaction or import from an account to begin.
                                </div>
                            ) : holdingsView === 'table' ? (
                                <section className="bg-slate-800/95 border border-slate-700/90 rounded-2xl shadow-xl overflow-hidden">
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left border-collapse">
                                            <thead className="bg-slate-900/90 border-b border-slate-700/80">
                                                <tr className="text-xs font-bold uppercase tracking-wider text-slate-300 whitespace-nowrap">
                                                    <th className="px-5 py-3.5">Ticker</th>
                                                    <th className="px-4 py-3.5 text-right">Shares</th>
                                                    <th className="px-4 py-3.5 text-right">Total ACB</th>
                                                    <th className="px-4 py-3.5 text-right text-blue-400">ACB / Share</th>
                                                    <th className="px-4 py-3.5 text-right">Realized CG</th>
                                                    <th className="px-4 py-3.5 text-right w-20">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-700/60 text-sm">
                                                {accountSummaries.map(summary => {
                                                    const isSelected = selectedTicker === summary.ticker;
                                                    return (
                                                        <tr
                                                            key={summary.ticker}
                                                            onClick={() => setSelectedTicker(summary.ticker)}
                                                            className={`cursor-pointer transition-colors ${
                                                                isSelected
                                                                    ? 'bg-blue-500/15 hover:bg-blue-500/20'
                                                                    : 'hover:bg-slate-750/60'
                                                            }`}
                                                        >
                                                            <td className="px-5 py-3.5 font-mono font-bold text-white whitespace-nowrap">
                                                                <span className={isSelected ? 'text-blue-400' : 'text-white'}>
                                                                    {summary.ticker}
                                                                </span>
                                                            </td>
                                                            <td className="px-4 py-3.5 text-right font-mono tabular-nums text-slate-200 whitespace-nowrap">
                                                                {formatShares(summary.shares)}
                                                            </td>
                                                            <td className="px-4 py-3.5 text-right font-mono tabular-nums font-semibold text-white whitespace-nowrap">
                                                                ${fmt2(summary.acb)}
                                                            </td>
                                                            <td className="px-4 py-3.5 text-right font-mono tabular-nums font-bold text-blue-400 whitespace-nowrap">
                                                                ${fmt4(summary.acbPerShare)}
                                                            </td>
                                                            <td
                                                                className={`px-4 py-3.5 text-right font-mono tabular-nums font-bold whitespace-nowrap ${
                                                                    summary.cg >= 0 ? 'text-green-400' : 'text-red-400'
                                                                }`}
                                                            >
                                                                {summary.cg >= 0 ? '+' : '-'}${fmt2(Math.abs(summary.cg))}
                                                            </td>
                                                            <td className="px-4 py-3.5 text-right">
                                                                <button
                                                                    onClick={e => {
                                                                        e.stopPropagation();
                                                                        if (
                                                                            confirm(
                                                                                `Delete ${summary.ticker} and all its ACB transactions from ${selectedAccount?.name || 'this account'}?`
                                                                            )
                                                                        ) {
                                                                            deleteAcbTicker(selectedAccountId, summary.ticker);
                                                                            if (selectedTicker === summary.ticker) {
                                                                                setSelectedTicker(null);
                                                                            }
                                                                        }
                                                                    }}
                                                                    className="p-1.5 hover:bg-red-500/15 text-slate-400 hover:text-red-400 rounded-lg transition-colors"
                                                                    title={`Delete ${summary.ticker}`}
                                                                    aria-label={`Delete ${summary.ticker}`}
                                                                >
                                                                    <Trash2 size={15} />
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </section>
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                                    {accountSummaries.map(summary => {
                                        const isSelected = selectedTicker === summary.ticker;
                                        return (
                                            <div
                                                key={summary.ticker}
                                                onClick={() => setSelectedTicker(summary.ticker)}
                                                className={`p-5 rounded-2xl border cursor-pointer transition-all shadow-lg ${
                                                    isSelected
                                                        ? 'bg-slate-800/95 border-blue-500 ring-2 ring-blue-500/25'
                                                        : 'bg-slate-800/95 border-slate-700/90 hover:border-slate-500'
                                                }`}
                                            >
                                                <div className="flex justify-between items-center mb-3.5">
                                                    <h3 className="text-xl font-bold font-mono text-white">
                                                        {summary.ticker}
                                                    </h3>
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="text-xs font-mono font-bold px-2.5 py-1 bg-slate-900 border border-slate-700 rounded-lg text-slate-200">
                                                            {formatShares(summary.shares)} shs
                                                        </span>
                                                        <button
                                                            onClick={e => {
                                                                e.stopPropagation();
                                                                if (
                                                                    confirm(
                                                                        `Delete ${summary.ticker} and all its ACB transactions from ${selectedAccount?.name || 'this account'}?`
                                                                    )
                                                                ) {
                                                                    deleteAcbTicker(selectedAccountId, summary.ticker);
                                                                    if (selectedTicker === summary.ticker) {
                                                                        setSelectedTicker(null);
                                                                    }
                                                                }
                                                            }}
                                                            className="p-1.5 hover:bg-red-500/15 text-slate-400 hover:text-red-400 rounded-lg transition-colors"
                                                            title={`Delete ${summary.ticker}`}
                                                            aria-label={`Delete ${summary.ticker}`}
                                                        >
                                                            <Trash2 size={15} />
                                                        </button>
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-2 gap-3.5 bg-slate-900/65 border border-slate-700/70 rounded-xl p-3">
                                                    <div>
                                                        <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-0.5">
                                                            Total ACB
                                                        </p>
                                                        <p className="font-mono tabular-nums font-bold text-sm text-white">
                                                            ${fmt2(summary.acb)}
                                                        </p>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-0.5">
                                                            ACB / Share
                                                        </p>
                                                        <p className="font-mono tabular-nums font-bold text-sm text-blue-400">
                                                            ${fmt4(summary.acbPerShare)}
                                                        </p>
                                                    </div>
                                                    <div className="col-span-2 pt-2 border-t border-slate-700/70 flex justify-between items-center">
                                                        <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                                                            Realized CG
                                                        </span>
                                                        <span
                                                            className={`font-mono tabular-nums font-bold text-sm ${
                                                                summary.cg >= 0 ? 'text-green-400' : 'text-red-400'
                                                            }`}
                                                        >
                                                            {summary.cg >= 0 ? '+' : '-'}${fmt2(Math.abs(summary.cg))}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {/* Transaction History Table */}
                            {selectedTicker && (
                                <section className="bg-slate-800/95 border border-slate-700/90 rounded-2xl shadow-xl overflow-hidden flex flex-col">
                                    <div className="px-5 py-4 border-b border-slate-700/80 flex flex-wrap justify-between items-center gap-4 bg-slate-900/80">
                                        <h3 className="text-lg font-bold text-white tracking-tight">
                                            <span className="text-blue-400 font-mono">{selectedTicker}</span> Tracking
                                            History
                                        </h3>

                                        <div className="flex items-center gap-3">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                                                    Year:
                                                </span>
                                                <select
                                                    className="bg-slate-800 border border-slate-700 rounded-xl py-1.5 px-3 text-xs font-mono font-bold text-white focus:outline-none focus:border-blue-500"
                                                    value={selectedYear}
                                                    onChange={e => setSelectedYear(e.target.value)}
                                                >
                                                    <option value="All">All</option>
                                                    {availableYears.map(y => (
                                                        <option key={y} value={y}>
                                                            {y}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                            <button
                                                onClick={handleExportCsv}
                                                disabled={filteredRows.length === 0}
                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-750 border border-slate-700 hover:border-slate-500 text-slate-200 hover:text-white rounded-xl text-xs font-semibold transition-colors disabled:opacity-45 disabled:cursor-not-allowed"
                                            >
                                                <Download size={14} /> Export CSV
                                            </button>
                                        </div>
                                    </div>

                                    {yearSummary && selectedYear !== 'All' && (
                                        <div className="bg-slate-900/50 p-4 border-b border-slate-700/80">
                                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                                <div className="bg-slate-800/90 border border-slate-700/80 rounded-xl p-3">
                                                    <p className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-1">
                                                        {selectedYear} Gain/Loss
                                                    </p>
                                                    <p
                                                        className={`font-mono tabular-nums text-lg font-bold ${
                                                            yearSummary.totalGains >= 0
                                                                ? 'text-green-400'
                                                                : 'text-red-400'
                                                        }`}
                                                    >
                                                        {yearSummary.totalGains >= 0 ? '+' : '-'}$
                                                        {fmt2(Math.abs(yearSummary.totalGains))}
                                                    </p>
                                                </div>
                                                <div className="bg-slate-800/90 border border-slate-700/80 rounded-xl p-3">
                                                    <p className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-1">
                                                        Total Buys
                                                    </p>
                                                    <p className="font-mono tabular-nums text-lg font-bold text-white">
                                                        {yearSummary.buys}
                                                    </p>
                                                </div>
                                                <div className="bg-slate-800/90 border border-slate-700/80 rounded-xl p-3">
                                                    <p className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-1">
                                                        Total Sells
                                                    </p>
                                                    <p className="font-mono tabular-nums text-lg font-bold text-white">
                                                        {yearSummary.sells}
                                                    </p>
                                                </div>
                                                <div className="bg-slate-800/90 border border-slate-700/80 rounded-xl p-3">
                                                    <p className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-1">
                                                        CG Dividends
                                                    </p>
                                                    <p className="font-mono tabular-nums text-lg font-bold text-white">
                                                        {yearSummary.dividends}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left border-collapse">
                                            <thead className="bg-slate-900/90 border-b border-slate-700/80">
                                                <tr className="text-xs font-bold uppercase tracking-wider text-slate-300 whitespace-nowrap">
                                                    <th className="px-4 py-3.5 w-28">Date</th>
                                                    <th className="px-4 py-3.5">Transaction</th>
                                                    <th className="px-4 py-3.5 text-right">Shares +/-</th>
                                                    <th className="px-4 py-3.5 text-right">Price/Share</th>
                                                    <th className="px-4 py-3.5 text-right">Amount</th>
                                                    <th className="px-4 py-3.5 text-right">Shares Bal.</th>
                                                    <th className="px-4 py-3.5 text-right">ACB +/-</th>
                                                    <th className="px-4 py-3.5 text-right bg-blue-500/10 text-blue-400">
                                                        Total ACB
                                                    </th>
                                                    <th className="px-4 py-3.5 text-right bg-blue-500/10 text-blue-400">
                                                        ACB/Share
                                                    </th>
                                                    <th className="px-4 py-3.5 text-right">Gain/Loss</th>
                                                    <th className="px-4 py-3.5 text-right w-24">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-700/60 text-sm">
                                                {filteredRows.length === 0 ? (
                                                    <tr>
                                                        <td colSpan={11} className="text-center py-10 text-slate-300">
                                                            No transactions found for {selectedYear}.
                                                        </td>
                                                    </tr>
                                                ) : (
                                                    filteredRows.map(row => {
                                                        const rowInfo = getRowPriceAndAmount(row);
                                                        return (
                                                            <tr
                                                                key={row.tx.id}
                                                                className="hover:bg-slate-750/60 transition-colors"
                                                            >
                                                                <td className="px-4 py-3.5 text-slate-300 font-mono tabular-nums whitespace-nowrap">
                                                                    {row.tx.date}
                                                                </td>
                                                                <td className="px-4 py-3.5">
                                                                    <div className="flex flex-col items-start gap-1">
                                                                        <span
                                                                            className={`px-2 py-0.5 rounded-md text-xs font-bold uppercase border ${
                                                                                [
                                                                                    'Buy',
                                                                                    'Reinvested Dividend',
                                                                                    'Reinvested Capital Gains Distribution',
                                                                                    'Split',
                                                                                ].includes(row.tx.type)
                                                                                    ? 'bg-green-500/15 border-green-500/35 text-green-400'
                                                                                    : row.tx.type === 'Sell'
                                                                                    ? 'bg-red-500/15 border-red-500/35 text-red-400'
                                                                                    : 'bg-blue-500/15 border-blue-500/35 text-blue-400'
                                                                            }`}
                                                                        >
                                                                            {row.tx.type === 'Split' && row.tx.splitFrom && row.tx.splitTo
                                                                                ? `Split (${row.tx.splitTo}-for-${row.tx.splitFrom})`
                                                                                : row.tx.type}
                                                                        </span>
                                                                        {row.tx.memo && (
                                                                            <span className="text-xs text-slate-300">
                                                                                {row.tx.memo}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                </td>
                                                                <td
                                                                    className={`px-4 py-3.5 text-right font-mono tabular-nums font-semibold ${
                                                                        row.sharesChange > 0
                                                                            ? 'text-green-400'
                                                                            : row.sharesChange < 0
                                                                            ? 'text-red-400'
                                                                            : 'text-slate-400'
                                                                    }`}
                                                                >
                                                                    {row.sharesChange > 0 ? '+' : ''}
                                                                    {row.sharesChange !== 0
                                                                        ? formatShares(row.sharesChange)
                                                                        : '—'}
                                                                </td>
                                                                <td className="px-4 py-3.5 text-right font-mono tabular-nums text-slate-200">
                                                                    {rowInfo.price}
                                                                </td>
                                                                <td className="px-4 py-3.5 text-right font-mono tabular-nums text-slate-200">
                                                                    {rowInfo.amount}
                                                                </td>
                                                                <td className="px-4 py-3.5 text-right font-mono tabular-nums text-slate-200">
                                                                    {formatShares(row.sharesAfter)}
                                                                </td>
                                                            <td
                                                                className={`px-4 py-3.5 text-right font-mono tabular-nums font-semibold ${
                                                                    row.acbChange > 0
                                                                        ? 'text-green-400'
                                                                        : row.acbChange < 0
                                                                        ? 'text-red-400'
                                                                        : 'text-slate-400'
                                                                }`}
                                                            >
                                                                {row.acbChange > 0 ? '+' : row.acbChange < 0 ? '-' : ''}
                                                                {row.acbChange !== 0
                                                                    ? `$${fmt2(Math.abs(row.acbChange))}`
                                                                    : '—'}
                                                            </td>
                                                            <td className="px-4 py-3.5 text-right font-mono tabular-nums font-bold text-white bg-blue-500/10">
                                                                ${fmt2(row.acbAfter)}
                                                            </td>
                                                            <td className="px-4 py-3.5 text-right font-mono tabular-nums font-bold text-blue-400 bg-blue-500/10">
                                                                ${fmt4(row.acbPerShare)}
                                                            </td>
                                                            <td
                                                                className={`px-4 py-3.5 text-right font-mono tabular-nums font-bold ${
                                                                    row.capitalGainOrLoss > 0
                                                                        ? 'text-green-400'
                                                                        : row.capitalGainOrLoss < 0
                                                                        ? 'text-red-400'
                                                                        : 'text-slate-400'
                                                                }`}
                                                            >
                                                                {row.capitalGainOrLoss > 0
                                                                    ? '+'
                                                                    : row.capitalGainOrLoss < 0
                                                                    ? '-'
                                                                    : ''}
                                                                {row.capitalGainOrLoss !== 0
                                                                    ? `$${fmt2(Math.abs(row.capitalGainOrLoss))}`
                                                                    : '—'}
                                                            </td>
                                                            <td className="px-4 py-3.5 text-right">
                                                                <div className="flex justify-end gap-1.5">
                                                                    <button
                                                                        onClick={() => openEditModal(row.tx)}
                                                                        className="p-1.5 bg-slate-900 border border-slate-700 hover:border-slate-500 text-slate-300 hover:text-white rounded-lg transition-colors"
                                                                        title="Edit Transaction"
                                                                        aria-label="Edit Transaction"
                                                                    >
                                                                        <Pencil size={14} />
                                                                    </button>
                                                                    <button
                                                                        onClick={() => {
                                                                            if (
                                                                                confirm(
                                                                                    'Delete this transaction? This will recalculate all subsequent history.'
                                                                                )
                                                                            ) {
                                                                                deleteAcbTransaction(row.tx.id);
                                                                            }
                                                                        }}
                                                                        className="p-1.5 bg-red-500/15 border border-red-500/30 hover:bg-red-500/25 text-red-400 rounded-lg transition-colors"
                                                                        title="Delete Transaction"
                                                                        aria-label="Delete Transaction"
                                                                    >
                                                                        <Trash2 size={14} />
                                                                    </button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    );
                                                })
                                            )}
                                            </tbody>
                                        </table>
                                    </div>
                                </section>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* New ACB Account Modal */}
            {isAddAccountModalOpen && (
                <div className="fixed inset-0 bg-black/65 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-800 p-6 rounded-2xl w-full max-w-sm border border-slate-700 shadow-2xl">
                        <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-700/80">
                            <h3 className="text-lg font-bold text-white">New ACB Account</h3>
                            <button
                                onClick={() => setIsAddAccountModalOpen(false)}
                                className="p-1.5 bg-slate-900 border border-slate-700 rounded-lg text-slate-300 hover:text-white transition-colors"
                                aria-label="Close modal"
                            >
                                <X size={18} />
                            </button>
                        </div>
                        <form onSubmit={handleAddAccount} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                                    Account Name
                                </label>
                                <input
                                    type="text"
                                    required
                                    autoFocus
                                    className={inputClass}
                                    placeholder="e.g. Non-Registered, Joint Account"
                                    value={newAccountName}
                                    onChange={e => setNewAccountName(e.target.value)}
                                />
                            </div>
                            <div className="flex justify-end gap-2.5 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setIsAddAccountModalOpen(false)}
                                    className="px-4 py-2 bg-slate-900 hover:bg-slate-750 border border-slate-700 text-slate-200 hover:text-white rounded-xl text-sm font-semibold transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    style={{ color: '#ffffff' }}
                                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-xl text-sm font-semibold transition-colors"
                                >
                                    Create Account
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Add / Edit ACB Transaction Modal */}
            {isAddTxModalOpen && (
                <div className="fixed inset-0 bg-black/65 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-800 p-6 rounded-2xl w-full max-w-lg border border-slate-700 shadow-2xl">
                        <div className="flex justify-between items-center mb-5 pb-3 border-b border-slate-700/80">
                            <h3 className="text-xl font-bold text-white">
                                {editingTxId ? 'Edit ACB Transaction' : 'Add ACB Transaction'}
                            </h3>
                            <button
                                onClick={() => setIsAddTxModalOpen(false)}
                                className="p-1.5 bg-slate-900 border border-slate-700 rounded-lg text-slate-300 hover:text-white transition-colors"
                                aria-label="Close modal"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <form onSubmit={handleAddTransaction} className="flex flex-col gap-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                                        Security Ticker *
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        className={`${inputClass} font-mono font-bold uppercase`}
                                        value={txForm.ticker || ''}
                                        onChange={e =>
                                            setTxForm({ ...txForm, ticker: e.target.value.toUpperCase() })
                                        }
                                        placeholder="e.g. XEQT"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                                        Date *
                                    </label>
                                    <input
                                        type="date"
                                        required
                                        className={`${inputClass} font-mono`}
                                        value={txForm.date}
                                        onChange={e => setTxForm({ ...txForm, date: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                                    Transaction Type *
                                </label>
                                <div className="relative">
                                    <select
                                        required
                                        className={`${inputClass} appearance-none pr-10`}
                                        value={txForm.type}
                                        onChange={e =>
                                            setTxForm({ ...txForm, type: e.target.value as AcbTransactionType })
                                        }
                                    >
                                        <option value="Buy">Buy</option>
                                        <option value="Sell">Sell</option>
                                        <option value="Return of Capital">Return of Capital</option>
                                        <option value="Capital Gains Dividend">Capital Gains Dividend</option>
                                        <option value="Reinvested Dividend">Reinvested Dividend</option>
                                        <option value="Reinvested Capital Gains Distribution">
                                            Reinvested Capital Gains Distribution
                                        </option>
                                        <option value="Split">Split</option>
                                    </select>
                                    <ChevronDown
                                        size={16}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none"
                                    />
                                </div>
                            </div>

                            {/* Conditional Fields based on Type */}
                            <div className="bg-slate-900/65 p-4 rounded-xl border border-slate-700/80 space-y-4">
                                {['Buy', 'Sell'].includes(txForm.type || '') && (
                                    <>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                                                    Shares *
                                                </label>
                                                <input
                                                    type="number"
                                                    step="any"
                                                    min="0"
                                                    required
                                                    className={`${inputClass} input-no-spinner font-mono`}
                                                    value={txForm.shares ?? ''}
                                                    onChange={e => setTxForm({ ...txForm, shares: e.target.value })}
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                                                    Price per share *
                                                </label>
                                                <input
                                                    type="number"
                                                    step="any"
                                                    min="0"
                                                    required
                                                    className={`${inputClass} input-no-spinner font-mono`}
                                                    value={txForm.pricePerShare ?? ''}
                                                    onChange={e =>
                                                        setTxForm({ ...txForm, pricePerShare: e.target.value })
                                                    }
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                                                Commission
                                            </label>
                                            <input
                                                type="number"
                                                step="any"
                                                min="0"
                                                className={`${inputClass} input-no-spinner font-mono`}
                                                placeholder="0.00"
                                                value={txForm.commission ?? ''}
                                                onChange={e => setTxForm({ ...txForm, commission: e.target.value })}
                                            />
                                        </div>
                                    </>
                                )}

                                {['Return of Capital', 'Capital Gains Dividend'].includes(txForm.type || '') && (
                                    <div>
                                        <div className="flex justify-between items-center mb-1.5">
                                            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
                                                Total Amount *
                                            </label>
                                            {txForm.type === 'Capital Gains Dividend' && (
                                                <label className="flex items-center gap-2 text-xs font-semibold text-slate-200 cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        className="accent-blue-500"
                                                        checked={!!txForm.amountPerShare}
                                                        onChange={e =>
                                                            setTxForm({ ...txForm, amountPerShare: e.target.checked })
                                                        }
                                                    />
                                                    Amount is Per Share
                                                </label>
                                            )}
                                        </div>
                                        <input
                                            type="number"
                                            step="any"
                                            min="0"
                                            required
                                            className={`${inputClass} input-no-spinner font-mono`}
                                            value={txForm.amount ?? ''}
                                            onChange={e => setTxForm({ ...txForm, amount: e.target.value })}
                                        />
                                    </div>
                                )}

                                {['Reinvested Dividend', 'Reinvested Capital Gains Distribution'].includes(
                                    txForm.type || ''
                                ) && (
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                                                Reinvested Amount ($) *
                                            </label>
                                            <input
                                                type="number"
                                                step="any"
                                                min="0"
                                                required
                                                className={`${inputClass} input-no-spinner font-mono`}
                                                value={txForm.reinvestedAmount ?? ''}
                                                onChange={e =>
                                                    setTxForm({ ...txForm, reinvestedAmount: e.target.value })
                                                }
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                                                Shares Received *
                                            </label>
                                            <input
                                                type="number"
                                                step="any"
                                                min="0"
                                                required
                                                className={`${inputClass} input-no-spinner font-mono`}
                                                value={txForm.reinvestedShares ?? ''}
                                                onChange={e =>
                                                    setTxForm({ ...txForm, reinvestedShares: e.target.value })
                                                }
                                            />
                                        </div>
                                    </div>
                                )}

                                {txForm.type === 'Split' && (
                                    <div className="grid grid-cols-2 gap-4 items-center">
                                        <div>
                                            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                                                Old Shares (From) *
                                            </label>
                                            <input
                                                type="number"
                                                step="any"
                                                min="0.0001"
                                                required
                                                className={`${inputClass} input-no-spinner font-mono`}
                                                value={txForm.splitFrom ?? ''}
                                                onChange={e => setTxForm({ ...txForm, splitFrom: e.target.value })}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                                                New Shares (To) *
                                            </label>
                                            <input
                                                type="number"
                                                step="any"
                                                min="0.0001"
                                                required
                                                className={`${inputClass} input-no-spinner font-mono`}
                                                value={txForm.splitTo ?? ''}
                                                onChange={e => setTxForm({ ...txForm, splitTo: e.target.value })}
                                            />
                                        </div>
                                        <div className="col-span-2 text-xs text-slate-300 text-center">
                                            2-for-1 split: Old = 1, New = 2 • 1-for-3 reverse split: Old = 3, New = 1
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                                    Memo (Optional)
                                </label>
                                <input
                                    type="text"
                                    className={inputClass}
                                    value={txForm.memo || ''}
                                    onChange={e => setTxForm({ ...txForm, memo: e.target.value })}
                                />
                            </div>

                            <div className="flex justify-end gap-2.5 mt-2 pt-4 border-t border-slate-700/80">
                                <button
                                    type="button"
                                    onClick={() => setIsAddTxModalOpen(false)}
                                    className="px-4 py-2 bg-slate-900 hover:bg-slate-750 border border-slate-700 text-slate-200 hover:text-white rounded-xl text-sm font-semibold transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    style={{ color: '#ffffff' }}
                                    className="px-5 py-2 bg-blue-600 hover:bg-blue-500 rounded-xl text-sm font-semibold transition-colors"
                                >
                                    {editingTxId ? 'Update Transaction' : 'Save Transaction'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            {/* Import Transactions from Portfolio Account Modal */}
            {selectedAccount && (
                <ImportAcbTxModal
                    isOpen={isImportModalOpen}
                    onClose={() => setIsImportModalOpen(false)}
                    acbAccountId={selectedAccount.id}
                    acbAccountName={selectedAccount.name}
                    initialTicker={selectedTicker}
                    onImported={importedTickers => {
                        if (importedTickers.length === 1) {
                            setSelectedTicker(importedTickers[0]);
                        } else if (!selectedTicker && importedTickers.length > 0) {
                            setSelectedTicker(importedTickers[0]);
                        }
                    }}
                />
            )}
        </div>
    );
};

export default AcbTracker;
