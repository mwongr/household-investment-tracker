import { useMemo } from 'react';
import { useTheme } from '../context/ThemeContext';

export interface ChartTheme {
    isDark: boolean;
    tickColor: string;
    gridColor: string;
    tooltipStyle: React.CSSProperties;
    tooltipItemStyle: React.CSSProperties;
    tooltipLabelStyle: React.CSSProperties;
    cursorFill: string;
    cursorStroke: string;
}

export function useChartTheme(): ChartTheme {
    const { theme } = useTheme();
    const isDark = theme === 'dark';

    return useMemo<ChartTheme>(
        () => ({
            isDark,
            tickColor: isDark ? '#94a3b8' : '#57534E',
            gridColor: isDark ? 'rgba(148, 163, 184, 0.14)' : 'rgba(28, 25, 23, 0.08)',
            tooltipStyle: {
                backgroundColor: isDark ? '#0f172a' : '#ffffff',
                borderColor: isDark ? '#334155' : '#e4ddd0',
                borderRadius: '0.75rem',
                color: isDark ? '#f8fafc' : '#1c1917',
                fontSize: '12px',
                padding: '8px 12px',
                boxShadow: isDark
                    ? '0 10px 25px -5px rgba(0,0,0,0.4)'
                    : '0 10px 25px -5px rgba(28, 25, 23, 0.12)',
            },
            tooltipItemStyle: {
                color: isDark ? '#f8fafc' : '#1c1917',
                fontWeight: 700,
                fontFamily: 'monospace',
            },
            tooltipLabelStyle: {
                color: isDark ? '#cbd5e1' : '#57534e',
                fontWeight: 600,
                marginBottom: '2px',
            },
            cursorFill: isDark ? 'rgba(148, 163, 184, 0.12)' : 'rgba(28, 25, 23, 0.06)',
            cursorStroke: isDark ? '#64748b' : '#78716c',
        }),
        [isDark]
    );
}
