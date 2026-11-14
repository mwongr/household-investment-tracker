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
        }),
        [isDark]
    );
}
