import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ReferenceLine,
} from 'recharts';
import { Plus, X, TrendingUp, TrendingDown, BarChart2, AlertCircle, Loader2 } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import type { CompareRange, CompareApiResponse } from '../types';

// ─── Constants ────────────────────────────────────────────────────────────────
const API_BASE = '';

const SERIES_COLORS = [
  '#3b82f6', // blue
  '#10b981', // emerald
  '#f59e0b', // amber
  '#a855f7', // purple
  '#ef4444', // red
  '#06b6d4', // cyan
  '#ec4899', // pink
  '#84cc16', // lime
];

const RANGES: { label: string; value: CompareRange }[] = [
  { label: '1M',  value: '1mo' },
  { label: '6M',  value: '6mo' },
  { label: '1Y',  value: '1y'  },
  { label: '5Y',  value: '5y'  },
  { label: 'YTD', value: 'ytd' },
];

const DEFAULT_TICKERS = ['XEQT.TO', 'XGRO.TO'];

// ─── Helpers ─────────────────────────────────────────────────────────────────
function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: '2-digit' });
}

function formatPct(val: number | null | undefined): string {
  if (val == null) return '—';
  return (val >= 0 ? '+' : '') + val.toFixed(2) + '%';
}

interface CompareTooltipProps {
  active?: boolean;
  payload?: Array<{ dataKey: string; color: string; value: number }>;
  label?: string;
  isDark: boolean;
}

