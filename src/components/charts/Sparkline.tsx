import React, { useId } from 'react';
import { Area, AreaChart, ResponsiveContainer, Tooltip, YAxis } from 'recharts';
import type { ChartTheme } from '../../hooks/useChartTheme';

interface SparklineProps {
    data: { price: number; date?: string }[];
    isPositive: boolean;
    chartTheme: ChartTheme;
    showTooltip?: boolean;
}

const fmt2 = (val: number) =>
    val.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const Sparkline: React.FC<SparklineProps> = React.memo(
    ({ data, isPositive, chartTheme, showTooltip = true }) => {
        const gradientId = useId();
        const strokeColor = isPositive ? '#4ade80' : '#f87171';

        return (
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data}>
                    <defs>
                        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={strokeColor} stopOpacity={0.32} />
                            <stop offset="95%" stopColor={strokeColor} stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    {showTooltip && (
                        <Tooltip
                            contentStyle={chartTheme.tooltipStyle}
                            itemStyle={chartTheme.tooltipItemStyle}
                            formatter={(value) => [`$${fmt2(Number(value))}`, 'Price']}
                            labelStyle={{ display: 'none' }}
                            cursor={{ stroke: chartTheme.cursorStroke, strokeWidth: 1 }}
                        />
                    )}
                    <YAxis domain={['auto', 'auto']} hide />
                    <Area
                        type="monotone"
                        dataKey="price"
                        stroke={strokeColor}
                        strokeWidth={2}
                        fill={`url(#${gradientId})`}
                        isAnimationActive={false}
                    />
                </AreaChart>
            </ResponsiveContainer>
        );
    }
);

Sparkline.displayName = 'Sparkline';
