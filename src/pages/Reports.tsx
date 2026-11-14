import { useState } from 'react';
import { useData } from '../context/DataContext';
import { Download, FileText, Filter, Trash2, FileBarChart, X, Calendar } from 'lucide-react';
import '../styles/shared.css';

const toIsoDate = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
};

const fmt2 = (n: number) =>
    n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const escapeCsv = (val: string | number) => {
    const str = String(val);
    return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
};

const Reports = () => {
    const { transactions, accounts, members, institutions, deleteTransaction, assets } = useData();
    const [activeTab, setActiveTab] = useState<'transactions' | 'assets'>('transactions');

    // Transactions Filter State
    const [filterType, setFilterType] = useState('All');
    const [filterMemberId, setFilterMemberId] = useState('All');
    const [filterAccountId, setFilterAccountId] = useState('All');
    const [filterTicker, setFilterTicker] = useState('All');

    // Pagination & Date Range State
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(50);

    // Unique tickers for dropdown
    const uniqueTickers = Array.from(new Set(transactions.map(tx => tx.ticker).filter(Boolean))).sort();

    // Dynamic Date Presets
    const now = new Date();
    const currentYear = now.getFullYear();
    const todayStr = toIsoDate(now);
    const monthStartStr = toIsoDate(new Date(currentYear, now.getMonth(), 1));
    const threeMonthsAgo = new Date(now);
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    const sixMonthsAgo = new Date(now);
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const twelveMonthsAgo = new Date(now);
    twelveMonthsAgo.setFullYear(twelveMonthsAgo.getFullYear() - 1);

    const datePresets = [
        { id: 'all', label: 'All Time', start: '', end: '' },
        { id: 'this-month', label: 'This Month', start: monthStartStr, end: todayStr },
        { id: '3m', label: 'Last 3M', start: toIsoDate(threeMonthsAgo), end: todayStr },
        { id: '6m', label: 'Last 6M', start: toIsoDate(sixMonthsAgo), end: todayStr },
        { id: '1y', label: 'Last 12M', start: toIsoDate(twelveMonthsAgo), end: todayStr },
        { id: 'ytd', label: 'YTD', start: `${currentYear}-01-01`, end: todayStr },
        ...[0, 1, 2, 3].map(offset => {
            const yr = currentYear - offset;
            return {
                id: `yr-${yr}`,
                label: String(yr),
                start: `${yr}-01-01`,
                end: `${yr}-12-31`,
            };
        }),
    ];

    const applyDatePreset = (start: string, end: string) => {
        setStartDate(start);
        setEndDate(end);
        setCurrentPage(1);
    };

    // Enrich transactions with readable names and preserve original order
    const enrichedTransactions = transactions.map((tx, index) => {
        const account = accounts.find(a => a.id === tx.accountId);
        const member = members.find(m => m.id === account?.memberId);
        const institution = institutions.find(i => i.id === account?.institutionId);

        return {
            ...tx,
            memberId: member?.id,
            accountName: account?.name || 'Unknown',
            memberName: member?.name || 'Unknown',
            institutionName: institution?.name || 'Unknown',
            _originalIndex: index,
        };
    });

    // Filter Logic
    const filteredData = enrichedTransactions
        .filter(tx => {
            const matchesType = filterType === 'All' || tx.type === filterType;
            const matchesMember = filterMemberId === 'All' || tx.memberId === filterMemberId;
            const matchesAccount = filterAccountId === 'All' || tx.accountId === filterAccountId;
            const matchesTicker = filterTicker === 'All' || tx.ticker === filterTicker;

            const txDate = new Date(tx.date);
            const start = startDate ? new Date(startDate) : null;
            const end = endDate ? new Date(endDate) : null;

            const matchesDate = (!start || txDate >= start) && (!end || txDate <= end);

            return matchesType && matchesMember && matchesAccount && matchesTicker && matchesDate;
        })
        .sort((a, b) => {
            const dateA = new Date(a.date).getTime();
            const dateB = new Date(b.date).getTime();
            if (dateA !== dateB) {
                return dateB - dateA;
            }
            return b._originalIndex - a._originalIndex;
        });

    // Pagination Logic
    const totalItems = filteredData.length;
    const totalPages = rowsPerPage === -1 ? 1 : Math.max(1, Math.ceil(totalItems / rowsPerPage));
    const startIndex = rowsPerPage === -1 ? 0 : (currentPage - 1) * rowsPerPage;
    const paginatedData =
        rowsPerPage === -1 ? filteredData : filteredData.slice(startIndex, startIndex + rowsPerPage);

    // Export Transactions to CSV
    const exportCSV = () => {
        const headers = ['Date', 'Type', 'Ticker', 'Shares', 'Price', 'Amount', 'Account', 'Member', 'Institution'];
        const rows = filteredData.map(tx => [
            tx.date,
            tx.type,
            tx.ticker || '-',
            tx.type === 'Stock Split' && tx.splitFrom && tx.splitTo
                ? `${tx.splitTo}-for-${tx.splitFrom}`
                : tx.shares || 0,
            tx.pricePerShare || 0,
            tx.amount,
            tx.accountName,
            tx.memberName,
            tx.institutionName,
        ]);

        const csvContent =
            'data:text/csv;charset=utf-8,' +
            headers.join(',') +
            '\n' +
            rows.map(row => row.map(escapeCsv).join(',')).join('\n');

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement('a');
        link.setAttribute('href', encodedUri);
        link.setAttribute('download', `transactions_report_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // Data for Asset Overview
    const memberAccountAssets = members
        .map(member => {
            const memberAccounts = accounts.filter(a => a.memberId === member.id);
            const accountsWithAssets = memberAccounts
                .map(account => {
                    const accountAssets = assets.filter(a => a.accountId === account.id && a.quantity > 0);

                    const totalInvested = accountAssets.reduce((sum, a) => sum + (a.customBookCost ?? a.totalCost), 0);
                    const totalValue = accountAssets.reduce(
                        (sum, a) => sum + (a.cadMarketValue || a.marketValue || 0),
                        0
                    );
                    const totalProfit = totalValue - totalInvested;

                    return {
                        ...account,
                        institutionName: institutions.find(i => i.id === account.institutionId)?.name || 'Unknown',
                        assets: accountAssets,
                        totalInvested,
                        totalValue,
                        totalProfit,
                    };
                })
                .filter(a => a.assets.length > 0 || a.cashBalance > 0);

            const totalInvested = accountsWithAssets.reduce((sum, a) => sum + a.totalInvested, 0);
            const totalValue = accountsWithAssets.reduce((sum, a) => sum + a.totalValue, 0);
            const totalProfit = totalValue - totalInvested;

            return {
                ...member,
                accounts: accountsWithAssets,
                totalInvested,
                totalValue,
                totalProfit,
            };
        })
        .filter(m => m.accounts.length > 0);

    const exportAssetsCSV = () => {
        const headers = [
            'Member',
            'Account',
            'Institution',
            'Ticker',
            'Shares',
            'Cost/Share',
            'Total Invested',
            'Market Value',
            'Profit/Loss ($)',
            'Profit/Loss (%)',
        ];
        const rows: (string | number)[][] = [];

        memberAccountAssets.forEach(member => {
            member.accounts.forEach(account => {
                account.assets.forEach(asset => {
                    const costPerShare =
                        asset.quantity > 0 ? (asset.customBookCost ?? asset.totalCost) / asset.quantity : 0;
                    rows.push([
                        member.name,
                        account.name,
                        account.institutionName,
                        asset.ticker,
                        asset.quantity,
                        costPerShare.toFixed(2),
                        (asset.customBookCost ?? asset.totalCost).toFixed(2),
                        asset.marketValue.toFixed(2),
                        asset.profit.toFixed(2),
                        asset.profitPercent.toFixed(2) + '%',
                    ]);
                });
            });
        });

        const csvContent =
            'data:text/csv;charset=utf-8,' +
            headers.join(',') +
            '\n' +
            rows.map(row => row.map(escapeCsv).join(',')).join('\n');

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement('a');
        link.setAttribute('href', encodedUri);
        link.setAttribute('download', `asset_overview_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const hasActiveFilters =
        filterType !== 'All' ||
        filterMemberId !== 'All' ||
        filterAccountId !== 'All' ||
        filterTicker !== 'All' ||
        Boolean(startDate) ||
        Boolean(endDate);

    const clearAllFilters = () => {
        setFilterType('All');
        setFilterMemberId('All');
        setFilterAccountId('All');
        setFilterTicker('All');
        setStartDate('');
        setEndDate('');
        setCurrentPage(1);
    };

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                    <div className="p-3 bg-blue-500/15 rounded-2xl border border-blue-500/35 text-blue-400 shadow-sm">
                        <FileBarChart size={24} />
                    </div>
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Reports</h1>
                        <p className="text-sm text-slate-300 mt-0.5">
                            Filter transaction history, inspect member asset summaries &amp; export CSVs
                        </p>
                    </div>
                </div>
                <button
                    style={{ color: '#ffffff' }}
                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 rounded-xl text-sm font-semibold shadow-sm transition-colors self-start sm:self-auto"
                    onClick={activeTab === 'transactions' ? exportCSV : exportAssetsCSV}
                >
                    <Download size={17} /> Export CSV
                </button>
            </div>

            {/* Segmented Tabs */}
            <div className="inline-flex bg-slate-900 border border-slate-700/90 p-1 rounded-xl">
                <button
                    style={activeTab === 'transactions' ? { color: '#ffffff' } : undefined}
                    className={`px-5 py-2 rounded-lg text-sm font-bold transition-colors ${
                        activeTab === 'transactions'
                            ? 'bg-blue-600 shadow-sm'
                            : 'text-slate-300 hover:text-white hover:bg-slate-800'
                    }`}
                    onClick={() => setActiveTab('transactions')}
                >
                    Transactions Report
                </button>
                <button
                    style={activeTab === 'assets' ? { color: '#ffffff' } : undefined}
                    className={`px-5 py-2 rounded-lg text-sm font-bold transition-colors ${
                        activeTab === 'assets'
                            ? 'bg-blue-600 shadow-sm'
                            : 'text-slate-300 hover:text-white hover:bg-slate-800'
                    }`}
                    onClick={() => setActiveTab('assets')}
                >
                    Asset Overview Report
                </button>
            </div>

            {activeTab === 'transactions' && (
                <div className="space-y-6">
                    {/* Filter Bar */}
                    <div className="bg-slate-800/95 border border-slate-700/90 rounded-2xl p-4 shadow-xl space-y-3">
                        <div className="flex flex-wrap items-center gap-3 text-sm">
                            <div className="flex items-center gap-2 text-slate-200 font-bold text-xs uppercase tracking-wider whitespace-nowrap border-r border-slate-700 pr-3">
                                <Filter size={15} className="text-blue-400" /> Filters
                            </div>

                            <select
                                className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs font-semibold focus:outline-none focus:border-blue-500 min-w-[120px]"
                                value={filterType}
                                onChange={e => {
                                    setFilterType(e.target.value);
                                    setCurrentPage(1);
                                }}
                            >
                                <option value="All">All Types</option>
                                <option value="Buy">Buy</option>
                                <option value="Sell">Sell</option>
                                <option value="Deposit">Deposit</option>
                                <option value="Withdrawal">Withdrawal</option>
                                <option value="Dividend Income">Dividend Income</option>
                                <option value="Dividend Reinvested">Dividend Reinvested</option>
                                <option value="Interest">Interest</option>
                                <option value="Fee">Fee</option>
                                <option value="Stock Split">Stock Split</option>
                            </select>

                            <select
                                className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs font-semibold focus:outline-none focus:border-blue-500 min-w-[130px]"
                                value={filterMemberId}
                                onChange={e => {
                                    setFilterMemberId(e.target.value);
                                    setFilterAccountId('All');
                                    setCurrentPage(1);
                                }}
                            >
                                <option value="All">All Members</option>
                                {members.map(m => (
                                    <option key={m.id} value={m.id}>
                                        {m.name}
                                    </option>
                                ))}
                            </select>

                            <select
                                className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs font-semibold focus:outline-none focus:border-blue-500 min-w-[140px]"
                                value={filterAccountId}
                                onChange={e => {
                                    setFilterAccountId(e.target.value);
                                    setCurrentPage(1);
                                }}
                            >
                                <option value="All">All Accounts</option>
                                {accounts
                                    .filter(a => filterMemberId === 'All' || a.memberId === filterMemberId)
                                    .map(a => (
                                        <option key={a.id} value={a.id}>
                                            {a.name}
                                        </option>
                                    ))}
                            </select>

                            <select
                                className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs font-semibold focus:outline-none focus:border-blue-500 min-w-[115px]"
                                value={filterTicker}
                                onChange={e => {
                                    setFilterTicker(e.target.value);
                                    setCurrentPage(1);
                                }}
                            >
                                <option value="All">All Tickers</option>
                                {uniqueTickers.map((t, i) => (
                                    <option key={i} value={t as string}>
                                        {t}
                                    </option>
                                ))}
                            </select>

                            <div className="hidden md:block border-r border-slate-700 h-6 mx-0.5" />

                            <div className="flex items-center gap-2">
                                <span className="text-slate-300 text-xs uppercase tracking-wider font-bold">From</span>
                                <input
                                    type="date"
                                    className="bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-white font-mono text-xs focus:outline-none focus:border-blue-500"
                                    value={startDate}
                                    onChange={e => {
                                        setStartDate(e.target.value);
                                        setCurrentPage(1);
                                    }}
                                />
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-slate-300 text-xs uppercase tracking-wider font-bold">To</span>
                                <input
                                    type="date"
                                    className="bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-white font-mono text-xs focus:outline-none focus:border-blue-500"
                                    value={endDate}
                                    onChange={e => {
                                        setEndDate(e.target.value);
                                        setCurrentPage(1);
                                    }}
                                />
                            </div>

                            {hasActiveFilters && (
                                <button
                                    onClick={clearAllFilters}
                                    className="inline-flex items-center gap-1 text-xs font-bold text-blue-400 bg-blue-500/15 hover:bg-blue-500/25 border border-blue-500/35 px-2.5 py-1.5 rounded-xl ml-auto transition-colors"
                                >
                                    <X size={13} /> Clear Filters
                                </button>
                            )}
                        </div>

                        {/* Quick Date Presets */}
                        <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-slate-700/70">
                            <div className="flex items-center gap-1.5 text-slate-300 font-bold text-xs uppercase tracking-wider whitespace-nowrap mr-1">
                                <Calendar size={14} className="text-blue-400" /> Presets
                            </div>
                            {datePresets.map(preset => {
                                const isActive = startDate === preset.start && endDate === preset.end;
                                return (
                                    <button
                                        key={preset.id}
                                        type="button"
                                        onClick={() => applyDatePreset(preset.start, preset.end)}
                                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors ${
                                            isActive
                                                ? 'bg-blue-600 border-blue-500 text-white shadow-sm'
                                                : 'bg-slate-900 border-slate-700 text-slate-300 hover:text-white hover:border-slate-500'
                                        }`}
                                    >
                                        {preset.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Transactions Table Card */}
                    <div className="bg-slate-800/95 border border-slate-700/90 rounded-2xl shadow-xl overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-slate-900/90 border-b border-slate-700/80">
                                    <tr className="text-xs font-bold uppercase tracking-wider text-slate-300">
                                        <th className="px-5 py-3.5">Date</th>
                                        <th className="px-5 py-3.5">Type</th>
                                        <th className="px-5 py-3.5">Ticker</th>
                                        <th className="px-5 py-3.5">Details</th>
                                        <th className="px-5 py-3.5 text-right">Amount</th>
                                        <th className="px-5 py-3.5">Account</th>
                                        <th className="px-5 py-3.5">Member</th>
                                        <th className="px-5 py-3.5 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-700/60 text-sm">
                                    {paginatedData.length > 0 ? (
                                        paginatedData.map(tx => (
                                            <tr key={tx.id} className="hover:bg-slate-750/60 transition-colors">
                                                <td className="px-5 py-3.5 text-slate-300 font-mono tabular-nums whitespace-nowrap">
                                                    {tx.date}
                                                </td>
                                                <td className="px-5 py-3.5">
                                                    <span
                                                        className={`px-2.5 py-0.5 rounded-md text-xs font-bold uppercase border whitespace-nowrap ${
                                                            ['Buy', 'DRIP', 'Dividend Reinvested', 'Stock Split'].includes(
                                                                tx.type
                                                            )
                                                                ? 'bg-green-500/15 border-green-500/35 text-green-400'
                                                                : tx.type === 'Sell'
                                                                ? 'bg-red-500/15 border-red-500/35 text-red-400'
                                                                : tx.type === 'Dividend Income' || tx.type === 'Dividend'
                                                                ? 'bg-amber-500/15 border-amber-500/35 text-amber-400'
                                                                : tx.type === 'Withdrawal'
                                                                ? 'bg-purple-500/15 border-purple-500/35 text-purple-400'
                                                                : tx.type === 'Interest'
                                                                ? 'bg-emerald-500/15 border-emerald-500/35 text-emerald-400'
                                                                : tx.type === 'Fee'
                                                                ? 'bg-amber-500/15 border-amber-500/35 text-amber-400'
                                                                : 'bg-blue-500/15 border-blue-500/35 text-blue-400'
                                                        }`}
                                                    >
                                                        {tx.type}
                                                    </span>
                                                </td>
                                                <td className="px-5 py-3.5 font-bold font-mono text-white">
                                                    {tx.ticker || '—'}
                                                </td>
                                                <td className="px-5 py-3.5 text-slate-300 font-mono tabular-nums">
                                                    {tx.type === 'Stock Split' && tx.splitFrom && tx.splitTo
                                                        ? `${tx.splitTo}-for-${tx.splitFrom} Split`
                                                        : tx.shares
                                                        ? `${tx.shares} @ $${tx.pricePerShare?.toFixed(2)}`
                                                        : '—'}
                                                </td>
                                                <td className="px-5 py-3.5 text-right font-mono tabular-nums font-bold text-white">
                                                    ${fmt2(tx.amount)}
                                                </td>
                                                <td className="px-5 py-3.5 text-slate-200 font-medium">
                                                    {tx.accountName}
                                                </td>
                                                <td className="px-5 py-3.5 text-slate-300">{tx.memberName}</td>
                                                <td className="px-5 py-3.5 text-right">
                                                    <button
                                                        onClick={() => deleteTransaction(tx.id)}
                                                        className="p-2 bg-red-500/15 border border-red-500/30 hover:bg-red-500/25 text-red-400 rounded-lg transition-colors"
                                                        title="Delete Transaction"
                                                        aria-label="Delete Transaction"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={8} className="text-center py-12 text-slate-300">
                                                <div className="flex flex-col items-center gap-2">
                                                    <FileText size={32} className="text-slate-400" />
                                                    <p className="font-medium">No transactions found matching your filters.</p>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Totals Row */}
                        {filteredData.length > 0 &&
                            (() => {
                                const totals = filteredData.reduce(
                                    (acc, tx) => {
                                        if (tx.type === 'Deposit') acc.deposits += tx.amount;
                                        else if (tx.type === 'Withdrawal') acc.withdrawals += tx.amount;
                                        else if (tx.type === 'Buy') acc.buys += tx.amount;
                                        else if (tx.type === 'Sell') acc.sells += tx.amount;
                                        else if (tx.type.includes('Dividend') || tx.type === 'DRIP')
                                            acc.dividends += tx.amount;
                                        else if (tx.type === 'Interest') acc.interest += tx.amount;
                                        else if (tx.type === 'Fee') acc.fees += tx.amount;
                                        return acc;
                                    },
                                    { deposits: 0, withdrawals: 0, buys: 0, sells: 0, dividends: 0, interest: 0, fees: 0 }
                                );

                                return (
                                    <div className="bg-slate-900/75 px-6 py-4 border-t border-slate-700/80 flex flex-wrap gap-x-8 gap-y-4">
                                        <div className="flex flex-col">
                                            <span className="text-slate-300 uppercase text-xs font-bold tracking-wider">
                                                Total Deposits
                                            </span>
                                            <span className="text-green-400 font-mono tabular-nums font-bold text-lg">
                                                ${fmt2(totals.deposits)}
                                            </span>
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-slate-300 uppercase text-xs font-bold tracking-wider">
                                                Total Withdrawals
                                            </span>
                                            <span className="text-red-400 font-mono tabular-nums font-bold text-lg">
                                                ${fmt2(totals.withdrawals)}
                                            </span>
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-slate-300 uppercase text-xs font-bold tracking-wider">
                                                Total Buys
                                            </span>
                                            <span className="text-blue-400 font-mono tabular-nums font-bold text-lg">
                                                ${fmt2(totals.buys)}
                                            </span>
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-slate-300 uppercase text-xs font-bold tracking-wider">
                                                Total Sells
                                            </span>
                                            <span className="text-red-400 font-mono tabular-nums font-bold text-lg">
                                                ${fmt2(totals.sells)}
                                            </span>
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-slate-300 uppercase text-xs font-bold tracking-wider">
                                                Total Dividends
                                            </span>
                                            <span className="text-amber-400 font-mono tabular-nums font-bold text-lg">
                                                ${fmt2(totals.dividends)}
                                            </span>
                                        </div>
                                        {totals.interest > 0 && (
                                            <div className="flex flex-col">
                                                <span className="text-slate-300 uppercase text-xs font-bold tracking-wider">
                                                    Total Interest
                                                </span>
                                                <span className="text-emerald-400 font-mono tabular-nums font-bold text-lg">
                                                    ${fmt2(totals.interest)}
                                                </span>
                                            </div>
                                        )}
                                        {totals.fees > 0 && (
                                            <div className="flex flex-col">
                                                <span className="text-slate-300 uppercase text-xs font-bold tracking-wider">
                                                    Total Fees
                                                </span>
                                                <span className="text-amber-400 font-mono tabular-nums font-bold text-lg">
                                                    ${fmt2(totals.fees)}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                );
                            })()}

                        {/* Pagination Controls */}
                        {filteredData.length > 0 && (
                            <div className="flex flex-wrap justify-between items-center gap-3 px-6 py-3.5 border-t border-slate-700/80 bg-slate-900/90">
                                <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
                                    <span>Show:</span>
                                    <select
                                        className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1 text-white font-mono focus:outline-none focus:border-blue-500"
                                        value={rowsPerPage}
                                        onChange={e => {
                                            setRowsPerPage(Number(e.target.value));
                                            setCurrentPage(1);
                                        }}
                                    >
                                        <option value={10}>10</option>
                                        <option value={20}>20</option>
                                        <option value={50}>50</option>
                                        <option value={-1}>All</option>
                                    </select>
                                    <span>rows</span>
                                </div>

                                <div className="flex items-center gap-4">
                                    <span className="text-xs font-mono font-semibold text-slate-300">
                                        {rowsPerPage === -1
                                            ? `1–${totalItems} of ${totalItems}`
                                            : `${startIndex + 1}–${Math.min(startIndex + rowsPerPage, totalItems)} of ${totalItems}`}
                                    </span>

                                    <div className="flex gap-1.5">
                                        <button
                                            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-200 hover:text-white disabled:opacity-45 disabled:cursor-not-allowed transition-colors"
                                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                            disabled={currentPage === 1 || rowsPerPage === -1}
                                        >
                                            Prev
                                        </button>
                                        <button
                                            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-200 hover:text-white disabled:opacity-45 disabled:cursor-not-allowed transition-colors"
                                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                            disabled={currentPage === totalPages || rowsPerPage === -1}
                                        >
                                            Next
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {activeTab === 'assets' && (
                <div className="flex flex-col gap-6">
                    {memberAccountAssets.map(member => (
                        <section
                            key={member.id}
                            className="bg-slate-800/95 border border-slate-700/90 rounded-2xl shadow-xl overflow-hidden"
                        >
                            {/* Member Header */}
                            <div className="bg-slate-900/80 px-6 py-4 border-b border-slate-700/80 flex flex-wrap justify-between items-center gap-4">
                                <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                                    {member.name}
                                </h2>
                                <div className="text-right">
                                    <div className="text-xs font-bold uppercase tracking-wider text-slate-300">
                                        Member Net Invested
                                    </div>
                                    <div className="font-mono tabular-nums font-bold text-xl text-white">
                                        ${fmt2(member.totalInvested)}
                                    </div>
                                </div>
                            </div>

                            <div className="p-6 space-y-6">
                                {member.accounts.map(account => (
                                    <div key={account.id} className="space-y-3">
                                        <div className="flex justify-between items-center">
                                            <h3 className="text-base sm:text-lg font-bold text-blue-400">
                                                {account.name}{' '}
                                                <span className="text-sm text-slate-300 font-medium ml-1.5">
                                                    ({account.institutionName})
                                                </span>
                                            </h3>
                                        </div>

                                        <div className="bg-slate-900/50 border border-slate-700/80 rounded-xl overflow-hidden">
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-left border-collapse">
                                                    <thead className="bg-slate-900/90 border-b border-slate-700/80">
                                                        <tr className="text-xs font-bold uppercase tracking-wider text-slate-300">
                                                            <th className="px-4 py-3">Asset</th>
                                                            <th className="px-4 py-3 text-right">Shares</th>
                                                            <th className="px-4 py-3 text-right">Cost/Share</th>
                                                            <th className="px-4 py-3 text-right">Total Invested</th>
                                                            <th className="px-4 py-3 text-right">Current Value</th>
                                                            <th className="px-4 py-3 text-right">$ Gain/Loss</th>
                                                            <th className="px-4 py-3 text-right">% Gain/Loss</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-700/50 text-sm">
                                                        {account.assets.map(asset => {
                                                            const invested = asset.customBookCost ?? asset.totalCost;
                                                            const costPerShare =
                                                                asset.quantity > 0 ? invested / asset.quantity : 0;
                                                            return (
                                                                <tr
                                                                    key={asset.id}
                                                                    className="hover:bg-slate-800/60 transition-colors"
                                                                >
                                                                    <td className="px-4 py-3 font-bold font-mono text-white">
                                                                        {asset.ticker}
                                                                    </td>
                                                                    <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-200">
                                                                        {asset.quantity.toLocaleString(undefined, {
                                                                            minimumFractionDigits: 2,
                                                                            maximumFractionDigits: 4,
                                                                        })}
                                                                    </td>
                                                                    <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-300">
                                                                        ${fmt2(costPerShare)}
                                                                    </td>
                                                                    <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-300">
                                                                        ${fmt2(invested)}
                                                                    </td>
                                                                    <td className="px-4 py-3 text-right font-mono tabular-nums font-semibold text-white">
                                                                        ${fmt2(asset.marketValue)}
                                                                    </td>
                                                                    <td
                                                                        className={`px-4 py-3 text-right font-mono tabular-nums font-bold ${
                                                                            asset.profit >= 0
                                                                                ? 'text-green-400'
                                                                                : 'text-red-400'
                                                                        }`}
                                                                    >
                                                                        {asset.profit >= 0 ? '+' : '-'}$
                                                                        {fmt2(Math.abs(asset.profit))}
                                                                    </td>
                                                                    <td
                                                                        className={`px-4 py-3 text-right font-mono tabular-nums font-bold ${
                                                                            asset.profitPercent >= 0
                                                                                ? 'text-green-400'
                                                                                : 'text-red-400'
                                                                        }`}
                                                                    >
                                                                        {asset.profitPercent >= 0 ? '+' : ''}
                                                                        {asset.profitPercent.toFixed(2)}%
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })}
                                                        {/* Account Summary Row */}
                                                        <tr className="bg-slate-900/90 font-bold border-t-2 border-slate-700">
                                                            <td
                                                                colSpan={3}
                                                                className="px-4 py-3 text-right text-xs uppercase tracking-wider text-slate-300"
                                                            >
                                                                Account Total
                                                            </td>
                                                            <td className="px-4 py-3 text-right font-mono tabular-nums text-white">
                                                                ${fmt2(account.totalInvested)}
                                                            </td>
                                                            <td className="px-4 py-3 text-right font-mono tabular-nums text-white">
                                                                ${fmt2(account.totalValue)}
                                                            </td>
                                                            <td
                                                                className={`px-4 py-3 text-right font-mono tabular-nums ${
                                                                    account.totalProfit >= 0
                                                                        ? 'text-green-400'
                                                                        : 'text-red-400'
                                                                }`}
                                                            >
                                                                {account.totalProfit >= 0 ? '+' : '-'}$
                                                                {fmt2(Math.abs(account.totalProfit))}
                                                            </td>
                                                            <td
                                                                className={`px-4 py-3 text-right font-mono tabular-nums ${
                                                                    account.totalInvested > 0 && account.totalProfit >= 0
                                                                        ? 'text-green-400'
                                                                        : account.totalProfit < 0
                                                                        ? 'text-red-400'
                                                                        : 'text-slate-300'
                                                                }`}
                                                            >
                                                                {account.totalInvested > 0
                                                                    ? (
                                                                          (account.totalProfit / account.totalInvested) *
                                                                          100
                                                                      ).toFixed(2)
                                                                    : '0.00'}
                                                                %
                                                            </td>
                                                        </tr>
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    </div>
                                ))}

                                {/* Member Summary */}
                                <div className="bg-slate-900/75 border border-slate-700/80 rounded-xl p-4 flex flex-wrap justify-end gap-8">
                                    <div>
                                        <div className="text-xs font-bold uppercase tracking-wider text-slate-300">
                                            Total Invested
                                        </div>
                                        <div className="font-mono tabular-nums font-bold text-lg text-white mt-0.5">
                                            ${fmt2(member.totalInvested)}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-xs font-bold uppercase tracking-wider text-slate-300">
                                            Total Current Value
                                        </div>
                                        <div className="font-mono tabular-nums font-bold text-lg text-white mt-0.5">
                                            ${fmt2(member.totalValue)}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-xs font-bold uppercase tracking-wider text-slate-300">
                                            Total Profit/Loss
                                        </div>
                                        <div
                                            className={`font-mono tabular-nums font-bold text-lg mt-0.5 ${
                                                member.totalProfit >= 0 ? 'text-green-400' : 'text-red-400'
                                            }`}
                                        >
                                            {member.totalProfit >= 0 ? '+' : '-'}${fmt2(Math.abs(member.totalProfit))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </section>
                    ))}

                    {/* Grand Total Card */}
                    {memberAccountAssets.length > 0 &&
                        (() => {
                            const grandInvested = memberAccountAssets.reduce((sum, m) => sum + m.totalInvested, 0);
                            const grandValue = memberAccountAssets.reduce((sum, m) => sum + m.totalValue, 0);
                            const grandProfit = memberAccountAssets.reduce((sum, m) => sum + m.totalProfit, 0);

                            return (
                                <section className="bg-slate-800/95 border border-blue-500/40 rounded-2xl p-6 shadow-xl space-y-4">
                                    <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                                        Household Grand Total
                                    </h2>
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-900/65 border border-slate-700/70 rounded-xl p-4">
                                        <div>
                                            <div className="text-xs font-bold uppercase tracking-wider text-slate-300">
                                                Total Invested
                                            </div>
                                            <div className="font-mono tabular-nums font-bold text-xl text-white mt-1">
                                                ${fmt2(grandInvested)}
                                            </div>
                                        </div>
                                        <div>
                                            <div className="text-xs font-bold uppercase tracking-wider text-slate-300">
                                                Total Current Value
                                            </div>
                                            <div className="font-mono tabular-nums font-bold text-xl text-white mt-1">
                                                ${fmt2(grandValue)}
                                            </div>
                                        </div>
                                        <div>
                                            <div className="text-xs font-bold uppercase tracking-wider text-slate-300">
                                                Total Profit/Loss
                                            </div>
                                            <div
                                                className={`font-mono tabular-nums font-bold text-xl mt-1 ${
                                                    grandProfit >= 0 ? 'text-green-400' : 'text-red-400'
                                                }`}
                                            >
                                                {grandProfit >= 0 ? '+' : '-'}${fmt2(Math.abs(grandProfit))}
                                            </div>
                                        </div>
                                    </div>
                                </section>
                            );
                        })()}

                    {memberAccountAssets.length === 0 && (
                        <div className="bg-slate-800/95 border border-slate-700/90 rounded-2xl p-12 text-center text-slate-300">
                            <FileText size={40} className="mx-auto mb-3 text-slate-400" />
                            <p className="font-medium">No assets found.</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default Reports;
