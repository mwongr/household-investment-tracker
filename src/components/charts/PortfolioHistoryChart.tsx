import React, { useMemo, useState } from 'react';
import { ArrowDownRight, ArrowUpRight, TrendingUp } from 'lucide-react';
import {
    Area,
    AreaChart,
    CartesianGrid,
    Legend,
    Line,
    LineChart,
    ReferenceLine,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import type { ChartTheme } from '../../hooks/useChartTheme';
import {
    getHistoryExtremes,
    mergeMemberHistories,
    type MemberPortfolioHistory,
    type PortfolioHistoryPoint,
} from '../../utils/portfolioHistory';

interface PortfolioHistoryChartProps {
    data: PortfolioHistoryPoint[];
    memberSeries?: MemberPortfolioHistory[];
    chartTheme: ChartTheme;
}

const MEMBER_COLORS = ['#3b82f6', '#10b981', '#a855f7', '#06b6d4', '#ec4899', '#6366f1'];

const fmt2 = (val: number) =>
    val.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtCurrency = (val: number) =>
    val < 0 ? `-$${fmt2(Math.abs(val))}` : `$${fmt2(val)}`;

const fmtShortCurrency = (val: number) => {
    const sign = val < 0 ? '-' : '';
    const abs = Math.abs(val);
    return abs >= 1000 ? `${sign}$${(abs / 1000).toFixed(1)}k` : `${sign}$${abs.toFixed(0)}`;
};

const formatDateLabel = (val: string) => {
    const d = new Date(val.includes('T') ? val : `${val}T12:00:00`);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

const formatAxisMonthYear = (val: string) => {
    const d = new Date(val.includes('T') ? val : `${val}T12:00:00`);
    return `${d.getMonth() + 1}/${d.getFullYear().toString().slice(2)}`;
};

export const PortfolioHistoryChart: React.FC<PortfolioHistoryChartProps> = React.memo(
    ({ data, memberSeries, chartTheme }) => {
        const activeMembers = useMemo(
            () => (memberSeries ?? []).filter(m => m.data.length > 0),
            [memberSeries]
        );
        const hasMultipleMembers = activeMembers.length > 1;

        // 'combined' | 'individual' | memberId
        const [viewMode, setViewMode] = useState<string>('combined');

        const effectiveView =
            !hasMultipleMembers
                ? 'combined'
                : viewMode === 'combined' ||
                    viewMode === 'individual' ||
                    activeMembers.some(m => m.id === viewMode)
                  ? viewMode
                  : 'combined';

        const selectedMember = useMemo(
            () => activeMembers.find(m => m.id === effectiveView) ?? null,
            [activeMembers, effectiveView]
        );

        const singleSeriesData = selectedMember ? selectedMember.data : data;
        const singleSeriesColor = selectedMember
            ? MEMBER_COLORS[activeMembers.indexOf(selectedMember) % MEMBER_COLORS.length]
            : '#3b82f6';
        const gradientId = selectedMember ? `colorValue-${selectedMember.id}` : 'colorValue-combined';

        const extremes = useMemo(
            () => getHistoryExtremes(singleSeriesData),
            [singleSeriesData]
        );

        const mergedIndividualData = useMemo(
            () => (effectiveView === 'individual' ? mergeMemberHistories(activeMembers) : []),
            [effectiveView, activeMembers]
        );

        const memberExtremes = useMemo(
            () =>
                effectiveView === 'individual'
                    ? activeMembers.map((m, idx) => ({
                          id: m.id,
                          name: m.name,
                          color: MEMBER_COLORS[idx % MEMBER_COLORS.length],
                          extremes: getHistoryExtremes(m.data),
                      }))
                    : [],
            [effectiveView, activeMembers]
        );

        return (
            <section className="bg-slate-800/95 border border-slate-700/90 rounded-2xl p-6 shadow-xl">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-700/70">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2.5 tracking-tight">
                        <TrendingUp size={20} className="text-blue-400" />
                        <span>Portfolio Value History</span>
                    </h3>

                    {hasMultipleMembers ? (
                        <div className="flex flex-wrap items-center gap-1.5 bg-slate-900/70 p-1 rounded-xl border border-slate-700/70">
                            <button
                                type="button"
                                onClick={() => setViewMode('combined')}
                                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                                    effectiveView === 'combined'
                                        ? 'bg-blue-600 text-white shadow-sm'
                                        : 'text-slate-300 hover:text-white hover:bg-slate-800'
                                }`}
                            >
                                Combined
                            </button>
                            <button
                                type="button"
                                onClick={() => setViewMode('individual')}
                                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                                    effectiveView === 'individual'
                                        ? 'bg-blue-600 text-white shadow-sm'
                                        : 'text-slate-300 hover:text-white hover:bg-slate-800'
                                }`}
                            >
                                Individual
                            </button>
                            {activeMembers.map(member => (
                                <button
                                    key={member.id}
                                    type="button"
                                    onClick={() => setViewMode(member.id)}
                                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                                        effectiveView === member.id
                                            ? 'bg-blue-600 text-white shadow-sm'
                                            : 'text-slate-300 hover:text-white hover:bg-slate-800'
                                    }`}
                                >
                                    {member.name}
                                </button>
                            ))}
                        </div>
                    ) : (
                        <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                            Net Worth Trend
                        </span>
                    )}
                </div>

                {/* Highest & Lowest Summary */}
                {effectiveView !== 'individual' && extremes && (
                    <div className="flex flex-wrap items-center gap-3 mb-4">
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900/60 border border-slate-700/70 text-xs">
                            <ArrowUpRight size={14} className="text-emerald-400 shrink-0" />
                            <span className="text-slate-300 font-medium">Highest:</span>
                            <span className="font-mono font-bold text-emerald-400">
                                {fmtCurrency(extremes.high.value)}
                            </span>
                            <span className="text-slate-400">({formatDateLabel(extremes.high.name)})</span>
                        </div>
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900/60 border border-slate-700/70 text-xs">
                            <ArrowDownRight size={14} className="text-rose-400 shrink-0" />
                            <span className="text-slate-300 font-medium">Lowest:</span>
                            <span className="font-mono font-bold text-rose-400">
                                {fmtCurrency(extremes.low.value)}
                            </span>
                            <span className="text-slate-400">({formatDateLabel(extremes.low.name)})</span>
                        </div>
                    </div>
                )}

                {effectiveView === 'individual' && memberExtremes.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2.5 mb-4">
                        {memberExtremes.map(m =>
                            m.extremes ? (
                                <div
                                    key={m.id}
                                    className="flex flex-wrap items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900/60 border border-slate-700/70 text-xs"
                                >
                                    <span
                                        className="w-2.5 h-2.5 rounded-full shrink-0"
                                        style={{ backgroundColor: m.color }}
                                    />
                                    <span className="font-semibold text-white">{m.name}:</span>
                                    <span className="text-emerald-400 font-mono font-semibold">
                                        High {fmtCurrency(m.extremes.high.value)}
                                    </span>
                                    <span className="text-slate-500">·</span>
                                    <span className="text-rose-400 font-mono font-semibold">
                                        Low {fmtCurrency(m.extremes.low.value)}
                                    </span>
                                </div>
                            ) : null
                        )}
                    </div>
                )}

                <div className="h-[300px] w-full bg-slate-900/50 border border-slate-700/60 rounded-xl p-3">
                    <ResponsiveContainer width="100%" height="100%">
                        {effectiveView === 'individual' ? (
                            <LineChart
                                data={mergedIndividualData}
                                margin={{ top: 12, right: 12, left: 0, bottom: 0 }}
                            >
                                <CartesianGrid
                                    strokeDasharray="3 3"
                                    stroke={chartTheme.gridColor}
                                    vertical={false}
                                />
                                <XAxis
                                    dataKey="name"
                                    tickFormatter={formatAxisMonthYear}
                                    interval={Math.max(1, Math.floor(mergedIndividualData.length / 5))}
                                    tick={{ fill: chartTheme.tickColor, fontSize: 11 }}
                                    axisLine={false}
                                    tickLine={false}
                                />
                                <YAxis
                                    domain={['auto', 'auto']}
                                    orientation="right"
                                    tickFormatter={(val) => `$${(val / 1000).toFixed(0)}k`}
                                    tick={{ fill: chartTheme.tickColor, fontSize: 11 }}
                                    tickLine={false}
                                    axisLine={false}
                                    width={56}
                                />
                                <Tooltip
                                    formatter={(value, name) => [
                                        value === null || value === undefined
                                            ? '—'
                                            : fmtCurrency(Number(value)),
                                        String(name),
                                    ]}
                                    labelFormatter={(label) => formatDateLabel(String(label))}
                                    contentStyle={chartTheme.tooltipStyle}
                                    itemStyle={chartTheme.tooltipItemStyle}
                                    labelStyle={chartTheme.tooltipLabelStyle}
                                />
                                <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '6px' }} />
                                {activeMembers.map((member, idx) => (
                                    <Line
                                        key={member.id}
                                        type="monotone"
                                        dataKey={member.id}
                                        name={member.name}
                                        stroke={MEMBER_COLORS[idx % MEMBER_COLORS.length]}
                                        strokeWidth={2.5}
                                        dot={false}
                                        connectNulls={false}
                                        isAnimationActive={false}
                                    />
                                ))}
                            </LineChart>
                        ) : (
                            <AreaChart
                                data={singleSeriesData}
                                margin={{ top: 18, right: 12, left: 0, bottom: 0 }}
                            >
                                <defs>
                                    <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor={singleSeriesColor} stopOpacity={0.32} />
                                        <stop offset="95%" stopColor={singleSeriesColor} stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid
                                    strokeDasharray="3 3"
                                    stroke={chartTheme.gridColor}
                                    vertical={false}
                                />
                                <XAxis
                                    dataKey="name"
                                    tickFormatter={formatAxisMonthYear}
                                    interval={Math.max(1, Math.floor(singleSeriesData.length / 5))}
                                    tick={{ fill: chartTheme.tickColor, fontSize: 11 }}
                                    axisLine={false}
                                    tickLine={false}
                                />
                                <YAxis
                                    domain={['auto', 'auto']}
                                    orientation="right"
                                    tickFormatter={(val) => `$${(val / 1000).toFixed(0)}k`}
                                    tick={{ fill: chartTheme.tickColor, fontSize: 11 }}
                                    tickLine={false}
                                    axisLine={false}
                                    width={56}
                                />
                                <Tooltip
                                    formatter={(value) => [
                                        fmtCurrency(Number(value)),
                                        selectedMember ? selectedMember.name : 'Net Worth',
                                    ]}
                                    labelFormatter={(label) => formatDateLabel(String(label))}
                                    contentStyle={chartTheme.tooltipStyle}
                                    itemStyle={chartTheme.tooltipItemStyle}
                                    labelStyle={chartTheme.tooltipLabelStyle}
                                />
                                {extremes && (
                                    <ReferenceLine
                                        y={extremes.high.value}
                                        stroke="#10b981"
                                        strokeDasharray="4 4"
                                        strokeOpacity={0.65}
                                        label={{
                                            value: `High ${fmtShortCurrency(extremes.high.value)}`,
                                            position: 'insideTopLeft',
                                            fill: '#10b981',
                                            fontSize: 11,
                                            fontWeight: 600,
                                        }}
                                    />
                                )}
                                {extremes && extremes.low.value !== extremes.high.value && (
                                    <ReferenceLine
                                        y={extremes.low.value}
                                        stroke="#fb7185"
                                        strokeDasharray="4 4"
                                        strokeOpacity={0.65}
                                        label={{
                                            value: `Low ${fmtShortCurrency(extremes.low.value)}`,
                                            position: 'insideBottomLeft',
                                            fill: '#fb7185',
                                            fontSize: 11,
                                            fontWeight: 600,
                                        }}
                                    />
                                )}
                                <Area
                                    type="monotone"
                                    dataKey="value"
                                    stroke={singleSeriesColor}
                                    strokeWidth={2.5}
                                    fillOpacity={1}
                                    fill={`url(#${gradientId})`}
                                    isAnimationActive={false}
                                />
                            </AreaChart>
                        )}
                    </ResponsiveContainer>
                </div>
            </section>
        );
    }
);

PortfolioHistoryChart.displayName = 'PortfolioHistoryChart';
