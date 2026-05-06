import { useState, useEffect } from 'react';
import { useData } from '../context/DataContext';
import { Download, FileText, Filter, Trash2 } from 'lucide-react';
import '../styles/shared.css';

const Reports = () => {
    const { transactions, accounts, members, institutions, deleteTransaction, assets } = useData();
    const [activeTab, setActiveTab] = useState<'transactions' | 'assets'>('transactions');
    
    // Transactions Filter State
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

    // Export Transactions to CSV
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

    // Data for Asset Overview
    // Group by Member -> Account -> Assets
    const memberAccountAssets = members.map(member => {
        const memberAccounts = accounts.filter(a => a.memberId === member.id);
        const accountsWithAssets = memberAccounts.map(account => {
            const accountAssets = assets.filter(a => a.accountId === account.id && a.quantity > 0);
            
            const totalInvested = accountAssets.reduce((sum, a) => sum + (a.customBookCost ?? a.totalCost), 0);
            const totalValue = accountAssets.reduce((sum, a) => sum + a.marketValue, 0);
            const totalProfit = totalValue - totalInvested;
            
            return {
                ...account,
                institutionName: institutions.find(i => i.id === account.institutionId)?.name || 'Unknown',
                assets: accountAssets,
                totalInvested,
                totalValue,
                totalProfit
            };
        }).filter(a => a.assets.length > 0 || a.cashBalance > 0);

        const totalInvested = accountsWithAssets.reduce((sum, a) => sum + a.totalInvested, 0);
        const totalValue = accountsWithAssets.reduce((sum, a) => sum + a.totalValue, 0);
        const totalProfit = totalValue - totalInvested;

        return {
            ...member,
            accounts: accountsWithAssets,
            totalInvested,
            totalValue,
            totalProfit
        };
    }).filter(m => m.accounts.length > 0);

    const exportAssetsCSV = () => {
        const headers = ['Member', 'Account', 'Institution', 'Ticker', 'Shares', 'Cost/Share', 'Total Invested', 'Market Value', 'Profit/Loss ($)', 'Profit/Loss (%)'];
        const rows: any[] = [];

        memberAccountAssets.forEach(member => {
            member.accounts.forEach(account => {
                account.assets.forEach(asset => {
                    const costPerShare = asset.quantity > 0 ? (asset.customBookCost ?? asset.totalCost) / asset.quantity : 0;
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
                        asset.profitPercent.toFixed(2) + '%'
                    ]);
                });
            });
        });

        const csvContent = "data:text/csv;charset=utf-8,"
            + headers.join(",") + "\n"
            + rows.map(e => e.join(",")).join("\n");

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `asset_overview_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-3xl font-bold text-white mb-2">Reports</h1>
                    <p className="text-slate-400">View and export your investment history and asset overviews</p>
                </div>
                <button 
                    className="btn btn-primary" 
                    onClick={activeTab === 'transactions' ? exportCSV : exportAssetsCSV}
                >
                    <Download size={18} /> Export CSV
                </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-4 mb-6 border-b border-slate-700">
                <button 
                    className={`pb-2 px-1 transition-colors ${activeTab === 'transactions' ? 'border-b-2 border-blue-500 text-blue-400 font-medium' : 'text-slate-400 hover:text-slate-300'}`}
                    onClick={() => setActiveTab('transactions')}
                >
                    Transactions Report
                </button>
                <button 
                    className={`pb-2 px-1 transition-colors ${activeTab === 'assets' ? 'border-b-2 border-blue-500 text-blue-400 font-medium' : 'text-slate-400 hover:text-slate-300'}`}
                    onClick={() => setActiveTab('assets')}
                >
                    Asset Overview Report
                </button>
            </div>

            {activeTab === 'transactions' && (
                <>
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
                                    <option value="Dividend Income">Dividend Income</option>
                                    <option value="Dividend Reinvested">Dividend Reinvested</option>
                                    <option value="Stock Split">Stock Split</option>
                                    <option value="Dividend">Dividend (Legacy)</option>
                                    <option value="DRIP">DRIP (Legacy)</option>
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
                                                    ${['Buy', 'DRIP', 'Dividend Reinvested', 'Stock Split'].includes(tx.type) ? 'bg-green-500/20 text-green-400' :
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
                                                ${tx.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
                </>
            )}

            {activeTab === 'assets' && (
                <div className="flex flex-col gap-6">
                    {memberAccountAssets.map(member => (
                        <div key={member.id} className="card p-6">
                            <div className="flex justify-between items-center mb-6 border-b border-slate-700/50 pb-4">
                                <h2 className="text-2xl font-bold text-white">{member.name}</h2>
                                <div className="text-right">
                                    <div className="text-sm text-slate-400">Member Net Invested</div>
                                    <div className="font-mono font-bold text-xl text-white">${member.totalInvested.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                                </div>
                            </div>

                            {member.accounts.map(account => (
                                <div key={account.id} className="mb-8 last:mb-0">
                                    <div className="flex justify-between items-center mb-3">
                                        <h3 className="text-lg font-semibold text-blue-400">{account.name} <span className="text-sm text-slate-500 font-normal ml-2">({account.institutionName})</span></h3>
                                    </div>
                                    <div className="table-container rounded overflow-hidden">
                                        <table className="data-table">
                                            <thead>
                                                <tr>
                                                    <th>Asset</th>
                                                    <th className="text-right">Shares</th>
                                                    <th className="text-right">Cost/Share</th>
                                                    <th className="text-right">Total Invested</th>
                                                    <th className="text-right">Current Value</th>
                                                    <th className="text-right">$ Gain/Loss</th>
                                                    <th className="text-right">% Gain/Loss</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {account.assets.map(asset => {
                                                    const costPerShare = asset.quantity > 0 ? (asset.customBookCost ?? asset.totalCost) / asset.quantity : 0;
                                                    const invested = asset.customBookCost ?? asset.totalCost;
                                                    return (
                                                        <tr key={asset.id}>
                                                            <td className="font-bold text-white">{asset.ticker}</td>
                                                            <td className="text-right font-mono text-slate-300">{asset.quantity.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</td>
                                                            <td className="text-right font-mono text-slate-300">${costPerShare.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                                            <td className="text-right font-mono text-slate-300">${invested.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                                            <td className="text-right font-mono text-white">${asset.marketValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                                            <td className={`text-right font-mono font-medium ${asset.profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                                {asset.profit >= 0 ? '+' : ''}${asset.profit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                            </td>
                                                            <td className={`text-right font-mono font-medium ${asset.profitPercent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                                {asset.profitPercent >= 0 ? '+' : ''}{asset.profitPercent.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                                {/* Account Summary Row */}
                                                <tr className="bg-slate-800/50 font-bold border-t-2 border-slate-700">
                                                    <td colSpan={3} className="text-right text-slate-400 py-3">Account Total</td>
                                                    <td className="text-right font-mono text-white py-3">${account.totalInvested.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                                    <td className="text-right font-mono text-white py-3">${account.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                                    <td className={`text-right font-mono py-3 ${account.totalProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                        {account.totalProfit >= 0 ? '+' : ''}${account.totalProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                    </td>
                                                    <td className={`text-right font-mono py-3 ${account.totalInvested > 0 && account.totalProfit >= 0 ? 'text-green-400' : account.totalProfit < 0 ? 'text-red-400' : 'text-slate-400'}`}>
                                                        {account.totalInvested > 0 ? ((account.totalProfit / account.totalInvested) * 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : 0}%
                                                    </td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            ))}

                            {/* Member Summary */}
                            <div className="mt-6 pt-6 border-t border-slate-700/50 flex flex-wrap justify-end gap-8 bg-slate-800/30 p-4 rounded-lg">
                                <div>
                                    <div className="text-sm text-slate-400">Total Invested</div>
                                    <div className="font-mono font-bold text-lg text-white">${member.totalInvested.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                                </div>
                                <div>
                                    <div className="text-sm text-slate-400">Total Current Value</div>
                                    <div className="font-mono font-bold text-lg text-white">${member.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                                </div>
                                <div>
                                    <div className="text-sm text-slate-400">Total Profit/Loss</div>
                                    <div className={`font-mono font-bold text-lg ${member.totalProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                        {member.totalProfit >= 0 ? '+' : ''}${member.totalProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                    {memberAccountAssets.length === 0 && (
                        <div className="card p-8 text-center text-slate-500">
                            <FileText size={48} className="mx-auto mb-4 opacity-50" />
                            <p>No assets found.</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default Reports;

