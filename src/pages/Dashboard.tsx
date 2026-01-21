import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { DollarSign, TrendingUp, TrendingDown, Users, Wallet, Award, AlertTriangle, ArrowUpDown, Eye, Settings, Pencil, Check, X, RefreshCw } from 'lucide-react';
import EventsTable from '../components/EventsTable';
import '../styles/shared.css';

const Dashboard = () => {
    const { assets, accounts, members, institutions, refreshPrices, netWorthHistory, lastUpdated } = useData();
    const [isRefreshing, setIsRefreshing] = useState(false);

    const handleRefresh = async () => {
        setIsRefreshing(true);
        await refreshPrices();
        setIsRefreshing(false);
    };

    // 1. Global Metrics
    const totalValue = assets.reduce((sum, a) => sum + a.marketValue, 0)
        + accounts.reduce((sum, a) => sum + a.cashBalance, 0); // Adding cash

    // Total Cost only for assets
    const totalInvested = assets.reduce((sum, a) => sum + (a.customBookCost ?? a.totalCost), 0);
    const totalProfit = assets.reduce((sum, a) => sum + (a.marketValue - (a.customBookCost ?? a.totalCost)), 0);
    const totalProfitPercent = totalInvested > 0 ? (totalProfit / totalInvested) * 100 : 0;

    // Cash Available
    const totalCash = accounts.reduce((sum, a) => sum + a.cashBalance, 0);

    // 2. Breakdown by Person (Pie Chart Data)
    const allocationByPerson = members.map(member => {
        const memberAccounts = accounts.filter(a => a.memberId === member.id);
        const memberAssets = assets.filter(a => memberAccounts.find(acc => acc.id === a.accountId));
        const value = memberAssets.reduce((sum, a) => sum + a.marketValue, 0)
            + memberAccounts.reduce((sum, a) => sum + a.cashBalance, 0);
        return { name: member.name, value };
    }).filter(d => d.value > 0);

    // Allocation by Account Type
    const accountTypes = Array.from(new Set(accounts.map(a => a.type)));
    const allocationByAccountType = accountTypes.map(type => {
        const typeAccounts = accounts.filter(a => a.type === type);
        const typeAssets = assets.filter(a => typeAccounts.find(acc => acc.id === a.accountId));
        const value = typeAssets.reduce((sum, a) => sum + a.marketValue, 0)
            + typeAccounts.reduce((sum, a) => sum + a.cashBalance, 0);
        return { name: type, value };
    }).filter(d => d.value > 0);

    // Allocation by Institution
    const allocationByInstitution = institutions.map(inst => {
        const instAccounts = accounts.filter(a => a.institutionId === inst.id);
        const instAssets = assets.filter(a => instAccounts.find(acc => acc.id === a.accountId));
        const value = instAssets.reduce((sum, a) => sum + a.marketValue, 0)
            + instAccounts.reduce((sum, a) => sum + a.cashBalance, 0);
        return { name: inst.name, value };
    }).filter(d => d.value > 0);

    // 3. Member Details for individual cards
    const memberDetails = members.map(member => {
        const memberAccounts = accounts.filter(a => a.memberId === member.id);
        const memberAssets = assets.filter(a => memberAccounts.find(acc => acc.id === a.accountId));

        const totalWorth = memberAssets.reduce((sum, a) => sum + a.marketValue, 0)
            + memberAccounts.reduce((sum, a) => sum + a.cashBalance, 0);
        const invested = memberAssets.reduce((sum, a) => sum + a.totalCost, 0);
        const profit = memberAssets.reduce((sum, a) => sum + (a.marketValue - a.totalCost), 0);
        const profitPercent = invested > 0 ? (profit / invested) * 100 : 0;
        const cash = memberAccounts.reduce((sum, a) => sum + a.cashBalance, 0);

        return {
            id: member.id,
            name: member.name,
            totalWorth,
            invested,
            profit,
            profitPercent,
            cash
        };
    });

    // 4. Best and Worst Performing Assets
    const assetsWithAccountInfo = assets.map(asset => {
        const account = accounts.find(acc => acc.id === asset.accountId);
        const member = members.find(m => m.id === account?.memberId);
        const percentTo52WeekHigh = asset.high52Week
            ? ((asset.currentPrice - asset.high52Week) / asset.high52Week) * 100
            : 0;

        return {
            ...asset,
            accountName: account?.name || 'Unknown',
            memberName: member?.name || 'Unknown',
            percentTo52WeekHigh
        };
    });

    // Sort by profit percentage to find best and worst
    const sortedByPerformance = [...assetsWithAccountInfo].sort((a, b) => b.profitPercent - a.profitPercent);
    const bestPerformer = sortedByPerformance[0];
    const worstPerformer = sortedByPerformance[sortedByPerformance.length - 1];

    // Sort by profit ($)
    const sortedByProfitDollar = [...assetsWithAccountInfo].sort((a, b) => b.profit - a.profit);
    const highestGainerDollar = sortedByProfitDollar[0];
    const lowestGainerDollar = sortedByProfitDollar[sortedByProfitDollar.length - 1];

    // Top 5 Assets by Profit %
    const top5AssetsPercent = [...assetsWithAccountInfo]
        .sort((a, b) => b.profitPercent - a.profitPercent)
        .slice(0, 5)
        .map(a => ({ name: `${a.ticker} (${a.accountName})`, value: a.profitPercent, ...a }));

    // Top 5 Assets by Profit % (Lowest)
    const bottom5AssetsPercent = [...assetsWithAccountInfo]
        .sort((a, b) => a.profitPercent - b.profitPercent)
        .slice(0, 5)
        .map(a => ({ name: `${a.ticker} (${a.accountName})`, value: a.profitPercent, ...a }));

    // 5. Account Performance Data for Table
    type AccountPerformance = {
        rank: number;
        accountId: string;
        accountName: string;
        memberName: string;
        institutionName: string;
        bookCost: number;
        marketValue: number;
        profitDollar: number;
        profitPercent: number;
    };

    type SortField = keyof AccountPerformance;
    type SortDirection = 'asc' | 'desc';

    const [sortField, setSortField] = useState<SortField>('profitPercent');
    const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

    // Goal State
    const [financialGoal, setFinancialGoal] = useState<number>(() => {
        const saved = localStorage.getItem('financialFreedomGoal');
        return saved ? parseFloat(saved) : 1000000;
    });
    const [isEditingGoal, setIsEditingGoal] = useState(false);
    const [tempGoal, setTempGoal] = useState<string>(financialGoal.toString());

    const handleSaveGoal = () => {
        const val = parseFloat(tempGoal);
        if (!isNaN(val) && val > 0) {
            setFinancialGoal(val);
            localStorage.setItem('financialFreedomGoal', val.toString());
            setIsEditingGoal(false);
        }
    };

    const handleCancelGoal = () => {
        setTempGoal(financialGoal.toString());
        setIsEditingGoal(false);
    };

    // totalInvested is already calculated at line 23, reuse it.
    const totalBasis = totalInvested + (accounts.reduce((sum, a) => sum + a.cashBalance, 0));
    const isPositivePerformance = totalValue >= totalBasis;
    const gaugeColor = isPositivePerformance ? 'from-blue-500 to-green-400' : 'from-red-600 to-red-400';

    const baseAccountPerformance = accounts.map(account => {
        const accountAssets = assets.filter(a => a.accountId === account.id);
        const member = members.find(m => m.id === account.memberId);
        const institution = institutions.find(i => i.id === account.institutionId);

        const bookCost = accountAssets.reduce((sum, a) => sum + (a.customBookCost || a.totalCost), 0);
        const marketValue = accountAssets.reduce((sum, a) => sum + a.marketValue, 0);
        const profitDollar = marketValue - bookCost;
        const profitPercent = bookCost > 0 ? (profitDollar / bookCost) * 100 : 0;

        return {
            rank: 0, // Placeholder, will be set after sorting
            accountId: account.id,
            accountName: account.name,
            memberName: member?.name || 'Unknown',
            institutionName: institution?.name || 'Unknown',
            bookCost,
            marketValue,
            profitDollar,
            profitPercent
        };
    });

    // Assign rank based on profitPercent (descending)
    const rankedAccountPerformance: AccountPerformance[] = [...baseAccountPerformance]
        .sort((a, b) => b.profitPercent - a.profitPercent)
        .map((item, index) => ({ ...item, rank: index + 1 }));

    // Sort for display
    const sortedAccountPerformance = [...rankedAccountPerformance].sort((a, b) => {
        const aVal = a[sortField];
        const bVal = b[sortField];

        if (typeof aVal === 'string' && typeof bVal === 'string') {
            return sortDirection === 'asc'
                ? aVal.localeCompare(bVal)
                : bVal.localeCompare(aVal);
        }

        return sortDirection === 'asc'
            ? (aVal as number) - (bVal as number)
            : (bVal as number) - (aVal as number);
    });

    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection(field === 'rank' || field === 'profitPercent' || field === 'profitDollar' || field === 'bookCost' || field === 'marketValue' ? 'desc' : 'asc');
        }
    };

    // 7. Asset Performance Data for Table
    type AssetPerformance = typeof assetsWithAccountInfo[0] & { rank: number, effectiveBookCost: number };
    type AssetSortField = keyof AssetPerformance;

    const [assetSortField, setAssetSortField] = useState<AssetSortField>('profitPercent');
    const [assetSortDirection, setAssetSortDirection] = useState<SortDirection>('desc');

    const rankedAssetPerformance: AssetPerformance[] = [...assetsWithAccountInfo]
        .sort((a, b) => b.profitPercent - a.profitPercent)
        .map((item, index) => ({
            ...item,
            rank: index + 1,
            effectiveBookCost: item.customBookCost || item.totalCost
        }));

    const sortedAssetPerformance = [...rankedAssetPerformance].sort((a, b) => {
        const aVal = a[assetSortField];
        const bVal = b[assetSortField];

        if (typeof aVal === 'string' && typeof bVal === 'string') {
            return assetSortDirection === 'asc'
                ? aVal.localeCompare(bVal)
                : bVal.localeCompare(aVal);
        }

        // Specific check because some fields might be undefined (like high52Week)
        const numA = (typeof aVal === 'number') ? aVal : 0;
        const numB = (typeof bVal === 'number') ? bVal : 0;

        return assetSortDirection === 'asc'
            ? numA - numB
            : numB - numA;
    });

    const handleAssetSort = (field: AssetSortField) => {
        if (assetSortField === field) {
            setAssetSortDirection(assetSortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setAssetSortField(field);
            // Default sort direction for numbers is usually desc (rank 1, highest profit), strings asc
            setAssetSortDirection(field === 'ticker' || field === 'accountName' ? 'asc' : 'desc');
        }
    };

    // 8. Breakdown by Member, Institution & Account
    const memberBreakdown = members.map(member => {
        const memberAccounts = accounts.filter(a => a.memberId === member.id);
        const memberAssets = assetsWithAccountInfo.filter(a => memberAccounts.some(acc => acc.id === a.accountId));

        // Groups by Institution
        const institutionGroups = institutions
            .map(inst => {
                const instAccounts = memberAccounts.filter(acc => acc.institutionId === inst.id);
                if (instAccounts.length === 0) return null;

                return {
                    institution: inst,
                    accounts: instAccounts.map(account => {
                        const accountAssets = memberAssets.filter(a => a.accountId === account.id);
                        // Show account if it has assets OR cash
                        if (accountAssets.length === 0 && account.cashBalance === 0) return null;

                        const bookCost = accountAssets.reduce((sum, a) => sum + (a.customBookCost || a.totalCost), 0);
                        const marketValue = accountAssets.reduce((sum, a) => sum + a.marketValue, 0);
                        const profit = marketValue - bookCost;
                        const profitPercent = bookCost > 0 ? (profit / bookCost) * 100 : 0;

                        return {
                            account,
                            assets: accountAssets,
                            stats: { bookCost, marketValue, profit, profitPercent }
                        };
                    }).filter((g): g is NonNullable<typeof g> => g !== null)
                };
            })
            .filter((g): g is NonNullable<typeof g> => g !== null && g.accounts.length > 0);

        // Member Totals
        const totalBookCost = memberAssets.reduce((sum, a) => sum + (a.customBookCost || a.totalCost), 0);
        const totalMarketValue = memberAssets.reduce((sum, a) => sum + a.marketValue, 0);
        const totalProfit = totalMarketValue - totalBookCost;
        const totalProfitPercent = totalBookCost > 0 ? (totalProfit / totalBookCost) * 100 : 0;
        const totalCash = memberAccounts.reduce((sum, a) => sum + a.cashBalance, 0);

        return {
            member,
            stats: { totalBookCost, totalMarketValue, totalProfit, totalProfitPercent, totalCash },
            institutionGroups
        };
    }).filter(m => m.institutionGroups.length > 0 && (m.institutionGroups as any[]).some(g => g.accounts.length > 0)); // Ensure we have data

    // 6. Portfolio History (Persisted Net Worth)
    // Use stored history from netWorthHistory


    // Sort history by date asc
    const sortedHistory = [...netWorthHistory].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Convert to chart format
    const portfolioHistory = sortedHistory.map(entry => ({
        name: entry.date,
        value: entry.value
    }));

    // If history is empty (first day), show current state as a single dot
    if (portfolioHistory.length === 0 && totalValue > 0) {
        const today = new Date().toISOString().split('T')[0];
        portfolioHistory.push({ name: today, value: totalValue });
    }

    const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#6366f1'];

    return (
        <div>
            <div className="flex justify-between items-center mb-8">
                <h1 className="text-3xl font-bold text-white">Dashboard</h1>
                <div className="flex items-center gap-4">
                    {lastUpdated && (
                        <p className="text-xs text-slate-400">
                            Last updated: {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                    )}
                    <button
                        onClick={handleRefresh}
                        disabled={isRefreshing}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:opacity-50 text-white rounded-lg transition-colors"
                    >
                        <RefreshCw size={18} className={isRefreshing ? 'animate-spin' : ''} />
                        {isRefreshing ? 'Refreshing...' : 'Refresh Prices'}
                    </button>
                </div>
            </div>

            {/* Global Overview Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
                <div className="card border-l-4 border-blue-500">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-slate-400 text-sm font-medium uppercase">Net Worth</p>
                            <h2 className="text-3xl font-bold text-white mt-2">${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</h2>
                        </div>
                        <div className="p-2 bg-blue-500/10 rounded-lg text-blue-500">
                            <DollarSign size={24} />
                        </div>
                    </div>
                </div>

                <div className="card border-l-4 border-purple-500">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-slate-400 text-sm font-medium uppercase">Total Invested</p>
                            <h2 className="text-3xl font-bold text-white mt-2">${totalInvested.toLocaleString(undefined, { minimumFractionDigits: 2 })}</h2>
                        </div>
                        <div className="p-2 bg-purple-500/10 rounded-lg text-purple-500">
                            <Wallet size={24} />
                        </div>
                    </div>
                </div>

                <div className="card border-l-4 border-green-500">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-slate-400 text-sm font-medium uppercase">Total Profit ($)</p>
                            <div className="flex items-center gap-2 mt-2">
                                <h2 className={`text-3xl font-bold ${totalProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                    {totalProfit >= 0 ? '+' : '-'}${Math.abs(totalProfit).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </h2>
                            </div>
                        </div>
                        <div className={`p-2 rounded-lg ${totalProfit >= 0 ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                            <DollarSign size={24} />
                        </div>
                    </div>
                </div>

                <div className={`card border-l-4 ${totalProfitPercent >= 0 ? 'border-green-500' : 'border-red-500'}`}>
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-slate-400 text-sm font-medium uppercase">Total Profit (%)</p>
                            <div className="flex items-center gap-2 mt-2">
                                <h2 className={`text-3xl font-bold ${totalProfitPercent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                    {totalProfitPercent >= 0 ? '+' : ''}{totalProfitPercent.toFixed(2)}%
                                </h2>
                            </div>
                        </div>
                        <div className={`p-2 rounded-lg ${totalProfitPercent >= 0 ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                            {totalProfitPercent >= 0 ? <TrendingUp size={24} /> : <TrendingDown size={24} />}
                        </div>
                    </div>
                </div>

                <div className="card border-l-4 border-slate-500">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-slate-400 text-sm font-medium uppercase">Cash Available</p>
                            <h2 className="text-3xl font-bold text-white mt-2">${totalCash.toLocaleString(undefined, { minimumFractionDigits: 2 })}</h2>
                        </div>
                        <div className="p-2 bg-slate-500/10 rounded-lg text-slate-500">
                            <DollarSign size={24} />
                        </div>
                    </div>
                </div>
            </div>

            {/* Member Overview Section */}
            <div className="mb-8">
                <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
                    <Users size={24} className="text-blue-400" />
                    Member Overview
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {memberDetails.map((member) => (
                        <div key={member.id} className="card border-l-4 border-blue-400">
                            <h3 className="text-xl font-bold text-white mb-4">{member.name}</h3>

                            {/* Total Worth */}
                            <div className="mb-3">
                                <p className="text-slate-400 text-xs font-medium uppercase mb-1">Total Worth</p>
                                <p className="text-2xl font-bold text-white">
                                    ${member.totalWorth.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </p>
                            </div>

                            {/* Invested */}
                            <div className="mb-3">
                                <p className="text-slate-400 text-xs font-medium uppercase mb-1">Invested</p>
                                <p className="text-lg font-semibold text-slate-300">
                                    ${member.invested.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </p>
                            </div>

                            {/* Profit/Loss */}
                            <div className="mb-3">
                                <p className="text-slate-400 text-xs font-medium uppercase mb-1">Profit/Loss</p>
                                <div className="flex items-center gap-2">
                                    <p className={`text-lg font-bold ${member.profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                        {member.profit >= 0 ? '+' : '-'}${Math.abs(member.profit).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                    </p>
                                    {member.profit >= 0 ?
                                        <TrendingUp size={18} className="text-green-400" /> :
                                        <TrendingDown size={18} className="text-red-400" />
                                    }
                                </div>
                                <p className={`text-sm font-semibold ${member.profitPercent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                    {member.profitPercent >= 0 ? '+' : ''}{member.profitPercent.toFixed(2)}%
                                </p>
                            </div>

                            {/* Cash Available */}
                            <div className="pt-3 border-t border-slate-700">
                                <p className="text-slate-400 text-xs font-medium uppercase mb-1">Cash Available</p>
                                <p className="text-lg font-semibold text-slate-300">
                                    ${member.cash.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Best and Worst Performing Assets */}
            {bestPerformer && worstPerformer && (
                <div className="mb-8">
                    <h2 className="text-2xl font-bold text-white mb-6">Asset Performance</h2>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                        {/* Best Performer */}
                        <div className="card border-l-4 border-green-500">
                            <div className="flex items-start justify-between mb-4">
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <Award size={20} className="text-green-400" />
                                        <h3 className="text-lg font-bold text-green-400">Best Performer</h3>
                                    </div>
                                    <h4 className="text-2xl font-bold text-white">{bestPerformer.name || bestPerformer.ticker}</h4>
                                    <p className="text-slate-400 text-sm">{bestPerformer.ticker} • {bestPerformer.accountName} ({bestPerformer.memberName})</p>
                                </div>
                                <div className={`px-3 py-1 rounded-lg ${bestPerformer.profitPercent >= 0 ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                    <p className="text-lg font-bold">
                                        {bestPerformer.profitPercent >= 0 ? '+' : ''}{bestPerformer.profitPercent.toFixed(2)}%
                                    </p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                                <div>
                                    <p className="text-slate-400 text-xs uppercase mb-1">Current Price</p>
                                    <p className="text-lg font-semibold text-white">${bestPerformer.currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                                </div>
                                <div>
                                    <p className="text-slate-400 text-xs uppercase mb-1">Shares</p>
                                    <p className="text-lg font-semibold text-white">{bestPerformer.quantity.toLocaleString()}</p>
                                </div>
                                <div>
                                    <p className="text-slate-400 text-xs uppercase mb-1">Cost Per Share</p>
                                    <p className="text-lg font-semibold text-white">${bestPerformer.averageCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                                </div>
                                <div>
                                    <p className="text-slate-400 text-xs uppercase mb-1">Market Value</p>
                                    <p className="text-lg font-semibold text-white">${bestPerformer.marketValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                                </div>
                                <div>
                                    <p className="text-slate-400 text-xs uppercase mb-1">Book Cost</p>
                                    <p className="text-lg font-semibold text-white">${(bestPerformer.customBookCost || bestPerformer.totalCost).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                                </div>
                                <div>
                                    <p className="text-slate-400 text-xs uppercase mb-1">52W Low</p>
                                    <p className="text-sm font-semibold text-slate-300">${bestPerformer.low52Week?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || 'N/A'}</p>
                                </div>
                                <div>
                                    <p className="text-slate-400 text-xs uppercase mb-1">52W High</p>
                                    <p className="text-sm font-semibold text-slate-300">${bestPerformer.high52Week?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || 'N/A'}</p>
                                </div>
                                <div>
                                    <p className="text-slate-400 text-xs uppercase mb-1">% to 52W High</p>
                                    <div className="flex items-center gap-2">
                                        <p className={`text-sm font-bold ${bestPerformer.percentTo52WeekHigh >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                            {bestPerformer.percentTo52WeekHigh >= 0 ? '+' : ''}{bestPerformer.percentTo52WeekHigh.toFixed(2)}%
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="pt-4 border-t border-slate-700">
                                <div className="flex justify-between items-center mb-2">
                                    <p className="text-slate-400 text-xs uppercase">Total Profit/Loss</p>
                                    <div className="text-right">
                                        <p className={`text-xl font-bold ${bestPerformer.profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                            {bestPerformer.profit >= 0 ? '+' : '-'}${Math.abs(bestPerformer.profit).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Sparkline Chart */}
                            {bestPerformer.sparkline && bestPerformer.sparkline.length > 0 && (
                                <div className="mt-4">
                                    <p className="text-[10px] text-slate-500 font-bold uppercase mb-1 text-right">1 Year Trend</p>
                                    <div className="h-24">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <AreaChart data={bestPerformer.sparkline}>
                                                <defs>
                                                    <linearGradient id="colorGreen" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                                    </linearGradient>
                                                </defs>
                                                <Tooltip
                                                    contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f8fafc', fontSize: '12px', padding: '8px' }}
                                                    itemStyle={{ color: '#f8fafc' }}
                                                    formatter={(value: any) => [`$${parseFloat(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 'Price']}
                                                    labelStyle={{ display: 'none' }}
                                                    cursor={{ stroke: '#475569', strokeWidth: 1 }}
                                                />
                                                <YAxis domain={['auto', 'auto']} hide />
                                                <Area type="monotone" dataKey="price" stroke="#10b981" strokeWidth={2} fill="url(#colorGreen)" />
                                            </AreaChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Worst Performer */}
                        <div className="card border-l-4 border-red-500">
                            <div className="flex items-start justify-between mb-4">
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <AlertTriangle size={20} className="text-red-400" />
                                        <h3 className="text-lg font-bold text-red-400">Worst Performer</h3>
                                    </div>
                                    <h4 className="text-2xl font-bold text-white">{worstPerformer.name || worstPerformer.ticker}</h4>
                                    <p className="text-slate-400 text-sm">{worstPerformer.ticker} • {worstPerformer.accountName} ({worstPerformer.memberName})</p>
                                </div>
                                <div className={`px-3 py-1 rounded-lg ${worstPerformer.profitPercent >= 0 ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                    <p className="text-lg font-bold">
                                        {worstPerformer.profitPercent >= 0 ? '+' : ''}{worstPerformer.profitPercent.toFixed(2)}%
                                    </p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                                <div>
                                    <p className="text-slate-400 text-xs uppercase mb-1">Current Price</p>
                                    <p className="text-lg font-semibold text-white">${worstPerformer.currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                                </div>
                                <div>
                                    <p className="text-slate-400 text-xs uppercase mb-1">Shares</p>
                                    <p className="text-lg font-semibold text-white">{worstPerformer.quantity.toLocaleString()}</p>
                                </div>
                                <div>
                                    <p className="text-slate-400 text-xs uppercase mb-1">Cost Per Share</p>
                                    <p className="text-lg font-semibold text-white">${worstPerformer.averageCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                                </div>
                                <div>
                                    <p className="text-slate-400 text-xs uppercase mb-1">Market Value</p>
                                    <p className="text-lg font-semibold text-white">${worstPerformer.marketValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                                </div>
                                <div>
                                    <p className="text-slate-400 text-xs uppercase mb-1">Book Cost</p>
                                    <p className="text-lg font-semibold text-white">${(worstPerformer.customBookCost || worstPerformer.totalCost).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                                </div>
                                <div>
                                    <p className="text-slate-400 text-xs uppercase mb-1">52W Low</p>
                                    <p className="text-sm font-semibold text-slate-300">${worstPerformer.low52Week?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || 'N/A'}</p>
                                </div>
                                <div>
                                    <p className="text-slate-400 text-xs uppercase mb-1">52W High</p>
                                    <p className="text-sm font-semibold text-slate-300">${worstPerformer.high52Week?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || 'N/A'}</p>
                                </div>
                                <div>
                                    <p className="text-slate-400 text-xs uppercase mb-1">% to 52W High</p>
                                    <div className="flex items-center gap-2">
                                        <p className={`text-sm font-bold ${worstPerformer.percentTo52WeekHigh >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                            {worstPerformer.percentTo52WeekHigh >= 0 ? '+' : ''}{worstPerformer.percentTo52WeekHigh.toFixed(2)}%
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="pt-4 border-t border-slate-700">
                                <div className="flex justify-between items-center mb-2">
                                    <p className="text-slate-400 text-xs uppercase">Total Profit/Loss</p>
                                    <div className="text-right">
                                        <p className={`text-xl font-bold ${worstPerformer.profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                            {worstPerformer.profit >= 0 ? '+' : '-'}${Math.abs(worstPerformer.profit).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Sparkline Chart */}
                            {worstPerformer.sparkline && worstPerformer.sparkline.length > 0 && (
                                <div className="mt-4">
                                    <p className="text-[10px] text-slate-500 font-bold uppercase mb-1 text-right">1 Year Trend</p>
                                    <div className="h-24">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <AreaChart data={worstPerformer.sparkline}>
                                                <defs>
                                                    <linearGradient id="colorRed" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                                                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                                                    </linearGradient>
                                                </defs>
                                                <Tooltip
                                                    contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f8fafc', fontSize: '12px', padding: '8px' }}
                                                    itemStyle={{ color: '#f8fafc' }}
                                                    formatter={(value: any) => [`$${parseFloat(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 'Price']}
                                                    labelStyle={{ display: 'none' }}
                                                    cursor={{ stroke: '#475569', strokeWidth: 1 }}
                                                />
                                                <YAxis domain={['auto', 'auto']} hide />
                                                <Area type="monotone" dataKey="price" stroke="#ef4444" strokeWidth={2} fill="url(#colorRed)" />
                                            </AreaChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Highest Gain ($) */}
                        {highestGainerDollar && (
                            <div className="card border-l-4 border-emerald-500">
                                <div className="flex items-start justify-between mb-4">
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <Award size={20} className="text-emerald-400" />
                                            <h3 className="text-lg font-bold text-emerald-400">Highest Gain ($)</h3>
                                        </div>
                                        <h4 className="text-2xl font-bold text-white">{highestGainerDollar.name || highestGainerDollar.ticker}</h4>
                                        <p className="text-slate-400 text-sm">{highestGainerDollar.ticker} • {highestGainerDollar.accountName} ({highestGainerDollar.memberName})</p>
                                    </div>
                                    <div className={`px-3 py-1 rounded-lg ${highestGainerDollar.profit >= 0 ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                        <p className="text-lg font-bold">
                                            {highestGainerDollar.profit >= 0 ? '+' : '-'}${Math.abs(highestGainerDollar.profit).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                        </p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                                    <div>
                                        <p className="text-slate-400 text-xs uppercase mb-1">Current Price</p>
                                        <p className="text-lg font-semibold text-white">${highestGainerDollar.currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                                    </div>
                                    <div>
                                        <p className="text-slate-400 text-xs uppercase mb-1">Shares</p>
                                        <p className="text-lg font-semibold text-white">{highestGainerDollar.quantity.toLocaleString()}</p>
                                    </div>
                                    <div>
                                        <p className="text-slate-400 text-xs uppercase mb-1">Cost Per Share</p>
                                        <p className="text-lg font-semibold text-white">${highestGainerDollar.averageCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                                    </div>
                                    <div>
                                        <p className="text-slate-400 text-xs uppercase mb-1">Market Value</p>
                                        <p className="text-lg font-semibold text-white">${highestGainerDollar.marketValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                                    </div>
                                    <div>
                                        <p className="text-slate-400 text-xs uppercase mb-1">Book Cost</p>
                                        <p className="text-lg font-semibold text-white">${(highestGainerDollar.customBookCost || highestGainerDollar.totalCost).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                                    </div>
                                    <div>
                                        <p className="text-slate-400 text-xs uppercase mb-1">52W Low</p>
                                        <p className="text-sm font-semibold text-slate-300">${highestGainerDollar.low52Week?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || 'N/A'}</p>
                                    </div>
                                    <div>
                                        <p className="text-slate-400 text-xs uppercase mb-1">52W High</p>
                                        <p className="text-sm font-semibold text-slate-300">${highestGainerDollar.high52Week?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || 'N/A'}</p>
                                    </div>
                                    <div>
                                        <p className="text-slate-400 text-xs uppercase mb-1">% to 52W High</p>
                                        <div className="flex items-center gap-2">
                                            <p className={`text-sm font-bold ${highestGainerDollar.percentTo52WeekHigh >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                {highestGainerDollar.percentTo52WeekHigh >= 0 ? '+' : ''}{highestGainerDollar.percentTo52WeekHigh.toFixed(2)}%
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div className="pt-4 border-t border-slate-700">
                                    <div className="flex justify-between items-center mb-2">
                                        <p className="text-slate-400 text-xs uppercase">Total Return (%)</p>
                                        <div className="text-right">
                                            <p className={`text-xl font-bold ${highestGainerDollar.profitPercent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                {highestGainerDollar.profitPercent >= 0 ? '+' : ''}{highestGainerDollar.profitPercent.toFixed(2)}%
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Sparkline Chart */}
                                {highestGainerDollar.sparkline && highestGainerDollar.sparkline.length > 0 && (
                                    <div className="mt-4">
                                        <p className="text-[10px] text-slate-500 font-bold uppercase mb-1 text-right">1 Year Trend</p>
                                        <div className="h-24">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <AreaChart data={highestGainerDollar.sparkline}>
                                                    <defs>
                                                        <linearGradient id="colorEmerald" x1="0" y1="0" x2="0" y2="1">
                                                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                                            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                                        </linearGradient>
                                                    </defs>
                                                    <Tooltip
                                                        contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f8fafc', fontSize: '12px', padding: '8px' }}
                                                        itemStyle={{ color: '#f8fafc' }}
                                                        formatter={(value: any) => [`$${parseFloat(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 'Price']}
                                                        labelStyle={{ display: 'none' }}
                                                        cursor={{ stroke: '#475569', strokeWidth: 1 }}
                                                    />
                                                    <YAxis domain={['auto', 'auto']} hide />
                                                    <Area type="monotone" dataKey="price" stroke="#10b981" strokeWidth={2} fill="url(#colorEmerald)" />
                                                </AreaChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Lowest Gain ($) */}
                        {lowestGainerDollar && (
                            <div className="card border-l-4 border-rose-500">
                                <div className="flex items-start justify-between mb-4">
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <AlertTriangle size={20} className="text-rose-400" />
                                            <h3 className="text-lg font-bold text-rose-400">Lowest Gain ($)</h3>
                                        </div>
                                        <h4 className="text-2xl font-bold text-white">{lowestGainerDollar.name || lowestGainerDollar.ticker}</h4>
                                        <p className="text-slate-400 text-sm">{lowestGainerDollar.ticker} • {lowestGainerDollar.accountName} ({lowestGainerDollar.memberName})</p>
                                    </div>
                                    <div className={`px-3 py-1 rounded-lg ${lowestGainerDollar.profit >= 0 ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                        <p className="text-lg font-bold">
                                            {lowestGainerDollar.profit >= 0 ? '+' : '-'}${Math.abs(lowestGainerDollar.profit).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                        </p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                                    <div>
                                        <p className="text-slate-400 text-xs uppercase mb-1">Current Price</p>
                                        <p className="text-lg font-semibold text-white">${lowestGainerDollar.currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                                    </div>
                                    <div>
                                        <p className="text-slate-400 text-xs uppercase mb-1">Shares</p>
                                        <p className="text-lg font-semibold text-white">{lowestGainerDollar.quantity.toLocaleString()}</p>
                                    </div>
                                    <div>
                                        <p className="text-slate-400 text-xs uppercase mb-1">Cost Per Share</p>
                                        <p className="text-lg font-semibold text-white">${lowestGainerDollar.averageCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                                    </div>
                                    <div>
                                        <p className="text-slate-400 text-xs uppercase mb-1">Market Value</p>
                                        <p className="text-lg font-semibold text-white">${lowestGainerDollar.marketValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                                    </div>
                                    <div>
                                        <p className="text-slate-400 text-xs uppercase mb-1">Book Cost</p>
                                        <p className="text-lg font-semibold text-white">${(lowestGainerDollar.customBookCost || lowestGainerDollar.totalCost).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                                    </div>
                                    <div>
                                        <p className="text-slate-400 text-xs uppercase mb-1">52W Low</p>
                                        <p className="text-sm font-semibold text-slate-300">${lowestGainerDollar.low52Week?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || 'N/A'}</p>
                                    </div>
                                    <div>
                                        <p className="text-slate-400 text-xs uppercase mb-1">52W High</p>
                                        <p className="text-sm font-semibold text-slate-300">${lowestGainerDollar.high52Week?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || 'N/A'}</p>
                                    </div>
                                    <div>
                                        <p className="text-slate-400 text-xs uppercase mb-1">% to 52W High</p>
                                        <div className="flex items-center gap-2">
                                            <p className={`text-sm font-bold ${lowestGainerDollar.percentTo52WeekHigh >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                {lowestGainerDollar.percentTo52WeekHigh >= 0 ? '+' : ''}{lowestGainerDollar.percentTo52WeekHigh.toFixed(2)}%
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div className="pt-4 border-t border-slate-700">
                                    <div className="flex justify-between items-center mb-2">
                                        <p className="text-slate-400 text-xs uppercase">Total Return (%)</p>
                                        <div className="text-right">
                                            <p className={`text-xl font-bold ${lowestGainerDollar.profitPercent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                {lowestGainerDollar.profitPercent >= 0 ? '+' : ''}{lowestGainerDollar.profitPercent.toFixed(2)}%
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Sparkline Chart */}
                                {lowestGainerDollar.sparkline && lowestGainerDollar.sparkline.length > 0 && (
                                    <div className="mt-4">
                                        <p className="text-[10px] text-slate-500 font-bold uppercase mb-1 text-right">1 Year Trend</p>
                                        <div className="h-24">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <AreaChart data={lowestGainerDollar.sparkline}>
                                                    <defs>
                                                        <linearGradient id="colorRose" x1="0" y1="0" x2="0" y2="1">
                                                            <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3} />
                                                            <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                                                        </linearGradient>
                                                    </defs>
                                                    <Tooltip
                                                        contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f8fafc', fontSize: '12px', padding: '8px' }}
                                                        itemStyle={{ color: '#f8fafc' }}
                                                        formatter={(value: any) => [`$${parseFloat(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 'Price']}
                                                        labelStyle={{ display: 'none' }}
                                                        cursor={{ stroke: '#475569', strokeWidth: 1 }}
                                                    />
                                                    <YAxis domain={['auto', 'auto']} hide />
                                                    <Area type="monotone" dataKey="price" stroke="#f43f5e" strokeWidth={2} fill="url(#colorRose)" />
                                                </AreaChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                    </div>
                </div>
            )}

            {/* Upcoming Events */}
            <div className="mb-8">
                <EventsTable assets={assets} />
            </div>

            {/* Portfolio History Chart */}
            {portfolioHistory.length > 0 && (
                <div className="card mb-8">
                    <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                        <TrendingUp size={24} className="text-blue-400" />
                        Portfolio Value History
                    </h3>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={portfolioHistory} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                                <XAxis
                                    dataKey="name"
                                    hide={false} // Show dates now
                                    tickFormatter={(val) => {
                                        // Show Month/Year for readability
                                        const d = new Date(val);
                                        return `${d.getMonth() + 1}/${d.getFullYear().toString().substr(2)}`;
                                    }}
                                    interval={Math.max(1, Math.floor(portfolioHistory.length / 5))} // ~5 ticks
                                    stroke="#475569"
                                    tick={{ fill: '#64748b', fontSize: 10 }}
                                />
                                <YAxis
                                    domain={['auto', 'auto']}
                                    orientation="right"
                                    tickFormatter={(val) => `$${(val / 1000).toFixed(0)}k`}
                                    stroke="#94a3b8"
                                    tick={{ fill: '#94a3b8', fontSize: 12 }}
                                    tickLine={false}
                                    axisLine={false}
                                />
                                <Tooltip
                                    formatter={(value: any) => [`$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 'Net Worth']}
                                    labelFormatter={(label) => new Date(label).toLocaleDateString()}
                                    contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f8fafc' }}
                                    itemStyle={{ color: '#f8fafc' }}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="value"
                                    stroke="#3b82f6"
                                    strokeWidth={3}
                                    fillOpacity={1}
                                    fill="url(#colorValue)"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

                {/* Allocation by Person */}
                <div className="card h-[400px] flex flex-col">
                    <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                        <Users size={20} className="text-slate-400" /> Allocation by Person
                    </h3>
                    <div className="flex-1 w-full relative">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={allocationByPerson}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={80}
                                    outerRadius={120}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {allocationByPerson.map((_entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    formatter={(value: any) => `$${(value || 0).toLocaleString()}`}
                                    contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f8fafc' }}
                                    itemStyle={{ color: '#f8fafc' }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                        {/* Center Label */}
                        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
                            <p className="text-slate-400 text-xs uppercase font-medium">Total</p>
                            <p className="text-xl font-bold text-white">${totalValue.toLocaleString(undefined, { notation: 'compact' })}</p>
                        </div>
                    </div>
                    <div className="flex justify-center flex-wrap gap-4 mt-4">
                        {allocationByPerson.map((entry, index) => (
                            <div key={entry.name} className="flex items-center gap-2 text-sm text-slate-300">
                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                                {entry.name}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Financial Freedom Goal Gauge */}
                <div className="card p-8 flex flex-col items-center justify-center text-center">
                    <h3 className="text-lg font-bold text-white mb-2">Financial Freedom Goal</h3>

                    <div className="mb-8 flex items-center justify-center gap-2">
                        {isEditingGoal ? (
                            <div className="flex items-center gap-2">
                                <input
                                    type="number"
                                    value={tempGoal}
                                    onChange={(e) => setTempGoal(e.target.value)}
                                    className="bg-slate-800 border border-slate-600 rounded px-2 py-1 text-white text-sm w-32 focus:outline-none focus:border-blue-500"
                                    autoFocus
                                />
                                <button onClick={handleSaveGoal} className="p-1 bg-green-500/20 text-green-400 rounded hover:bg-green-500/30 transition-colors">
                                    <Check size={16} />
                                </button>
                                <button onClick={handleCancelGoal} className="p-1 bg-red-500/20 text-red-400 rounded hover:bg-red-500/30 transition-colors">
                                    <X size={16} />
                                </button>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 group cursor-pointer" onClick={() => setIsEditingGoal(true)}>
                                <p className="text-slate-400 text-sm">Target: ${financialGoal.toLocaleString()}</p>
                                <Pencil size={12} className="text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                        )}
                    </div>

                    <div className="relative w-64 h-32 overflow-hidden mb-6">
                        {/* Gauge Background */}
                        <div className="absolute bottom-0 w-full h-full bg-slate-700 rounded-t-full"></div>
                        {/* Gauge Progress */}
                        <div
                            className={`absolute bottom-0 w-full h-full bg-gradient-to-t ${gaugeColor} rounded-t-full origin-bottom transform rotate-[-180deg] transition-all duration-1000`}
                            style={{
                                transform: `rotate(${Math.min(0, (totalValue / financialGoal * 180) - 180)}deg)`
                            }}
                        ></div>
                        {/* Inner Cover */}
                        <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-1/2 w-48 h-48 bg-slate-800 rounded-full flex items-center justify-center pt-4">
                        </div>
                    </div>

                    <h2 className="text-4xl font-bold text-white mb-2">${totalValue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</h2>
                    <p className={`text-sm font-medium ${isPositivePerformance ? 'text-green-400' : 'text-red-400'}`}>
                        {isPositivePerformance ? 'Profit' : 'Loss'}: ${(totalValue - totalBasis).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        <span className="opacity-75 ml-1">
                            ({totalProfitPercent >= 0 ? '+' : ''}{totalProfitPercent.toFixed(2)}%)
                        </span>
                    </p>
                    <p className="text-xs text-slate-500 mt-1">Current Net Worth</p>
                </div>

                {/* Allocation by Account Type */}
                <div className="card h-[400px] flex flex-col">
                    <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                        <Wallet size={20} className="text-slate-400" /> Allocation by Account Type
                    </h3>
                    <div className="flex-1 w-full relative">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={allocationByAccountType}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={80}
                                    outerRadius={120}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {allocationByAccountType.map((_entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    formatter={(value: any) => `$${(value || 0).toLocaleString()}`}
                                    contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f8fafc' }}
                                    itemStyle={{ color: '#f8fafc' }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="flex justify-center flex-wrap gap-4 mt-4">
                        {allocationByAccountType.map((entry, index) => (
                            <div key={entry.name} className="flex items-center gap-2 text-sm text-slate-300">
                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                                {entry.name}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Allocation by Institution */}
                <div className="card h-[400px] flex flex-col">
                    <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                        <Users size={20} className="text-slate-400" /> Allocation by Institution
                    </h3>
                    <div className="flex-1 w-full relative">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={allocationByInstitution}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={80}
                                    outerRadius={120}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {allocationByInstitution.map((_entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    formatter={(value: any) => `$${(value || 0).toLocaleString()}`}
                                    contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f8fafc' }}
                                    itemStyle={{ color: '#f8fafc' }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="flex justify-center flex-wrap gap-4 mt-4">
                        {allocationByInstitution.map((entry, index) => (
                            <div key={entry.name} className="flex items-center gap-2 text-sm text-slate-300">
                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                                {entry.name}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Top 5 Assets by % Profit */}
                <div className="card h-[400px] flex flex-col">
                    <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                        <TrendingUp size={20} className="text-green-400" /> Top 5 Assets (% Profit)
                    </h3>
                    <div className="flex-1 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart layout="vertical" data={top5AssetsPercent} margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
                                <XAxis type="number" unit="%" stroke="#94a3b8" />
                                <YAxis type="category" dataKey="name" stroke="#94a3b8" width={150} fontSize={12} tickLine={false} />
                                <Tooltip
                                    cursor={{ fill: '#334155', opacity: 0.4 }}
                                    contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f8fafc' }}
                                    itemStyle={{ color: '#f8fafc' }}
                                    labelStyle={{ color: '#f8fafc' }}
                                    formatter={(value: any) => `${value.toFixed(2)}%`}
                                />
                                <Bar dataKey="value" fill="#10b981" radius={[0, 4, 4, 0]}>
                                    {top5AssetsPercent.map((_entry, index) => (
                                        <Cell key={`cell-${index}`} fill={index === 0 ? '#10b981' : '#34d399'} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Bottom 5 Assets by % Profit */}
                <div className="card h-[400px] flex flex-col">
                    <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                        <TrendingDown size={20} className="text-red-400" /> Bottom 5 Assets (% Profit)
                    </h3>
                    <div className="flex-1 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart layout="vertical" data={bottom5AssetsPercent} margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
                                <XAxis type="number" unit="%" stroke="#94a3b8" />
                                <YAxis type="category" dataKey="name" stroke="#94a3b8" width={150} fontSize={12} tickLine={false} />
                                <Tooltip
                                    cursor={{ fill: '#334155', opacity: 0.4 }}
                                    contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f8fafc' }}
                                    itemStyle={{ color: '#f8fafc' }}
                                    labelStyle={{ color: '#f8fafc' }}
                                    formatter={(value: any) => `${value.toFixed(2)}%`}
                                />
                                <Bar dataKey="value" fill="#ef4444" radius={[4, 0, 0, 4]}>
                                    {bottom5AssetsPercent.map((_entry, index) => (
                                        <Cell key={`cell-${index}`} fill={index === 0 ? '#ef4444' : '#f87171'} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

            </div>

            {/* Account Performance Table */}
            <div className="card mt-8 overflow-hidden">
                <h3 className="text-xl font-bold text-white mb-6">Accounts Ranked by Performance</h3>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="text-slate-400 border-b border-slate-700 text-xs uppercase whitespace-nowrap">
                                <th className="px-3 py-3 font-medium cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('rank')}>
                                    <div className="flex items-center gap-1">Rank <ArrowUpDown size={12} /></div>
                                </th>
                                <th className="px-3 py-3 font-medium cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('accountName')}>
                                    <div className="flex items-center gap-1">Account <ArrowUpDown size={12} /></div>
                                </th>
                                <th className="px-3 py-3 font-medium cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('memberName')}>
                                    <div className="flex items-center gap-1">Member <ArrowUpDown size={12} /></div>
                                </th>
                                <th className="px-3 py-3 font-medium cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('institutionName')}>
                                    <div className="flex items-center gap-1">Institution <ArrowUpDown size={12} /></div>
                                </th>
                                <th className="px-3 py-3 text-right font-medium cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('bookCost')}>
                                    <div className="flex items-center justify-end gap-1">Book <ArrowUpDown size={12} /></div>
                                </th>
                                <th className="px-3 py-3 text-right font-medium cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('marketValue')}>
                                    <div className="flex items-center justify-end gap-1">Value <ArrowUpDown size={12} /></div>
                                </th>
                                <th className="px-3 py-3 text-right font-medium cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('profitDollar')}>
                                    <div className="flex items-center justify-end gap-1">P/L $ <ArrowUpDown size={12} /></div>
                                </th>
                                <th className="px-3 py-3 text-right font-medium cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('profitPercent')}>
                                    <div className="flex items-center justify-end gap-1">P/L % <ArrowUpDown size={12} /></div>
                                </th>
                                <th className="px-3 py-3 text-right font-medium">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700 text-sm">
                            {sortedAccountPerformance.map((account) => (
                                <tr key={account.accountId} className="hover:bg-slate-700/30 transition-colors">
                                    <td className="p-4 text-white font-medium">#{account.rank}</td>
                                    <td className="p-4 text-white font-bold">{account.accountName}</td>
                                    <td className="p-4 text-slate-300">{account.memberName}</td>
                                    <td className="p-4 text-slate-300">{account.institutionName}</td>
                                    <td className="p-4 text-right text-slate-300 font-medium">
                                        ${account.bookCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </td>
                                    <td className="p-4 text-right text-white font-bold">
                                        ${account.marketValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </td>
                                    <td className={`p-4 text-right font-bold ${account.profitDollar >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                        {account.profitDollar >= 0 ? '+' : '-'}${Math.abs(account.profitDollar).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </td>
                                    <td className={`p-4 text-right font-bold ${account.profitPercent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                        {account.profitPercent >= 0 ? '+' : ''}{account.profitPercent.toFixed(2)}%
                                    </td>
                                    <td className="p-4 text-right">
                                        <Link to={`/accounts/${account.accountId}`} className="p-2 bg-blue-500/10 text-blue-400 rounded-lg hover:bg-blue-500/20 hover:text-blue-300 transition-colors inline-block" title="View Account">
                                            <Eye size={18} />
                                        </Link>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* All Assets Performance Table */}
            <div className="card mt-8 overflow-hidden">
                <h3 className="text-xl font-bold text-white mb-6">All Assets Ranked by Performance</h3>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="text-slate-400 border-b border-slate-700 text-xs uppercase whitespace-nowrap">
                                <th className="px-2 py-3 font-medium cursor-pointer hover:text-white transition-colors" onClick={() => handleAssetSort('rank')}>
                                    <div className="flex items-center gap-1">Rank <ArrowUpDown size={12} /></div>
                                </th>
                                <th className="px-2 py-3 font-medium cursor-pointer hover:text-white transition-colors" onClick={() => handleAssetSort('ticker')}>
                                    <div className="flex items-center gap-1">Ticker <ArrowUpDown size={12} /></div>
                                </th>
                                <th className="px-2 py-3 text-right font-medium cursor-pointer hover:text-white transition-colors" onClick={() => handleAssetSort('currentPrice')}>
                                    <div className="flex items-center justify-end gap-1">Price <ArrowUpDown size={12} /></div>
                                </th>
                                <th className="px-2 py-3 text-right font-medium cursor-pointer hover:text-white transition-colors" onClick={() => handleAssetSort('todayChangePercent')}>
                                    <div className="flex items-center justify-end gap-1">Day % <ArrowUpDown size={12} /></div>
                                </th>
                                <th className="px-2 py-3 text-right font-medium cursor-pointer hover:text-white transition-colors" onClick={() => handleAssetSort('averageCost')}>
                                    <div className="flex items-center justify-end gap-1">Avg Cost <ArrowUpDown size={12} /></div>
                                </th>
                                <th className="px-2 py-3 text-right font-medium cursor-pointer hover:text-white transition-colors" onClick={() => handleAssetSort('effectiveBookCost')}>
                                    <div className="flex items-center justify-end gap-1">Book <ArrowUpDown size={12} /></div>
                                </th>
                                <th className="px-2 py-3 text-right font-medium cursor-pointer hover:text-white transition-colors" onClick={() => handleAssetSort('marketValue')}>
                                    <div className="flex items-center justify-end gap-1">Value <ArrowUpDown size={12} /></div>
                                </th>
                                <th className="px-2 py-3 text-right font-medium cursor-pointer hover:text-white transition-colors" onClick={() => handleAssetSort('profit')}>
                                    <div className="flex items-center justify-end gap-1">P/L $ <ArrowUpDown size={12} /></div>
                                </th>
                                <th className="px-2 py-3 text-right font-medium cursor-pointer hover:text-white transition-colors" onClick={() => handleAssetSort('profitPercent')}>
                                    <div className="flex items-center justify-end gap-1">P/L % <ArrowUpDown size={12} /></div>
                                </th>
                                <th className="px-2 py-3 text-right font-medium cursor-pointer hover:text-white transition-colors" onClick={() => handleAssetSort('low52Week')}>
                                    <div className="flex items-center justify-end gap-1">Low <ArrowUpDown size={12} /></div>
                                </th>
                                <th className="px-2 py-3 text-right font-medium cursor-pointer hover:text-white transition-colors" onClick={() => handleAssetSort('high52Week')}>
                                    <div className="flex items-center justify-end gap-1">High <ArrowUpDown size={12} /></div>
                                </th>
                                <th className="px-2 py-3 text-right font-medium cursor-pointer hover:text-white transition-colors" onClick={() => handleAssetSort('percentTo52WeekHigh')}>
                                    <div className="flex items-center justify-end gap-1">% High <ArrowUpDown size={12} /></div>
                                </th>
                                <th className="px-2 py-3 font-medium cursor-pointer hover:text-white transition-colors" onClick={() => handleAssetSort('accountName')}>
                                    <div className="flex items-center gap-1">Account <ArrowUpDown size={12} /></div>
                                </th>
                                <th className="px-2 py-3 text-right font-medium">
                                    Action
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700 text-sm">
                            {sortedAssetPerformance.map((asset) => (
                                <tr key={asset.id} className="hover:bg-slate-700/30 transition-colors">
                                    <td className="p-2 text-white font-medium">#{asset.rank}</td>
                                    <td className="p-2 text-white font-bold">{asset.ticker}</td>
                                    <td className="p-2 text-right text-slate-300 font-medium">
                                        ${asset.currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </td>
                                    <td className={`p-2 text-right font-medium ${asset.todayChangePercent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                        {asset.todayChangePercent >= 0 ? '+' : ''}{asset.todayChangePercent.toFixed(2)}%
                                    </td>
                                    <td className="p-2 text-right text-slate-300 font-medium">
                                        ${asset.averageCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </td>
                                    <td className="p-2 text-right text-slate-300 font-medium">
                                        ${(asset.customBookCost || asset.totalCost).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </td>
                                    <td className="p-2 text-right text-white font-bold">
                                        ${asset.marketValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </td>
                                    <td className={`p-2 text-right font-bold ${asset.profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                        {asset.profit >= 0 ? '+' : '-'}${Math.abs(asset.profit).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </td>
                                    <td className={`p-2 text-right font-bold ${asset.profitPercent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                        {asset.profitPercent >= 0 ? '+' : ''}{asset.profitPercent.toFixed(2)}%
                                    </td>
                                    <td className="p-2 text-right text-slate-400">
                                        ${asset.low52Week?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '-'}
                                    </td>
                                    <td className="p-2 text-right text-slate-400">
                                        ${asset.high52Week?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '-'}
                                    </td>
                                    <td className={`p-2 text-right font-semibold ${asset.percentTo52WeekHigh >= -5 ? 'text-green-400' : 'text-slate-400'}`}>
                                        {asset.percentTo52WeekHigh.toFixed(2)}%
                                    </td>
                                    <td className="p-2 text-slate-300">{asset.accountName}</td>
                                    <td className="p-2 text-right">
                                        <Link to={`/accounts/${asset.accountId}`} className="p-2 bg-blue-500/10 text-blue-400 rounded-lg hover:bg-blue-500/20 hover:text-blue-300 transition-colors inline-block" title="View Account">
                                            <Eye size={18} />
                                        </Link>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Breakdown by Member, Institution & Account */}
            <div className="mt-12">
                <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                    <Users size={24} className="text-blue-500" /> Breakdown by Member, Institution & Account
                </h3>

                <div className="space-y-8">
                    {memberBreakdown.map((mb) => (
                        <div key={mb.member.id} className="card overflow-hidden border border-slate-700 p-0">
                            {/* Member Header */}
                            <div className="bg-slate-800/80 p-6 border-b border-slate-700 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                <div>
                                    <h4 className="text-2xl font-bold text-white mb-1">{mb.member.name}</h4>
                                    <p className="text-slate-400 text-sm">Member Overview</p>
                                </div>
                                <div className="flex flex-wrap gap-4 md:gap-8">
                                    <div>
                                        <p className="text-slate-400 text-xs uppercase mb-1">Total Cash</p>
                                        <p className="text-lg font-bold text-white tabular-nums">${mb.stats.totalCash.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                                    </div>
                                    <div>
                                        <p className="text-slate-400 text-xs uppercase mb-1">Total Book Cost</p>
                                        <p className="text-lg font-bold text-white tabular-nums">${mb.stats.totalBookCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                                    </div>
                                    <div>
                                        <p className="text-slate-400 text-xs uppercase mb-1">Total Market Value</p>
                                        <p className="text-lg font-bold text-white tabular-nums">${mb.stats.totalMarketValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                                    </div>
                                    <div>
                                        <p className="text-slate-400 text-xs uppercase mb-1">Total Profit</p>
                                        <div className="flex items-center gap-2">
                                            <p className={`text-lg font-bold tabular-nums ${mb.stats.totalProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                {mb.stats.totalProfit >= 0 ? '+' : '-'}${Math.abs(mb.stats.totalProfit).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </p>
                                            <span className={`text-sm font-bold ${mb.stats.totalProfitPercent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                ({mb.stats.totalProfitPercent >= 0 ? '+' : ''}{mb.stats.totalProfitPercent.toFixed(2)}%)
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Groups */}
                            <div className="p-6 space-y-8 bg-slate-900/40">
                                {mb.institutionGroups.map((group) => (
                                    <div key={group.institution.id} className="space-y-6">
                                        {group.accounts.map((accGroup) => (
                                            <div key={accGroup.account.id} className="bg-slate-900 rounded-xl overflow-hidden border border-slate-800">
                                                {/* Account Header */}
                                                <div className="px-6 py-4 bg-slate-800/50 border-b border-slate-700/50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="p-2 bg-slate-700/50 rounded-lg">
                                                            <Wallet size={18} className="text-blue-400" />
                                                        </div>
                                                        <div>
                                                            <h5 className="font-bold text-white">{group.institution.name}</h5>
                                                            <p className="text-slate-400 text-sm">{accGroup.account.name}</p>
                                                        </div>
                                                    </div>
                                                    <div className="flex gap-6 text-sm">
                                                        <div>
                                                            <span className="text-slate-500 mr-2">Cash:</span>
                                                            <span className="text-white tabular-nums font-mono">${accGroup.account.cashBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                                        </div>
                                                        <div>
                                                            <span className="text-slate-500 mr-2">Book:</span>
                                                            <span className="text-slate-300 tabular-nums">${accGroup.stats.bookCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                                        </div>
                                                        <div>
                                                            <span className="text-slate-500 mr-2">Value:</span>
                                                            <span className="text-white font-bold tabular-nums">${accGroup.stats.marketValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                                        </div>
                                                        <div>
                                                            <span className="text-slate-500 mr-2">P/L:</span>
                                                            <span className={`font-bold tabular-nums ${accGroup.stats.profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                                {accGroup.stats.profit >= 0 ? '+' : '-'}${Math.abs(accGroup.stats.profit).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                            </span>
                                                        </div>
                                                        <div>
                                                            <span className="text-slate-500 mr-2">P/L %:</span>
                                                            <span className={`font-bold tabular-nums ${accGroup.stats.profitPercent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                                {accGroup.stats.profitPercent >= 0 ? '+' : ''}{accGroup.stats.profitPercent.toFixed(2)}%
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Table */}
                                                <div className="overflow-x-auto">
                                                    <table className="w-full text-left border-collapse">
                                                        <thead>
                                                            <tr className="text-slate-400 border-b border-slate-700/50 text-xs uppercase whitespace-nowrap bg-slate-800/20">
                                                                <th className="px-4 py-3 font-medium">Ticker</th>
                                                                <th className="px-4 py-3 text-right font-medium">Shares</th>
                                                                <th className="px-4 py-3 text-right font-medium">Price</th>
                                                                <th className="px-4 py-3 text-right font-medium">Avg Cost</th>
                                                                <th className="px-4 py-3 text-right font-medium">Book</th>
                                                                <th className="px-4 py-3 text-right font-medium">Value</th>
                                                                <th className="px-4 py-3 text-right font-medium">P/L $</th>
                                                                <th className="px-4 py-3 text-right font-medium">P/L %</th>
                                                                <th className="px-4 py-3 text-right font-medium">Low</th>
                                                                <th className="px-4 py-3 text-right font-medium">High</th>
                                                                <th className="px-4 py-3 text-right font-medium">% High</th>
                                                                <th className="px-4 py-3 font-medium">Account</th>
                                                                <th className="px-4 py-3 text-right font-medium">Action</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-slate-800 text-sm">
                                                            {accGroup.assets.map((asset) => (
                                                                <tr key={asset.id} className="hover:bg-slate-800/50 transition-colors">
                                                                    <td className="px-4 py-2 text-white font-bold">{asset.ticker}</td>
                                                                    <td className="px-4 py-2 text-right text-slate-300 tabular-nums">{asset.quantity}</td>
                                                                    <td className="px-4 py-2 text-right text-slate-300 font-medium tabular-nums">${asset.currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                                                    <td className="px-4 py-2 text-right text-slate-300 font-medium tabular-nums">${asset.averageCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                                                    <td className="px-4 py-2 text-right text-slate-300 font-medium tabular-nums">${(asset.customBookCost || asset.totalCost).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                                                    <td className="px-4 py-2 text-right text-white font-bold tabular-nums">${asset.marketValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                                                    <td className={`px-4 py-2 text-right font-bold tabular-nums ${asset.profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                                        {asset.profit >= 0 ? '+' : '-'}${Math.abs(asset.profit).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                    </td>
                                                                    <td className={`px-4 py-2 text-right font-bold tabular-nums ${asset.profitPercent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                                        {asset.profitPercent >= 0 ? '+' : ''}{asset.profitPercent.toFixed(2)}%
                                                                    </td>
                                                                    <td className="px-4 py-2 text-right text-slate-400 tabular-nums">${asset.low52Week?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '-'}</td>
                                                                    <td className="px-4 py-2 text-right text-slate-400 tabular-nums">${asset.high52Week?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '-'}</td>
                                                                    <td className={`px-4 py-2 text-right font-semibold tabular-nums ${asset.percentTo52WeekHigh >= -5 ? 'text-green-400' : 'text-slate-400'}`}>
                                                                        {asset.percentTo52WeekHigh.toFixed(2)}%
                                                                    </td>
                                                                    <td className="px-4 py-2 text-slate-400 text-xs">{accGroup.account.name}</td>
                                                                    <td className="px-4 py-2 text-right">
                                                                        <div className="flex items-center justify-end gap-2">
                                                                            <Link to={`/accounts/${asset.accountId}`} className="p-1.5 bg-blue-500/10 text-blue-400 rounded hover:bg-blue-500/20 hover:text-blue-300 transition-colors" title="View Account">
                                                                                <Eye size={16} />
                                                                            </Link>
                                                                            <button className="p-1.5 bg-slate-700/50 text-slate-400 rounded hover:bg-slate-700 hover:text-slate-200 transition-colors" title="Manage Asset">
                                                                                <Settings size={16} />
                                                                            </button>
                                                                        </div>
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div >
    );
};

export default Dashboard;