// Custom Recharts Tooltip
const CompareTooltip = ({ active, payload, label, isDark }: CompareTooltipProps) => {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: isDark ? '#0f172a' : '#ffffff',
        border: `1px solid ${isDark ? '#334155' : '#cbd5e1'}`,
        borderRadius: '0.75rem',
        padding: '0.75rem 1rem',
        fontSize: '0.82rem',
        minWidth: '195px',
        boxShadow: '0 10px 25px -5px rgba(0,0,0,0.25)',
      }}
    >
      <p
        style={{
          color: isDark ? '#cbd5e1' : '#475569',
          marginBottom: '0.45rem',
          fontSize: '0.72rem',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}
      >
        {label ? formatDate(label) : ''}
      </p>
      {payload.map((entry) => {
        const posColor = isDark ? '#34d399' : '#059669';
        const negColor = isDark ? '#f87171' : '#dc2626';
        return (
          <div
            key={entry.dataKey}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '1.25rem',
              marginBottom: '0.25rem',
            }}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: isDark ? '#f8fafc' : '#0f172a', fontWeight: 700 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: entry.color, display: 'inline-block' }} />
              {entry.dataKey}
            </span>
            <span
              style={{
                color: entry.value >= 0 ? posColor : negColor,
                fontWeight: 700,
                fontFamily: 'monospace',
              }}
            >
              {formatPct(entry.value)}
            </span>
          </div>
        );
      })}
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────
const StockComparison: React.FC = () => {
  const [tickers, setTickers] = useState<string[]>(DEFAULT_TICKERS);
  const [inputValue, setInputValue] = useState('');
  const [range, setRange] = useState<CompareRange>('1y');
  const [data, setData] = useState<CompareApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState('');
  const { theme } = useTheme();

  const isDark = theme === 'dark';
  const tickColor = isDark ? '#94a3b8' : '#475569';
  const gridColor = isDark ? 'rgba(148, 163, 184, 0.14)' : 'rgba(15, 23, 42, 0.08)';
  const zeroLineColor = isDark ? 'rgba(148, 163, 184, 0.35)' : 'rgba(15, 23, 42, 0.25)';

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Fetch ────────────────────────────────────────────────────────────────
  const fetchComparison = useCallback(async (symbols: string[], selectedRange: CompareRange) => {
    if (symbols.length === 0) { setData(null); return; }
    setLoading(true);
    setFetchError('');
    try {
      const url = `${API_BASE}/api/stocks/compare?symbols=${symbols.join(',')}&range=${selectedRange}`;
      const res = await fetch(url);
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const json: CompareApiResponse = await res.json();
      setData(json);
    } catch (e: unknown) {
      setFetchError(e instanceof Error ? e.message : 'Failed to load comparison data');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      fetchComparison(tickers, range);
    }, 400);
    return () => { if (debounceTimer.current) clearTimeout(debounceTimer.current); };
  }, [tickers, range, fetchComparison]);

  // ── Ticker management ────────────────────────────────────────────────────
  const addTicker = (raw: string) => {
    const sym = raw.trim().toUpperCase();
    if (!sym || tickers.includes(sym) || tickers.length >= 8) return;
    setTickers(prev => [...prev, sym]);
    setInputValue('');
  };

  const removeTicker = (sym: string) => setTickers(prev => prev.filter(t => t !== sym));

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTicker(inputValue);
    }
  };

  // ── Chart data preparation ────────────────────────────────────────────────
  const chartData = data
    ? data.dates.map((date, i) => {
        const row: Record<string, string | number | null> = { date };
        for (const sym of Object.keys(data.series)) {
          row[sym] = data.series[sym][i];
        }
        return row;
      })
    : [];

  const xTickCount = range === '5y' ? 6 : range === '1y' ? 12 : range === '6mo' ? 6 : 4;
  const successSymbols = data ? Object.keys(data.series) : [];

  return (
    <section className="space-y-5">
      {/* Section Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-indigo-500/15 border border-indigo-500/35 text-indigo-400">
            <BarChart2 size={20} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">Performance Comparison</h2>
            <p className="text-xs text-slate-300">
              Normalized % total return (dividend-adjusted) — all symbols indexed to 0% at period start
            </p>
          </div>
        </div>
      </div>

      {/* Controls Panel */}
      <div className="bg-slate-800/95 border border-slate-700/90 rounded-2xl p-5 shadow-xl flex flex-col lg:flex-row gap-5 items-start justify-between">
        {/* Ticker Input + Pills */}
        <div className="flex-1 w-full space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs text-slate-300 uppercase tracking-wider font-bold">
              Selected Symbols ({tickers.length}/8)
            </label>
            <span className="text-xs text-slate-400 hidden sm:inline">
              Press Enter or comma to add (use .TO for TSX)
            </span>
          </div>

          {/* Pill badges */}
          <div className="flex flex-wrap gap-2">
            {tickers.map((sym, i) => {
              const color = SERIES_COLORS[i % SERIES_COLORS.length];
              return (
                <span
                  key={sym}
                  style={{
                    backgroundColor: `${color}18`,
                    borderColor: `${color}66`,
                  }}
                  className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold font-mono border text-white"
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: color }}
                  />
                  <span>{sym}</span>
                  <button
                    onClick={() => removeTicker(sym)}
                    title={`Remove ${sym}`}
                    aria-label={`Remove ${sym}`}
                    className="p-0.5 rounded-full text-slate-300 hover:text-white hover:bg-slate-700/70 transition-colors"
                  >
                    <X size={12} />
                  </button>
                </span>
              );
            })}
            {tickers.length === 0 && (
              <span className="text-xs text-slate-400 italic py-1">Add tickers below to compare performance…</span>
            )}
          </div>

          {/* Input row */}
          <div className="flex gap-2 max-w-md">
            <input
              type="text"
              placeholder="e.g. AAPL, XEQT.TO, VFV.TO"
              value={inputValue}
              onChange={e => setInputValue(e.target.value.toUpperCase())}
              onKeyDown={handleKeyDown}
              disabled={tickers.length >= 8}
              className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white placeholder-slate-400 font-medium focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
            />
            <button
              onClick={() => addTicker(inputValue)}
              disabled={!inputValue.trim() || tickers.length >= 8}
              style={{ color: '#ffffff' }}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-45 disabled:cursor-not-allowed rounded-xl text-sm font-semibold transition-colors shrink-0"
            >
              <Plus size={15} /> Add
            </button>
          </div>
        </div>

        {/* Range Selector */}
        <div className="space-y-2 shrink-0">
          <label className="text-xs text-slate-300 uppercase tracking-wider font-bold block">
            Time Frame
          </label>
          <div className="flex gap-1 bg-slate-900 border border-slate-700/90 p-1 rounded-xl">
            {RANGES.map(r => (
              <button
                key={r.value}
                onClick={() => setRange(r.value)}
                style={range === r.value ? { color: '#ffffff' } : undefined}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                  range === r.value
                    ? 'bg-blue-600 shadow-sm'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Error banner for individual failed symbols */}
      {data && Object.keys(data.errors).length > 0 && (
        <div className="bg-red-500/15 border border-red-500/35 rounded-xl px-4 py-3 flex items-start gap-2.5 text-red-400 text-sm">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <div>
            <strong>Could not load:</strong>{' '}
            {Object.entries(data.errors).map(([sym, err]) => `${sym} (${err})`).join(' · ')}
          </div>
        </div>
      )}

      {/* Global fetch error */}
      {fetchError && (
        <div className="bg-red-500/15 border border-red-500/35 rounded-xl px-4 py-3 text-sm text-red-400 flex items-center gap-2.5">
          <AlertCircle size={16} className="shrink-0" />
          <span>{fetchError}</span>
        </div>
      )}

      {/* Chart Panel */}
      <div className="bg-slate-800/95 border border-slate-700/90 rounded-2xl p-6 shadow-xl relative min-h-[380px]">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-900/70 backdrop-blur-[2px] rounded-2xl z-10">
            <div className="flex flex-col items-center gap-3">
              <Loader2 size={30} className="text-blue-400 animate-spin" />
              <p className="text-slate-200 text-sm font-medium">Fetching historical comparison…</p>
            </div>
          </div>
        )}

        {!loading && tickers.length === 0 && (
          <div className="flex flex-col items-center justify-center h-[320px] gap-2.5">
            <BarChart2 size={36} className="text-slate-400" />
            <p className="text-slate-300 text-sm font-medium">Add at least one ticker above to compare returns</p>
          </div>
        )}

        {!loading && !fetchError && chartData.length > 0 && (
          <div className="bg-slate-900/50 border border-slate-700/60 rounded-xl p-3">
            <ResponsiveContainer width="100%" height={340}>
              <LineChart data={chartData} margin={{ top: 12, right: 20, left: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatDate}
                  tick={{ fill: tickColor, fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  interval={Math.max(1, Math.floor(chartData.length / xTickCount))}
                />
                <YAxis
                  tickFormatter={v => `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`}
                  tick={{ fill: tickColor, fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={60}
                />
                <Tooltip content={<CompareTooltip isDark={isDark} />} />
                <ReferenceLine y={0} stroke={zeroLineColor} strokeDasharray="4 4" />
                {successSymbols.map((sym, i) => (
                  <Line
                    key={sym}
                    type="monotone"
                    dataKey={sym}
                    stroke={SERIES_COLORS[i % SERIES_COLORS.length]}
                    strokeWidth={2.25}
                    dot={false}
                    activeDot={{ r: 4.5, strokeWidth: 0 }}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Summary Table */}
      {data && successSymbols.length > 0 && (
        <div className="bg-slate-800/95 border border-slate-700/90 rounded-2xl shadow-xl overflow-hidden">
          <div className="px-5 py-3.5 bg-slate-900/90 border-b border-slate-700/80 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              Period Summary
            </h3>
            <span className="text-xs text-slate-400">
              Start: {data.dates[0] ?? '—'} · {data.dates.length} trading days
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-900/50 border-b border-slate-700/70">
                  {['Symbol', 'Start Price', 'Current Price', 'Total Return (adj.)'].map(h => (
                    <th
                      key={h}
                      className={`px-5 py-3 text-xs font-bold text-slate-300 uppercase tracking-wider ${
                        h === 'Symbol' ? 'text-left' : 'text-right'
                      }`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {successSymbols.map((sym, i) => {
                  const s = data.summary[sym];
                  const color = SERIES_COLORS[i % SERIES_COLORS.length];
                  const isPos = s.totalReturn >= 0;
                  return (
                    <tr key={sym} className="hover:bg-slate-750/60 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <span
                            className="w-3 h-3 rounded-full shrink-0"
                            style={{ backgroundColor: color }}
                          />
                          <span className="text-white font-bold font-mono text-sm">{sym}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono tabular-nums text-sm text-slate-300">
                        ${s.firstPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono tabular-nums text-sm text-white font-semibold">
                        ${s.currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-mono tabular-nums font-bold text-sm border ${
                            isPos
                              ? 'bg-green-500/15 border-green-500/35 text-green-400'
                              : 'bg-red-500/15 border-red-500/35 text-red-400'
                          }`}
                        >
                          {isPos ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                          {formatPct(s.totalReturn)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="px-5 py-2.5 bg-slate-900/40 border-t border-slate-700/60 text-right">
            <span className="text-xs text-slate-400">
              Data: Yahoo Finance (adjClose) · Cached 1h
            </span>
          </div>
        </div>
      )}
    </section>
  );
};

export default StockComparison;
