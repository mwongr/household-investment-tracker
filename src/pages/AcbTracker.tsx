import React, { useState, useMemo } from 'react';
import { useData } from '../context/DataContext';
import { Calculator, Plus, Trash2, ChevronRight, X, ChevronDown, Download } from 'lucide-react';
import type { AcbTransactionType, AcbTransaction } from '../types';
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

// Helper block to format shares to maximum 4 decimals but trim trailing zeroes
const formatShares = (value: number) => {
    // If it's effectively an integer, show rounded integer
    if (Math.abs(value - Math.round(value)) < 0.0001) {
        return Math.round(value).toLocaleString();
    }
    // Else truncate trailing zeroes up to 4 decimals
    const num = Number(value.toFixed(4));
    return num.toLocaleString(undefined, { maximumFractionDigits: 4 });
};

const AcbTracker = () => {
    const { acbAccounts, acbTransactions, addAcbAccount, deleteAcbAccount, addAcbTransaction, updateAcbTransaction, deleteAcbTransaction } = useData();
    const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
    const [selectedTicker, setSelectedTicker] = useState<string | null>(null);

    // Modals
    const [isAddAccountModalOpen, setIsAddAccountModalOpen] = useState(false);
    const [newAccountName, setNewAccountName] = useState('');
    const [isAddTxModalOpen, setIsAddTxModalOpen] = useState(false);
    const [editingTxId, setEditingTxId] = useState<string | null>(null);

    // Transaction Form State
    const [txForm, setTxForm] = useState<Partial<AcbTransaction>>({
        type: 'Buy',
        date: new Date().toISOString().split('T')[0],
        memo: ''
    });

    // Filtering
    const [selectedYear, setSelectedYear] = useState<string>('All');

    // --- Derived Data ---
    const selectedAccount = acbAccounts.find(a => a.id === selectedAccountId);

    // Tickers in selected account
    const tickersInAccount = useMemo(() => {
        if (!selectedAccountId) return [];
        const txs = acbTransactions.filter(t => t.acbAccountId === selectedAccountId);
        const tickers = Array.from(new Set(txs.map(t => t.ticker)));
        return tickers.sort();
    }, [acbTransactions, selectedAccountId]);

    // History calculation
    const historyRows = useMemo(() => {
        if (!selectedAccountId || !selectedTicker) return [];

        const txs = acbTransactions
            .filter(t => t.acbAccountId === selectedAccountId && t.ticker === selectedTicker)
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        const rows: AcbHistoryRow[] = [];
        let runningShares = 0;
        let runningAcb = 0;

        for (const tx of txs) {
            let sharesChange = 0;
            let acbChange = 0;
            let capitalGainOrLoss = 0;

            switch (tx.type) {
                case 'Buy':
                    sharesChange = tx.shares || 0;
                    acbChange = ((tx.shares || 0) * (tx.pricePerShare || 0)) + (tx.commission || 0);
                    break;
                case 'Sell':
                    sharesChange = -(tx.shares || 0);
                    const costFraction = runningShares > 0 ? (tx.shares || 0) / runningShares : 0;
                    acbChange = -(costFraction * runningAcb);
                    const proceeds = ((tx.shares || 0) * (tx.pricePerShare || 0)) - (tx.commission || 0);
                    capitalGainOrLoss = proceeds + acbChange; // acbChange is negative
                    break;
                case 'Return of Capital':
                    acbChange = -(tx.amount || 0);
                    if (runningAcb + acbChange < 0) {
                        capitalGainOrLoss = -(runningAcb + acbChange);
                        acbChange = -runningAcb; // Floor at 0
                    }
                    break;
                case 'Capital Gains Dividend':
                    if (tx.amountPerShare && tx.amount) {
                        // Calculate total amount based on running shares
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
                case 'Split':
                    const from = tx.splitFrom || 1;
                    const to = tx.splitTo || 1;
                    const newShares = (runningShares * to) / from;
                    sharesChange = newShares - runningShares;
                    break;
            }

            runningShares += sharesChange;
            runningAcb += acbChange;
            // Floor precision errors
            if (Math.abs(runningShares) < 0.0001) runningShares = 0;
            if (Math.abs(runningAcb) < 0.0001) runningAcb = 0;

            rows.push({
                tx,
                sharesChange,
                sharesAfter: runningShares,
                acbChange,
                acbAfter: runningAcb,
                acbPerShare: runningShares > 0 ? runningAcb / runningShares : 0,
                capitalGainOrLoss
            });
        }

        return rows.reverse(); // Newest first for display
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

        return {
            totalGains,
            dividends,
            buys,
            sells
        };
    }, [filteredRows, selectedYear]);

    // Summaries per ticker
    const accountSummaries = useMemo(() => {
        if (!selectedAccountId) return [];
        return tickersInAccount.map(ticker => {
            const txs = acbTransactions
                .filter(t => t.acbAccountId === selectedAccountId && t.ticker === ticker)
                .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

            let shares = 0;
            let acb = 0;
            let cg = 0;

            for (const tx of txs) {
                switch (tx.type) {
                    case 'Buy':
                        shares += tx.shares || 0;
                        acb += ((tx.shares || 0) * (tx.pricePerShare || 0)) + (tx.commission || 0);
                        break;
                    case 'Sell':
                        const costFraction = shares > 0 ? (tx.shares || 0) / shares : 0;
                        const acbDrop = costFraction * acb;
                        acb -= acbDrop;
                        shares -= (tx.shares || 0);
                        const proceeds = ((tx.shares || 0) * (tx.pricePerShare || 0)) - (tx.commission || 0);
                        cg += proceeds - acbDrop;
                        break;
                    case 'Return of Capital':
                        acb -= (tx.amount || 0);
                        if (acb < 0) {
                            cg += (-acb);
                            acb = 0;
                        }
                        break;
                    case 'Capital Gains Dividend':
                        if (tx.amountPerShare && tx.amount) {
                            cg += tx.amount * shares;
                        } else {
                            cg += tx.amount || 0;
                        }
                        break;
                    case 'Reinvested Dividend':
                    case 'Reinvested Capital Gains Distribution':
                        shares += tx.reinvestedShares || 0;
                        acb += tx.reinvestedAmount || 0;
                        break;
                    case 'Split':
                        const from = tx.splitFrom || 1;
                        const to = tx.splitTo || 1;
                        shares = (shares * to) / from;
                        break;
                }
            }

            return {
                ticker,
                shares,
                acb,
                acbPerShare: shares > 0 ? acb / shares : 0,
                cg
            };
        });
    }, [tickersInAccount, acbTransactions, selectedAccountId]);

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
        if (selectedAccountId && txForm.ticker && txForm.date && txForm.type) {
            if (editingTxId) {
                // We're editing
                updateAcbTransaction(editingTxId, { ...txForm, acbAccountId: selectedAccountId } as Omit<AcbTransaction, 'id'>);
            } else {
                // We're adding new
                addAcbTransaction({ ...txForm, acbAccountId: selectedAccountId } as Omit<AcbTransaction, 'id'>);
            }

            setIsAddTxModalOpen(false);
            setEditingTxId(null);
            setTxForm({
                type: 'Buy',
                date: new Date().toISOString().split('T')[0],
                memo: '',
                ticker: txForm.ticker // remember ticker
            });
            setSelectedTicker(txForm.ticker); // select it if new
        }
    };

    // Open edit modal with existing details
    const openEditModal = (tx: AcbTransaction) => {
        setTxForm({ ...tx });
        setEditingTxId(tx.id);
        setIsAddTxModalOpen(true);
    };

    const handleExportCsv = () => {
        if (!selectedTicker || filteredRows.length === 0) return;

        const headers = ['Date', 'Transaction', 'Memo', 'Shares Change', 'Shares Balance', 'ACB Change', 'Total ACB', 'ACB/Share', 'Capital Gain/Loss'];

        const formatNumber = (num: number) => num.toFixed(4);

        const rows = filteredRows.map(row => {
            return [
                row.tx.date,
                row.tx.type,
                `"${row.tx.memo?.replace(/"/g, '""') || ''}"`,
                formatNumber(row.sharesChange),
                formatNumber(row.sharesAfter),
                formatNumber(row.acbChange),
                formatNumber(row.acbAfter),
                formatNumber(row.acbPerShare),
                formatNumber(row.capitalGainOrLoss)
            ].join(',');
        });

        const csvContent = [headers.join(','), ...rows].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `acb_history_${selectedTicker.replace(/[^a-z0-9]/gi, '_')}_${selectedYear}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="flex h-[calc(100vh-80px)] overflow-hidden gap-6">

            {/* Left Sidebar: Accounts */}
            <div className="w-1/4 min-w-[250px] max-w-[350px] flex flex-col gap-4 overflow-y-auto pr-2">
                <div className="flex justify-between items-center bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <Calculator size={20} className="text-blue-400" />
                        ACB Trackers
                    </h2>
                    <button
                        onClick={() => setIsAddAccountModalOpen(true)}
                        className="p-1.5 bg-blue-500/20 text-blue-400 hover:bg-blue-500 hover:text-white rounded transition-colors"
                        title="Add ACB Account"
                    >
                        <Plus size={18} />
                    </button>
                </div>

                <div className="flex flex-col gap-2">
                    {acbAccounts.length === 0 ? (
                        <div className="text-center p-6 bg-slate-800/30 rounded-xl border border-dashed border-slate-700">
                            <p className="text-slate-400 text-sm mb-4">No tracking accounts yet.</p>
                            <button onClick={() => setIsAddAccountModalOpen(true)} className="btn btn-primary text-xs">
                                Create Account
                            </button>
                        </div>
                    ) : (
                        acbAccounts.map(account => (
                            <div
                                key={account.id}
                                onClick={() => {
                                    setSelectedAccountId(account.id);
                                    setSelectedTicker(null);
                                }}
                                className={`p-4 rounded-xl border cursor-pointer transition-all flex justify-between items-center group
                                    ${selectedAccountId === account.id
                                        ? 'bg-blue-500/10 border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.15)]'
                                        : 'bg-slate-800/40 border-slate-700 hover:border-slate-500 hover:bg-slate-800'}`}
                            >
                                <span className={`font-medium ${selectedAccountId === account.id ? 'text-blue-400' : 'text-slate-300'}`}>
                                    {account.name}
                                </span>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (confirm(`Delete account ${account.name} and all its transactions?`)) {
                                                deleteAcbAccount(account.id);
                                                if (selectedAccountId === account.id) setSelectedAccountId(null);
                                            }
                                        }}
                                        className="p-1 opacity-0 group-hover:opacity-100 hover:bg-red-500/20 text-slate-400 hover:text-red-400 rounded transition-all"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                    <ChevronRight size={18} className={selectedAccountId === account.id ? 'text-blue-400' : 'text-slate-600'} />
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col gap-6 overflow-hidden">
                {!selectedAccountId ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-500 bg-slate-800/10 rounded-2xl border border-slate-800 border-dashed">
                        <Calculator size={48} className="mb-4 opacity-30" />
                        <h3 className="text-xl font-medium mb-2">Adjusted Cost Base Tracker</h3>
                        <p className="max-w-md text-center">
                            Select an account from the sidebar or create a new one to start tracking your adjusted cost base for non-registered investments.
                        </p>
                    </div>
                ) : (
                    <>
                        <div className="flex justify-between items-center">
                            <h2 className="text-2xl font-bold text-white">
                                {selectedAccount?.name}
                            </h2>
                            <button
                                onClick={() => {
                                    setEditingTxId(null);
                                    setTxForm({
                                        type: 'Buy',
                                        date: new Date().toISOString().split('T')[0],
                                        memo: '',
                                        ticker: selectedTicker || ''
                                    });
                                    setIsAddTxModalOpen(true);
                                }}
                                className="btn btn-primary"
                            >
                                <Plus size={18} /> Add Transaction
                            </button>
                        </div>

                        {/* Top: Security Cards */}
                        <div className="flex gap-4 overflow-x-auto pb-2 shrink-0">
                            {accountSummaries.length === 0 ? (
                                <div className="p-4 bg-slate-800/30 rounded-xl border border-slate-700 text-slate-400 w-full">
                                    No securities tracked in this account yet. Add a transaction to begin.
                                </div>
                            ) : (
                                accountSummaries.map(summary => (
                                    <div
                                        key={summary.ticker}
                                        onClick={() => setSelectedTicker(summary.ticker)}
                                        className={`min-w-[280px] p-5 rounded-xl border cursor-pointer transition-all
                                            ${selectedTicker === summary.ticker
                                                ? 'bg-slate-800 border-blue-500 shadow-[0_4px_20px_rgba(59,130,246,0.1)]'
                                                : 'bg-slate-800/50 border-slate-700 hover:bg-slate-800 hover:border-slate-600'}`}
                                    >
                                        <div className="flex justify-between items-start mb-3">
                                            <h3 className="text-xl font-bold text-white">{summary.ticker}</h3>
                                            <span className="text-xs font-medium px-2 py-1 bg-slate-700 rounded text-slate-300">
                                                {formatShares(summary.shares)} Shares
                                            </span>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <p className="text-xs text-slate-400 mb-1">Total ACB</p>
                                                <p className="font-mono text-sm text-white">${summary.acb.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-slate-400 mb-1">ACB / Share</p>
                                                <p className="font-mono text-sm text-blue-400">${summary.acbPerShare.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 })}</p>
                                            </div>
                                            <div className="col-span-2 pt-2 border-t border-slate-700/50">
                                                <p className="text-xs text-slate-400 mb-1 flex justify-between">
                                                    Realized CG
                                                    <span className={`font-mono ${summary.cg >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                        {summary.cg >= 0 ? '+' : ''}{summary.cg.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                    </span>
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        {/* Bottom: Transaction History Table */}
                        {selectedTicker && (
                            <div className="card flex-1 flex flex-col overflow-hidden p-0">
                                <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-800/80">
                                    <h3 className="text-lg font-semibold text-white">
                                        <span className="text-blue-400">{selectedTicker}</span> Tracking History
                                    </h3>

                                    <div className="flex items-center gap-4">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm text-slate-400">Year:</span>
                                            <select
                                                className="input py-1 px-2 text-sm w-24 bg-slate-900"
                                                value={selectedYear}
                                                onChange={e => setSelectedYear(e.target.value)}
                                            >
                                                <option value="All">All</option>
                                                {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
                                            </select>
                                        </div>
                                        <button
                                            onClick={handleExportCsv}
                                            disabled={filteredRows.length === 0}
                                            className="btn btn-secondary py-1.5 px-3 text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            <Download size={14} /> Export CSV
                                        </button>
                                    </div>
                                </div>

                                {yearSummary && selectedYear !== 'All' && (
                                    <div className="bg-slate-800/60 p-4 border-b border-slate-700/50">
                                        <div className="grid grid-cols-4 gap-4">
                                            <div>
                                                <p className="text-xs text-slate-400 mb-1">Total {selectedYear} Gain/Loss</p>
                                                <p className={`font-mono text-lg font-bold ${yearSummary.totalGains >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                    {yearSummary.totalGains >= 0 ? '+' : ''}${Math.abs(yearSummary.totalGains).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </p>
                                            </div>
                                            <div className="border-l border-slate-700/50 pl-4">
                                                <p className="text-xs text-slate-400 mb-1">Total Buys </p>
                                                <p className="font-mono text-sm text-white">{yearSummary.buys}</p>
                                            </div>
                                            <div className="border-l border-slate-700/50 pl-4">
                                                <p className="text-xs text-slate-400 mb-1">Total Sells </p>
                                                <p className="font-mono text-sm text-white">{yearSummary.sells}</p>
                                            </div>
                                            <div className="border-l border-slate-700/50 pl-4">
                                                <p className="text-xs text-slate-400 mb-1">CG Dividends</p>
                                                <p className="font-mono text-sm text-white">{yearSummary.dividends}</p>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <div className="overflow-y-auto flex-1 p-4">
                                    <table className="data-table">
                                        <thead className="sticky top-0 bg-slate-800 z-10 shadow-sm">
                                            <tr>
                                                <th className="w-24">Date</th>
                                                <th>Transaction</th>
                                                <th className="text-right">Shares +/-</th>
                                                <th className="text-right">Shares Bal.</th>
                                                <th className="text-right">ACB +/-</th>
                                                <th className="text-right bg-blue-500/5">Total ACB</th>
                                                <th className="text-right bg-blue-500/5">ACB/Share</th>
                                                <th className="text-right">Gain/Loss</th>
                                                <th className="w-10"></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredRows.length === 0 ? (
                                                <tr>
                                                    <td colSpan={9} className="text-center py-8 text-slate-500">
                                                        No transactions found for {selectedYear}.
                                                    </td>
                                                </tr>
                                            ) : (
                                                filteredRows.map((row) => (
                                                    <tr key={row.tx.id} className="hover:bg-slate-800/30 group">
                                                        <td className="text-sm text-slate-400 font-mono">{row.tx.date}</td>
                                                        <td>
                                                            <div className="flex flex-col">
                                                                <span className="font-medium text-slate-200 text-sm">{row.tx.type}</span>
                                                                {row.tx.memo && <span className="text-xs text-slate-500">{row.tx.memo}</span>}
                                                            </div>
                                                        </td>
                                                        <td className={`text-right font-mono text-sm ${row.sharesChange > 0 ? 'text-green-400' : row.sharesChange < 0 ? 'text-red-400' : 'text-slate-500'}`}>
                                                            {row.sharesChange > 0 ? '+' : ''}{row.sharesChange !== 0 ? formatShares(row.sharesChange) : '-'}
                                                        </td>
                                                        <td className="text-right font-mono text-sm text-slate-300">
                                                            {formatShares(row.sharesAfter)}
                                                        </td>
                                                        <td className={`text-right font-mono text-sm ${row.acbChange > 0 ? 'text-green-400' : row.acbChange < 0 ? 'text-red-400' : 'text-slate-500'}`}>
                                                            {row.acbChange > 0 ? '+' : ''}{row.acbChange !== 0 ? `$${Math.abs(row.acbChange).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}
                                                        </td>
                                                        <td className="text-right font-mono text-sm font-bold text-white bg-blue-500/5">
                                                            ${row.acbAfter.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                        </td>
                                                        <td className="text-right font-mono text-sm text-blue-300 bg-blue-500/5 pr-4">
                                                            ${row.acbPerShare.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 })}
                                                        </td>
                                                        <td className={`text-right font-mono text-sm ${row.capitalGainOrLoss > 0 ? 'text-green-400' : row.capitalGainOrLoss < 0 ? 'text-red-400' : 'text-slate-500'}`}>
                                                            {row.capitalGainOrLoss > 0 ? '+' : ''}{row.capitalGainOrLoss !== 0 ? `$${Math.abs(row.capitalGainOrLoss).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}
                                                        </td>
                                                        <td className="w-[80px]">
                                                            <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                <button
                                                                    onClick={() => openEditModal(row.tx)}
                                                                    className="p-1.5 hover:bg-slate-700/50 text-slate-400 hover:text-white rounded"
                                                                    title="Edit Transaction"
                                                                >
                                                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                                                                </button>
                                                                <button
                                                                    onClick={() => {
                                                                        if (confirm('Delete this transaction? This will recalculate all subsequent history.')) {
                                                                            deleteAcbTransaction(row.tx.id);
                                                                        }
                                                                    }}
                                                                    className="p-1.5 hover:bg-red-500/20 text-slate-400 hover:text-red-400 rounded transition-colors"
                                                                    title="Delete Transaction"
                                                                >
                                                                    <Trash2 size={14} />
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Modals */}
            {isAddAccountModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="bg-slate-800 p-6 rounded-2xl w-full max-w-sm border border-slate-700 shadow-2xl">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-bold text-white">New ACB Account</h3>
                            <button onClick={() => setIsAddAccountModalOpen(false)} className="text-slate-400 hover:text-white">
                                <X size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleAddAccount}>
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-slate-300 mb-1">Account Name</label>
                                <input
                                    type="text"
                                    required
                                    autoFocus
                                    className="input"
                                    placeholder="e.g. Non-Registered, Joint Account"
                                    value={newAccountName}
                                    onChange={(e) => setNewAccountName(e.target.value)}
                                />
                            </div>
                            <div className="flex justify-end gap-2">
                                <button type="button" onClick={() => setIsAddAccountModalOpen(false)} className="btn btn-secondary">
                                    Cancel
                                </button>
                                <button type="submit" className="btn btn-primary">
                                    Create Account
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {isAddTxModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="bg-slate-800 p-6 rounded-2xl w-full max-w-lg border border-slate-700 shadow-2xl">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-white">
                                {editingTxId ? 'Edit ACB Transaction' : 'Add ACB Transaction'}
                            </h3>
                            <button onClick={() => setIsAddTxModalOpen(false)} className="text-slate-400 hover:text-white">
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleAddTransaction} className="flex flex-col gap-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-1">Security Ticker *</label>
                                    <input
                                        type="text"
                                        required
                                        className="input uppercase"
                                        value={txForm.ticker || ''}
                                        onChange={(e) => setTxForm({ ...txForm, ticker: e.target.value })}
                                        placeholder="e.g. XEQT"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-1">Date *</label>
                                    <input
                                        type="date"
                                        required
                                        className="input"
                                        value={txForm.date}
                                        onChange={(e) => setTxForm({ ...txForm, date: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-1">Transaction Type *</label>
                                <div className="relative">
                                    <select
                                        required
                                        className="input appearance-none pr-10"
                                        value={txForm.type}
                                        onChange={(e) => setTxForm({ ...txForm, type: e.target.value as AcbTransactionType })}
                                    >
                                        <option value="Buy">Buy</option>
                                        <option value="Sell">Sell</option>
                                        <option value="Return of Capital">Return of Capital</option>
                                        <option value="Capital Gains Dividend">Capital Gains Dividend</option>
                                        <option value="Reinvested Dividend">Reinvested Dividend</option>
                                        <option value="Reinvested Capital Gains Distribution">Reinvested Capital Gains Distribution</option>
                                        <option value="Split">Split</option>
                                    </select>
                                    <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                </div>
                            </div>

                            {/* Conditional Fields based on Type */}
                            <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700/50 space-y-4">

                                {['Buy', 'Sell'].includes(txForm.type || '') && (
                                    <>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-xs text-slate-400 mb-1">Shares *</label>
                                                <input type="number" step="any" min="0" required className="input"
                                                    value={txForm.shares || ''} onChange={e => setTxForm({ ...txForm, shares: parseFloat(e.target.value) })} />
                                            </div>
                                            <div>
                                                <label className="block text-xs text-slate-400 mb-1">Price per share *</label>
                                                <input type="number" step="any" min="0" required className="input"
                                                    value={txForm.pricePerShare || ''} onChange={e => setTxForm({ ...txForm, pricePerShare: parseFloat(e.target.value) })} />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-xs text-slate-400 mb-1">Commission</label>
                                            <input type="number" step="any" min="0" className="input" placeholder="0.00"
                                                value={txForm.commission || ''} onChange={e => setTxForm({ ...txForm, commission: parseFloat(e.target.value) })} />
                                        </div>
                                    </>
                                )}

                                {['Return of Capital', 'Capital Gains Dividend'].includes(txForm.type || '') && (
                                    <div>
                                        <div className="flex justify-between items-end mb-1">
                                            <label className="block text-xs text-slate-400">Total Amount *</label>
                                            {txForm.type === 'Capital Gains Dividend' && (
                                                <label className="flex items-center gap-2 text-xs text-slate-300">
                                                    <input type="checkbox" checked={!!txForm.amountPerShare} onChange={e => setTxForm({ ...txForm, amountPerShare: e.target.checked })} />
                                                    Amount is Per Share
                                                </label>
                                            )}
                                        </div>
                                        <input type="number" step="any" min="0" required className="input"
                                            value={txForm.amount || ''} onChange={e => setTxForm({ ...txForm, amount: parseFloat(e.target.value) })} />
                                    </div>
                                )}

                                {['Reinvested Dividend', 'Reinvested Capital Gains Distribution'].includes(txForm.type || '') && (
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs text-slate-400 mb-1">Reinvested Amount ($) *</label>
                                            <input type="number" step="any" min="0" required className="input"
                                                value={txForm.reinvestedAmount || ''} onChange={e => setTxForm({ ...txForm, reinvestedAmount: parseFloat(e.target.value) })} />
                                        </div>
                                        <div>
                                            <label className="block text-xs text-slate-400 mb-1">Shares Received *</label>
                                            <input type="number" step="any" min="0" required className="input"
                                                value={txForm.reinvestedShares || ''} onChange={e => setTxForm({ ...txForm, reinvestedShares: parseFloat(e.target.value) })} />
                                        </div>
                                    </div>
                                )}

                                {txForm.type === 'Split' && (
                                    <div className="grid grid-cols-2 gap-4 items-center">
                                        <div>
                                            <label className="block text-xs text-slate-400 mb-1">Old Shares (From) *</label>
                                            <input type="number" step="any" min="1" required className="input"
                                                value={txForm.splitFrom || ''} onChange={e => setTxForm({ ...txForm, splitFrom: parseFloat(e.target.value) })} />
                                        </div>
                                        <div>
                                            <label className="block text-xs text-slate-400 mb-1">New Shares (To) *</label>
                                            <input type="number" step="any" min="1" required className="input"
                                                value={txForm.splitTo || ''} onChange={e => setTxForm({ ...txForm, splitTo: parseFloat(e.target.value) })} />
                                        </div>
                                        <div className="col-span-2 text-xs text-slate-400 text-center">
                                            Example: For a 2-for-1 split, Old Shares = 1, New Shares = 2
                                        </div>
                                    </div>
                                )}

                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-1">Memo (Optional)</label>
                                <input
                                    type="text"
                                    className="input"
                                    value={txForm.memo || ''}
                                    onChange={(e) => setTxForm({ ...txForm, memo: e.target.value })}
                                />
                            </div>

                            <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-slate-700">
                                <button type="button" onClick={() => setIsAddTxModalOpen(false)} className="btn btn-secondary">
                                    Cancel
                                </button>
                                <button type="submit" className="btn btn-primary">
                                    {editingTxId ? 'Update Transaction' : 'Save Transaction'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AcbTracker;
