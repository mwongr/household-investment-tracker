import { useState, useEffect } from 'react';
import { useData } from '../context/DataContext';
import { Download, FileText, Filter, Trash2 } from 'lucide-react';
import '../styles/shared.css';

const Reports = () => {
    const { transactions, accounts, members, institutions, deleteTransaction } = useData();
    const [filterType, setFilterType] = useState('All');
    const [searchTerm, setSearchTerm] = useState('');

    // Pagination & Date Range State
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(10);

    // Reset page when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [filterType, searchTerm, startDate, endDate, rowsPerPage]);

    // Enrich transactions with readable names and preserve original order
    const enrichedTransactions = transactions.map((tx, index) => {
        const account = accounts.find(a => a.id === tx.accountId);
        const member = members.find(m => m.id === account?.memberId);
        const institution = institutions.find(i => i.id === account?.institutionId);

        return {
            ...tx,
            accountName: account?.name || 'Unknown',
            memberName: member?.name || 'Unknown',
            institutionName: institution?.name || 'Unknown',
            _originalIndex: index // Preserve insertion order for stable sorting
        };
    });

    // Filter Logic
    const filteredData = enrichedTransactions.filter(tx => {
        const matchesType = filterType === 'All' || tx.type === filterType;
        const matchesSearch =
            tx.ticker?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            tx.accountName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            tx.memberName.toLowerCase().includes(searchTerm.toLowerCase());

        const txDate = new Date(tx.date);
        const start = startDate ? new Date(startDate) : null;
        const end = endDate ? new Date(endDate) : null;

        const matchesDate = (!start || txDate >= start) && (!end || txDate <= end);

        return matchesType && matchesSearch && matchesDate;
    }).sort((a, b) => {
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();
        if (dateA !== dateB) {
            return dateB - dateA; // Sort by Date Descending
        }
        return b._originalIndex - a._originalIndex; // Tie-breaker: Newest added first (stable)
    });

    // Pagination Logic
    const totalItems = filteredData.length;
    const totalPages = Math.ceil(totalItems / rowsPerPage);
    const startIndex = (currentPage - 1) * rowsPerPage;
    const paginatedData = rowsPerPage === -1 ? filteredData : filteredData.slice(startIndex, startIndex + rowsPerPage);

    // Export to CSV
    const exportCSV = () => {
        const headers = ['Date', 'Type', 'Ticker', 'Shares', 'Price', 'Amount', 'Account', 'Member', 'Institution'];
        const rows = filteredData.map(tx => [ // Export filteredData (full set), not paginatedData
            tx.date,
            tx.type,
            tx.ticker || '-',
            tx.shares || 0,
            tx.pricePerShare || 0,
            tx.amount,
            tx.accountName,
            tx.memberName,
            tx.institutionName
        ]);

        const csvContent = "data:text/csv;charset=utf-8,"
            + headers.join(",") + "\n"
            + rows.map(e => e.join(",")).join("\n");

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `transactions_report_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-white mb-2">Reports</h1>
                    <p className="text-slate-400">View and export your investment history</p>
                </div>
                <button className="btn btn-primary" onClick={exportCSV}>
                    <Download size={18} /> Export Filtered CSV
                </button>
            </div>

            <div className="card mb-6 p-4">
                <div className="flex flex-col gap-4">
                    {/* Top Row: Type and Search */}
                    <div className="flex flex-wrap gap-4 items-center">
                        <div className="flex items-center gap-2 text-slate-400">
                            <Filter size={18} />
                            <span className="text-sm font-medium">Filters:</span>
                        </div>

                        <select
                            className="input w-auto min-w-[150px]"
                            value={filterType}
                            onChange={(e) => setFilterType(e.target.value)}
                        >
                            <option value="All">All Types</option>
                            <option value="Buy">Buy</option>
                            <option value="Sell">Sell</option>
                            <option value="Deposit">Deposit</option>
                            <option value="Withdrawal">Withdrawal</option>
                            <option value="Dividend">Dividend</option>
                        </select>

                        <input
                            type="text"
                            className="input w-auto flex-1 min-w-[200px]"
                            placeholder="Search ticker, account, or member..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    {/* Bottom Row: Date Range */}
                    <div className="flex flex-wrap gap-4 items-center">
                        <div className="flex items-center gap-2">
                            <span className="text-slate-400 text-sm">From:</span>
                            <input
                                type="date"
                                className="input py-1 px-2 w-[160px] text-sm"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-slate-400 text-sm">To:</span>
                            <input
                                type="date"
                                className="input py-1 px-2 w-[160px] text-sm"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                            />
                        </div>
                        {(startDate || endDate) && (
                            <button
                                onClick={() => { setStartDate(''); setEndDate(''); }}
                                className="text-xs text-blue-400 hover:text-blue-300 underline"
                            >
                                Clear Dates
                            </button>
                        )}
                    </div>
                </div>
            </div>

            <div className="card">
                <div className="table-container">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Type</th>
                                <th>Ticker</th>
                                <th>Details</th>
                                <th className="text-right">Amount</th>
                                <th>Account</th>
                                <th>Member</th>
                                <th className="text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {paginatedData.length > 0 ? paginatedData.map(tx => (
                                <tr key={tx.id}>
                                    <td className="text-slate-400 font-mono text-sm">{tx.date}</td>
                                    <td>
                                        <span className={`px-2 py-1 rounded text-xs font-medium 
                                            ${tx.type === 'Buy' ? 'bg-green-500/20 text-green-400' :
                                                tx.type === 'Sell' ? 'bg-red-500/20 text-red-400' :
                                                    'bg-blue-500/20 text-blue-400'}`}>
                                            {tx.type}
                                        </span>
                                    </td>
                                    <td className="font-bold text-white">{tx.ticker || '-'}</td>
                                    <td className="text-sm text-slate-400">
                                        {tx.shares ? `${tx.shares} @ $${tx.pricePerShare?.toFixed(2)}` : '-'}
                                    </td>
                                    <td className="text-right font-mono text-white">
                                        ${tx.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                    </td>
                                    <td className="text-sm text-slate-300">{tx.accountName}</td>
                                    <td className="text-sm text-slate-400">{tx.memberName}</td>
                                    <td className="text-right">
                                        <button
                                            onClick={() => deleteTransaction(tx.id)}
                                            className="p-1 hover:bg-red-500/20 text-slate-400 hover:text-red-400 rounded transition-colors"
                                            title="Delete Transaction"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan={8} className="text-center py-8 text-slate-500">
                                        <div className="flex flex-col items-center gap-2">
                                            <FileText size={32} className="opacity-50" />
                                            <p>No transactions found matching your filters.</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination Controls */}
                {filteredData.length > 0 && (
                    <div className="flex justify-between items-center p-4 border-t border-slate-700/50 bg-slate-800/20">
                        <div className="flex items-center gap-2 text-sm text-slate-400">
                            <span>Show:</span>
                            <select
                                className="bg-slate-800 border-slate-700 rounded px-2 py-1 text-white focus:outline-none focus:border-blue-500"
                                value={rowsPerPage}
                                onChange={(e) => setRowsPerPage(Number(e.target.value))}
                            >
                                <option value={10}>10</option>
                                <option value={20}>20</option>
                                <option value={50}>50</option>
                                <option value={-1}>All</option>
                            </select>
                            <span>rows</span>
                        </div>

                        <div className="flex items-center gap-4">
                            <span className="text-sm text-slate-400">
                                {startIndex + 1}-{Math.min(startIndex + rowsPerPage, totalItems)} of {totalItems}
                            </span>

                            <div className="flex gap-1">
                                <button
                                    className="px-3 py-1 rounded bg-slate-700 text-white disabled:opacity-50 hover:bg-slate-600 transition-colors"
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                    disabled={currentPage === 1}
                                >
                                    Prev
                                </button>
                                <button
                                    className="px-3 py-1 rounded bg-slate-700 text-white disabled:opacity-50 hover:bg-slate-600 transition-colors"
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
    );
};

export default Reports;
