import React, { useState, useRef } from 'react';
import { useData } from '../context/DataContext';
import { TrendingUp, Wallet, Landmark, Activity, PiggyBank, CreditCard, Plus, Trash2, Home, Receipt, Edit2, Check, X, Coins, FileText, Download } from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import Papa from 'papaparse';
import '../styles/networth.css';

const NetWorth = () => {
    const {
        members,
        accounts,
        assets,
        bankAccounts, addBankAccount, updateBankAccount, deleteBankAccount,
        liabilities, addLiability, updateLiability, deleteLiability,
        monthlyExpenses, addMonthlyExpense, updateMonthlyExpense, deleteMonthlyExpense
    } = useData();

    const [selectedMember, setSelectedMember] = useState<string>('total');
    const contentRef = useRef<HTMLDivElement>(null);

    // Forms state
    const [newBankName, setNewBankName] = useState('');
    const [newBankBalance, setNewBankBalance] = useState('');
    const [newLibName, setNewLibName] = useState('');
    const [newLibBalance, setNewLibBalance] = useState('');
    const [newExpName, setNewExpName] = useState('');
    const [newExpAmount, setNewExpAmount] = useState('');
    const [newExpCategory, setNewExpCategory] = useState('Housing');

    // Edit states
    const [editingBankId, setEditingBankId] = useState<string | null>(null);
    const [editBankName, setEditBankName] = useState('');
    const [editBankBalance, setEditBankBalance] = useState('');

    const [editingLibId, setEditingLibId] = useState<string | null>(null);
    const [editLibName, setEditLibName] = useState('');
    const [editLibBalance, setEditLibBalance] = useState('');

    const [editingExpId, setEditingExpId] = useState<string | null>(null);
    const [editExpName, setEditExpName] = useState('');
    const [editExpAmount, setEditExpAmount] = useState('');
    const [editExpCategory, setEditExpCategory] = useState('');

    const handleAddBank = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newBankName || !newBankBalance) return;
        addBankAccount({
            name: newBankName,
            balance: parseFloat(newBankBalance),
            memberId: selectedMember === 'total' ? 'joint' : selectedMember
        });
        setNewBankName('');
        setNewBankBalance('');
    };

    const handleAddLiability = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newLibName || !newLibBalance) return;
        addLiability({
            name: newLibName,
            balance: parseFloat(newLibBalance),
            memberId: selectedMember === 'total' ? 'joint' : selectedMember
        });
        setNewLibName('');
        setNewLibBalance('');
    };

    const handleAddExpense = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newExpName || !newExpAmount) return;
        addMonthlyExpense({
            name: newExpName,
            amount: parseFloat(newExpAmount),
            category: newExpCategory,
            memberId: 'joint' // Always joint so it's calculated together for the household
        });
        setNewExpName('');
        setNewExpAmount('');
    };

    // Save Edit Handlers
    const saveBankEdit = (id: string) => {
        const bank = bankAccounts.find(b => b.id === id);
        if (bank) {
            updateBankAccount(id, {
                ...bank,
                name: editBankName,
                balance: parseFloat(editBankBalance) || 0
            });
        }
        setEditingBankId(null);
    };

    const saveLibEdit = (id: string) => {
        const lib = liabilities.find(l => l.id === id);
        if (lib) {
            updateLiability(id, {
                ...lib,
                name: editLibName,
                balance: parseFloat(editLibBalance) || 0
            });
        }
        setEditingLibId(null);
    };

    const saveExpEdit = (id: string) => {
        const exp = monthlyExpenses.find(e => e.id === id);
        if (exp) {
            updateMonthlyExpense(id, {
                ...exp,
                name: editExpName,
                amount: parseFloat(editExpAmount) || 0,
                category: editExpCategory || 'Other'
            });
        }
        setEditingExpId(null);
    };

    // Export Handlers
    const exportToPDF = async () => {
        if (!contentRef.current) return;

        const canvas = await html2canvas(contentRef.current, {
            scale: 2,
            useCORS: true,
            backgroundColor: '#0f172a' // Slate-900 style
        });

        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF('p', 'mm', 'a4');
        const imgProps = pdf.getImageProperties(imgData);
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
        pdf.save(`net-worth-${selectedMember}-${new Date().toISOString().split('T')[0]}.pdf`);
    };

    const exportToCSV = () => {
        const memberName = selectedMember === 'total' ? 'Total Household' : members.find(m => m.id === selectedMember)?.name || 'Member';

        const data = [
            ['Net Worth Report', new Date().toLocaleDateString()],
            ['Member', memberName],
            [],
            ['Summary Metrics'],
            ['Metric', 'Value'],
            ['Total Net Worth', netWorth],
            ['Gross Assets', grossAssets],
            ['Total Cash In Hand', totalCashInHand],
            ['Total Liabilities', totalLiabilities],
            ['Monthly Expenses', totalExpenses],
            [],
            ['Bank Accounts'],
            ['Name', 'Owner', 'Balance'],
            ...filteredBanks.map(b => [b.name, b.memberId === 'joint' ? 'Joint' : members.find(m => m.id === b.memberId)?.name, b.balance]),
            [],
            ['Investment Accounts'],
            ['Name', 'Type', 'Assets Market Value', 'Cash Balance', 'Total'],
            ...filteredAccounts.map(acc => {
                const accAssets = filteredAssets.filter(a => a.accountId === acc.id);
                const accAssetsTotal = accAssets.reduce((sum, a) => sum + (a.marketValue || 0), 0);
                return [acc.name, acc.type, accAssetsTotal, acc.cashBalance, accAssetsTotal + acc.cashBalance];
            }),
            [],
            ['Liabilities'],
            ['Name', 'Balance'],
            ...filteredLiabilities.map(l => [l.name, l.balance]),
            [],
            ['Monthly Expenses'],
            ['Expense', 'Category', 'Amount'],
            ...monthlyExpenses.map(e => [e.name, e.category, e.amount])
        ];

        const csv = Papa.unparse(data);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `net-worth-${selectedMember}-${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // Derived Data Computing
    // Filter functions
    const isOwner = (itemMemberId: string) => {
        if (selectedMember === 'total') return true;
        // if viewing specific member, show their items + joint items
        return itemMemberId === selectedMember || itemMemberId === 'joint';
    };

    // Filter accounts and assets
    const filteredAccounts = selectedMember === 'total' ? accounts : accounts.filter(a => a.memberId === selectedMember);
    const filteredAssets = selectedMember === 'total'
        ? assets
        : assets.filter(asset => {
            const acc = accounts.find(a => a.id === asset.accountId);
            return acc && acc.memberId === selectedMember;
        });

    const filteredBanks = bankAccounts.filter(b => isOwner(b.memberId));
    const filteredLiabilities = liabilities.filter(l => isOwner(l.memberId));
    const filteredExpenses = monthlyExpenses; // Always show all expenses for the household

    // Computations
    const investmentMarketValue = filteredAssets.reduce((sum, a) => sum + (a.marketValue || 0), 0);
    const investmentCash = filteredAccounts.reduce((sum, a) => sum + (a.cashBalance || 0), 0);
    const bankCash = filteredBanks.reduce((sum, b) => sum + (b.balance || 0), 0);

    const totalInvestments = investmentMarketValue + investmentCash;
    const totalCashInHand = investmentCash + bankCash;
    const totalCash = bankCash; // keeping variable for consistency below

    const totalLiabilities = filteredLiabilities.reduce((sum, l) => sum + (l.balance || 0), 0);
    const totalExpenses = filteredExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);

    const grossAssets = totalInvestments + totalCash;
    const netWorth = grossAssets - totalLiabilities;
    const debtToAssetRatio = grossAssets > 0 ? (totalLiabilities / grossAssets) * 100 : 0;

    // Estimated Safe Withdrawal / Monthly Cash Flow (rough estimate for "wow" factor)
    // Rule of thumb: 4% safe withdrawal rate per year -> /12 for monthly
    const estimatedMonthlyIncome = totalInvestments * 0.04 / 12;
    const netCashFlow = estimatedMonthlyIncome - totalExpenses;

    const formatter = new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' });

    // Visualization Widths
    const totalVisual = grossAssets + totalLiabilities;
    let wAssets = totalVisual > 0 ? (totalInvestments / totalVisual) * 100 : 0;
    let wCash = totalVisual > 0 ? (totalCash / totalVisual) * 100 : 0;
    let wLiab = totalVisual > 0 ? (totalLiabilities / totalVisual) * 100 : 0;

    return (
        <div className="networth-page">
            <div className="page-header pb-4 border-b border-gray-700">
                <div className="flex items-center gap-4">
                    <h1 className="page-title flex items-center gap-3">
                        <TrendingUp className="text-blue-500" size={32} />
                        Net Worth Dashboard
                    </h1>

                    <div className="flex gap-2 ml-auto">
                        <button
                            onClick={exportToPDF}
                            className="btn bg-slate-700 hover:bg-slate-600 text-white flex items-center gap-2 px-3 py-1.5 text-sm"
                        >
                            <FileText size={16} /> Export PDF
                        </button>
                        <button
                            onClick={exportToCSV}
                            className="btn bg-slate-700 hover:bg-slate-600 text-white flex items-center gap-2 px-3 py-1.5 text-sm"
                        >
                            <Download size={16} /> Export CSV
                        </button>
                    </div>
                </div>

                <div className="networth-tabs shadow-lg">
                    <button
                        className={`networth-tab ${selectedMember === 'total' ? 'active' : ''}`}
                        onClick={() => setSelectedMember('total')}
                    >
                        Total Household
                    </button>
                    {members.map(member => (
                        <button
                            key={member.id}
                            className={`networth-tab ${selectedMember === member.id ? 'active' : ''}`}
                            onClick={() => setSelectedMember(member.id)}
                        >
                            {member.name}
                        </button>
                    ))}
                </div>
            </div>

            <div ref={contentRef} className="p-1">
                <div className="networth-summary-grid">
                    <div className="summary-card bg-gradient-to-br from-blue-900/50 to-blue-800/20 border-blue-500/30">
                        <Activity className="summary-card-icon text-blue-400" size={48} />
                        <span className="summary-card-label text-blue-200">Total Net Worth</span>
                        <span className="summary-card-value text-blue-100">{formatter.format(netWorth)}</span>
                    </div>
                    <div className="summary-card bg-gradient-to-br from-emerald-900/50 to-emerald-800/20 border-emerald-500/30">
                        <Wallet className="summary-card-icon text-emerald-400" size={48} />
                        <span className="summary-card-label text-emerald-200">Gross Assets</span>
                        <span className="summary-card-value text-emerald-100">{formatter.format(grossAssets)}</span>
                    </div>
                    <div className="summary-card bg-gradient-to-br from-teal-900/50 to-teal-800/20 border-teal-500/30">
                        <Coins className="summary-card-icon text-teal-400" size={48} />
                        <span className="summary-card-label text-teal-200">Cash in Hand</span>
                        <span className="summary-card-value text-teal-100">{formatter.format(totalCashInHand)}</span>
                        <div className="text-xs text-teal-300/70 mt-1 flex justify-between border-t border-teal-700/50 pt-1">
                            <span>Investments: {formatter.format(investmentCash)}</span>
                            <span>Bank: {formatter.format(bankCash)}</span>
                        </div>
                    </div>
                    <div className="summary-card bg-gradient-to-br from-red-900/50 to-red-800/20 border-red-500/30">
                        <Landmark className="summary-card-icon text-red-400" size={48} />
                        <span className="summary-card-label text-red-200">Total Liabilities</span>
                        <span className="summary-card-value text-red-100">{formatter.format(totalLiabilities)}</span>
                    </div>
                    <div className="summary-card bg-gradient-to-br from-purple-900/50 to-purple-800/20 border-purple-500/30">
                        <Receipt className="summary-card-icon text-purple-400" size={48} />
                        <span className="summary-card-label text-purple-200">Mo. Expenses</span>
                        <span className="summary-card-value text-purple-100">{formatter.format(totalExpenses)}</span>
                    </div>
                </div>

                {/* Context/Insight Row */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 my-2">
                    {/* Visual Breakdown Bar */}
                    <div className="card p-6 bg-slate-800/80 backdrop-blur-sm border border-slate-700/50 shadow-xl rounded-2xl flex flex-col justify-center">
                        <div className="flex justify-between items-center mb-2">
                            <h3 className="font-semibold text-gray-300">Portfolio Breakdown</h3>
                            <div className="visual-legend mt-0">
                                <span className="legend-item"><span className="legend-dot segment-assets"></span> Investments ({wAssets.toFixed(1)}%)</span>
                                <span className="legend-item"><span className="legend-dot segment-cash"></span> Cash ({wCash.toFixed(1)}%)</span>
                                <span className="legend-item"><span className="legend-dot segment-liab"></span> Debt ({wLiab.toFixed(1)}%)</span>
                            </div>
                        </div>
                        <div className="visual-bar-container shadow-inner">
                            <div className="visual-bar-segment segment-assets" style={{ width: `${wAssets}%` }}>
                                {wAssets > 5 && 'Investments'}
                            </div>
                            <div className="visual-bar-segment segment-cash" style={{ width: `${wCash}%` }}>
                                {wCash > 5 && 'Cash'}
                            </div>
                            <div className="visual-bar-segment segment-liab bg-red-500" style={{ width: `${wLiab}%` }}>
                                {wLiab > 5 && 'Debt'}
                            </div>
                        </div>
                    </div>

                    {/* Cashflow Widget Insight */}
                    <div className="card p-6 bg-slate-800/80 backdrop-blur-sm border border-slate-700/50 shadow-xl rounded-2xl flex flex-col justify-center relative overflow-hidden">
                        <h3 className="font-semibold text-gray-300 mb-4">Cashflow Projections</h3>
                        <div className="flex justify-between items-center z-10 relative">
                            <div>
                                <h4 className="text-sm text-slate-400 font-medium">Est. 4% Safe Withdrawal /mo</h4>
                                <p className="text-xl font-semibold text-blue-300">{formatter.format(estimatedMonthlyIncome)}</p>
                            </div>
                            <div className="text-right">
                                <h4 className="text-sm text-slate-400 font-medium">Passive Net Cashflow</h4>
                                <p className={`text-2xl font-bold ${netCashFlow >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                    {netCashFlow >= 0 ? '+' : ''}{formatter.format(netCashFlow)}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="networth-content-grid">
                    {/* Left Column - Assets & Banks */}
                    <div className="nw-section">

                        {/* Bank Accounts */}
                        <div className="card shadow-lg border-emerald-900/40">
                            <div className="nw-card-header text-emerald-400">
                                <h2 className="nw-card-title"><PiggyBank size={24} /> Bank Accounts</h2>
                                <span className="font-bold text-xl">{formatter.format(totalCash)}</span>
                            </div>

                            <form className="inline-form bg-slate-900/50 border border-slate-700/50" onSubmit={handleAddBank}>
                                <input
                                    type="text"
                                    className="input bg-slate-800 text-white border-slate-600 focus:border-emerald-500"
                                    placeholder="Bank Name (e.g. Scotiabank Checking)"
                                    value={newBankName}
                                    onChange={e => setNewBankName(e.target.value)}
                                    required
                                />
                                <input
                                    type="number"
                                    step="0.01"
                                    className="input input-no-spinner bg-slate-800 text-white border-slate-600 focus:border-emerald-500"
                                    placeholder="Balance"
                                    value={newBankBalance}
                                    onChange={e => setNewBankBalance(e.target.value)}
                                    required
                                />
                                <button type="submit" className="btn bg-emerald-600 hover:bg-emerald-500 text-white"><Plus size={16} /> Add</button>
                            </form>

                            <div className="table-container pt-2">
                                <table className="data-table">
                                    <thead>
                                        <tr className="bg-slate-800/50">
                                            <th className="text-slate-300 border-b border-slate-700">Account Name</th>
                                            <th className="text-slate-300 border-b border-slate-700">Owner</th>
                                            <th className="text-right text-slate-300 border-b border-slate-700">Balance</th>
                                            <th className="w-12 border-b border-slate-700"></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredBanks.length === 0 && (
                                            <tr><td colSpan={4} className="text-center text-gray-500 py-6">No bank accounts added for this view.</td></tr>
                                        )}
                                        {filteredBanks.map(bank => (
                                            <tr key={bank.id} className="hover:bg-slate-800/30 transition-colors">
                                                {editingBankId === bank.id ? (
                                                    <>
                                                        <td colSpan={2}>
                                                            <input
                                                                type="text"
                                                                className="input bg-slate-800 text-white border-slate-600 w-full py-1 px-2"
                                                                value={editBankName}
                                                                onChange={e => setEditBankName(e.target.value)}
                                                                autoFocus
                                                            />
                                                        </td>
                                                        <td className="text-right">
                                                            <input
                                                                type="number"
                                                                step="0.01"
                                                                className="input input-no-spinner bg-slate-800 text-white border-slate-600 w-24 py-1 px-2 shrink-0 text-right inline-block"
                                                                value={editBankBalance}
                                                                onChange={e => setEditBankBalance(e.target.value)}
                                                            />
                                                        </td>
                                                        <td className="text-center whitespace-nowrap">
                                                            <button onClick={() => saveBankEdit(bank.id)} className="action-btn p-1 text-emerald-400 hover:text-emerald-300 mx-1" title="Save"><Check size={16} /></button>
                                                            <button onClick={() => setEditingBankId(null)} className="action-btn p-1 text-slate-400 hover:text-slate-300 mx-1" title="Cancel"><X size={16} /></button>
                                                        </td>
                                                    </>
                                                ) : (
                                                    <>
                                                        <td className="font-medium text-slate-200">{bank.name}</td>
                                                        <td className="text-slate-400 text-xs">
                                                            {bank.memberId === 'joint' ? <span className="px-2 py-1 bg-blue-900/50 rounded-full text-blue-300">Joint</span> : members.find(m => m.id === bank.memberId)?.name || 'Unknown'}
                                                        </td>
                                                        <td className="text-right font-medium text-emerald-400">{formatter.format(bank.balance)}</td>
                                                        <td className="text-center whitespace-nowrap">
                                                            <button onClick={() => { setEditingBankId(bank.id); setEditBankName(bank.name); setEditBankBalance(bank.balance.toString()); }} className="action-btn p-1.5 hover:bg-slate-700/50 rounded-md transition-colors mx-0.5" title="Edit">
                                                                <Edit2 size={16} className="text-slate-500 hover:text-blue-400" />
                                                            </button>
                                                            <button onClick={() => deleteBankAccount(bank.id)} className="action-btn delete p-1.5 hover:bg-red-900/30 rounded-md transition-colors mx-0.5" title="Delete">
                                                                <Trash2 size={16} className="text-slate-500 hover:text-red-400" />
                                                            </button>
                                                        </td>
                                                    </>
                                                )}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Investments Summary */}
                        <div className="card shadow-lg border-blue-900/40 mt-4">
                            <div className="nw-card-header text-blue-400">
                                <h2 className="nw-card-title"><Activity size={24} /> Investment Assets</h2>
                                <span className="font-bold text-xl">{formatter.format(totalInvestments)}</span>
                            </div>
                            <p className="text-xs text-gray-400 mb-4 px-1">Read-only view derived from your configured accounts and assets.</p>

                            <div className="table-container">
                                <table className="data-table">
                                    <thead>
                                        <tr className="bg-slate-800/50">
                                            <th className="text-slate-300 border-b border-slate-700">Account</th>
                                            <th className="text-slate-300 border-b border-slate-700">Type</th>
                                            <th className="text-right text-slate-300 border-b border-slate-700">Assets Val.</th>
                                            <th className="text-right text-slate-300 border-b border-slate-700">Cash Bal.</th>
                                            <th className="text-right text-slate-300 border-b border-slate-700">Total</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredAccounts.length === 0 && (
                                            <tr><td colSpan={5} className="text-center text-gray-500 py-6">No investment accounts found.</td></tr>
                                        )}
                                        {filteredAccounts.map(acc => {
                                            const accAssets = filteredAssets.filter(a => a.accountId === acc.id);
                                            const accAssetsTotal = accAssets.reduce((sum, a) => sum + (a.marketValue || 0), 0);
                                            const total = accAssetsTotal + acc.cashBalance;
                                            return (
                                                <tr key={acc.id} className="hover:bg-slate-800/30 transition-colors">
                                                    <td className="font-medium text-slate-200">{acc.name}</td>
                                                    <td className="text-slate-400 text-xs">{acc.type}</td>
                                                    <td className="text-right text-slate-300">{formatter.format(accAssetsTotal)}</td>
                                                    <td className="text-right text-slate-300">{formatter.format(acc.cashBalance)}</td>
                                                    <td className="text-right font-medium text-blue-400">{formatter.format(total)}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                    <tfoot className="border-t-2 border-slate-700 font-bold bg-slate-900/50">
                                        <tr>
                                            <td colSpan={2} className="text-right text-slate-300 py-3">Total:</td>
                                            <td className="text-right text-blue-400 py-3">{formatter.format(investmentMarketValue)}</td>
                                            <td className="text-right text-teal-400 py-3">{formatter.format(investmentCash)}</td>
                                            <td className="text-right text-blue-400 py-3">{formatter.format(totalInvestments)}</td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </div>

                    </div>

                    {/* Right Column - Liabilities & Expenses */}
                    <div className="nw-section">

                        {/* Liabilities */}
                        <div className="card shadow-lg border-red-900/40">
                            <div className="nw-card-header text-red-500">
                                <h2 className="nw-card-title"><CreditCard size={24} /> Liabilities</h2>
                                <span className="font-bold text-xl">{formatter.format(totalLiabilities)}</span>
                            </div>

                            <form className="inline-form bg-slate-900/50 border border-slate-700/50" onSubmit={handleAddLiability}>
                                <input
                                    type="text"
                                    className="input bg-slate-800 text-white border-slate-600 focus:border-red-500"
                                    placeholder="Debt Name (e.g. Mortgage)"
                                    value={newLibName}
                                    onChange={e => setNewLibName(e.target.value)}
                                    required
                                />
                                <input
                                    type="number"
                                    step="0.01"
                                    className="input input-no-spinner bg-slate-800 text-white border-slate-600 focus:border-red-500 w-24"
                                    placeholder="Balance"
                                    value={newLibBalance}
                                    onChange={e => setNewLibBalance(e.target.value)}
                                    required
                                />
                                <button type="submit" className="btn bg-red-600 hover:bg-red-500 text-white p-2" aria-label="Add Liability"><Plus size={20} /></button>
                            </form>

                            <div className="table-container pt-2">
                                <table className="data-table">
                                    <thead>
                                        <tr className="bg-slate-800/50">
                                            <th className="text-slate-300 border-b border-slate-700">Debt Name</th>
                                            <th className="text-right text-slate-300 border-b border-slate-700">Balance</th>
                                            <th className="w-12 border-b border-slate-700"></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredLiabilities.map(liab => (
                                            <tr key={liab.id} className="hover:bg-slate-800/30">
                                                {editingLibId === liab.id ? (
                                                    <>
                                                        <td>
                                                            <input
                                                                type="text"
                                                                className="input bg-slate-800 text-white border-slate-600 w-full py-1 px-2"
                                                                value={editLibName}
                                                                onChange={e => setEditLibName(e.target.value)}
                                                                autoFocus
                                                            />
                                                        </td>
                                                        <td className="text-right">
                                                            <input
                                                                type="number"
                                                                step="0.01"
                                                                className="input input-no-spinner bg-slate-800 text-white border-slate-600 w-24 py-1 px-2 shrink-0 text-right inline-block"
                                                                value={editLibBalance}
                                                                onChange={e => setEditLibBalance(e.target.value)}
                                                            />
                                                        </td>
                                                        <td className="text-center whitespace-nowrap">
                                                            <button onClick={() => saveLibEdit(liab.id)} className="action-btn p-1 text-emerald-400 hover:text-emerald-300 mx-1" title="Save"><Check size={16} /></button>
                                                            <button onClick={() => setEditingLibId(null)} className="action-btn p-1 text-slate-400 hover:text-slate-300 mx-1" title="Cancel"><X size={16} /></button>
                                                        </td>
                                                    </>
                                                ) : (
                                                    <>
                                                        <td className="font-medium text-slate-200">{liab.name}</td>
                                                        <td className="text-right font-medium text-red-400">{formatter.format(liab.balance)}</td>
                                                        <td className="text-center whitespace-nowrap">
                                                            <button onClick={() => { setEditingLibId(liab.id); setEditLibName(liab.name); setEditLibBalance(liab.balance.toString()); }} className="action-btn p-1.5 hover:bg-slate-700/50 rounded-md transition-colors mx-0.5" title="Edit">
                                                                <Edit2 size={16} className="text-slate-500 hover:text-blue-400" />
                                                            </button>
                                                            <button onClick={() => deleteLiability(liab.id)} className="action-btn delete p-1.5 hover:bg-red-900/30 rounded-md transition-colors mx-0.5" title="Delete">
                                                                <Trash2 size={16} className="text-slate-500 hover:text-red-400" />
                                                            </button>
                                                        </td>
                                                    </>
                                                )}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Monthly Living Expenses */}
                        <div className="card shadow-lg border-purple-900/40 mt-4">
                            <div className="nw-card-header text-purple-400">
                                <h2 className="nw-card-title"><Home size={24} /> Mo. Expenses</h2>
                                <span className="font-bold text-xl">{formatter.format(totalExpenses)}</span>
                            </div>

                            <form className="inline-form bg-slate-900/50 border border-slate-700/50 flex-wrap" onSubmit={handleAddExpense}>
                                <input
                                    type="text"
                                    className="input bg-slate-800 text-white border-slate-600 focus:border-purple-500 flex-grow"
                                    placeholder="Expense (e.g. Groceries)"
                                    value={newExpName}
                                    onChange={e => setNewExpName(e.target.value)}
                                    required
                                />
                                <select
                                    className="input bg-slate-800 text-white border-slate-600 focus:border-purple-500 w-28"
                                    value={newExpCategory}
                                    onChange={e => setNewExpCategory(e.target.value)}
                                >
                                    <option>Housing</option>
                                    <option>Food</option>
                                    <option>Transp.</option>
                                    <option>Utilities</option>
                                    <option>Personal</option>
                                    <option>Other</option>
                                </select>
                                <input
                                    type="number"
                                    step="0.01"
                                    className="input input-no-spinner bg-slate-800 text-white border-slate-600 focus:border-purple-500 w-24"
                                    placeholder="Amount"
                                    value={newExpAmount}
                                    onChange={e => setNewExpAmount(e.target.value)}
                                    required
                                />
                                <button type="submit" className="btn bg-purple-600 hover:bg-purple-500 text-white p-2"><Plus size={20} /></button>
                            </form>

                            <div className="table-container pt-2">
                                <table className="data-table">
                                    <thead>
                                        <tr className="bg-slate-800/50">
                                            <th className="text-slate-300 border-b border-slate-700">Expense</th>
                                            <th className="text-slate-300 border-b border-slate-700">Cat.</th>
                                            <th className="text-right text-slate-300 border-b border-slate-700">Amount</th>
                                            <th className="w-12 border-b border-slate-700"></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredExpenses.map(exp => (
                                            <tr key={exp.id} className="hover:bg-slate-800/30">
                                                {editingExpId === exp.id ? (
                                                    <>
                                                        <td>
                                                            <input
                                                                type="text"
                                                                className="input bg-slate-800 text-white border-slate-600 w-full py-1 px-2"
                                                                value={editExpName}
                                                                onChange={e => setEditExpName(e.target.value)}
                                                                autoFocus
                                                            />
                                                        </td>
                                                        <td>
                                                            <select
                                                                className="input bg-slate-800 text-white border-slate-600 py-1 px-2 w-full text-xs"
                                                                value={editExpCategory}
                                                                onChange={e => setEditExpCategory(e.target.value)}
                                                            >
                                                                <option>Housing</option>
                                                                <option>Food</option>
                                                                <option>Transp.</option>
                                                                <option>Utilities</option>
                                                                <option>Personal</option>
                                                                <option>Other</option>
                                                            </select>
                                                        </td>
                                                        <td className="text-right">
                                                            <input
                                                                type="number"
                                                                step="0.01"
                                                                className="input input-no-spinner bg-slate-800 text-white border-slate-600 w-24 py-1 px-2 shrink-0 text-right inline-block"
                                                                value={editExpAmount}
                                                                onChange={e => setEditExpAmount(e.target.value)}
                                                            />
                                                        </td>
                                                        <td className="text-center whitespace-nowrap">
                                                            <button onClick={() => saveExpEdit(exp.id)} className="action-btn p-1 text-emerald-400 hover:text-emerald-300 mx-1" title="Save"><Check size={16} /></button>
                                                            <button onClick={() => setEditingExpId(null)} className="action-btn p-1 text-slate-400 hover:text-slate-300 mx-1" title="Cancel"><X size={16} /></button>
                                                        </td>
                                                    </>
                                                ) : (
                                                    <>
                                                        <td className="font-medium text-slate-200">{exp.name}</td>
                                                        <td className="text-slate-400 text-xs">{exp.category}</td>
                                                        <td className="text-right font-medium text-purple-400">{formatter.format(exp.amount)}</td>
                                                        <td className="text-center whitespace-nowrap">
                                                            <button onClick={() => { setEditingExpId(exp.id); setEditExpName(exp.name); setEditExpAmount(exp.amount.toString()); setEditExpCategory(exp.category); }} className="action-btn p-1.5 hover:bg-slate-700/50 rounded-md transition-colors mx-0.5" title="Edit">
                                                                <Edit2 size={16} className="text-slate-500 hover:text-blue-400" />
                                                            </button>
                                                            <button onClick={() => deleteMonthlyExpense(exp.id)} className="action-btn delete p-1.5 hover:bg-red-900/30 rounded-md transition-colors mx-0.5" title="Delete">
                                                                <Trash2 size={16} className="text-slate-500 hover:text-red-400" />
                                                            </button>
                                                        </td>
                                                    </>
                                                )}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 mb-10">
                    {/* Debt to asset ratio for context */}
                    <div className="text-center text-sm text-slate-500 py-4">
                        Debt-to-Asset Ratio: <strong className="text-slate-400">{debtToAssetRatio.toFixed(1)}%</strong>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default NetWorth;
