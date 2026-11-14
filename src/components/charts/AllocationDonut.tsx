import React from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import type { ChartTheme } from '../../hooks/useChartTheme';

const COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#06b6d4', '#6366f1'];

interface AllocationDonutProps {
    title: string;
    icon: React.ReactNode;
    data: { name: string; value: number }[];
    centerTotal?: number;
    chartTheme: ChartTheme;
}

export const AllocationDonut: React.FC<AllocationDonutProps> = React.memo(
    ({ title, icon, data, centerTotal, chartTheme }) => (
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
                                    isAnimationActive={false}
                                >
                                    {data.map((_entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    formatter={(value) =>
                                        `$${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`
                                    }
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
    )
);

AllocationDonut.displayName = 'AllocationDonut';
