import React, { useState, useRef } from 'react';
import { useData } from '../context/DataContext';
import { useTheme } from '../context/ThemeContext';
import {
    TrendingUp,
    Wallet,
    Landmark,
    Activity,
    PiggyBank,
    CreditCard,
    Plus,
    Trash2,
    Home,
    Receipt,
    Pencil,
    Check,
    X,
    Coins,
    FileText,
    Download,
} from 'lucide-react';
import Papa from 'papaparse';
import '../styles/networth.css';

const NetWorth = () => {
    const {
        members,
        accounts,
        assets,
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
    } = useData();
    const { theme } = useTheme();

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
            memberId: selectedMember === 'total' ? 'joint' : selectedMember,
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
            memberId: selectedMember === 'total' ? 'joint' : selectedMember,
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
            memberId: 'joint',
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
                balance: parseFloat(editBankBalance) || 0,
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
                balance: parseFloat(editLibBalance) || 0,
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
                category: editExpCategory || 'Other',
            });
        }
        setEditingExpId(null);
    };

    // Derived Data Computing
    const isOwner = (itemMemberId: string) => {
        if (selectedMember === 'total') return true;
        return itemMemberId === selectedMember || itemMemberId === 'joint';
    };

    const filteredAccounts =
        selectedMember === 'total' ? accounts : accounts.filter(a => a.memberId === selectedMember);
    const filteredAssets =
        selectedMember === 'total'
            ? assets
            : assets.filter(asset => {
                  const acc = accounts.find(a => a.id === asset.accountId);
                  return acc && acc.memberId === selectedMember;
              });

    const filteredBanks = bankAccounts.filter(b => isOwner(b.memberId));
    const filteredLiabilities = liabilities.filter(l => isOwner(l.memberId));
    const filteredExpenses = monthlyExpenses;

    // Computations
    const investmentMarketValue = filteredAssets.reduce((sum, a) => sum + (a.cadMarketValue || a.marketValue || 0), 0);
    const investmentCash = filteredAccounts.reduce((sum, a) => sum + (a.cashBalance || 0), 0);
    const bankCash = filteredBanks.reduce((sum, b) => sum + (b.balance || 0), 0);

    const totalInvestments = investmentMarketValue + investmentCash;
    const totalCashInHand = investmentCash + bankCash;
    const totalCash = bankCash;

    const totalLiabilities = filteredLiabilities.reduce((sum, l) => sum + (l.balance || 0), 0);
    const totalExpenses = filteredExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);

    const grossAssets = totalInvestments + totalCash;
    const netWorth = grossAssets - totalLiabilities;
    const debtToAssetRatio = grossAssets > 0 ? (totalLiabilities / grossAssets) * 100 : 0;

    // 4% safe withdrawal rate / 12 for monthly estimate
    const estimatedMonthlyIncome = (totalInvestments * 0.04) / 12;
    const netCashFlow = estimatedMonthlyIncome - totalExpenses;

    const formatter = new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' });

    // Visualization Widths
    const totalVisual = grossAssets + totalLiabilities;
    const wAssets = totalVisual > 0 ? (totalInvestments / totalVisual) * 100 : 0;
    const wCash = totalVisual > 0 ? (totalCash / totalVisual) * 100 : 0;
    const wLiab = totalVisual > 0 ? (totalLiabilities / totalVisual) * 100 : 0;

    // Export Handlers
    const exportToPDF = async () => {
        if (!contentRef.current) return;

        const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
            import('jspdf'),
            import('html2canvas'),
        ]);

        const canvas = await html2canvas(contentRef.current, {
            scale: 2,
            useCORS: true,
            backgroundColor: theme === 'dark' ? '#090e1a' : '#FAF7F0',
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
        const memberName =
            selectedMember === 'total'
                ? 'Total Household'
                : members.find(m => m.id === selectedMember)?.name || 'Member';

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
            ...filteredBanks.map(b => [
                b.name,
                b.memberId === 'joint' ? 'Joint' : members.find(m => m.id === b.memberId)?.name || 'Unknown',
                b.balance,
            ]),
            [],
            ['Investment Accounts'],
            ['Name', 'Type', 'Assets Market Value', 'Cash Balance', 'Total'],
            ...filteredAccounts.map(acc => {
                const accAssets = filteredAssets.filter(a => a.accountId === acc.id);
                const accAssetsTotal = accAssets.reduce(
                    (sum, a) => sum + (a.cadMarketValue || a.marketValue || 0),
                    0
                );
                return [acc.name, acc.type, accAssetsTotal, acc.cashBalance, accAssetsTotal + acc.cashBalance];
            }),
            [],
            ['Liabilities'],
            ['Name', 'Balance'],
            ...filteredLiabilities.map(l => [l.name, l.balance]),
            [],
            ['Monthly Expenses'],
            ['Expense', 'Category', 'Amount'],
            ...monthlyExpenses.map(e => [e.name, e.category, e.amount]),
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

    const inputClass =
        'bg-slate-900 border border-slate-700 text-white placeholder-slate-400 rounded-xl px-3 py-2 text-sm font-medium focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20';

    return (
        <div className="networth-page">
            {/* Page Header */}
            <div className="flex flex-col gap-5 pb-5 border-b border-slate-700/80">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3.5">
                        <div className="p-3 bg-blue-500/15 rounded-2xl border border-blue-500/35 text-blue-400 shadow-sm">
                            <TrendingUp size={24} />
                        </div>
                        <div>
                            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                                Net Worth Dashboard
                            </h1>
                            <p className="text-sm text-slate-300 mt-0.5">
                                Track household assets, bank cash, liabilities &amp; monthly living expenses
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-2.5">
                        <button
                            onClick={exportToPDF}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-750 border border-slate-700 hover:border-slate-500 text-slate-200 hover:text-white rounded-xl text-sm font-semibold transition-colors"
                        >
                            <FileText size={16} /> Export PDF
                        </button>
                        <button
                            onClick={exportToCSV}
                            style={{ color: '#ffffff' }}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-xl text-sm font-semibold shadow-sm transition-colors"
                        >
                            <Download size={16} /> Export CSV
                        </button>
                    </div>
                </div>

                {/* Member Scope Tabs */}
                <div className="inline-flex flex-wrap gap-1 bg-slate-900 border border-slate-700/90 p-1 rounded-xl self-start">
                    <button
                        style={selectedMember === 'total' ? { color: '#ffffff' } : undefined}
                        className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${
                            selectedMember === 'total'
                                ? 'bg-blue-600 shadow-sm'
                                : 'text-slate-300 hover:text-white hover:bg-slate-800'
                        }`}
                        onClick={() => setSelectedMember('total')}
                    >
                        Total Household
                    </button>
                    {members.map(member => (
                        <button
                            key={member.id}
                            style={selectedMember === member.id ? { color: '#ffffff' } : undefined}
                            className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${
                                selectedMember === member.id
                                    ? 'bg-blue-600 shadow-sm'
                                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                            }`}
                            onClick={() => setSelectedMember(member.id)}
                        >
                            {member.name}
                        </button>
                    ))}
                </div>
            </div>

            <div ref={contentRef} className="space-y-6">
                {/* Summary KPI Grid */}
                <div className="networth-summary-grid">
                    <div className="bg-slate-800/95 border border-slate-700/90 rounded-2xl p-5 shadow-xl flex flex-col justify-between gap-2">
                        <div className="flex items-start justify-between gap-2">
                            <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                                Total Net Worth
                            </span>
                            <div className="p-2 bg-blue-500/15 border border-blue-500/30 rounded-xl text-blue-400">
                                <Activity size={18} />
                            </div>
                        </div>
                        <span className="text-2xl sm:text-3xl font-bold font-mono tabular-nums text-white">
                            {formatter.format(netWorth)}
                        </span>
                    </div>

                    <div className="bg-slate-800/95 border border-slate-700/90 rounded-2xl p-5 shadow-xl flex flex-col justify-between gap-2">
                        <div className="flex items-start justify-between gap-2">
                            <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                                Gross Assets
                            </span>
                            <div className="p-2 bg-green-500/15 border border-green-500/30 rounded-xl text-green-400">
                                <Wallet size={18} />
                            </div>
                        </div>
                        <span className="text-2xl sm:text-3xl font-bold font-mono tabular-nums text-green-400">
                            {formatter.format(grossAssets)}
                        </span>
                    </div>

                    <div className="bg-slate-800/95 border border-slate-700/90 rounded-2xl p-5 shadow-xl flex flex-col justify-between gap-2">
                        <div className="flex items-start justify-between gap-2">
                            <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                                Cash in Hand
                            </span>
                            <div className="p-2 bg-blue-500/15 border border-blue-500/30 rounded-xl text-blue-400">
                                <Coins size={18} />
                            </div>
                        </div>
                        <span className="text-2xl sm:text-3xl font-bold font-mono tabular-nums text-white">
                            {formatter.format(totalCashInHand)}
                        </span>
                        <div className="text-xs text-slate-300 font-mono flex flex-wrap justify-between gap-2 border-t border-slate-700/70 pt-2">
                            <span>Inv: {formatter.format(investmentCash)}</span>
                            <span>Bank: {formatter.format(bankCash)}</span>
                        </div>
                    </div>

                    <div className="bg-slate-800/95 border border-slate-700/90 rounded-2xl p-5 shadow-xl flex flex-col justify-between gap-2">
                        <div className="flex items-start justify-between gap-2">
                            <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                                Total Liabilities
                            </span>
                            <div className="p-2 bg-red-500/15 border border-red-500/30 rounded-xl text-red-400">
                                <Landmark size={18} />
                            </div>
                        </div>
                        <span className="text-2xl sm:text-3xl font-bold font-mono tabular-nums text-red-400">
                            {formatter.format(totalLiabilities)}
                        </span>
                    </div>

                    <div className="bg-slate-800/95 border border-slate-700/90 rounded-2xl p-5 shadow-xl flex flex-col justify-between gap-2">
                        <div className="flex items-start justify-between gap-2">
                            <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                                Mo. Expenses
                            </span>
                            <div className="p-2 bg-blue-500/15 border border-blue-500/30 rounded-xl text-blue-400">
                                <Receipt size={18} />
                            </div>
                        </div>
                        <span className="text-2xl sm:text-3xl font-bold font-mono tabular-nums text-blue-400">
                            {formatter.format(totalExpenses)}
                        </span>
                    </div>
                </div>

                {/* Context / Insight Row */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Visual Breakdown Bar */}
                    <div className="bg-slate-800/95 border border-slate-700/90 shadow-xl rounded-2xl p-6 flex flex-col justify-center gap-4">
                        <div className="flex flex-wrap justify-between items-center gap-3">
                            <h3 className="text-base font-bold text-white tracking-tight">Portfolio Breakdown</h3>
                            <div className="visual-legend text-slate-300">
                                <span className="legend-item">
                                    <span className="legend-dot segment-assets" /> Investments ({wAssets.toFixed(1)}%)
                                </span>
                                <span className="legend-item">
                                    <span className="legend-dot segment-cash" /> Cash ({wCash.toFixed(1)}%)
                                </span>
                                <span className="legend-item">
                                    <span className="legend-dot segment-liab" /> Debt ({wLiab.toFixed(1)}%)
                                </span>
                            </div>
                        </div>
                        <div className="visual-bar-container">
                            <div className="visual-bar-segment segment-assets" style={{ width: `${wAssets}%` }}>
                                {wAssets > 8 && 'Investments'}
                            </div>
                            <div className="visual-bar-segment segment-cash" style={{ width: `${wCash}%` }}>
                                {wCash > 8 && 'Cash'}
                            </div>
                            <div className="visual-bar-segment segment-liab" style={{ width: `${wLiab}%` }}>
                                {wLiab > 8 && 'Debt'}
                            </div>
                        </div>
                    </div>

                    {/* Cashflow Projections */}
                    <div className="bg-slate-800/95 border border-slate-700/90 shadow-xl rounded-2xl p-6 flex flex-col justify-center gap-4">
                        <h3 className="text-base font-bold text-white tracking-tight">Cashflow Projections</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-900/65 border border-slate-700/70 rounded-xl p-4">
                            <div>
                                <p className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-1">
                                    Est. 4% Safe Withdrawal / mo
                                </p>
                                <p className="text-xl font-bold font-mono tabular-nums text-blue-400">
                                    {formatter.format(estimatedMonthlyIncome)}
                                </p>
                            </div>
                            <div className="sm:text-right">
                                <p className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-1">
                                    Passive Net Cashflow
                                </p>
                                <p
                                    className={`text-2xl font-bold font-mono tabular-nums ${
                                        netCashFlow >= 0 ? 'text-green-400' : 'text-red-400'
                                    }`}
                                >
                                    {netCashFlow >= 0 ? '+' : ''}
                                    {formatter.format(netCashFlow)}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="networth-content-grid">
                    {/* Left Column - Banks & Investments */}
                    <div className="nw-section">
                        {/* Bank Accounts */}
                        <section className="bg-slate-800/95 border border-slate-700/90 rounded-2xl shadow-xl overflow-hidden">
                            <div className="px-5 py-4 bg-slate-900/80 border-b border-slate-700/80 flex justify-between items-center gap-4">
                                <h2 className="text-lg font-bold text-white flex items-center gap-2.5">
                                    <span className="p-2 rounded-xl bg-green-500/15 border border-green-500/35 text-green-400">
                                        <PiggyBank size={18} />
                                    </span>
                                    <span>Bank Accounts</span>
                                </h2>
                                <span className="font-mono tabular-nums font-bold text-lg text-green-400">
                                    {formatter.format(totalCash)}
                                </span>
                            </div>

                            <div className="p-5 space-y-4">
                                <form
                                    className="flex flex-wrap sm:flex-nowrap gap-2.5 bg-slate-900/70 p-3 rounded-xl border border-slate-700/80"
                                    onSubmit={handleAddBank}
                                >
                                    <input
                                        type="text"
                                        className={`${inputClass} flex-1 min-w-[160px]`}
                                        placeholder="Bank Name (e.g. Scotiabank Checking)"
                                        value={newBankName}
                                        onChange={e => setNewBankName(e.target.value)}
                                        required
                                    />
                                    <input
                                        type="number"
                                        step="0.01"
                                        className={`${inputClass} input-no-spinner w-full sm:w-32 font-mono`}
                                        placeholder="Balance"
                                        value={newBankBalance}
                                        onChange={e => setNewBankBalance(e.target.value)}
                                        required
                                    />
                                    <button
                                        type="submit"
                                        style={{ color: '#ffffff' }}
                                        className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-green-600 hover:bg-green-500 rounded-xl text-sm font-semibold transition-colors shrink-0"
                                    >
                                        <Plus size={16} /> Add
                                    </button>
                                </form>

                                <div className="overflow-x-auto bg-slate-900/50 border border-slate-700/80 rounded-xl">
                                    <table className="w-full text-left border-collapse">
                                        <thead className="bg-slate-900/90 border-b border-slate-700/80">
                                            <tr className="text-xs font-bold uppercase tracking-wider text-slate-300">
                                                <th className="px-4 py-3">Account Name</th>
                                                <th className="px-4 py-3">Owner</th>
                                                <th className="px-4 py-3 text-right">Balance</th>
                                                <th className="px-4 py-3 w-20 text-right">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-700/50 text-sm">
                                            {filteredBanks.length === 0 && (
                                                <tr>
                                                    <td colSpan={4} className="text-center text-slate-300 py-8">
                                                        No bank accounts added for this view.
                                                    </td>
                                                </tr>
                                            )}
                                            {filteredBanks.map(bank => (
                                                <tr key={bank.id} className="hover:bg-slate-800/60 transition-colors">
                                                    {editingBankId === bank.id ? (
                                                        <>
                                                            <td colSpan={2} className="px-4 py-2.5">
                                                                <input
                                                                    type="text"
                                                                    className={`${inputClass} w-full py-1.5 px-2.5`}
                                                                    value={editBankName}
                                                                    onChange={e => setEditBankName(e.target.value)}
                                                                    autoFocus
                                                                />
                                                            </td>
                                                            <td className="px-4 py-2.5 text-right">
                                                                <input
                                                                    type="number"
                                                                    step="0.01"
                                                                    className={`${inputClass} input-no-spinner w-28 py-1.5 px-2.5 text-right font-mono inline-block`}
                                                                    value={editBankBalance}
                                                                    onChange={e => setEditBankBalance(e.target.value)}
                                                                />
                                                            </td>
                                                            <td className="px-4 py-2.5 text-right whitespace-nowrap">
                                                                <div className="inline-flex gap-1.5">
                                                                    <button
                                                                        onClick={() => saveBankEdit(bank.id)}
                                                                        className="p-1.5 bg-green-500/15 text-green-400 hover:bg-green-500/25 rounded-lg transition-colors"
                                                                        title="Save"
                                                                    >
                                                                        <Check size={15} />
                                                                    </button>
                                                                    <button
                                                                        onClick={() => setEditingBankId(null)}
                                                                        className="p-1.5 bg-slate-800 text-slate-300 hover:text-white rounded-lg transition-colors"
                                                                        title="Cancel"
                                                                    >
                                                                        <X size={15} />
                                                                    </button>
                                                                </div>
                                                            </td>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <td className="px-4 py-3 font-semibold text-white">
                                                                {bank.name}
                                                            </td>
                                                            <td className="px-4 py-3 text-xs">
                                                                {bank.memberId === 'joint' ? (
                                                                    <span className="px-2.5 py-0.5 bg-blue-500/15 border border-blue-500/35 rounded-full text-blue-400 font-bold">
                                                                        Joint
                                                                    </span>
                                                                ) : (
                                                                    <span className="text-slate-300 font-medium">
                                                                        {members.find(m => m.id === bank.memberId)
                                                                            ?.name || 'Unknown'}
                                                                    </span>
                                                                )}
                                                            </td>
                                                            <td className="px-4 py-3 text-right font-mono tabular-nums font-bold text-green-400">
                                                                {formatter.format(bank.balance)}
                                                            </td>
                                                            <td className="px-4 py-3 text-right whitespace-nowrap">
                                                                <div className="inline-flex gap-1.5">
                                                                    <button
                                                                        onClick={() => {
                                                                            setEditingBankId(bank.id);
                                                                            setEditBankName(bank.name);
                                                                            setEditBankBalance(bank.balance.toString());
                                                                        }}
                                                                        className="p-1.5 bg-slate-800 border border-slate-700 hover:border-slate-500 text-slate-300 hover:text-white rounded-lg transition-colors"
                                                                        title="Edit"
                                                                    >
                                                                        <Pencil size={14} />
                                                                    </button>
                                                                    <button
                                                                        onClick={() => deleteBankAccount(bank.id)}
                                                                        className="p-1.5 bg-red-500/15 border border-red-500/30 hover:bg-red-500/25 text-red-400 rounded-lg transition-colors"
                                                                        title="Delete"
                                                                    >
                                                                        <Trash2 size={14} />
                                                                    </button>
                                                                </div>
                                                            </td>
                                                        </>
                                                    )}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </section>

                        {/* Investment Assets Summary */}
                        <section className="bg-slate-800/95 border border-slate-700/90 rounded-2xl shadow-xl overflow-hidden">
                            <div className="px-5 py-4 bg-slate-900/80 border-b border-slate-700/80 flex justify-between items-center gap-4">
                                <div>
                                    <h2 className="text-lg font-bold text-white flex items-center gap-2.5">
                                        <span className="p-2 rounded-xl bg-blue-500/15 border border-blue-500/35 text-blue-400">
                                            <Activity size={18} />
                                        </span>
                                        <span>Investment Assets</span>
                                    </h2>
                                    <p className="text-xs text-slate-300 mt-1">
                                        Read-only view derived from your configured accounts and assets
                                    </p>
                                </div>
                                <span className="font-mono tabular-nums font-bold text-lg text-blue-400">
                                    {formatter.format(totalInvestments)}
                                </span>
                            </div>

                            <div className="p-5">
                                <div className="overflow-x-auto bg-slate-900/50 border border-slate-700/80 rounded-xl">
                                    <table className="w-full text-left border-collapse">
                                        <thead className="bg-slate-900/90 border-b border-slate-700/80">
                                            <tr className="text-xs font-bold uppercase tracking-wider text-slate-300">
                                                <th className="px-4 py-3">Account</th>
                                                <th className="px-4 py-3">Type</th>
                                                <th className="px-4 py-3 text-right">Assets Val.</th>
                                                <th className="px-4 py-3 text-right">Cash Bal.</th>
                                                <th className="px-4 py-3 text-right">Total</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-700/50 text-sm">
                                            {filteredAccounts.length === 0 && (
                                                <tr>
                                                    <td colSpan={5} className="text-center text-slate-300 py-8">
                                                        No investment accounts found.
                                                    </td>
                                                </tr>
                                            )}
                                            {filteredAccounts.map(acc => {
                                                const accAssets = filteredAssets.filter(a => a.accountId === acc.id);
                                                const accAssetsTotal = accAssets.reduce(
                                                    (sum, a) => sum + (a.cadMarketValue || a.marketValue || 0),
                                                    0
                                                );
                                                const total = accAssetsTotal + acc.cashBalance;
                                                return (
                                                    <tr key={acc.id} className="hover:bg-slate-800/60 transition-colors">
                                                        <td className="px-4 py-3 font-semibold text-white">
                                                            {acc.name}
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-slate-800 border border-slate-700 text-slate-200">
                                                                {acc.type}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-200">
                                                            {formatter.format(accAssetsTotal)}
                                                        </td>
                                                        <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-300">
                                                            {formatter.format(acc.cashBalance)}
                                                        </td>
                                                        <td className="px-4 py-3 text-right font-mono tabular-nums font-bold text-blue-400">
                                                            {formatter.format(total)}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                        <tfoot className="border-t-2 border-slate-700 font-bold bg-slate-900/90 text-sm">
                                            <tr>
                                                <td
                                                    colSpan={2}
                                                    className="px-4 py-3 text-right text-xs uppercase tracking-wider text-slate-300"
                                                >
                                                    Total
                                                </td>
                                                <td className="px-4 py-3 text-right font-mono tabular-nums text-blue-400">
                                                    {formatter.format(investmentMarketValue)}
                                                </td>
                                                <td className="px-4 py-3 text-right font-mono tabular-nums text-green-400">
                                                    {formatter.format(investmentCash)}
                                                </td>
                                                <td className="px-4 py-3 text-right font-mono tabular-nums text-blue-400">
                                                    {formatter.format(totalInvestments)}
                                                </td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            </div>
                        </section>
                    </div>

                    {/* Right Column - Liabilities & Expenses */}
                    <div className="nw-section">
                        {/* Liabilities */}
                        <section className="bg-slate-800/95 border border-slate-700/90 rounded-2xl shadow-xl overflow-hidden">
                            <div className="px-5 py-4 bg-slate-900/80 border-b border-slate-700/80 flex justify-between items-center gap-4">
                                <h2 className="text-lg font-bold text-white flex items-center gap-2.5">
                                    <span className="p-2 rounded-xl bg-red-500/15 border border-red-500/35 text-red-400">
                                        <CreditCard size={18} />
                                    </span>
                                    <span>Liabilities</span>
                                </h2>
                                <span className="font-mono tabular-nums font-bold text-lg text-red-400">
                                    {formatter.format(totalLiabilities)}
                                </span>
                            </div>

                            <div className="p-5 space-y-4">
                                <form
                                    className="flex flex-wrap sm:flex-nowrap gap-2 bg-slate-900/70 p-3 rounded-xl border border-slate-700/80"
                                    onSubmit={handleAddLiability}
                                >
                                    <input
                                        type="text"
                                        className={`${inputClass} flex-1 min-w-[130px]`}
                                        placeholder="Debt Name (e.g. Mortgage)"
                                        value={newLibName}
                                        onChange={e => setNewLibName(e.target.value)}
                                        required
                                    />
                                    <input
                                        type="number"
                                        step="0.01"
                                        className={`${inputClass} input-no-spinner w-full sm:w-28 font-mono`}
                                        placeholder="Balance"
                                        value={newLibBalance}
                                        onChange={e => setNewLibBalance(e.target.value)}
                                        required
                                    />
                                    <button
                                        type="submit"
                                        style={{ color: '#ffffff' }}
                                        className="inline-flex items-center justify-center p-2.5 bg-red-600 hover:bg-red-500 rounded-xl transition-colors shrink-0"
                                        aria-label="Add Liability"
                                    >
                                        <Plus size={18} />
                                    </button>
                                </form>

                                <div className="overflow-x-auto bg-slate-900/50 border border-slate-700/80 rounded-xl">
                                    <table className="w-full text-left border-collapse">
                                        <thead className="bg-slate-900/90 border-b border-slate-700/80">
                                            <tr className="text-xs font-bold uppercase tracking-wider text-slate-300">
                                                <th className="px-4 py-3">Debt Name</th>
                                                <th className="px-4 py-3 text-right">Balance</th>
                                                <th className="px-4 py-3 w-20 text-right">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-700/50 text-sm">
                                            {filteredLiabilities.length === 0 && (
                                                <tr>
                                                    <td colSpan={3} className="text-center text-slate-300 py-6">
                                                        No liabilities recorded.
                                                    </td>
                                                </tr>
                                            )}
                                            {filteredLiabilities.map(liab => (
                                                <tr key={liab.id} className="hover:bg-slate-800/60 transition-colors">
                                                    {editingLibId === liab.id ? (
                                                        <>
                                                            <td className="px-4 py-2.5">
                                                                <input
                                                                    type="text"
                                                                    className={`${inputClass} w-full py-1.5 px-2.5`}
                                                                    value={editLibName}
                                                                    onChange={e => setEditLibName(e.target.value)}
                                                                    autoFocus
                                                                />
                                                            </td>
                                                            <td className="px-4 py-2.5 text-right">
                                                                <input
                                                                    type="number"
                                                                    step="0.01"
                                                                    className={`${inputClass} input-no-spinner w-24 py-1.5 px-2.5 text-right font-mono inline-block`}
                                                                    value={editLibBalance}
                                                                    onChange={e => setEditLibBalance(e.target.value)}
                                                                />
                                                            </td>
                                                            <td className="px-4 py-2.5 text-right whitespace-nowrap">
                                                                <div className="inline-flex gap-1.5">
                                                                    <button
                                                                        onClick={() => saveLibEdit(liab.id)}
                                                                        className="p-1.5 bg-green-500/15 text-green-400 hover:bg-green-500/25 rounded-lg transition-colors"
                                                                        title="Save"
                                                                    >
                                                                        <Check size={15} />
                                                                    </button>
                                                                    <button
                                                                        onClick={() => setEditingLibId(null)}
                                                                        className="p-1.5 bg-slate-800 text-slate-300 hover:text-white rounded-lg transition-colors"
                                                                        title="Cancel"
                                                                    >
                                                                        <X size={15} />
                                                                    </button>
                                                                </div>
                                                            </td>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <td className="px-4 py-3 font-semibold text-white">
                                                                {liab.name}
                                                            </td>
                                                            <td className="px-4 py-3 text-right font-mono tabular-nums font-bold text-red-400">
                                                                {formatter.format(liab.balance)}
                                                            </td>
                                                            <td className="px-4 py-3 text-right whitespace-nowrap">
                                                                <div className="inline-flex gap-1.5">
                                                                    <button
                                                                        onClick={() => {
                                                                            setEditingLibId(liab.id);
                                                                            setEditLibName(liab.name);
                                                                            setEditLibBalance(liab.balance.toString());
                                                                        }}
                                                                        className="p-1.5 bg-slate-800 border border-slate-700 hover:border-slate-500 text-slate-300 hover:text-white rounded-lg transition-colors"
                                                                        title="Edit"
                                                                    >
                                                                        <Pencil size={14} />
                                                                    </button>
                                                                    <button
                                                                        onClick={() => deleteLiability(liab.id)}
                                                                        className="p-1.5 bg-red-500/15 border border-red-500/30 hover:bg-red-500/25 text-red-400 rounded-lg transition-colors"
                                                                        title="Delete"
                                                                    >
                                                                        <Trash2 size={14} />
                                                                    </button>
                                                                </div>
                                                            </td>
                                                        </>
                                                    )}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </section>

                        {/* Monthly Living Expenses */}
                        <section className="bg-slate-800/95 border border-slate-700/90 rounded-2xl shadow-xl overflow-hidden">
                            <div className="px-5 py-4 bg-slate-900/80 border-b border-slate-700/80 flex justify-between items-center gap-4">
                                <h2 className="text-lg font-bold text-white flex items-center gap-2.5">
                                    <span className="p-2 rounded-xl bg-blue-500/15 border border-blue-500/35 text-blue-400">
                                        <Home size={18} />
                                    </span>
                                    <span>Mo. Expenses</span>
                                </h2>
                                <span className="font-mono tabular-nums font-bold text-lg text-blue-400">
                                    {formatter.format(totalExpenses)}
                                </span>
                            </div>

                            <div className="p-5 space-y-4">
                                <form
                                    className="flex flex-wrap gap-2 bg-slate-900/70 p-3 rounded-xl border border-slate-700/80"
                                    onSubmit={handleAddExpense}
                                >
                                    <input
                                        type="text"
                                        className={`${inputClass} flex-1 min-w-[130px]`}
                                        placeholder="Expense (e.g. Groceries)"
                                        value={newExpName}
                                        onChange={e => setNewExpName(e.target.value)}
                                        required
                                    />
                                    <select
                                        className={`${inputClass} w-28`}
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
                                        className={`${inputClass} input-no-spinner w-24 font-mono`}
                                        placeholder="Amount"
                                        value={newExpAmount}
                                        onChange={e => setNewExpAmount(e.target.value)}
                                        required
                                    />
                                    <button
                                        type="submit"
                                        style={{ color: '#ffffff' }}
                                        className="inline-flex items-center justify-center p-2.5 bg-blue-600 hover:bg-blue-500 rounded-xl transition-colors shrink-0"
                                        aria-label="Add Expense"
                                    >
                                        <Plus size={18} />
                                    </button>
                                </form>

                                <div className="overflow-x-auto bg-slate-900/50 border border-slate-700/80 rounded-xl">
                                    <table className="w-full text-left border-collapse">
                                        <thead className="bg-slate-900/90 border-b border-slate-700/80">
                                            <tr className="text-xs font-bold uppercase tracking-wider text-slate-300">
                                                <th className="px-4 py-3">Expense</th>
                                                <th className="px-4 py-3">Cat.</th>
                                                <th className="px-4 py-3 text-right">Amount</th>
                                                <th className="px-4 py-3 w-20 text-right">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-700/50 text-sm">
                                            {filteredExpenses.length === 0 && (
                                                <tr>
                                                    <td colSpan={4} className="text-center text-slate-300 py-6">
                                                        No monthly expenses recorded.
                                                    </td>
                                                </tr>
                                            )}
                                            {filteredExpenses.map(exp => (
                                                <tr key={exp.id} className="hover:bg-slate-800/60 transition-colors">
                                                    {editingExpId === exp.id ? (
                                                        <>
                                                            <td className="px-4 py-2.5">
                                                                <input
                                                                    type="text"
                                                                    className={`${inputClass} w-full py-1.5 px-2.5`}
                                                                    value={editExpName}
                                                                    onChange={e => setEditExpName(e.target.value)}
                                                                    autoFocus
                                                                />
                                                            </td>
                                                            <td className="px-4 py-2.5">
                                                                <select
                                                                    className={`${inputClass} py-1.5 px-2 w-full text-xs`}
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
                                                            <td className="px-4 py-2.5 text-right">
                                                                <input
                                                                    type="number"
                                                                    step="0.01"
                                                                    className={`${inputClass} input-no-spinner w-24 py-1.5 px-2.5 text-right font-mono inline-block`}
                                                                    value={editExpAmount}
                                                                    onChange={e => setEditExpAmount(e.target.value)}
                                                                />
                                                            </td>
                                                            <td className="px-4 py-2.5 text-right whitespace-nowrap">
                                                                <div className="inline-flex gap-1.5">
                                                                    <button
                                                                        onClick={() => saveExpEdit(exp.id)}
                                                                        className="p-1.5 bg-green-500/15 text-green-400 hover:bg-green-500/25 rounded-lg transition-colors"
                                                                        title="Save"
                                                                    >
                                                                        <Check size={15} />
                                                                    </button>
                                                                    <button
                                                                        onClick={() => setEditingExpId(null)}
                                                                        className="p-1.5 bg-slate-800 text-slate-300 hover:text-white rounded-lg transition-colors"
                                                                        title="Cancel"
                                                                    >
                                                                        <X size={15} />
                                                                    </button>
                                                                </div>
                                                            </td>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <td className="px-4 py-3 font-semibold text-white">
                                                                {exp.name}
                                                            </td>
                                                            <td className="px-4 py-3 text-xs">
                                                                <span className="px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-200 font-semibold">
                                                                    {exp.category}
                                                                </span>
                                                            </td>
                                                            <td className="px-4 py-3 text-right font-mono tabular-nums font-bold text-blue-400">
                                                                {formatter.format(exp.amount)}
                                                            </td>
                                                            <td className="px-4 py-3 text-right whitespace-nowrap">
                                                                <div className="inline-flex gap-1.5">
                                                                    <button
                                                                        onClick={() => {
                                                                            setEditingExpId(exp.id);
                                                                            setEditExpName(exp.name);
                                                                            setEditExpAmount(exp.amount.toString());
                                                                            setEditExpCategory(exp.category);
                                                                        }}
                                                                        className="p-1.5 bg-slate-800 border border-slate-700 hover:border-slate-500 text-slate-300 hover:text-white rounded-lg transition-colors"
                                                                        title="Edit"
                                                                    >
                                                                        <Pencil size={14} />
                                                                    </button>
                                                                    <button
                                                                        onClick={() => deleteMonthlyExpense(exp.id)}
                                                                        className="p-1.5 bg-red-500/15 border border-red-500/30 hover:bg-red-500/25 text-red-400 rounded-lg transition-colors"
                                                                        title="Delete"
                                                                    >
                                                                        <Trash2 size={14} />
                                                                    </button>
                                                                </div>
                                                            </td>
                                                        </>
                                                    )}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </section>
                    </div>
                </div>

                {/* Debt-to-Asset Ratio Footer */}
                <div className="flex justify-center pb-6">
                    <div className="bg-slate-800/95 border border-slate-700/90 rounded-xl px-5 py-2.5 text-sm text-slate-300 shadow-lg">
                        Debt-to-Asset Ratio:{' '}
                        <strong className="text-white font-mono tabular-nums ml-1">
                            {debtToAssetRatio.toFixed(1)}%
                        </strong>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default NetWorth;
