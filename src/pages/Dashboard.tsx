import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { useTheme } from '../context/ThemeContext';
import {
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    Tooltip,
    AreaChart,
    Area,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
} from 'recharts';
import {
    DollarSign,
    TrendingUp,
    TrendingDown,
    Users,
    Wallet,
    Award,
    AlertTriangle,
    ArrowUpDown,
    Eye,
    Pencil,
    Check,
    X,
    RefreshCw,
    Layers,
    ArrowRightLeft,
    LayoutDashboard,
    Building2,
    Sparkles,
    Plus,
    Upload,
} from 'lucide-react';
import EventsTable from '../components/EventsTable';
import CurrencyMigrationModal from '../components/CurrencyMigrationModal';
import type { Asset } from '../types';
import '../styles/shared.css';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#6366f1'];

type AssetWithMeta = Asset & {
    accountName: string;
    memberName: string;
    percentTo52WeekHigh: number;
};

interface ChartTheme {
    tickColor: string;
    gridColor: string;
    tooltipStyle: React.CSSProperties;
    tooltipItemStyle: React.CSSProperties;
    tooltipLabelStyle: React.CSSProperties;
    cursorFill: string;
    cursorStroke: string;
}

interface PerformerCardProps {
    title: string;
    mode: 'positive' | 'negative';
    badgeMode: 'percent' | 'dollar';
    asset: AssetWithMeta;
    gradientId: string;
    chartTheme: ChartTheme;
}

