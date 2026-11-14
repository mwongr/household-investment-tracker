import React from 'react';
import { TrendingUp } from 'lucide-react';
import {
    Area,
    AreaChart,
    CartesianGrid,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import type { ChartTheme } from '../../hooks/useChartTheme';

interface PortfolioHistoryChartProps {
    data: { name: string; value: number }[];
    chartTheme: ChartTheme;
}

const fmt2 = (val: number) =>
    val.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const PortfolioHistoryChart: React.FC<PortfolioHistoryChartProps> = React.memo(
    ({ data, chartTheme }) => (
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
                    <AreaChart data={data} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                        <defs>
                            <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.32} />
                                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid
                            strokeDasharray="3 3"
                            stroke={chartTheme.gridColor}
                            vertical={false}
                        />
                        <XAxis
                            dataKey="name"
                            tickFormatter={(val) => {
                                const d = new Date(val.includes('T') ? val : `${val}T12:00:00`);
                                return `${d.getMonth() + 1}/${d.getFullYear().toString().slice(2)}`;
                            }}
                            interval={Math.max(1, Math.floor(data.length / 5))}
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
                            formatter={(value) => [`$${fmt2(Number(value))}`, 'Net Worth']}
                            labelFormatter={(label) => {
                                const str = String(label);
                                return new Date(
                                    str.includes('T') ? str : `${str}T12:00:00`
                                ).toLocaleDateString();
                            }}
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
                            isAnimationActive={false}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </section>
    )
);

PortfolioHistoryChart.displayName = 'PortfolioHistoryChart';
