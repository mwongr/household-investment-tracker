import React, { useState } from 'react';
import {
    Bar,
    BarChart,
    CartesianGrid,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import { BarChart3 } from 'lucide-react';
import type { ChartTheme } from '../../hooks/useChartTheme';
import type { AnnualPayoutPoint, MonthlyPayoutPoint } from '../../types/dividends';

interface MonthlyPayoutsChartProps {
    data: MonthlyPayoutPoint[];
    annualData: AnnualPayoutPoint[];
    currentYear: number;
    chartTheme: ChartTheme;
}

type ChartViewMode = 'current' | 'yoy' | 'annual';

const fmtCad = (val: number) =>
    new Intl.NumberFormat('en-CA', {
        style: 'currency',
        currency: 'CAD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(val);

interface TooltipPayloadEntry<T> {
    dataKey?: string;
    payload?: T;
}

interface CustomTooltipProps {
    active?: boolean;
    payload?: TooltipPayloadEntry<MonthlyPayoutPoint>[];
    label?: string;
    currentYear: number;
    showYoY: boolean;
    chartTheme: ChartTheme;
}

const MonthlyTooltip: React.FC<CustomTooltipProps> = ({
    active,
    payload,
    label,
    currentYear,
    showYoY,
    chartTheme,
}) => {
    if (!active || !payload || payload.length === 0) return null;
    const point = payload[0]?.payload;
    if (!point) return null;

    const yoyDelta =
        point.previous > 0
            ? ((point.current - point.previous) / point.previous) * 100
            : null;

    return (
        <div
            style={chartTheme.tooltipStyle}
            className="border text-xs space-y-1.5 min-w-[190px]"
        >
            <div style={chartTheme.tooltipLabelStyle} className="font-semibold">
                {label} {currentYear}
            </div>
            <div className="flex items-center justify-between gap-4">
                <span className="text-emerald-500 font-medium">Total ({currentYear})</span>
                <span className="font-mono font-bold tabular-nums">{fmtCad(point.current)}</span>
            </div>
            <div className="flex items-center justify-between gap-4 text-[11px] opacity-80">
                <span>Cash / DRIP</span>
                <span className="font-mono tabular-nums">
                    {fmtCad(point.currentCash)} / {fmtCad(point.currentReinvested)}
                </span>
            </div>
            {showYoY && (
                <>
                    <div className="border-t border-slate-700/40 pt-1 flex items-center justify-between gap-4">
                        <span className="opacity-80">{currentYear - 1}</span>
                        <span className="font-mono font-semibold tabular-nums">
                            {fmtCad(point.previous)}
                        </span>
                    </div>
                    {yoyDelta !== null && (
                        <div className="flex items-center justify-between gap-4 text-[11px]">
                            <span className="opacity-75">YoY Change</span>
                            <span
                                className={`font-mono font-semibold tabular-nums ${
                                    yoyDelta >= 0 ? 'text-emerald-400' : 'text-red-400'
                                }`}
                            >
                                {yoyDelta >= 0 ? '+' : ''}
                                {yoyDelta.toFixed(1)}%
                            </span>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

interface AnnualTooltipProps {
    active?: boolean;
    payload?: TooltipPayloadEntry<AnnualPayoutPoint>[];
    label?: string;
    chartTheme: ChartTheme;
}

const AnnualTooltip: React.FC<AnnualTooltipProps> = ({
    active,
    payload,
    label,
    chartTheme,
}) => {
    if (!active || !payload || payload.length === 0) return null;
    const point = payload[0]?.payload;
    if (!point) return null;

    return (
        <div
            style={chartTheme.tooltipStyle}
            className="border text-xs space-y-1.5 min-w-[190px]"
        >
            <div style={chartTheme.tooltipLabelStyle} className="font-semibold">
                {label} Total
            </div>
            <div className="flex items-center justify-between gap-4">
                <span className="text-emerald-500 font-medium">Total</span>
                <span className="font-mono font-bold tabular-nums">{fmtCad(point.total)}</span>
            </div>
            <div className="flex items-center justify-between gap-4 text-[11px] opacity-80">
                <span>Cash / DRIP</span>
                <span className="font-mono tabular-nums">
                    {fmtCad(point.cash)} / {fmtCad(point.reinvested)}
                </span>
            </div>
        </div>
    );
};

export const MonthlyPayoutsChart: React.FC<MonthlyPayoutsChartProps> = React.memo(
    ({ data, annualData, currentYear, chartTheme }) => {
        const [viewMode, setViewMode] = useState<ChartViewMode>('yoy');
        const hasMonthlyData = data.some((d) => d.current > 0 || d.previous > 0);
        const hasAnnualData = annualData.length > 0;
        const hasAnyData = viewMode === 'annual' ? hasAnnualData : hasMonthlyData;

        return (
            <section className="bg-slate-800/95 border border-slate-700/90 rounded-2xl p-5 flex flex-col">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                    <div className="flex items-center gap-2.5">
                        <BarChart3 size={18} className="text-blue-400" />
                        <div>
                            <h2 className="text-base font-bold text-white tracking-tight">
                                {viewMode === 'annual'
                                    ? 'Annual Dividend Payouts'
                                    : 'Monthly Dividend Payouts'}
                            </h2>
                            <p className="text-xs text-slate-400">
                                Cash &amp; reinvested dividends recorded in CAD
                            </p>
                        </div>
                    </div>

                    <div className="inline-flex flex-wrap rounded-lg border border-slate-700 bg-slate-900/70 p-0.5 text-xs">
                        <button
                            type="button"
                            onClick={() => setViewMode('current')}
                            className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                                viewMode === 'current'
                                    ? 'bg-slate-700 text-white'
                                    : 'text-slate-400 hover:text-white'
                            }`}
                        >
                            {currentYear} Only
                        </button>
                        <button
                            type="button"
                            onClick={() => setViewMode('yoy')}
                            className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                                viewMode === 'yoy'
                                    ? 'bg-slate-700 text-white'
                                    : 'text-slate-400 hover:text-white'
                            }`}
                        >
                            YoY ({currentYear - 1} vs {currentYear})
                        </button>
                        <button
                            type="button"
                            onClick={() => setViewMode('annual')}
                            className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                                viewMode === 'annual'
                                    ? 'bg-slate-700 text-white'
                                    : 'text-slate-400 hover:text-white'
                            }`}
                        >
                            Annual (All Years)
                        </button>
                    </div>
                </div>

                {!hasAnyData ? (
                    <div className="h-[260px] flex items-center justify-center text-sm text-slate-400 border border-dashed border-slate-700/80 rounded-xl">
                        {viewMode === 'annual'
                            ? 'No dividend transactions recorded yet.'
                            : `No dividend transactions recorded for ${currentYear - 1}–${currentYear} yet.`}
                    </div>
                ) : viewMode === 'annual' ? (
                    <div className="h-[280px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                                data={annualData}
                                margin={{ top: 10, right: 12, left: 0, bottom: 4 }}
                            >
                                <CartesianGrid
                                    strokeDasharray="3 3"
                                    stroke={chartTheme.gridColor}
                                    vertical={false}
                                />
                                <XAxis
                                    dataKey="year"
                                    tick={{ fill: chartTheme.tickColor, fontSize: 12 }}
                                    axisLine={false}
                                    tickLine={false}
                                />
                                <YAxis
                                    tick={{ fill: chartTheme.tickColor, fontSize: 11 }}
                                    axisLine={false}
                                    tickLine={false}
                                    width={56}
                                    tickFormatter={(v: number) => `$${Math.round(v)}`}
                                />
                                <Tooltip
                                    cursor={{ fill: chartTheme.cursorFill }}
                                    content={<AnnualTooltip chartTheme={chartTheme} />}
                                />
                                <Bar
                                    dataKey="total"
                                    name="Total"
                                    fill="#10b981"
                                    radius={[4, 4, 0, 0]}
                                    isAnimationActive={false}
                                />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                ) : (
                    <div className="h-[280px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                                data={data}
                                margin={{ top: 10, right: 12, left: 0, bottom: 4 }}
                            >
                                <CartesianGrid
                                    strokeDasharray="3 3"
                                    stroke={chartTheme.gridColor}
                                    vertical={false}
                                />
                                <XAxis
                                    dataKey="month"
                                    tick={{ fill: chartTheme.tickColor, fontSize: 12 }}
                                    axisLine={false}
                                    tickLine={false}
                                />
                                <YAxis
                                    tick={{ fill: chartTheme.tickColor, fontSize: 11 }}
                                    axisLine={false}
                                    tickLine={false}
                                    width={56}
                                    tickFormatter={(v: number) => `$${Math.round(v)}`}
                                />
                                <Tooltip
                                    cursor={{ fill: chartTheme.cursorFill }}
                                    content={
                                        <MonthlyTooltip
                                            currentYear={currentYear}
                                            showYoY={viewMode === 'yoy'}
                                            chartTheme={chartTheme}
                                        />
                                    }
                                />
                                {viewMode === 'yoy' && (
                                    <Bar
                                        dataKey="previous"
                                        name={String(currentYear - 1)}
                                        fill={chartTheme.isDark ? '#475569' : '#cbd5e1'}
                                        radius={[4, 4, 0, 0]}
                                        isAnimationActive={false}
                                    />
                                )}
                                <Bar
                                    dataKey="current"
                                    name={String(currentYear)}
                                    fill="#10b981"
                                    radius={[4, 4, 0, 0]}
                                    isAnimationActive={false}
                                />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </section>
        );
    }
);

MonthlyPayoutsChart.displayName = 'MonthlyPayoutsChart';