const fmt2 = (val: number) =>
    val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const PerformerCard: React.FC<PerformerCardProps> = ({
    title,
    mode,
    badgeMode,
    asset,
    gradientId,
    chartTheme,
}) => {
    const isPosMode = mode === 'positive';
    const badgeVal = badgeMode === 'percent' ? asset.profitPercent : asset.profit;
    const isBadgePos = badgeVal >= 0;
    const strokeColor = isPosMode ? '#10b981' : '#ef4444';

    const footerLabel = badgeMode === 'percent' ? 'Total Profit/Loss' : 'Total Return (%)';
    const footerVal = badgeMode === 'percent' ? asset.profit : asset.profitPercent;
    const isFooterPos = footerVal >= 0;

    return (
        <div className="bg-slate-800/95 border border-slate-700/90 rounded-2xl p-6 shadow-xl flex flex-col justify-between gap-4">
            <div>
                <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1.5">
                            {isPosMode ? (
                                <Award size={18} className="text-green-400 shrink-0" />
                            ) : (
                                <AlertTriangle size={18} className="text-red-400 shrink-0" />
                            )}
                            <h3 className={`text-sm font-bold uppercase tracking-wider ${isPosMode ? 'text-green-400' : 'text-red-400'}`}>
                                {title}
                            </h3>
                        </div>
                        <h4 className="text-xl sm:text-2xl font-bold text-white truncate">
                            {asset.name || asset.ticker}
                        </h4>
                        <p className="text-slate-300 text-xs sm:text-sm mt-0.5 truncate">
                            <span className="font-mono font-bold text-white">{asset.ticker}</span> • {asset.accountName} ({asset.memberName})
                        </p>
                    </div>

                    <div
                        className={`px-3 py-1.5 rounded-xl border font-mono tabular-nums font-bold text-base shrink-0 ${
                            isBadgePos
                                ? 'bg-green-500/15 border-green-500/35 text-green-400'
                                : 'bg-red-500/15 border-red-500/35 text-red-400'
                        }`}
                    >
                        {badgeMode === 'percent'
                            ? `${isBadgePos ? '+' : ''}${badgeVal.toFixed(2)}%`
                            : `${isBadgePos ? '+' : '-'}$${fmt2(Math.abs(badgeVal))}`}
                    </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-900/65 border border-slate-700/70 rounded-xl p-3.5">
                    <div>
                        <p className="text-slate-400 text-xs font-semibold uppercase mb-0.5">Current Price</p>
                        <p className="text-sm sm:text-base font-mono tabular-nums font-bold text-white">
                            ${fmt2(asset.currentPrice)}
                        </p>
                    </div>
                    <div>
                        <p className="text-slate-400 text-xs font-semibold uppercase mb-0.5">Shares</p>
                        <p className="text-sm sm:text-base font-mono tabular-nums font-bold text-white">
                            {asset.quantity.toLocaleString()}
                        </p>
                    </div>
                    <div>
                        <p className="text-slate-400 text-xs font-semibold uppercase mb-0.5">Cost / Share</p>
                        <p className="text-sm sm:text-base font-mono tabular-nums font-bold text-white">
                            ${fmt2(asset.averageCost)}
                        </p>
                    </div>
                    <div>
                        <p className="text-slate-400 text-xs font-semibold uppercase mb-0.5">Market Value</p>
                        <p className="text-sm sm:text-base font-mono tabular-nums font-bold text-white">
                            ${fmt2(asset.marketValue)}
                        </p>
                    </div>
                    <div>
                        <p className="text-slate-400 text-xs font-semibold uppercase mb-0.5">Book Cost</p>
                        <p className="text-sm sm:text-base font-mono tabular-nums font-bold text-white">
                            ${fmt2(asset.customBookCost || asset.totalCost)}
                        </p>
                    </div>
                    <div>
                        <p className="text-slate-400 text-xs font-semibold uppercase mb-0.5">52W Low</p>
                        <p className="text-sm font-mono tabular-nums font-semibold text-slate-300">
                            {asset.low52Week ? `$${fmt2(asset.low52Week)}` : '—'}
                        </p>
                    </div>
                    <div>
                        <p className="text-slate-400 text-xs font-semibold uppercase mb-0.5">52W High</p>
                        <p className="text-sm font-mono tabular-nums font-semibold text-slate-300">
                            {asset.high52Week ? `$${fmt2(asset.high52Week)}` : '—'}
                        </p>
                    </div>
                    <div>
                        <p className="text-slate-400 text-xs font-semibold uppercase mb-0.5">% to 52W High</p>
                        <p
                            className={`text-sm font-mono tabular-nums font-bold ${
                                asset.percentTo52WeekHigh >= 0 ? 'text-green-400' : 'text-red-400'
                            }`}
                        >
                            {asset.percentTo52WeekHigh >= 0 ? '+' : ''}
                            {asset.percentTo52WeekHigh.toFixed(2)}%
                        </p>
                    </div>
                </div>
            </div>

            <div className="space-y-3">
                <div className="pt-3 border-t border-slate-700/70 flex justify-between items-center">
                    <span className="text-slate-300 text-xs font-bold uppercase tracking-wider">{footerLabel}</span>
                    <span
                        className={`text-lg font-mono tabular-nums font-bold ${
                            isFooterPos ? 'text-green-400' : 'text-red-400'
                        }`}
                    >
                        {badgeMode === 'percent'
                            ? `${isFooterPos ? '+' : '-'}$${fmt2(Math.abs(footerVal))}`
                            : `${isFooterPos ? '+' : ''}${footerVal.toFixed(2)}%`}
                    </span>
                </div>

                {asset.sparkline && asset.sparkline.length > 0 && (
                    <div className="bg-slate-900/50 border border-slate-700/60 rounded-xl p-2.5">
                        <p className="text-xs text-slate-300 font-semibold uppercase tracking-wider mb-1 text-right">
                            1 Year Trend
                        </p>
                        <div className="h-20">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={asset.sparkline}>
                                    <defs>
                                        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor={strokeColor} stopOpacity={0.32} />
                                            <stop offset="95%" stopColor={strokeColor} stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <Tooltip
                                        contentStyle={chartTheme.tooltipStyle}
                                        itemStyle={chartTheme.tooltipItemStyle}
                                        formatter={(value) => [`$${fmt2(Number(value))}`, 'Price']}
                                        labelStyle={{ display: 'none' }}
                                        cursor={{ stroke: chartTheme.cursorStroke, strokeWidth: 1 }}
                                    />
                                    <YAxis domain={['auto', 'auto']} hide />
                                    <Area
                                        type="monotone"
                                        dataKey="price"
                                        stroke={strokeColor}
                                        strokeWidth={2}
                                        fill={`url(#${gradientId})`}
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

interface AllocationDonutCardProps {
    title: string;
    icon: React.ReactNode;
    data: { name: string; value: number }[];
    centerTotal?: number;
    chartTheme: ChartTheme;
}

const AllocationDonutCard: React.FC<AllocationDonutCardProps> = ({
    title,
    icon,
    data,
    centerTotal,
    chartTheme,
}) => (
    <div className="bg-slate-800/95 border border-slate-700/90 rounded-2xl p-6 shadow-xl h-[410px] flex flex-col">
        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2.5 pb-3 border-b border-slate-700/70">
            {icon}
            <span>{title}</span>
        </h3>
        {data.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-slate-300 text-sm">
                No allocation data available
            </div>
        ) : (
            <>
                <div className="flex-1 w-full relative min-h-0">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={data}
                                cx="50%"
                                cy="50%"
                                innerRadius={76}
                                outerRadius={112}
                                paddingAngle={4}
                                dataKey="value"
                                stroke="none"
                            >
                                {data.map((_entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip
                                formatter={(value) => `$${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`}
                                contentStyle={chartTheme.tooltipStyle}
                                itemStyle={chartTheme.tooltipItemStyle}
                            />
                        </PieChart>
                    </ResponsiveContainer>
                    {centerTotal !== undefined && (
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
                            <p className="text-slate-300 text-xs uppercase font-bold tracking-wider">Total</p>
                            <p className="text-xl font-bold font-mono tabular-nums text-white">
                                ${centerTotal.toLocaleString(undefined, { notation: 'compact', maximumFractionDigits: 1 })}
                            </p>
                        </div>
                    )}
                </div>
                <div className="flex justify-center flex-wrap gap-x-4 gap-y-2 pt-3 border-t border-slate-700/60">
                    {data.map((entry, index) => (
                        <div key={entry.name} className="flex items-center gap-2 text-xs font-semibold text-slate-200">
                            <span
                                className="w-2.5 h-2.5 rounded-full shrink-0"
                                style={{ backgroundColor: COLORS[index % COLORS.length] }}
                            />
                            <span>{entry.name}</span>
                        </div>
                    ))}
                </div>
            </>
        )}
    </div>
);

const Dashboard = () => {
    const {
        assets,
        accounts,
        members,
        institutions,
        refreshPrices,
        netWorthHistory,
        lastUpdated,
        transactions,
        isDemoData,
        loadDemoData
    } = useData();
    const { theme } = useTheme();
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [showMigrationModal, setShowMigrationModal] = useState(false);

    const isDark = theme === 'dark';
    const chartTheme: ChartTheme = {
        tickColor: isDark ? '#94a3b8' : '#475569',
        gridColor: isDark ? 'rgba(148, 163, 184, 0.14)' : 'rgba(15, 23, 42, 0.08)',
        tooltipStyle: {
            backgroundColor: isDark ? '#0f172a' : '#ffffff',
            borderColor: isDark ? '#334155' : '#cbd5e1',
            borderRadius: '0.75rem',
            color: isDark ? '#f8fafc' : '#0f172a',
            fontSize: '12px',
            padding: '8px 12px',
            boxShadow: '0 10px 25px -5px rgba(0,0,0,0.25)',
        },
        tooltipItemStyle: {
            color: isDark ? '#f8fafc' : '#0f172a',
            fontWeight: 700,
            fontFamily: 'monospace',
        },
        tooltipLabelStyle: {
            color: isDark ? '#cbd5e1' : '#475569',
            fontWeight: 600,
            marginBottom: '2px',
        },
        cursorFill: isDark ? 'rgba(148, 163, 184, 0.12)' : 'rgba(15, 23, 42, 0.06)',
        cursorStroke: isDark ? '#64748b' : '#94a3b8',
    };

    const handleRefresh = async () => {
        setIsRefreshing(true);
        await refreshPrices();
        setIsRefreshing(false);
    };

    // 1. Global Metrics
    const totalValue =
        assets.reduce((sum, a) => sum + (a.cadMarketValue || a.marketValue || 0), 0) +
        accounts.reduce((sum, a) => sum + a.cashBalance, 0);

    const totalInvested = assets.reduce((sum, a) => sum + (a.cadTotalCost || a.totalCost || 0), 0);
    const totalProfit = assets.reduce(
        (sum, a) => sum + ((a.cadMarketValue || a.marketValue || 0) - (a.cadTotalCost || a.totalCost || 0)),
        0
    );
    const totalProfitPercent = totalInvested > 0 ? (totalProfit / totalInvested) * 100 : 0;
    const totalCash = accounts.reduce((sum, a) => sum + a.cashBalance, 0);

    // 2. Breakdowns for Pie Charts
    const allocationByPerson = members
        .map(member => {
            const memberAccounts = accounts.filter(a => a.memberId === member.id);
            const memberAssets = assets.filter(a => memberAccounts.find(acc => acc.id === a.accountId));
            const value =
                memberAssets.reduce((sum, a) => sum + (a.cadMarketValue || a.marketValue || 0), 0) +
                memberAccounts.reduce((sum, a) => sum + a.cashBalance, 0);
            return { name: member.name, value };
        })
        .filter(d => d.value > 0);

    const accountTypes = Array.from(new Set(accounts.map(a => a.type)));
    const allocationByAccountType = accountTypes
        .map(type => {
            const typeAccounts = accounts.filter(a => a.type === type);
            const typeAssets = assets.filter(a => typeAccounts.find(acc => acc.id === a.accountId));
            const value =
                typeAssets.reduce((sum, a) => sum + (a.cadMarketValue || a.marketValue || 0), 0) +
                typeAccounts.reduce((sum, a) => sum + a.cashBalance, 0);
            return { name: type, value };
        })
        .filter(d => d.value > 0);

    const allocationByInstitution = institutions
        .map(inst => {
            const instAccounts = accounts.filter(a => a.institutionId === inst.id);
            const instAssets = assets.filter(a => instAccounts.find(acc => acc.id === a.accountId));
            const value =
                instAssets.reduce((sum, a) => sum + (a.cadMarketValue || a.marketValue || 0), 0) +
                instAccounts.reduce((sum, a) => sum + a.cashBalance, 0);
            return { name: inst.name, value };
        })
        .filter(d => d.value > 0);

    // 3. Member Details
    const currentYear = new Date().getFullYear().toString();

    const memberDetails = members.map(member => {
        const memberAccounts = accounts.filter(a => a.memberId === member.id);
        const memberAssets = assets.filter(a => memberAccounts.find(acc => acc.id === a.accountId));
        const memberTransactions = transactions.filter(t => memberAccounts.find(acc => acc.id === t.accountId));
        const currentYearTransactions = memberTransactions.filter(t => t.date.startsWith(currentYear));

        const depositedThisYear = currentYearTransactions
            .filter(t => t.type === 'Deposit')
            .reduce((sum, t) => sum + t.amount, 0);

        const withdrawnThisYear = currentYearTransactions
            .filter(t => t.type === 'Withdrawal')
            .reduce((sum, t) => sum + t.amount, 0);

        const depositedTfsaThisYear = currentYearTransactions
            .filter(t => {
                if (t.type !== 'Deposit') return false;
                const account = memberAccounts.find(acc => acc.id === t.accountId);
                return account && account.type === 'TFSA';
            })
            .reduce((sum, t) => sum + t.amount, 0);

        const totalWorth =
            memberAssets.reduce((sum, a) => sum + (a.cadMarketValue || a.marketValue || 0), 0) +
            memberAccounts.reduce((sum, a) => sum + a.cashBalance, 0);
        const invested = memberAssets.reduce((sum, a) => sum + a.totalCost, 0);
        const profit = memberAssets.reduce((sum, a) => sum + ((a.cadMarketValue || a.marketValue || 0) - a.totalCost), 0);
        const profitPercent = invested > 0 ? (profit / invested) * 100 : 0;
        const cash = memberAccounts.reduce((sum, a) => sum + a.cashBalance, 0);

        return {
            id: member.id,
            name: member.name,
            totalWorth,
            invested,
            profit,
            profitPercent,
            cash,
            depositedThisYear,
            withdrawnThisYear,
            depositedTfsaThisYear,
        };
    });

    // 4. Best & Worst Performing Assets
    const assetsWithAccountInfo: AssetWithMeta[] = assets.map(asset => {
        const account = accounts.find(acc => acc.id === asset.accountId);
        const member = members.find(m => m.id === account?.memberId);
        const percentTo52WeekHigh =
            asset.high52Week && asset.high52Week !== 0
                ? ((asset.currentPrice - asset.high52Week) / asset.high52Week) * 100
                : 0;

        return {
            ...asset,
            accountName: account?.name || 'Unknown',
            memberName: member?.name || 'Unknown',
            percentTo52WeekHigh,
        };
    });

    const sortedByPerformance = [...assetsWithAccountInfo].sort((a, b) => b.profitPercent - a.profitPercent);
    const bestPerformer = sortedByPerformance[0];
    const worstPerformer = sortedByPerformance[sortedByPerformance.length - 1];

    const sortedByProfitDollar = [...assetsWithAccountInfo].sort((a, b) => b.profit - a.profit);
    const highestGainerDollar = sortedByProfitDollar[0];
    const lowestGainerDollar = sortedByProfitDollar[sortedByProfitDollar.length - 1];

    const top5AssetsPercent = [...assetsWithAccountInfo]
        .sort((a, b) => b.profitPercent - a.profitPercent)
        .slice(0, 5)
        .map(a => ({ name: `${a.ticker} (${a.accountName})`, value: a.profitPercent, ...a }));

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

    const totalBasis = totalInvested + accounts.reduce((sum, a) => sum + a.cashBalance, 0);
    const isPositivePerformance = totalValue >= totalBasis;
    const gaugeColor = isPositivePerformance ? 'from-blue-500 to-green-400' : 'from-red-600 to-red-400';
    const goalProgressPct = financialGoal > 0 ? Math.min(100, Math.max(0, (totalValue / financialGoal) * 100)) : 0;

    const baseAccountPerformance = accounts.map(account => {
        const accountAssets = assets.filter(a => a.accountId === account.id);
        const member = members.find(m => m.id === account.memberId);
        const institution = institutions.find(i => i.id === account.institutionId);

        const bookCost = accountAssets.reduce((sum, a) => sum + (a.cadTotalCost || a.totalCost || 0), 0);
        const marketValue = accountAssets.reduce((sum, a) => sum + (a.cadMarketValue || a.marketValue || 0), 0);
        const profitDollar = marketValue - bookCost;
        const profitPercent = bookCost > 0 ? (profitDollar / bookCost) * 100 : 0;

        return {
            rank: 0,
            accountId: account.id,
            accountName: account.name,
            memberName: member?.name || 'Unknown',
            institutionName: institution?.name || 'Unknown',
            bookCost,
            marketValue,
            profitDollar,
            profitPercent,
        };
    });

    const rankedAccountPerformance: AccountPerformance[] = [...baseAccountPerformance]
        .sort((a, b) => b.profitPercent - a.profitPercent)
        .map((item, index) => ({ ...item, rank: index + 1 }));

    const sortedAccountPerformance = [...rankedAccountPerformance].sort((a, b) => {
        const aVal = a[sortField];
        const bVal = b[sortField];

        if (typeof aVal === 'string' && typeof bVal === 'string') {
            return sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
        }

        return sortDirection === 'asc' ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    });

    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection(
                field === 'rank' ||
                    field === 'profitPercent' ||
                    field === 'profitDollar' ||
                    field === 'bookCost' ||
                    field === 'marketValue'
                    ? 'desc'
                    : 'asc'
            );
        }
    };

    // 7. Asset Performance Data for Table
    type AssetPerformance = AssetWithMeta & { rank: number; effectiveBookCost: number };
    type AssetSortField = keyof AssetPerformance;

    const [assetSortField, setAssetSortField] = useState<AssetSortField>('profitPercent');
    const [assetSortDirection, setAssetSortDirection] = useState<SortDirection>('desc');

    const rankedAssetPerformance: AssetPerformance[] = [...assetsWithAccountInfo]
        .sort((a, b) => b.profitPercent - a.profitPercent)
        .map((item, index) => ({
            ...item,
            rank: index + 1,
            effectiveBookCost: item.customBookCost || item.totalCost,
        }));

    const sortedAssetPerformance = [...rankedAssetPerformance].sort((a, b) => {
        const aVal = a[assetSortField];
        const bVal = b[assetSortField];

        if (typeof aVal === 'string' && typeof bVal === 'string') {
            return assetSortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
        }

        const numA = typeof aVal === 'number' ? aVal : 0;
        const numB = typeof bVal === 'number' ? bVal : 0;

        return assetSortDirection === 'asc' ? numA - numB : numB - numA;
    });

    const handleAssetSort = (field: AssetSortField) => {
        if (assetSortField === field) {
            setAssetSortDirection(assetSortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setAssetSortField(field);
            setAssetSortDirection(field === 'ticker' || field === 'accountName' ? 'asc' : 'desc');
        }
    };

    // 8. Breakdown by Member, Institution & Account
    const memberBreakdown = members
        .map(member => {
            const memberAccounts = accounts.filter(a => a.memberId === member.id);
            const memberAssets = assetsWithAccountInfo.filter(a => memberAccounts.some(acc => acc.id === a.accountId));

            const institutionGroups = institutions
                .map(inst => {
                    const instAccounts = memberAccounts.filter(acc => acc.institutionId === inst.id);
                    if (instAccounts.length === 0) return null;

                    return {
                        institution: inst,
                        accounts: instAccounts
                            .map(account => {
                                const accountAssets = memberAssets.filter(a => a.accountId === account.id);

                                const bookCost = accountAssets.reduce(
                                    (sum, a) => sum + (a.customBookCost || a.totalCost),
                                    0
                                );
                                const marketValue = accountAssets.reduce(
                                    (sum, a) => sum + (a.cadMarketValue || a.marketValue || 0),
                                    0
                                );
                                const profit = marketValue - bookCost;
                                const profitPercent = bookCost > 0 ? (profit / bookCost) * 100 : 0;

                                return {
                                    account,
                                    assets: accountAssets,
                                    stats: { bookCost, marketValue, profit, profitPercent },
                                };
                            })
                            .filter((g): g is NonNullable<typeof g> => g !== null),
                    };
                })
                .filter((g): g is NonNullable<typeof g> => g !== null && g.accounts.length > 0);

            const totalBookCost = memberAssets.reduce((sum, a) => sum + (a.customBookCost || a.totalCost), 0);
            const totalMarketValue = memberAssets.reduce(
                (sum, a) => sum + (a.cadMarketValue || a.marketValue || 0),
                0
            );
            const totalProfit = totalMarketValue - totalBookCost;
            const totalProfitPercent = totalBookCost > 0 ? (totalProfit / totalBookCost) * 100 : 0;
            const totalCash = memberAccounts.reduce((sum, a) => sum + a.cashBalance, 0);

            return {
                member,
                stats: { totalBookCost, totalMarketValue, totalProfit, totalProfitPercent, totalCash },
                institutionGroups,
            };
        })
        .filter(m => m.institutionGroups.length > 0 && m.institutionGroups.some(g => g.accounts.length > 0));

    // 9. Aggregated Stocks
    const aggregatedStocksMap = new Map<
        string,
        {
            ticker: string;
            totalShares: number;
            totalInvested: number;
            totalMarketValue: number;
            accounts: Set<string>;
            currency: string;
        }
    >();

    assetsWithAccountInfo.forEach(asset => {
        const existing = aggregatedStocksMap.get(asset.ticker);
        if (existing) {
            existing.totalShares += asset.quantity;
            existing.totalInvested += asset.cadTotalCost || asset.totalCost || 0;
            existing.totalMarketValue += asset.cadMarketValue || asset.marketValue || 0;
            existing.accounts.add(asset.accountName);
        } else {
            aggregatedStocksMap.set(asset.ticker, {
                ticker: asset.ticker,
                totalShares: asset.quantity,
                totalInvested: asset.cadTotalCost || asset.totalCost || 0,
                totalMarketValue: asset.cadMarketValue || asset.marketValue || 0,
                accounts: new Set([asset.accountName]),
                currency: asset.currency || 'CAD',
            });
        }
    });

    const unsortedAggregatedStocks = Array.from(aggregatedStocksMap.values()).map(stock => {
        const profit = stock.totalMarketValue - stock.totalInvested;
        const profitPercent = stock.totalInvested > 0 ? (profit / stock.totalInvested) * 100 : 0;
        return {
            ...stock,
            profit,
            profitPercent,
            accountsList: Array.from(stock.accounts).join(', '),
        };
    });

    type AggregatedSortField = keyof (typeof unsortedAggregatedStocks)[0];
    const [aggregatedSortField, setAggregatedSortField] = useState<AggregatedSortField>('totalInvested');
    const [aggregatedSortDirection, setAggregatedSortDirection] = useState<SortDirection>('desc');

    const aggregatedStocks = [...unsortedAggregatedStocks].sort((a, b) => {
        const aVal = a[aggregatedSortField];
        const bVal = b[aggregatedSortField];

        if (typeof aVal === 'string' && typeof bVal === 'string') {
            return aggregatedSortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
        }

        const numA = typeof aVal === 'number' ? aVal : 0;
        const numB = typeof bVal === 'number' ? bVal : 0;

        return aggregatedSortDirection === 'asc' ? numA - numB : numB - numA;
    });

    const handleAggregatedSort = (field: AggregatedSortField) => {
        if (aggregatedSortField === field) {
            setAggregatedSortDirection(aggregatedSortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setAggregatedSortField(field);
            setAggregatedSortDirection(field === 'ticker' || field === 'accountsList' ? 'asc' : 'desc');
        }
    };

    // 6. Portfolio History
    const sortedHistory = [...netWorthHistory].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    const portfolioHistory = sortedHistory.map(entry => ({
        name: entry.date,
        value: entry.value,
    }));

    if (portfolioHistory.length === 0 && totalValue > 0) {
        const today = new Date().toISOString().split('T')[0];
        portfolioHistory.push({ name: today, value: totalValue });
    }

    return (
        <div className="space-y-8">
            {/* Page Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                    <div className="p-3 bg-blue-500/15 rounded-2xl border border-blue-500/35 text-blue-400 shadow-sm">
                        <LayoutDashboard size={24} />
                    </div>
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Dashboard</h1>
                        <p className="text-sm text-slate-300 mt-0.5">
                            Household portfolio summary, account rankings &amp; asset performance
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    {lastUpdated && (
                        <span className="text-xs font-medium text-slate-300 bg-slate-800/90 border border-slate-700/80 px-3 py-1.5 rounded-xl">
                            Updated {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                    )}
                    <button
                        onClick={handleRefresh}
                        disabled={isRefreshing}
                        style={{ color: '#ffffff' }}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-xl text-sm font-semibold shadow-sm transition-colors"
                    >
                        <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />
                        <span>{isRefreshing ? 'Refreshing...' : 'Refresh Prices'}</span>
                    </button>
                    <button
                        onClick={() => setShowMigrationModal(true)}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-750 text-slate-200 hover:text-white rounded-xl text-sm font-semibold transition-colors border border-slate-700 hover:border-slate-500"
                        title="Migrate CAD asset to USD"
                    >
                        <ArrowRightLeft size={16} />
                        <span>Migrate Currency</span>
                    </button>
                </div>
            </div>

            {/* Empty State / Welcome Hero Card */}
            {members.length === 0 && accounts.length === 0 && !isDemoData && (
                <div className="rounded-3xl p-6 sm:p-8 bg-gradient-to-r from-blue-600/20 via-indigo-600/15 to-purple-600/15 border border-blue-500/30 shadow-2xl">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                        <div className="space-y-1.5 max-w-2xl">
                            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/20 border border-blue-500/35 text-blue-300 text-xs font-bold uppercase tracking-wider">
                                <Sparkles size={13} /> Clean Slate Ready
                            </div>
                            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                                Start Your Household Portfolio or Try Demo Mode
                            </h2>
                            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                                Welcome! Your tracker is currently blank. You can set up your first member and accounts in Settings, import statement CSVs, or test-drive all charts and calculators with sample demo data.
                            </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 shrink-0">
                            <button
                                onClick={loadDemoData}
                                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs shadow-md transition-all"
                            >
                                <Sparkles size={15} /> Try Demo Data
                            </button>
                            <Link
                                to="/settings"
                                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md transition-all"
                            >
                                <Users size={15} /> Configure in Settings
                            </Link>
                        </div>
                    </div>
                </div>
            )}

            {/* Newly Created Accounts / Ready to Populate Banner */}
            {accounts.length > 0 && assets.length === 0 && !isDemoData && (
                <div className="rounded-3xl p-6 sm:p-8 bg-gradient-to-r from-blue-600/20 via-indigo-600/15 to-purple-600/15 border border-blue-500/30 shadow-2xl">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                        <div className="space-y-1.5 max-w-2xl">
                            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/35 text-emerald-300 text-xs font-bold uppercase tracking-wider">
                                <Sparkles size={13} /> Account Ready
                            </div>
                            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                                Ready to Add Your First Holdings
                            </h2>
                            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                                Your account <span className="text-white font-semibold">{accounts[0]?.name}</span> is set up. Next, import statements from your brokerage or add your first stock or ETF holding.
                            </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 shrink-0">
                            <Link
                                to={`/accounts/${accounts[0]?.id}`}
                                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md transition-all"
                            >
                                <Plus size={15} /> Go to {accounts[0]?.name} &amp; Add Holding
                            </Link>
                            <Link
                                to="/settings"
                                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 hover:text-white font-bold text-xs shadow-md transition-all"
                            >
                                <Users size={15} /> Manage Household in Settings
                            </Link>
                        </div>
                    </div>
                </div>
            )}

            {/* Global Overview Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                <div className="bg-slate-800/95 border border-slate-700/90 rounded-2xl p-5 shadow-xl">
                    <div className="flex justify-between items-start gap-2">
                        <div>
                            <p className="text-slate-300 text-xs font-bold uppercase tracking-wider">Net Worth</p>
                            <h2 className="text-2xl sm:text-3xl font-bold font-mono tabular-nums text-white mt-2">
                                ${fmt2(totalValue)}
                            </h2>
                        </div>
                        <div className="p-2.5 bg-blue-500/15 border border-blue-500/30 rounded-xl text-blue-400 shrink-0">
                            <DollarSign size={20} />
                        </div>
                    </div>
                </div>

                <div className="bg-slate-800/95 border border-slate-700/90 rounded-2xl p-5 shadow-xl">
                    <div className="flex justify-between items-start gap-2">
                        <div>
                            <p className="text-slate-300 text-xs font-bold uppercase tracking-wider">Total Invested</p>
                            <h2 className="text-2xl sm:text-3xl font-bold font-mono tabular-nums text-white mt-2">
                                ${fmt2(totalInvested)}
                            </h2>
                        </div>
                        <div className="p-2.5 bg-purple-500/15 border border-purple-500/30 rounded-xl text-purple-400 shrink-0">
                            <Wallet size={20} />
                        </div>
                    </div>
                </div>

                <div className="bg-slate-800/95 border border-slate-700/90 rounded-2xl p-5 shadow-xl">
                    <div className="flex justify-between items-start gap-2">
                        <div>
                            <p className="text-slate-300 text-xs font-bold uppercase tracking-wider">Total Profit ($)</p>
                            <h2
                                className={`text-2xl sm:text-3xl font-bold font-mono tabular-nums mt-2 ${
                                    totalProfit >= 0 ? 'text-green-400' : 'text-red-400'
                                }`}
                            >
                                {totalProfit >= 0 ? '+' : '-'}${fmt2(Math.abs(totalProfit))}
                            </h2>
                        </div>
                        <div
                            className={`p-2.5 rounded-xl border shrink-0 ${
                                totalProfit >= 0
                                    ? 'bg-green-500/15 border-green-500/30 text-green-400'
                                    : 'bg-red-500/15 border-red-500/30 text-red-400'
                            }`}
                        >
                            <DollarSign size={20} />
                        </div>
                    </div>
                </div>

                <div className="bg-slate-800/95 border border-slate-700/90 rounded-2xl p-5 shadow-xl">
                    <div className="flex justify-between items-start gap-2">
                        <div>
                            <p className="text-slate-300 text-xs font-bold uppercase tracking-wider">Total Profit (%)</p>
                            <h2
                                className={`text-2xl sm:text-3xl font-bold font-mono tabular-nums mt-2 ${
                                    totalProfitPercent >= 0 ? 'text-green-400' : 'text-red-400'
                                }`}
                            >
                                {totalProfitPercent >= 0 ? '+' : ''}
                                {totalProfitPercent.toFixed(2)}%
                            </h2>
                        </div>
                        <div
                            className={`p-2.5 rounded-xl border shrink-0 ${
                                totalProfitPercent >= 0
                                    ? 'bg-green-500/15 border-green-500/30 text-green-400'
                                    : 'bg-red-500/15 border-red-500/30 text-red-400'
                            }`}
                        >
                            {totalProfitPercent >= 0 ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
                        </div>
                    </div>
                </div>

                <div className="bg-slate-800/95 border border-slate-700/90 rounded-2xl p-5 shadow-xl">
                    <div className="flex justify-between items-start gap-2">
                        <div>
                            <p className="text-slate-300 text-xs font-bold uppercase tracking-wider">Cash Available</p>
                            <h2 className="text-2xl sm:text-3xl font-bold font-mono tabular-nums text-white mt-2">
                                ${fmt2(totalCash)}
                            </h2>
                        </div>
                        <div className="p-2.5 bg-amber-500/15 border border-amber-500/30 rounded-xl text-amber-400 shrink-0">
                            <Wallet size={20} />
                        </div>
                    </div>
                </div>
            </div>

            {/* Member Overview Section */}
            <section className="space-y-4">
                <h2 className="text-xl font-bold text-white flex items-center gap-2.5 tracking-tight">
                    <Users size={22} className="text-blue-400" />
                    <span>Member Overview</span>
                </h2>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {memberDetails.map(member => (
                        <div
                            key={member.id}
                            className="bg-slate-800/95 border border-slate-700/90 rounded-2xl p-6 shadow-xl flex flex-col justify-between gap-4"
                        >
                            <h3 className="text-xl font-bold text-white tracking-tight">{member.name}</h3>

                            <div className="grid grid-cols-2 gap-3.5 bg-slate-900/65 border border-slate-700/70 rounded-xl p-4">
                                <div>
                                    <p className="text-slate-300 text-xs font-bold uppercase tracking-wider mb-1">
                                        Total Worth
                                    </p>
                                    <p className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-white">
                                        ${fmt2(member.totalWorth)}
                                    </p>
                                </div>

                                <div>
                                    <p className="text-slate-300 text-xs font-bold uppercase tracking-wider mb-1">
                                        Invested
                                    </p>
                                    <p className="text-lg sm:text-xl font-semibold font-mono tabular-nums text-slate-200">
                                        ${fmt2(member.invested)}
                                    </p>
                                </div>

                                <div>
                                    <p className="text-slate-300 text-xs font-bold uppercase tracking-wider mb-1">
                                        Profit / Loss
                                    </p>
                                    <div className="flex items-center gap-1.5">
                                        <p
                                            className={`text-base sm:text-lg font-bold font-mono tabular-nums ${
                                                member.profit >= 0 ? 'text-green-400' : 'text-red-400'
                                            }`}
                                        >
                                            {member.profit >= 0 ? '+' : '-'}${fmt2(Math.abs(member.profit))}
                                        </p>
                                        {member.profit >= 0 ? (
                                            <TrendingUp size={16} className="text-green-400 shrink-0" />
                                        ) : (
                                            <TrendingDown size={16} className="text-red-400 shrink-0" />
                                        )}
                                    </div>
                                    <p
                                        className={`text-xs font-mono tabular-nums font-bold ${
                                            member.profitPercent >= 0 ? 'text-green-400' : 'text-red-400'
                                        }`}
                                    >
                                        {member.profitPercent >= 0 ? '+' : ''}
                                        {member.profitPercent.toFixed(2)}%
                                    </p>
                                </div>

                                <div>
                                    <p className="text-slate-300 text-xs font-bold uppercase tracking-wider mb-1">
                                        Cash Available
                                    </p>
                                    <p className="text-base sm:text-lg font-semibold font-mono tabular-nums text-slate-200">
                                        ${fmt2(member.cash)}
                                    </p>
                                </div>
                            </div>

                            <div className="pt-3 border-t border-slate-700/70 grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-slate-300 text-xs font-bold uppercase tracking-wider mb-1">
                                        Deposited This Year
                                    </p>
                                    <div className="flex flex-wrap items-baseline gap-2">
                                        <p className="text-lg font-bold font-mono tabular-nums text-blue-400">
                                            ${fmt2(member.depositedThisYear)}
                                        </p>
                                        <span
                                            className="text-xs text-slate-300 font-medium font-mono"
                                            title="To TFSA accounts"
                                        >
                                            (TFSA: $
                                            {member.depositedTfsaThisYear.toLocaleString(undefined, {
                                                minimumFractionDigits: 0,
                                                maximumFractionDigits: 0,
                                            })}
                                            )
                                        </span>
                                    </div>
                                </div>
                                <div>
                                    <p className="text-slate-300 text-xs font-bold uppercase tracking-wider mb-1">
                                        Withdrawn This Year
                                    </p>
                                    <p className="text-lg font-bold font-mono tabular-nums text-amber-400">
                                        ${fmt2(member.withdrawnThisYear)}
                                    </p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* Asset Performance Highlights */}
            {bestPerformer && worstPerformer && (
                <section className="space-y-4">
                    <h2 className="text-xl font-bold text-white tracking-tight">Asset Performance Highlights</h2>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <PerformerCard
                            title="Best Performer (%)"
                            mode="positive"
                            badgeMode="percent"
                            asset={bestPerformer}
                            gradientId="colorBestPct"
                            chartTheme={chartTheme}
                        />
                        <PerformerCard
                            title="Worst Performer (%)"
                            mode="negative"
                            badgeMode="percent"
                            asset={worstPerformer}
                            gradientId="colorWorstPct"
                            chartTheme={chartTheme}
                        />
                        {highestGainerDollar && (
                            <PerformerCard
                                title="Highest Gain ($)"
                                mode="positive"
                                badgeMode="dollar"
                                asset={highestGainerDollar}
                                gradientId="colorBestDollar"
                                chartTheme={chartTheme}
                            />
                        )}
                        {lowestGainerDollar && (
                            <PerformerCard
                                title="Lowest Gain ($)"
                                mode="negative"
                                badgeMode="dollar"
                                asset={lowestGainerDollar}
                                gradientId="colorWorstDollar"
                                chartTheme={chartTheme}
                            />
                        )}
                    </div>
                </section>
            )}

            {/* Upcoming Events */}
            <EventsTable assets={assets} />

            {/* Portfolio History Chart */}
            {portfolioHistory.length > 0 && (
                <section className="bg-slate-800/95 border border-slate-700/90 rounded-2xl p-6 shadow-xl">
                    <div className="flex items-center justify-between mb-5 pb-3 border-b border-slate-700/70">
                        <h3 className="text-lg font-bold text-white flex items-center gap-2.5 tracking-tight">
                            <TrendingUp size={20} className="text-blue-400" />
                            <span>Portfolio Value History</span>
                        </h3>
                        <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                            Net Worth Trend
                        </span>
                    </div>
                    <div className="h-[300px] w-full bg-slate-900/50 border border-slate-700/60 rounded-xl p-3">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={portfolioHistory} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.32} />
                                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.gridColor} vertical={false} />
                                <XAxis
                                    dataKey="name"
                                    tickFormatter={val => {
                                        const d = new Date(val);
                                        return `${d.getMonth() + 1}/${d.getFullYear().toString().slice(2)}`;
                                    }}
                                    interval={Math.max(1, Math.floor(portfolioHistory.length / 5))}
                                    tick={{ fill: chartTheme.tickColor, fontSize: 11 }}
                                    axisLine={false}
                                    tickLine={false}
                                />
                                <YAxis
                                    domain={['auto', 'auto']}
                                    orientation="right"
                                    tickFormatter={val => `$${(val / 1000).toFixed(0)}k`}
                                    tick={{ fill: chartTheme.tickColor, fontSize: 11 }}
                                    tickLine={false}
                                    axisLine={false}
                                    width={56}
                                />
                                <Tooltip
                                    formatter={(value) => [`$${fmt2(Number(value))}`, 'Net Worth']}
                                    labelFormatter={label => new Date(label).toLocaleDateString()}
                                    contentStyle={chartTheme.tooltipStyle}
                                    itemStyle={chartTheme.tooltipItemStyle}
                                    labelStyle={chartTheme.tooltipLabelStyle}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="value"
                                    stroke="#3b82f6"
                                    strokeWidth={2.5}
                                    fillOpacity={1}
                                    fill="url(#colorValue)"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </section>
            )}

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <AllocationDonutCard
                    title="Allocation by Person"
                    icon={<Users size={19} className="text-blue-400" />}
                    data={allocationByPerson}
                    centerTotal={totalValue}
                    chartTheme={chartTheme}
                />

                {/* Financial Freedom Goal Gauge */}
                <div className="bg-slate-800/95 border border-slate-700/90 rounded-2xl p-6 shadow-xl h-[410px] flex flex-col items-center justify-center text-center">
                    <h3 className="text-lg font-bold text-white mb-2 tracking-tight">Financial Freedom Goal</h3>

                    <div className="mb-6 flex items-center justify-center gap-2">
                        {isEditingGoal ? (
                            <div className="flex items-center gap-2">
                                <input
                                    type="number"
                                    value={tempGoal}
                                    onChange={e => setTempGoal(e.target.value)}
                                    className="bg-slate-900 border border-slate-600 rounded-xl px-3 py-1.5 text-white font-mono text-sm w-36 focus:outline-none focus:border-blue-500"
                                    autoFocus
                                />
                                <button
                                    onClick={handleSaveGoal}
                                    className="p-1.5 bg-green-500/20 text-green-400 border border-green-500/35 rounded-lg hover:bg-green-500/30 transition-colors"
                                    aria-label="Save goal"
                                >
                                    <Check size={16} />
                                </button>
                                <button
                                    onClick={handleCancelGoal}
                                    className="p-1.5 bg-red-500/20 text-red-400 border border-red-500/35 rounded-lg hover:bg-red-500/30 transition-colors"
                                    aria-label="Cancel editing goal"
                                >
                                    <X size={16} />
                                </button>
                            </div>
                        ) : (
                            <button
                                type="button"
                                className="flex items-center gap-2 px-3 py-1 rounded-lg bg-slate-900/70 border border-slate-700/80 hover:border-blue-500/60 transition-colors cursor-pointer"
                                onClick={() => setIsEditingGoal(true)}
                            >
                                <span className="text-slate-200 text-sm font-mono font-semibold">
                                    Target: ${financialGoal.toLocaleString()}
                                </span>
                                <Pencil size={13} className="text-slate-300" />
                            </button>
                        )}
                    </div>

                    <div className="relative w-64 h-32 overflow-hidden mb-5">
                        {/* Gauge Background */}
                        <div className="absolute bottom-0 w-full h-full bg-slate-700 rounded-t-full" />
                        {/* Gauge Progress */}
                        <div
                            className={`absolute bottom-0 w-full h-full bg-gradient-to-t ${gaugeColor} rounded-t-full origin-bottom transition-all duration-1000`}
                            style={{
                                transform: `rotate(${Math.min(0, (totalValue / financialGoal) * 180 - 180)}deg)`,
                            }}
                        />
                        {/* Inner Cover */}
                        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-48 h-48 bg-slate-800 rounded-full flex items-start justify-center pt-5">
                            <span className="text-xs font-mono font-bold text-blue-400 bg-blue-500/15 border border-blue-500/35 px-2.5 py-0.5 rounded-full">
                                {goalProgressPct.toFixed(1)}%
                            </span>
                        </div>
                    </div>

                    <h2 className="text-3xl sm:text-4xl font-bold font-mono tabular-nums text-white mb-1.5">
                        ${totalValue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </h2>
                    <p
                        className={`text-sm font-mono tabular-nums font-bold ${
                            isPositivePerformance ? 'text-green-400' : 'text-red-400'
                        }`}
                    >
                        {isPositivePerformance ? 'Profit' : 'Loss'}: ${fmt2(totalValue - totalBasis)}{' '}
                        <span className="ml-1">
                            ({totalProfitPercent >= 0 ? '+' : ''}
                            {totalProfitPercent.toFixed(2)}%)
                        </span>
                    </p>
                    <p className="text-xs font-medium text-slate-300 mt-1">Current Net Worth</p>
                </div>

                <AllocationDonutCard
                    title="Allocation by Account Type"
                    icon={<Wallet size={19} className="text-purple-400" />}
                    data={allocationByAccountType}
                    chartTheme={chartTheme}
                />

                <AllocationDonutCard
                    title="Allocation by Institution"
                    icon={<Building2 size={19} className="text-amber-400" />}
                    data={allocationByInstitution}
                    chartTheme={chartTheme}
                />

                {/* Top 5 Assets by % Profit */}
                <div className="bg-slate-800/95 border border-slate-700/90 rounded-2xl p-6 shadow-xl h-[410px] flex flex-col">
                    <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2.5 pb-3 border-b border-slate-700/70">
                        <TrendingUp size={19} className="text-green-400" />
                        <span>Top 5 Assets (% Profit)</span>
                    </h3>
                    <div className="flex-1 w-full min-h-0 bg-slate-900/50 border border-slate-700/60 rounded-xl p-2">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart layout="vertical" data={top5AssetsPercent} margin={{ top: 8, right: 24, left: 10, bottom: 8 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.gridColor} horizontal={false} />
                                <XAxis type="number" unit="%" tick={{ fill: chartTheme.tickColor, fontSize: 11 }} axisLine={false} tickLine={false} />
                                <YAxis
                                    type="category"
                                    dataKey="name"
                                    tick={{ fill: chartTheme.tickColor, fontSize: 11, fontWeight: 600 }}
                                    width={135}
                                    tickLine={false}
                                    axisLine={false}
                                />
                                <Tooltip
                                    cursor={{ fill: chartTheme.cursorFill }}
                                    contentStyle={chartTheme.tooltipStyle}
                                    itemStyle={chartTheme.tooltipItemStyle}
                                    labelStyle={chartTheme.tooltipLabelStyle}
                                    formatter={(value) => [`${Number(value).toFixed(2)}%`, 'Return']}
                                />
                                <Bar dataKey="value" fill="#10b981" radius={[0, 6, 6, 0]}>
                                    {top5AssetsPercent.map((_entry, index) => (
                                        <Cell key={`cell-${index}`} fill={index === 0 ? '#10b981' : '#34d399'} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Bottom 5 Assets by % Profit */}
                <div className="bg-slate-800/95 border border-slate-700/90 rounded-2xl p-6 shadow-xl h-[410px] flex flex-col">
                    <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2.5 pb-3 border-b border-slate-700/70">
                        <TrendingDown size={19} className="text-red-400" />
                        <span>Bottom 5 Assets (% Profit)</span>
                    </h3>
                    <div className="flex-1 w-full min-h-0 bg-slate-900/50 border border-slate-700/60 rounded-xl p-2">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart layout="vertical" data={bottom5AssetsPercent} margin={{ top: 8, right: 24, left: 10, bottom: 8 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.gridColor} horizontal={false} />
                                <XAxis type="number" unit="%" tick={{ fill: chartTheme.tickColor, fontSize: 11 }} axisLine={false} tickLine={false} />
                                <YAxis
                                    type="category"
                                    dataKey="name"
                                    tick={{ fill: chartTheme.tickColor, fontSize: 11, fontWeight: 600 }}
                                    width={135}
                                    tickLine={false}
                                    axisLine={false}
                                />
                                <Tooltip
                                    cursor={{ fill: chartTheme.cursorFill }}
                                    contentStyle={chartTheme.tooltipStyle}
                                    itemStyle={chartTheme.tooltipItemStyle}
                                    labelStyle={chartTheme.tooltipLabelStyle}
                                    formatter={(value) => [`${Number(value).toFixed(2)}%`, 'Return']}
                                />
                                <Bar dataKey="value" fill="#ef4444" radius={[0, 6, 6, 0]}>
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
            <section className="bg-slate-800/95 border border-slate-700/90 rounded-2xl shadow-xl overflow-hidden">
                <div className="px-6 py-4 bg-slate-900/80 border-b border-slate-700/80 flex items-center justify-between">
                    <h3 className="text-lg font-bold text-white tracking-tight">Accounts Ranked by Performance</h3>
                    <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-300">
                        {sortedAccountPerformance.length}
                    </span>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-900/90 border-b border-slate-700/80">
                            <tr className="text-slate-300 text-xs font-bold uppercase tracking-wider whitespace-nowrap">
                                <th className={`px-4 py-3.5 cursor-pointer hover:text-white transition-colors ${sortField === 'rank' ? 'text-blue-400' : ''}`} onClick={() => handleSort('rank')}>
                                    <div className="flex items-center gap-1">Rank <ArrowUpDown size={12} /></div>
                                </th>
                                <th className={`px-4 py-3.5 cursor-pointer hover:text-white transition-colors ${sortField === 'accountName' ? 'text-blue-400' : ''}`} onClick={() => handleSort('accountName')}>
                                    <div className="flex items-center gap-1">Account <ArrowUpDown size={12} /></div>
                                </th>
                                <th className={`px-4 py-3.5 cursor-pointer hover:text-white transition-colors ${sortField === 'memberName' ? 'text-blue-400' : ''}`} onClick={() => handleSort('memberName')}>
                                    <div className="flex items-center gap-1">Member <ArrowUpDown size={12} /></div>
                                </th>
                                <th className={`px-4 py-3.5 cursor-pointer hover:text-white transition-colors ${sortField === 'institutionName' ? 'text-blue-400' : ''}`} onClick={() => handleSort('institutionName')}>
                                    <div className="flex items-center gap-1">Institution <ArrowUpDown size={12} /></div>
                                </th>
                                <th className={`px-4 py-3.5 text-right cursor-pointer hover:text-white transition-colors ${sortField === 'bookCost' ? 'text-blue-400' : ''}`} onClick={() => handleSort('bookCost')}>
                                    <div className="flex items-center justify-end gap-1">Book <ArrowUpDown size={12} /></div>
                                </th>
                                <th className={`px-4 py-3.5 text-right cursor-pointer hover:text-white transition-colors ${sortField === 'marketValue' ? 'text-blue-400' : ''}`} onClick={() => handleSort('marketValue')}>
                                    <div className="flex items-center justify-end gap-1">Value <ArrowUpDown size={12} /></div>
                                </th>
                                <th className={`px-4 py-3.5 text-right cursor-pointer hover:text-white transition-colors ${sortField === 'profitDollar' ? 'text-blue-400' : ''}`} onClick={() => handleSort('profitDollar')}>
                                    <div className="flex items-center justify-end gap-1">P/L $ <ArrowUpDown size={12} /></div>
                                </th>
                                <th className={`px-4 py-3.5 text-right cursor-pointer hover:text-white transition-colors ${sortField === 'profitPercent' ? 'text-blue-400' : ''}`} onClick={() => handleSort('profitPercent')}>
                                    <div className="flex items-center justify-end gap-1">P/L % <ArrowUpDown size={12} /></div>
                                </th>
                                <th className="px-4 py-3.5 text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700/60 text-sm">
                            {sortedAccountPerformance.map(account => (
                                <tr key={account.accountId} className="hover:bg-slate-750/60 transition-colors">
                                    <td className="px-4 py-3.5 text-slate-300 font-mono font-bold">#{account.rank}</td>
                                    <td className="px-4 py-3.5 text-white font-bold">{account.accountName}</td>
                                    <td className="px-4 py-3.5 text-slate-300">{account.memberName}</td>
                                    <td className="px-4 py-3.5 text-slate-300">{account.institutionName}</td>
                                    <td className="px-4 py-3.5 text-right text-slate-300 font-mono tabular-nums font-medium">
                                        ${fmt2(account.bookCost)}
                                    </td>
                                    <td className="px-4 py-3.5 text-right text-white font-mono tabular-nums font-bold">
                                        ${fmt2(account.marketValue)}
                                    </td>
                                    <td
                                        className={`px-4 py-3.5 text-right font-mono tabular-nums font-bold ${
                                            account.profitDollar >= 0 ? 'text-green-400' : 'text-red-400'
                                        }`}
                                    >
                                        {account.profitDollar >= 0 ? '+' : '-'}${fmt2(Math.abs(account.profitDollar))}
                                    </td>
                                    <td
                                        className={`px-4 py-3.5 text-right font-mono tabular-nums font-bold ${
                                            account.profitPercent >= 0 ? 'text-green-400' : 'text-red-400'
                                        }`}
                                    >
                                        {account.profitPercent >= 0 ? '+' : ''}
                                        {account.profitPercent.toFixed(2)}%
                                    </td>
                                    <td className="px-4 py-3.5 text-right">
                                        <Link
                                            to={`/accounts/${account.accountId}`}
                                            className="p-2 bg-blue-500/15 border border-blue-500/30 text-blue-400 rounded-lg hover:bg-blue-500/25 transition-colors inline-flex"
                                            title="View Account"
                                        >
                                            <Eye size={16} />
                                        </Link>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>

            {/* All Assets Performance Table */}
            <section className="bg-slate-800/95 border border-slate-700/90 rounded-2xl shadow-xl overflow-hidden">
                <div className="px-6 py-4 bg-slate-900/80 border-b border-slate-700/80 flex items-center justify-between">
                    <h3 className="text-lg font-bold text-white tracking-tight">All Assets Ranked by Performance</h3>
                    <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-300">
                        {sortedAssetPerformance.length}
                    </span>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-900/90 border-b border-slate-700/80">
                            <tr className="text-slate-300 text-xs font-bold uppercase tracking-wider whitespace-nowrap">
                                <th className={`px-3 py-3.5 cursor-pointer hover:text-white transition-colors ${assetSortField === 'rank' ? 'text-blue-400' : ''}`} onClick={() => handleAssetSort('rank')}>
                                    <div className="flex items-center gap-1">Rank <ArrowUpDown size={12} /></div>
                                </th>
                                <th className={`px-3 py-3.5 cursor-pointer hover:text-white transition-colors ${assetSortField === 'ticker' ? 'text-blue-400' : ''}`} onClick={() => handleAssetSort('ticker')}>
                                    <div className="flex items-center gap-1">Ticker <ArrowUpDown size={12} /></div>
                                </th>
                                <th className={`px-3 py-3.5 text-right cursor-pointer hover:text-white transition-colors ${assetSortField === 'currentPrice' ? 'text-blue-400' : ''}`} onClick={() => handleAssetSort('currentPrice')}>
                                    <div className="flex items-center justify-end gap-1">Price <ArrowUpDown size={12} /></div>
                                </th>
                                <th className={`px-3 py-3.5 text-right cursor-pointer hover:text-white transition-colors ${assetSortField === 'todayChangePercent' ? 'text-blue-400' : ''}`} onClick={() => handleAssetSort('todayChangePercent')}>
                                    <div className="flex items-center justify-end gap-1">Day % <ArrowUpDown size={12} /></div>
                                </th>
                                <th className={`px-3 py-3.5 text-right cursor-pointer hover:text-white transition-colors ${assetSortField === 'todayChangeDollar' ? 'text-blue-400' : ''}`} onClick={() => handleAssetSort('todayChangeDollar')}>
                                    <div className="flex items-center justify-end gap-1">Day $ <ArrowUpDown size={12} /></div>
                                </th>
                                <th className={`px-3 py-3.5 text-right cursor-pointer hover:text-white transition-colors ${assetSortField === 'averageCost' ? 'text-blue-400' : ''}`} onClick={() => handleAssetSort('averageCost')}>
                                    <div className="flex items-center justify-end gap-1">Avg Cost <ArrowUpDown size={12} /></div>
                                </th>
                                <th className={`px-3 py-3.5 text-right cursor-pointer hover:text-white transition-colors ${assetSortField === 'effectiveBookCost' ? 'text-blue-400' : ''}`} onClick={() => handleAssetSort('effectiveBookCost')}>
                                    <div className="flex items-center justify-end gap-1">Book <ArrowUpDown size={12} /></div>
                                </th>
                                <th className={`px-3 py-3.5 text-right cursor-pointer hover:text-white transition-colors ${assetSortField === 'marketValue' ? 'text-blue-400' : ''}`} onClick={() => handleAssetSort('marketValue')}>
                                    <div className="flex items-center justify-end gap-1">Value <ArrowUpDown size={12} /></div>
                                </th>
                                <th className={`px-3 py-3.5 text-right cursor-pointer hover:text-white transition-colors ${assetSortField === 'profit' ? 'text-blue-400' : ''}`} onClick={() => handleAssetSort('profit')}>
                                    <div className="flex items-center justify-end gap-1">P/L $ <ArrowUpDown size={12} /></div>
                                </th>
                                <th className={`px-3 py-3.5 text-right cursor-pointer hover:text-white transition-colors ${assetSortField === 'profitPercent' ? 'text-blue-400' : ''}`} onClick={() => handleAssetSort('profitPercent')}>
                                    <div className="flex items-center justify-end gap-1">P/L % <ArrowUpDown size={12} /></div>
                                </th>
                                <th className={`px-3 py-3.5 text-right cursor-pointer hover:text-white transition-colors ${assetSortField === 'low52Week' ? 'text-blue-400' : ''}`} onClick={() => handleAssetSort('low52Week')}>
                                    <div className="flex items-center justify-end gap-1">Low <ArrowUpDown size={12} /></div>
                                </th>
                                <th className={`px-3 py-3.5 text-right cursor-pointer hover:text-white transition-colors ${assetSortField === 'high52Week' ? 'text-blue-400' : ''}`} onClick={() => handleAssetSort('high52Week')}>
                                    <div className="flex items-center justify-end gap-1">High <ArrowUpDown size={12} /></div>
                                </th>
                                <th className={`px-3 py-3.5 text-right cursor-pointer hover:text-white transition-colors ${assetSortField === 'percentTo52WeekHigh' ? 'text-blue-400' : ''}`} onClick={() => handleAssetSort('percentTo52WeekHigh')}>
                                    <div className="flex items-center justify-end gap-1">% High <ArrowUpDown size={12} /></div>
                                </th>
                                <th className={`px-3 py-3.5 cursor-pointer hover:text-white transition-colors ${assetSortField === 'accountName' ? 'text-blue-400' : ''}`} onClick={() => handleAssetSort('accountName')}>
                                    <div className="flex items-center gap-1">Account <ArrowUpDown size={12} /></div>
                                </th>
                                <th className="px-3 py-3.5 text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700/60 text-sm">
                            {sortedAssetPerformance.map(asset => (
                                <tr key={asset.id} className="hover:bg-slate-750/60 transition-colors">
                                    <td className="px-3 py-3 text-slate-300 font-mono font-bold">#{asset.rank}</td>
                                    <td className="px-3 py-3 text-white font-mono font-bold">
                                        <span className="inline-flex items-center gap-1.5">
                                            {asset.ticker}
                                            {asset.currency === 'USD' && (
                                                <span className="text-[11px] font-sans font-bold px-1.5 py-0.5 rounded bg-blue-500/15 border border-blue-500/30 text-blue-400">
                                                    USD
                                                </span>
                                            )}
                                        </span>
                                    </td>
                                    <td className="px-3 py-3 text-right text-slate-200 font-mono tabular-nums font-medium">
                                        ${fmt2(asset.currentPrice)}
                                    </td>
                                    <td
                                        className={`px-3 py-3 text-right font-mono tabular-nums font-semibold ${
                                            asset.todayChangePercent >= 0 ? 'text-green-400' : 'text-red-400'
                                        }`}
                                    >
                                        {asset.todayChangePercent >= 0 ? '+' : ''}
                                        {asset.todayChangePercent.toFixed(2)}%
                                    </td>
                                    <td
                                        className={`px-3 py-3 text-right font-mono tabular-nums font-semibold ${
                                            (asset.todayChangeDollar || 0) >= 0 ? 'text-green-400' : 'text-red-400'
                                        }`}
                                    >
                                        {(asset.todayChangeDollar || 0) >= 0 ? '+' : '-'}$
                                        {fmt2(Math.abs(asset.todayChangeDollar || 0))}
                                    </td>
                                    <td className="px-3 py-3 text-right text-slate-300 font-mono tabular-nums">
                                        ${fmt2(asset.averageCost)}
                                    </td>
                                    <td className="px-3 py-3 text-right text-slate-300 font-mono tabular-nums">
                                        ${fmt2(asset.customBookCost || asset.totalCost)}
                                    </td>
                                    <td className="px-3 py-3 text-right text-white font-mono tabular-nums font-bold">
                                        ${fmt2(asset.marketValue)}
                                    </td>
                                    <td
                                        className={`px-3 py-3 text-right font-mono tabular-nums font-bold ${
                                            asset.profit >= 0 ? 'text-green-400' : 'text-red-400'
                                        }`}
                                    >
                                        {asset.profit >= 0 ? '+' : '-'}${fmt2(Math.abs(asset.profit))}
                                    </td>
                                    <td
                                        className={`px-3 py-3 text-right font-mono tabular-nums font-bold ${
                                            asset.profitPercent >= 0 ? 'text-green-400' : 'text-red-400'
                                        }`}
                                    >
                                        {asset.profitPercent >= 0 ? '+' : ''}
                                        {asset.profitPercent.toFixed(2)}%
                                    </td>
                                    <td className="px-3 py-3 text-right text-slate-300 font-mono tabular-nums">
                                        {asset.low52Week ? `$${fmt2(asset.low52Week)}` : '—'}
                                    </td>
                                    <td className="px-3 py-3 text-right text-slate-300 font-mono tabular-nums">
                                        {asset.high52Week ? `$${fmt2(asset.high52Week)}` : '—'}
                                    </td>
                                    <td
                                        className={`px-3 py-3 text-right font-mono tabular-nums font-semibold ${
                                            asset.percentTo52WeekHigh >= -5 ? 'text-green-400' : 'text-slate-300'
                                        }`}
                                    >
                                        {asset.percentTo52WeekHigh.toFixed(2)}%
                                    </td>
                                    <td className="px-3 py-3 text-slate-300">{asset.accountName}</td>
                                    <td className="px-3 py-3 text-right">
                                        <Link
                                            to={`/accounts/${asset.accountId}`}
                                            className="p-2 bg-blue-500/15 border border-blue-500/30 text-blue-400 rounded-lg hover:bg-blue-500/25 transition-colors inline-flex"
                                            title="View Account"
                                        >
                                            <Eye size={16} />
                                        </Link>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>

            {/* Breakdown by Member, Institution & Account */}
            <section className="space-y-6">
                <h3 className="text-xl font-bold text-white flex items-center gap-2.5 tracking-tight">
                    <Users size={22} className="text-blue-400" />
                    <span>Breakdown by Member, Institution &amp; Account</span>
                </h3>

                <div className="space-y-6">
                    {memberBreakdown.map(mb => (
                        <div
                            key={mb.member.id}
                            className="bg-slate-800/95 border border-slate-700/90 rounded-2xl shadow-xl overflow-hidden"
                        >
                            {/* Member Header */}
                            <div className="bg-slate-900/80 p-6 border-b border-slate-700/80 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                <div>
                                    <h4 className="text-2xl font-bold text-white">{mb.member.name}</h4>
                                    <p className="text-slate-300 text-sm">Member Overview</p>
                                </div>
                                <div className="flex flex-wrap gap-5 md:gap-8">
                                    <div>
                                        <p className="text-slate-300 text-xs font-bold uppercase tracking-wider mb-1">
                                            Total Cash
                                        </p>
                                        <p className="text-lg font-bold text-white font-mono tabular-nums">
                                            ${fmt2(mb.stats.totalCash)}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-slate-300 text-xs font-bold uppercase tracking-wider mb-1">
                                            Total Book Cost
                                        </p>
                                        <p className="text-lg font-bold text-white font-mono tabular-nums">
                                            ${fmt2(mb.stats.totalBookCost)}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-slate-300 text-xs font-bold uppercase tracking-wider mb-1">
                                            Total Market Value
                                        </p>
                                        <p className="text-lg font-bold text-white font-mono tabular-nums">
                                            ${fmt2(mb.stats.totalMarketValue)}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-slate-300 text-xs font-bold uppercase tracking-wider mb-1">
                                            Total Profit
                                        </p>
                                        <div className="flex items-center gap-2">
                                            <p
                                                className={`text-lg font-bold font-mono tabular-nums ${
                                                    mb.stats.totalProfit >= 0 ? 'text-green-400' : 'text-red-400'
                                                }`}
                                            >
                                                {mb.stats.totalProfit >= 0 ? '+' : '-'}$
                                                {fmt2(Math.abs(mb.stats.totalProfit))}
                                            </p>
                                            <span
                                                className={`text-sm font-mono font-bold ${
                                                    mb.stats.totalProfitPercent >= 0 ? 'text-green-400' : 'text-red-400'
                                                }`}
                                            >
                                                ({mb.stats.totalProfitPercent >= 0 ? '+' : ''}
                                                {mb.stats.totalProfitPercent.toFixed(2)}%)
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Groups */}
                            <div className="p-5 sm:p-6 space-y-6">
                                {mb.institutionGroups.map(group => (
                                    <div key={group.institution.id} className="space-y-4">
                                        {group.accounts.map(accGroup => (
                                            <div
                                                key={accGroup.account.id}
                                                className="bg-slate-900/70 rounded-xl overflow-hidden border border-slate-700/80"
                                            >
                                                {/* Account Header */}
                                                <div className="px-5 py-4 bg-slate-900/95 border-b border-slate-700/80 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="p-2 bg-blue-500/15 border border-blue-500/30 rounded-xl text-blue-400">
                                                            <Wallet size={18} />
                                                        </div>
                                                        <div>
                                                            <h5 className="font-bold text-white">
                                                                {group.institution.name}
                                                            </h5>
                                                            <p className="text-slate-300 text-sm">{accGroup.account.name}</p>
                                                        </div>
                                                    </div>
                                                    <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
                                                        <div>
                                                            <span className="text-slate-400 font-semibold mr-1.5">Cash:</span>
                                                            <span className="text-white tabular-nums font-mono font-semibold">
                                                                ${fmt2(accGroup.account.cashBalance)}
                                                            </span>
                                                        </div>
                                                        <div>
                                                            <span className="text-slate-400 font-semibold mr-1.5">Book:</span>
                                                            <span className="text-slate-200 tabular-nums font-mono font-semibold">
                                                                ${fmt2(accGroup.stats.bookCost)}
                                                            </span>
                                                        </div>
                                                        <div>
                                                            <span className="text-slate-400 font-semibold mr-1.5">Value:</span>
                                                            <span className="text-white font-bold tabular-nums font-mono">
                                                                ${fmt2(accGroup.stats.marketValue)}
                                                            </span>
                                                        </div>
                                                        <div>
                                                            <span className="text-slate-400 font-semibold mr-1.5">P/L:</span>
                                                            <span
                                                                className={`font-bold tabular-nums font-mono ${
                                                                    accGroup.stats.profit >= 0
                                                                        ? 'text-green-400'
                                                                        : 'text-red-400'
                                                                }`}
                                                            >
                                                                {accGroup.stats.profit >= 0 ? '+' : '-'}$
                                                                {fmt2(Math.abs(accGroup.stats.profit))}
                                                            </span>
                                                        </div>
                                                        <div>
                                                            <span className="text-slate-400 font-semibold mr-1.5">P/L %:</span>
                                                            <span
                                                                className={`font-bold tabular-nums font-mono ${
                                                                    accGroup.stats.profitPercent >= 0
                                                                        ? 'text-green-400'
                                                                        : 'text-red-400'
                                                                }`}
                                                            >
                                                                {accGroup.stats.profitPercent >= 0 ? '+' : ''}
                                                                {accGroup.stats.profitPercent.toFixed(2)}%
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Table */}
                                                <div className="overflow-x-auto">
                                                    <table className="w-full text-left border-collapse">
                                                        <thead>
                                                            <tr className="text-slate-300 border-b border-slate-700/80 text-xs font-bold uppercase tracking-wider whitespace-nowrap bg-slate-900/60">
                                                                <th className="px-4 py-3">Ticker</th>
                                                                <th className="px-4 py-3 text-right">Shares</th>
                                                                <th className="px-4 py-3 text-right">Price</th>
                                                                <th className="px-4 py-3 text-right">Avg Cost</th>
                                                                <th className="px-4 py-3 text-right">Book</th>
                                                                <th className="px-4 py-3 text-right">Value</th>
                                                                <th className="px-4 py-3 text-right">Day %</th>
                                                                <th className="px-4 py-3 text-right">Day $</th>
                                                                <th className="px-4 py-3 text-right">P/L $</th>
                                                                <th className="px-4 py-3 text-right">P/L %</th>
                                                                <th className="px-4 py-3 text-right">Low</th>
                                                                <th className="px-4 py-3 text-right">High</th>
                                                                <th className="px-4 py-3 text-right">% High</th>
                                                                <th className="px-4 py-3 text-right">Action</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-slate-700/50 text-sm">
                                                            {accGroup.assets.length === 0 ? (
                                                                <tr>
                                                                    <td colSpan={14} className="px-6 py-6 text-center text-slate-400">
                                                                        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                                                                            <span className="text-xs text-slate-400">No holdings recorded in this account yet.</span>
                                                                            <div className="flex items-center gap-2">
                                                                                <Link
                                                                                    to={`/accounts/${accGroup.account.id}`}
                                                                                    className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-colors inline-flex items-center gap-1.5"
                                                                                >
                                                                                    <Plus size={13} /> Add Transaction
                                                                                </Link>
                                                                                <Link
                                                                                    to={`/accounts/${accGroup.account.id}`}
                                                                                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold transition-colors inline-flex items-center gap-1.5"
                                                                                >
                                                                                    <Upload size={13} className="text-blue-400" /> Import CSV
                                                                                </Link>
                                                                            </div>
                                                                        </div>
                                                                    </td>
                                                                </tr>
                                                            ) : (
                                                                accGroup.assets.map(asset => (
                                                                <tr key={asset.id} className="hover:bg-slate-800/70 transition-colors">
                                                                    <td className="px-4 py-2.5 text-white font-mono font-bold">
                                                                        <span className="inline-flex items-center gap-1.5">
                                                                            {asset.ticker}
                                                                            {asset.currency === 'USD' && (
                                                                                <span className="text-[11px] font-sans font-bold px-1.5 py-0.5 rounded bg-blue-500/15 border border-blue-500/30 text-blue-400">
                                                                                    USD
                                                                                </span>
                                                                            )}
                                                                        </span>
                                                                    </td>
                                                                    <td className="px-4 py-2.5 text-right text-slate-200 font-mono tabular-nums">
                                                                        {asset.quantity}
                                                                    </td>
                                                                    <td className="px-4 py-2.5 text-right text-slate-200 font-mono tabular-nums font-medium">
                                                                        ${fmt2(asset.currentPrice)}
                                                                    </td>
                                                                    <td className="px-4 py-2.5 text-right text-slate-300 font-mono tabular-nums">
                                                                        ${fmt2(asset.averageCost)}
                                                                    </td>
                                                                    <td className="px-4 py-2.5 text-right text-slate-300 font-mono tabular-nums">
                                                                        ${fmt2(asset.customBookCost || asset.totalCost)}
                                                                    </td>
                                                                    <td className="px-4 py-2.5 text-right text-white font-mono tabular-nums font-bold">
                                                                        ${fmt2(asset.marketValue)}
                                                                    </td>
                                                                    <td
                                                                        className={`px-4 py-2.5 text-right font-mono tabular-nums font-semibold ${
                                                                            asset.todayChangePercent >= 0
                                                                                ? 'text-green-400'
                                                                                : 'text-red-400'
                                                                        }`}
                                                                    >
                                                                        {asset.todayChangePercent >= 0 ? '+' : ''}
                                                                        {asset.todayChangePercent.toFixed(2)}%
                                                                    </td>
                                                                    <td
                                                                        className={`px-4 py-2.5 text-right font-mono tabular-nums font-semibold ${
                                                                            (asset.todayChangeDollar || 0) >= 0
                                                                                ? 'text-green-400'
                                                                                : 'text-red-400'
                                                                        }`}
                                                                    >
                                                                        {(asset.todayChangeDollar || 0) >= 0 ? '+' : '-'}$
                                                                        {fmt2(Math.abs(asset.todayChangeDollar || 0))}
                                                                    </td>
                                                                    <td
                                                                        className={`px-4 py-2.5 text-right font-mono tabular-nums font-bold ${
                                                                            asset.profit >= 0 ? 'text-green-400' : 'text-red-400'
                                                                        }`}
                                                                    >
                                                                        {asset.profit >= 0 ? '+' : '-'}$
                                                                        {fmt2(Math.abs(asset.profit))}
                                                                    </td>
                                                                    <td
                                                                        className={`px-4 py-2.5 text-right font-mono tabular-nums font-bold ${
                                                                            asset.profitPercent >= 0
                                                                                ? 'text-green-400'
                                                                                : 'text-red-400'
                                                                        }`}
                                                                    >
                                                                        {asset.profitPercent >= 0 ? '+' : ''}
                                                                        {asset.profitPercent.toFixed(2)}%
                                                                    </td>
                                                                    <td className="px-4 py-2.5 text-right text-slate-300 font-mono tabular-nums">
                                                                        {asset.low52Week ? `$${fmt2(asset.low52Week)}` : '—'}
                                                                    </td>
                                                                    <td className="px-4 py-2.5 text-right text-slate-300 font-mono tabular-nums">
                                                                        {asset.high52Week ? `$${fmt2(asset.high52Week)}` : '—'}
                                                                    </td>
                                                                    <td
                                                                        className={`px-4 py-2.5 text-right font-mono tabular-nums font-semibold ${
                                                                            asset.percentTo52WeekHigh >= -5
                                                                                ? 'text-green-400'
                                                                                : 'text-slate-300'
                                                                        }`}
                                                                    >
                                                                        {asset.percentTo52WeekHigh.toFixed(2)}%
                                                                    </td>
                                                                    <td className="px-4 py-2.5 text-right">
                                                                        <Link
                                                                            to={`/accounts/${asset.accountId}`}
                                                                            className="p-1.5 bg-blue-500/15 border border-blue-500/30 text-blue-400 rounded-lg hover:bg-blue-500/25 transition-colors inline-flex"
                                                                            title="View Account"
                                                                        >
                                                                            <Eye size={15} />
                                                                        </Link>
                                                                    </td>
                                                                </tr>
                                                            )))}
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
            </section>

            {/* Aggregated Stocks View */}
            <section className="space-y-4">
                <h3 className="text-xl font-bold text-white flex items-center gap-2.5 tracking-tight">
                    <Layers size={22} className="text-purple-400" />
                    <span>Combined Stocks (All Accounts)</span>
                </h3>
                <div className="bg-slate-800/95 border border-slate-700/90 rounded-2xl shadow-xl overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-slate-900/90 border-b border-slate-700/80">
                                <tr className="text-slate-300 text-xs font-bold uppercase tracking-wider whitespace-nowrap">
                                    <th className={`px-4 py-3.5 cursor-pointer hover:text-white transition-colors ${aggregatedSortField === 'ticker' ? 'text-blue-400' : ''}`} onClick={() => handleAggregatedSort('ticker')}>
                                        <div className="flex items-center gap-1">
                                            Ticker
                                            <ArrowUpDown size={12} className={aggregatedSortField === 'ticker' ? 'text-blue-400' : ''} />
                                        </div>
                                    </th>
                                    <th className={`px-4 py-3.5 text-right cursor-pointer hover:text-white transition-colors ${aggregatedSortField === 'totalShares' ? 'text-blue-400' : ''}`} onClick={() => handleAggregatedSort('totalShares')}>
                                        <div className="flex items-center justify-end gap-1">
                                            Total Shares
                                            <ArrowUpDown size={12} className={aggregatedSortField === 'totalShares' ? 'text-blue-400' : ''} />
                                        </div>
                                    </th>
                                    <th className={`px-4 py-3.5 text-right cursor-pointer hover:text-white transition-colors ${aggregatedSortField === 'totalInvested' ? 'text-blue-400' : ''}`} onClick={() => handleAggregatedSort('totalInvested')}>
                                        <div className="flex items-center justify-end gap-1">
                                            Total Invested
                                            <ArrowUpDown size={12} className={aggregatedSortField === 'totalInvested' ? 'text-blue-400' : ''} />
                                        </div>
                                    </th>
                                    <th className={`px-4 py-3.5 text-right cursor-pointer hover:text-white transition-colors ${aggregatedSortField === 'totalMarketValue' ? 'text-blue-400' : ''}`} onClick={() => handleAggregatedSort('totalMarketValue')}>
                                        <div className="flex items-center justify-end gap-1">
                                            Market Value
                                            <ArrowUpDown size={12} className={aggregatedSortField === 'totalMarketValue' ? 'text-blue-400' : ''} />
                                        </div>
                                    </th>
                                    <th className={`px-4 py-3.5 text-right cursor-pointer hover:text-white transition-colors ${aggregatedSortField === 'profit' ? 'text-blue-400' : ''}`} onClick={() => handleAggregatedSort('profit')}>
                                        <div className="flex items-center justify-end gap-1">
                                            Total P/L $
                                            <ArrowUpDown size={12} className={aggregatedSortField === 'profit' ? 'text-blue-400' : ''} />
                                        </div>
                                    </th>
                                    <th className={`px-4 py-3.5 text-right cursor-pointer hover:text-white transition-colors ${aggregatedSortField === 'profitPercent' ? 'text-blue-400' : ''}`} onClick={() => handleAggregatedSort('profitPercent')}>
                                        <div className="flex items-center justify-end gap-1">
                                            Total P/L %
                                            <ArrowUpDown size={12} className={aggregatedSortField === 'profitPercent' ? 'text-blue-400' : ''} />
                                        </div>
                                    </th>
                                    <th className={`px-4 py-3.5 cursor-pointer hover:text-white transition-colors ${aggregatedSortField === 'accountsList' ? 'text-blue-400' : ''}`} onClick={() => handleAggregatedSort('accountsList')}>
                                        <div className="flex items-center gap-1">
                                            Accounts
                                            <ArrowUpDown size={12} className={aggregatedSortField === 'accountsList' ? 'text-blue-400' : ''} />
                                        </div>
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-700/60 text-sm">
                                {aggregatedStocks.map(stock => (
                                    <tr key={stock.ticker} className="hover:bg-slate-750/60 transition-colors">
                                        <td className="px-4 py-3.5 text-white font-mono font-bold">{stock.ticker}</td>
                                        <td className="px-4 py-3.5 text-right text-slate-200 font-mono tabular-nums">
                                            {stock.totalShares.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                                        </td>
                                        <td className="px-4 py-3.5 text-right text-slate-300 font-mono tabular-nums font-medium">
                                            ${fmt2(stock.totalInvested)}
                                        </td>
                                        <td className="px-4 py-3.5 text-right text-white font-mono tabular-nums font-bold">
                                            ${fmt2(stock.totalMarketValue)}
                                        </td>
                                        <td
                                            className={`px-4 py-3.5 text-right font-mono tabular-nums font-bold ${
                                                stock.profit >= 0 ? 'text-green-400' : 'text-red-400'
                                            }`}
                                        >
                                            {stock.profit >= 0 ? '+' : '-'}${fmt2(Math.abs(stock.profit))}
                                        </td>
                                        <td
                                            className={`px-4 py-3.5 text-right font-mono tabular-nums font-bold ${
                                                stock.profitPercent >= 0 ? 'text-green-400' : 'text-red-400'
                                            }`}
                                        >
                                            {stock.profitPercent >= 0 ? '+' : ''}
                                            {stock.profitPercent.toFixed(2)}%
                                        </td>
                                        <td className="px-4 py-3.5 text-slate-300 text-xs">{stock.accountsList}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </section>

            {showMigrationModal && <CurrencyMigrationModal onClose={() => setShowMigrationModal(false)} />}
        </div>
    );
};

export default Dashboard;
