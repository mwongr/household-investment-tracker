import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ReferenceLine,
} from 'recharts';
import { Plus, X, TrendingUp, TrendingDown, BarChart2, AlertCircle, Loader2 } from 'lucide-react';
import type { CompareRange, CompareApiResponse } from '../types';

// ─── Constants ────────────────────────────────────────────────────────────────
const API_BASE = 'http://localhost:3001';

const SERIES_COLORS = [
  '#3b82f6', // blue-500
  '#10b981', // emerald-500
  '#f59e0b', // amber-500
  '#a855f7', // purple-500
  '#ef4444', // red-500
  '#06b6d4', // cyan-500
  '#ec4899', // pink-500
  '#84cc16', // lime-500
];

const RANGES: { label: string; value: CompareRange }[] = [
  { label: '1M',  value: '1mo' },
  { label: '6M',  value: '6mo' },
  { label: '1Y',  value: '1y'  },
  { label: '5Y',  value: '5y'  },
  { label: 'YTD', value: 'ytd' },
];

// Default tickers to show on first load
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

// Custom Recharts Tooltip
const CompareTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: '#1e293b',
      border: '1px solid #334155',
      borderRadius: '0.75rem',
      padding: '0.75rem 1rem',
      fontSize: '0.8rem',
      minWidth: '180px',
    }}>
      <p style={{ color: '#94a3b8', marginBottom: '0.4rem', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label ? formatDate(label) : ''}
      </p>
      {payload.map((entry: any) => (
        <div key={entry.dataKey} style={{ display: 'flex', justifyContent: 'space-between', gap: '1.5rem', marginBottom: '0.2rem' }}>
          <span style={{ color: entry.color, fontWeight: 600 }}>{entry.dataKey}</span>
          <span style={{ color: entry.value >= 0 ? '#6ee7b7' : '#fca5a5', fontWeight: 700, fontFamily: 'monospace' }}>
            {formatPct(entry.value)}
          </span>
        </div>
      ))}
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
    } catch (e: any) {
      setFetchError(e.message || 'Failed to load comparison data');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-fetch when tickers or range change (with debounce)
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
    if (e.key === 'Enter') { e.preventDefault(); addTicker(inputValue); }
    if (e.key === ',')     { e.preventDefault(); addTicker(inputValue); }
  };

  // ── Chart data preparation ────────────────────────────────────────────────
  const chartData = data
    ? data.dates.map((date, i) => {
        const row: Record<string, any> = { date };
        for (const sym of Object.keys(data.series)) {
          row[sym] = data.series[sym][i];
        }
        return row;
      })
    : [];

  // Reduce density on large ranges for cleaner X axis
  const xTickCount = range === '5y' ? 6 : range === '1y' ? 12 : range === '6mo' ? 6 : 4;

  const successSymbols = data ? Object.keys(data.series) : [];

  return (
    <div style={{ marginTop: '2.5rem' }}>
      {/* Section Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
        <div style={{ padding: '0.5rem', background: 'rgba(99,102,241,0.15)', borderRadius: '0.75rem' }}>
          <BarChart2 size={22} style={{ color: '#818cf8' }} />
        </div>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#f1f5f9', margin: 0 }}>
            Performance Comparison
          </h2>
          <p style={{ fontSize: '0.75rem', color: '#64748b', margin: 0 }}>
            Normalized % return (dividend-adjusted adjClose) — all series start at 0%
          </p>
        </div>
      </div>

      {/* Controls Panel */}
      <div style={{
        background: 'rgba(30,41,59,0.8)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: '1rem',
        padding: '1.25rem 1.5rem',
        marginBottom: '1.25rem',
        display: 'flex',
        flexWrap: 'wrap',
        gap: '1.25rem',
        alignItems: 'flex-start',
      }}>
        {/* Ticker Input + Pills */}
        <div style={{ flex: '1 1 320px' }}>
          <label style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700, display: 'block', marginBottom: '0.5rem' }}>
            Selected Symbols ({tickers.length}/8)
          </label>
          {/* Pill badges */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.6rem' }}>
            {tickers.map((sym, i) => (
              <span key={sym} style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                padding: '0.25rem 0.6rem',
                borderRadius: '999px',
                fontSize: '0.72rem', fontWeight: 700,
                background: `${SERIES_COLORS[i % SERIES_COLORS.length]}22`,
                border: `1px solid ${SERIES_COLORS[i % SERIES_COLORS.length]}55`,
                color: SERIES_COLORS[i % SERIES_COLORS.length],
              }}>
                {sym}
                <button
                  onClick={() => removeTicker(sym)}
                  title={`Remove ${sym}`}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0', display: 'flex', color: 'inherit', opacity: 0.6 }}
                >
                  <X size={11} />
                </button>
              </span>
            ))}
            {tickers.length === 0 && (
              <span style={{ fontSize: '0.75rem', color: '#475569', fontStyle: 'italic' }}>Add tickers below…</span>
            )}
          </div>
          {/* Input row */}
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              type="text"
              placeholder="e.g. AAPL, XEQT.TO"
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={tickers.length >= 8}
              style={{
                flex: 1,
                background: '#0f172a',
                border: '1px solid #334155',
                borderRadius: '0.5rem',
                padding: '0.45rem 0.75rem',
                color: '#f1f5f9',
                fontSize: '0.82rem',
                outline: 'none',
                fontFamily: 'inherit',
              }}
            />
            <button
              onClick={() => addTicker(inputValue)}
              disabled={!inputValue.trim() || tickers.length >= 8}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.3rem',
                padding: '0.45rem 0.9rem',
                background: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '0.5rem',
                fontSize: '0.82rem',
                fontWeight: 600,
                cursor: 'pointer',
                opacity: (!inputValue.trim() || tickers.length >= 8) ? 0.45 : 1,
              }}
            >
              <Plus size={15} /> Add
            </button>
          </div>
          <p style={{ fontSize: '0.65rem', color: '#475569', marginTop: '0.35rem' }}>
            Press Enter or comma to add. Canadian ETFs: append .TO (e.g. XEQT.TO)
          </p>
        </div>

        {/* Range Selector */}
        <div>
          <label style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700, display: 'block', marginBottom: '0.5rem' }}>
            Time Frame
          </label>
          <div style={{ display: 'flex', gap: '0.35rem' }}>
            {RANGES.map(r => (
              <button
                key={r.value}
                onClick={() => setRange(r.value)}
                style={{
                  padding: '0.4rem 0.85rem',
                  borderRadius: '0.5rem',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  background: range === r.value ? '#3b82f6' : '#1e293b',
                  color: range === r.value ? '#fff' : '#64748b',
                  boxShadow: range === r.value ? '0 0 0 1px #3b82f6' : '0 0 0 1px #334155',
                }}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Error banner for individual failed symbols */}
      {data && Object.keys(data.errors).length > 0 && (
        <div style={{
          background: 'rgba(239,68,68,0.08)',
          border: '1px solid rgba(239,68,68,0.25)',
          borderRadius: '0.75rem',
          padding: '0.75rem 1rem',
          marginBottom: '1rem',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '0.5rem',
        }}>
          <AlertCircle size={15} style={{ color: '#f87171', marginTop: '0.1rem', flexShrink: 0 }} />
          <div style={{ fontSize: '0.78rem', color: '#f87171' }}>
            <strong>Could not load:</strong>{' '}
            {Object.entries(data.errors).map(([sym, err]) => `${sym} (${err})`).join(' · ')}
          </div>
        </div>
      )}

      {/* Global fetch error */}
      {fetchError && (
        <div style={{
          background: 'rgba(239,68,68,0.08)',
          border: '1px solid rgba(239,68,68,0.25)',
          borderRadius: '0.75rem',
          padding: '0.75rem 1rem',
          marginBottom: '1rem',
          fontSize: '0.82rem',
          color: '#f87171',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
        }}>
          <AlertCircle size={15} /> {fetchError}
        </div>
      )}

      {/* Chart Panel */}
      <div style={{
        background: 'rgba(15,23,42,0.7)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: '1rem',
        padding: '1.5rem',
        marginBottom: '1rem',
        position: 'relative',
        minHeight: '380px',
      }}>
        {loading && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(15,23,42,0.7)', borderRadius: '1rem', zIndex: 10,
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
              <Loader2 size={32} style={{ color: '#3b82f6', animation: 'spin 1s linear infinite' }} />
              <p style={{ color: '#64748b', fontSize: '0.82rem' }}>Fetching historical data…</p>
            </div>
          </div>
        )}

        {!loading && tickers.length === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '320px', gap: '0.5rem' }}>
            <BarChart2 size={40} style={{ color: '#334155' }} />
            <p style={{ color: '#475569', fontSize: '0.9rem' }}>Add at least one ticker to get started</p>
          </div>
        )}

        {!loading && !fetchError && chartData.length > 0 && (
          <ResponsiveContainer width="100%" height={350}>
            <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={formatDate}
                tick={{ fill: '#475569', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                interval={Math.floor(chartData.length / xTickCount)}
              />
              <YAxis
                tickFormatter={v => `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`}
                tick={{ fill: '#475569', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                width={56}
              />
              <Tooltip content={<CompareTooltip />} />
              <ReferenceLine y={0} stroke="rgba(255,255,255,0.12)" strokeDasharray="4 4" />
              {successSymbols.map((sym, i) => (
                <Line
                  key={sym}
                  type="monotone"
                  dataKey={sym}
                  stroke={SERIES_COLORS[i % SERIES_COLORS.length]}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 0 }}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Summary Table */}
      {data && successSymbols.length > 0 && (
        <div style={{
          background: 'rgba(15,23,42,0.7)',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: '1rem',
          overflow: 'hidden',
        }}>
          <div style={{ padding: '0.9rem 1.25rem', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <h3 style={{ fontSize: '0.78rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>
              Period Summary
            </h3>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  {['Symbol', 'Start Price', 'Current Price', 'Total Return (adj.)'].map(h => (
                    <th key={h} style={{ padding: '0.6rem 1.25rem', textAlign: h === 'Symbol' ? 'left' : 'right', fontSize: '0.68rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {successSymbols.map((sym, i) => {
                  const s = data.summary[sym];
                  const color = SERIES_COLORS[i % SERIES_COLORS.length];
                  const returnColor = s.totalReturn >= 0 ? '#6ee7b7' : '#fca5a5';
                  return (
                    <tr key={sym} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td style={{ padding: '0.75rem 1.25rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                          <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: color, flexShrink: 0, display: 'inline-block' }} />
                          <span style={{ color: '#e2e8f0', fontWeight: 700, fontSize: '0.88rem' }}>{sym}</span>
                        </div>
                      </td>
                      <td style={{ padding: '0.75rem 1.25rem', textAlign: 'right', fontFamily: 'monospace', fontSize: '0.84rem', color: '#94a3b8' }}>
                        ${s.firstPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td style={{ padding: '0.75rem 1.25rem', textAlign: 'right', fontFamily: 'monospace', fontSize: '0.84rem', color: '#e2e8f0', fontWeight: 600 }}>
                        ${s.currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td style={{ padding: '0.75rem 1.25rem', textAlign: 'right' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', color: returnColor, fontWeight: 700, fontSize: '0.9rem', fontFamily: 'monospace' }}>
                          {s.totalReturn >= 0
                            ? <TrendingUp size={14} />
                            : <TrendingDown size={14} />
                          }
                          {formatPct(s.totalReturn)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div style={{ padding: '0.5rem 1.25rem 0.75rem', textAlign: 'right' }}>
            <span style={{ fontSize: '0.65rem', color: '#334155' }}>
              Data: Yahoo Finance (adjClose) · Cached 1h · Period start: {data.dates[0] ?? '—'} · {data.dates.length} trading days
            </span>
          </div>
        </div>
      )}

      {/* Spin keyframes — injected once */}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default StockComparison;
