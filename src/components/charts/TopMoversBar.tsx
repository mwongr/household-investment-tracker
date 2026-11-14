import React from 'react';
import {
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import type { ChartTheme } from '../../hooks/useChartTheme';

interface TopMoversBarProps {
    title: string;
    icon: React.ReactNode;
    data: { name: string; value: number }[];
    variant: 'positive' | 'negative';
    chartTheme: ChartTheme;
}

export const TopMoversBar: React.FC<TopMoversBarProps> = React.memo(
    ({ title, icon, data, variant, chartTheme }) => {
        const primary = variant === 'positive' ? '#10b981' : '#ef4444';
        const secondary = variant === 'positive' ? '#34d399' : '#f87171';

        return (
            <div className="bg-slate-800/95 border border-slate-700/90 rounded-2xl p-6 shadow-xl h-[410px] flex flex-col">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2.5 pb-3 border-b border-slate-700/70">
                    {icon}
                    <span>{title}</span>
                </h3>
                <div className="flex-1 w-full min-h-0 bg-slate-900/50 border border-slate-700/60 rounded-xl p-2">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                            layout="vertical"
                            data={data}
                            margin={{ top: 8, right: 24, left: 10, bottom: 8 }}
                        >
                            <CartesianGrid
                                strokeDasharray="3 3"
                                stroke={chartTheme.gridColor}
                                horizontal={false}
                            />
                            <XAxis
                                type="number"
                                unit="%"
                                tick={{ fill: chartTheme.tickColor, fontSize: 11 }}
                                axisLine={false}
                                tickLine={false}
                            />
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
                            <Bar dataKey="value" fill={primary} radius={[0, 6, 6, 0]} isAnimationActive={false}>
                                {data.map((_entry, index) => (
                                    <Cell key={`cell-${index}`} fill={index === 0 ? primary : secondary} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
        );
    }
);

TopMoversBar.displayName = 'TopMoversBar';
