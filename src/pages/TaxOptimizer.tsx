import React, { useState, useEffect, useCallback } from 'react';
import { Target, TrendingDown, ShieldCheck, Zap, Save, Check, AlertTriangle, BarChart3, ChevronRight, History, Settings, Trash2, Eye } from 'lucide-react';
import {
  calculateOptimization,
  buildLayerCakeData,
  DEFAULT_QUEBEC_ABATEMENT,
  defaultFederalBrackets,
  defaultProvincialBrackets
} from '../utils/taxEngine';
import type { OptimizationResult, TaxScenario, LayerCakeSegment, TaxSettings, TaxBracket } from '../types';
import '../styles/taxoptimizer.css';

const API_BASE = 'http://localhost:3001';
const fmt = new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 });
const fmtDec = new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ─── Bracket color by combined rate ─────────────────────────────────────────
function rateColor(rate: number): string {
  if (rate >= 0.48) return '#ef4444'; // red-500
  if (rate >= 0.43) return '#f97316'; // orange-500
  if (rate >= 0.38) return '#f59e0b'; // amber-500
  if (rate >= 0.30) return '#eab308'; // yellow-500
  return '#22c55e';                    // green-500
}

function rateClass(rate: number): string {
  if (rate >= 0.48) return 'rate-high';
  if (rate >= 0.43) return 'rate-medium';
  if (rate >= 0.38) return 'rate-low-mid';
  return 'rate-low';
}

const FormattedNumberInput = ({ value, onChange, className, placeholder, id, style }: any) => {
  const [strValue, setStrValue] = useState(value ? value.toLocaleString('en-CA') : '');

  useEffect(() => {
    const currentParsed = Number(strValue.replace(/,/g, ''));
    if (currentParsed !== value) {
      setStrValue(value ? value.toLocaleString('en-CA') : '');
    }
  }, [value, strValue]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/,/g, '');
    if (raw === '') {
      setStrValue('');
      onChange(0);
      return;
    }
    if (!isNaN(Number(raw))) {
      setStrValue(e.target.value);
      onChange(Number(raw));
    }
  };

  const handleBlur = () => {
    const raw = Number(strValue.replace(/,/g, ''));
    if (!isNaN(raw)) {
      setStrValue(raw.toLocaleString('en-CA'));
    }
  };

  return (
    <input
      id={id}
      type="text"
      className={className}
      style={style}
      value={strValue}
      onChange={handleChange}
      onBlur={handleBlur}
      placeholder={placeholder}
      inputMode="numeric"
    />
  );
};

// ─── Layer Cake Bar ──────────────────────────────────────────────────────────
const LayerCakeBar: React.FC<{ layers: LayerCakeSegment[]; income: number }> = ({ layers, income }) => {
  if (!layers.length || income <= 0) return <div className="tax-empty">Enter income to see the tax layer visualization.</div>;

  return (
    <div className="layer-cake-container">
      <div className="layer-cake-title">Income Tax Layer Cake</div>

      {/* Stacked bar */}
      <div className="layer-cake-bar-wrap">
        {layers.map((layer, i) => {
          const widthPct = (layer.amount / income) * 100;
          const color = rateColor(layer.combinedRate);
          return (
            <div
              key={i}
              className="lc-segment"
              style={{ flexBasis: `${widthPct}%`, flexGrow: 0, flexShrink: 0, background: color }}
              title={`${layer.label} — Combined Rate: ${(layer.combinedRate * 100).toFixed(1)}%`}
            >
              {/* Full shield */}
              {layer.isShielded && <div className="lc-shield-overlay" />}
              {/* Partial shield — covers right portion of this segment */}
              {!layer.isShielded && layer.partialShield > 0 && (
                <div
                  className="lc-shield-partial"
                  style={{ width: `${layer.partialShield * 100}%` }}
                />
              )}
              {widthPct > 6 && (
                <span className="lc-segment-label">{(layer.combinedRate * 100).toFixed(0)}%</span>
              )}
            </div>
          );
        })}
      </div>

      {/* Shield legend */}
      <div className="layer-cake-legend">
        {layers.map((layer, i) => (
          <div key={i} className="lc-legend-item">
            <span className="lc-legend-dot" style={{ background: rateColor(layer.combinedRate) }} />
            <span>{(layer.combinedRate * 100).toFixed(1)}%</span>
          </div>
        )).filter((_, i, arr) => {
          // dedupe by combinedRate label
          const rates = layers.map(l => (l.combinedRate * 100).toFixed(1));
          return rates.indexOf(rates[i]) === i;
        })}
        <div className="lc-legend-item">
          <span className="lc-legend-dot" style={{ background: 'repeating-linear-gradient(-45deg,#6366f1 0,#6366f1 3px,#312e81 3px,#312e81 6px)' }} />
          <span>RRSP Shield</span>
        </div>
      </div>

      {/* Detail table */}
      <table className="layer-cake-table">
        <thead>
          <tr>
            <th>Income Layer</th>
            <th>Amount in Layer</th>
            <th>Fed (eff.)</th>
            <th>Prov.</th>
            <th>Combined</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {layers.map((layer, i) => (
            <tr key={i} className={layer.isShielded || layer.partialShield > 0 ? 'shielded-row' : ''}>
              <td>{layer.label}</td>
              <td>{fmt.format(layer.amount)}</td>
              <td>{(layer.federalRate * 100).toFixed(1)}%</td>
              <td>{(layer.provincialRate * 100).toFixed(1)}%</td>
              <td>
                <span className={`lc-rate-badge ${rateClass(layer.combinedRate)}`}
                  style={{ background: rateColor(layer.combinedRate) + '22', border: `1px solid ${rateColor(layer.combinedRate)}55` }}>
                  {(layer.combinedRate * 100).toFixed(1)}%
                </span>
              </td>
              <td>
                {layer.isShielded
                  ? <span style={{ color: '#818cf8', fontWeight: 600 }}>🛡 Shielded</span>
                  : layer.partialShield > 0
                  ? <span style={{ color: '#a5b4fc' }}>🛡 {(layer.partialShield * 100).toFixed(0)}% covered</span>
                  : <span style={{ color: '#64748b' }}>Taxed</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// ─── Next Milestone Card ─────────────────────────────────────────────────────
const NextMilestoneCard: React.FC<{ result: OptimizationResult; contribution: number; settings: TaxSettings }> = ({ result, contribution, settings }) => {
  const { remainingRoomInCurrentBracket, currentCombinedRate, sweetSpotContribution } = result;
  const { federalBrackets, provincialBrackets, abatement } = settings;
  const additionalNeeded = Math.max(0, sweetSpotContribution - contribution);

  // Find the next lower combined rate from current
  const allRates = [...new Set(
    federalBrackets.flatMap(fb =>
      provincialBrackets.map(pb => {
        const effFed = fb.rate * (1 - abatement);
        return parseFloat((effFed + pb.rate).toFixed(4));
      })
    )
  )].sort((a, b) => a - b);

  const currentIdx = allRates.findIndex(r => Math.abs(r - currentCombinedRate) < 0.005);
  const nextRate = currentIdx > 0 ? allRates[currentIdx - 1] : null;

  if (additionalNeeded < 1) {
    return (
      <div className="milestone-card">
        <div className="milestone-title"><Target size={13} /> Next Milestone</div>
        <div className="milestone-amount" style={{ color: '#34d399', fontSize: '1.1rem' }}>✓ Bracket Drop Achieved!</div>
        <div className="milestone-desc">Your current contribution already pushes you into a lower bracket.</div>
      </div>
    );
  }

  return (
    <div className="milestone-card">
      <div className="milestone-title"><Target size={13} /> Next Milestone</div>
      <div className="milestone-amount">{fmt.format(additionalNeeded)}</div>
      <div className="milestone-desc">
        more to contribute to exit the{' '}
        <strong style={{ color: rateColor(currentCombinedRate) }}>{(currentCombinedRate * 100).toFixed(1)}%</strong> combined bracket.
      </div>
      {nextRate !== null && (
        <div className="milestone-bracket-drop">
          <span>Current top: <span className="milestone-from-rate">{(currentCombinedRate * 100).toFixed(1)}%</span></span>
          <ChevronRight size={14} style={{ color: '#64748b' }} />
          <span>Target: <span className="milestone-to-rate">{(nextRate * 100).toFixed(1)}%</span></span>
        </div>
      )}
      <div style={{ marginTop: '0.75rem', fontSize: '0.74rem', color: '#64748b' }}>
        {fmt.format(remainingRoomInCurrentBracket)} remaining in current bracket
      </div>
    </div>
  );
};

// ─── Diminishing Returns Warning ─────────────────────────────────────────────
const DiminishingWarning: React.FC = () => (
  <div className="diminishing-warning">
    <div className="diminishing-warning-icon"><AlertTriangle size={18} /></div>
    <div>
      <div className="diminishing-warning-title">Diminishing Tax Returns</div>
      <div className="diminishing-warning-body">
        You have maximized high-bracket savings. Further contributions now save less than 30¢ per dollar — consider other tax strategies.
      </div>
    </div>
  </div>
);

// ─── Bracket Reference Table ─────────────────────────────────────────────────
const BracketReference: React.FC<{ settings: TaxSettings }> = ({ settings }) => {
  const { federalBrackets, provincialBrackets, abatement } = settings;
  return (
    <div className="tax-panel">
      <div className="tax-panel-header">
        <span className="tax-panel-title"><BarChart3 size={15} /> Bracket Reference</span>
        <span style={{ fontSize: '0.7rem', color: '#64748b' }}>Abatement: {(abatement * 100).toFixed(1)}%</span>
      </div>
      <div className="tax-panel-body" style={{ padding: '0.75rem 1rem' }}>
        <table className="scenarios-table">
          <thead>
            <tr>
              <th>Income Band</th>
              <th>Fed.</th>
              <th>Eff. Fed.</th>
              <th>Prov.</th>
              <th>Combined</th>
            </tr>
          </thead>
          <tbody>
            {federalBrackets.map((fb, fi) =>
              provincialBrackets.map((pb, pi) => {
                const effFed = fb.rate * (1 - abatement);
                const combined = effFed + pb.rate;
                const minI = Math.max(fb.minIncome, pb.minIncome);
                const maxI = Math.min(
                  fb.maxIncome === Infinity ? 999_999 : fb.maxIncome,
                  pb.maxIncome === Infinity ? 999_999 : pb.maxIncome
                );
                if (minI >= maxI) return null;
                return (
                  <tr key={`${fi}-${pi}`}>
                    <td style={{ fontSize: '0.68rem' }}>
                      ${Math.round(minI / 1000)}k – {maxI >= 999_000 ? '∞' : `$${Math.round(maxI / 1000)}k`}
                    </td>
                    <td>{(fb.rate * 100).toFixed(1)}%</td>
                    <td style={{ color: '#93c5fd' }}>{(effFed * 100).toFixed(1)}%</td>
                    <td>{(pb.rate * 100).toFixed(1)}%</td>
                    <td>
                      <span className={`lc-rate-badge ${rateClass(combined)}`}
                        style={{ background: rateColor(combined) + '22', border: `1px solid ${rateColor(combined)}55` }}>
                        {(combined * 100).toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ─── Main Page ───────────────────────────────────────────────────────────────
const TaxOptimizer: React.FC = () => {
  const [settings, setSettings] = useState<TaxSettings>({
    federalBrackets: defaultFederalBrackets,
    provincialBrackets: defaultProvincialBrackets,
    abatement: DEFAULT_QUEBEC_ABATEMENT
  });
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  const [annualIncome, setAnnualIncome] = useState<number>(120000);
  const [rrspRoom, setRrspRoom] = useState<number>(30000);
  const [contribution, setContribution] = useState<number>(10000);
  const [result, setResult] = useState<OptimizationResult | null>(null);
  const [scenarios, setScenarios] = useState<TaxScenario[]>([]);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [scenariosLoaded, setScenariosLoaded] = useState(false);

  // Load settings
  useEffect(() => {
    fetch(`${API_BASE}/api/tax-settings`)
      .then(r => r.json())
      .then((data) => {
        if (data && data.federalBrackets) {
          setSettings(data);
        }
        setSettingsLoaded(true);
      })
      .catch(() => setSettingsLoaded(true));
  }, []);

  // Recalculate whenever inputs change
  useEffect(() => {
    if (settingsLoaded && annualIncome > 0) {
      setResult(calculateOptimization(annualIncome, contribution, settings));
    } else {
      setResult(null);
    }
  }, [annualIncome, contribution, settings, settingsLoaded]);

  // Load saved scenarios on mount
  useEffect(() => {
    fetch(`${API_BASE}/api/tax-scenarios`)
      .then(r => r.json())
      .then((data: TaxScenario[]) => { setScenarios(data); setScenariosLoaded(true); })
      .catch(() => setScenariosLoaded(true));
  }, []);

  const sliderPct = rrspRoom > 0 ? (contribution / rrspRoom) * 100 : 0;

  const handleSlider = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setContribution(Number(e.target.value));
  }, []);

  const handleSave = async () => {
    if (!result) return;
    setSaveState('saving');
    try {
      const body = {
        annualIncome,
        rrspContribution: contribution,
        totalRefund: result.totalRefund,
        effectiveRate: result.effectiveTaxSavingsPercentage,
      };
      const r = await fetch(`${API_BASE}/api/tax-scenarios`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (r.ok) {
        const saved: TaxScenario = await r.json();
        setScenarios(prev => [saved, ...prev]);
        setSaveState('saved');
        setTimeout(() => setSaveState('idle'), 2500);
      }
    } catch {
      setSaveState('idle');
    }
  };

  const handleDeleteScenario = async (id: string) => {
    try {
      const r = await fetch(`${API_BASE}/api/tax-scenarios/${id}`, { method: 'DELETE' });
      if (r.ok) {
        setScenarios(prev => prev.filter(s => s.id !== id));
      }
    } catch (e) {
      console.error('Failed to delete scenario', e);
    }
  };

  const handleLoadScenario = (scenario: TaxScenario) => {
    setAnnualIncome(scenario.annualIncome);
    setContribution(scenario.rrspContribution);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const saveSettings = async (newSettings: TaxSettings) => {
    try {
      await fetch(`${API_BASE}/api/tax-settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSettings),
      });
      setSettings(newSettings);
      setShowSettingsModal(false);
    } catch (e) {
      console.error('Failed to save settings');
    }
  };

  if (!settingsLoaded) return <div className="tax-optimizer-page"><div className="tax-empty">Loading...</div></div>;

  return (
    <div className="tax-optimizer-page">
      {/* Header */}
      <div className="page-header pb-4 border-b border-gray-700 flex justify-between items-center">
        <div>
          <h1 className="page-title">
            <ShieldCheck className="text-indigo-400" size={30} />
            Tax Bracket Optimizer
          </h1>
          <p className="page-subtitle">
            Quebec RRSP optimization — shave your highest combined brackets first.
            Federal abatement of {(settings.abatement * 100).toFixed(1)}% applied.
          </p>
        </div>
        <button 
          onClick={() => setShowSettingsModal(true)}
          className="btn bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center gap-2 px-3 py-2 text-sm border border-slate-700 rounded-md"
        >
          <Settings size={16} /> Edit Brackets
        </button>
      </div>

      {/* KPI Cards */}
      {result && (
        <div className="tax-kpi-grid">
          <div className="tax-kpi-card" style={{ '--kpi-gradient': 'linear-gradient(135deg,#6366f1,#8b5cf6)' } as React.CSSProperties}>
            <span className="tax-kpi-label">Estimated Refund</span>
            <span className="tax-kpi-value" style={{ color: '#a5b4fc' }}>{fmtDec.format(result.totalRefund)}</span>
            <span className="tax-kpi-sub">From your {fmt.format(contribution)} contribution</span>
          </div>
          <div className="tax-kpi-card" style={{ '--kpi-gradient': 'linear-gradient(135deg,#10b981,#059669)' } as React.CSSProperties}>
            <span className="tax-kpi-label">Effective Savings Rate</span>
            <span className="tax-kpi-value" style={{ color: '#6ee7b7' }}>{result.effectiveTaxSavingsPercentage.toFixed(1)}%</span>
            <span className="tax-kpi-sub">Refund per dollar contributed</span>
          </div>
          <div className="tax-kpi-card" style={{ '--kpi-gradient': 'linear-gradient(135deg,#f59e0b,#d97706)' } as React.CSSProperties}>
            <span className="tax-kpi-label">Top Marginal Rate</span>
            <span className={`tax-kpi-value ${rateClass(result.currentCombinedRate)}`}>
              {(result.currentCombinedRate * 100).toFixed(1)}%
            </span>
            <span className="tax-kpi-sub">Combined Fed + QC on top dollar</span>
          </div>
          <div className="tax-kpi-card" style={{ '--kpi-gradient': 'linear-gradient(135deg,#3b82f6,#1d4ed8)' } as React.CSSProperties}>
            <span className="tax-kpi-label">Taxable Income</span>
            <span className="tax-kpi-value" style={{ color: '#93c5fd' }}>{fmt.format(result.taxableIncome)}</span>
            <span className="tax-kpi-sub">After {fmt.format(contribution)} RRSP deduction</span>
          </div>
        </div>
      )}

      {/* Diminishing Returns Warning */}
      {result?.diminishingReturns && (
        <div className="mb-4"><DiminishingWarning /></div>
      )}

      {/* Main Content Grid */}
      <div className="tax-content-grid">
        {/* ── Left: Inputs + Layer Cake ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

          {/* Inputs */}
          <div className="tax-panel">
            <div className="tax-panel-header">
              <span className="tax-panel-title"><Zap size={15} /> Your Income & RRSP Details</span>
            </div>
            <div className="tax-panel-body">
              <div className="tax-input-grid">
                <div className="tax-input-group">
                  <label className="tax-input-label">Annual Gross Income (CAD)</label>
                  <FormattedNumberInput
                    id="tax-annual-income"
                    className="tax-input"
                    value={annualIncome}
                    onChange={(v: number) => {
                      setAnnualIncome(v);
                      if (contribution > v) setContribution(v);
                    }}
                  />
                </div>
                <div className="tax-input-group">
                  <label className="tax-input-label">Available RRSP Room (CAD)</label>
                  <FormattedNumberInput
                    id="tax-rrsp-room"
                    className="tax-input"
                    value={rrspRoom}
                    onChange={(v: number) => {
                      setRrspRoom(v);
                      if (contribution > v) setContribution(v);
                    }}
                  />
                </div>
              </div>

              {/* Slider */}
              <div className="tax-slider-wrapper">
                <div className="tax-slider-labels">
                  <span>Proposed RRSP Contribution</span>
                  <span>Max: {fmt.format(rrspRoom)}</span>
                </div>
                <input
                  id="tax-rrsp-slider"
                  type="range"
                  className="tax-slider"
                  min={0}
                  max={rrspRoom}
                  step={100}
                  value={contribution}
                  onChange={handleSlider}
                  style={{ '--slider-pct': `${sliderPct}%` } as React.CSSProperties}
                />
                <div className="tax-slider-value">{fmt.format(contribution)}</div>
                {/* Manual contribution input */}
                <div style={{ marginTop: '0.5rem' }}>
                  <FormattedNumberInput
                    id="tax-contribution-input"
                    className="tax-input"
                    value={contribution}
                    onChange={(v: number) => setContribution(Math.min(v, rrspRoom))}
                    style={{ textAlign: 'center' }}
                    placeholder="Or type amount"
                  />
                </div>

                {contribution > 0 && (
                  <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'rgba(15, 23, 42, 0.5)', borderRadius: '0.5rem', display: 'flex', justifyContent: 'space-around', fontSize: '0.8rem', color: '#94a3b8' }}>
                    <div style={{ textAlign: 'center' }}>
                      <span style={{ display: 'block', fontSize: '0.7rem', textTransform: 'uppercase', marginBottom: '0.2rem' }}>Per Month</span>
                      <strong style={{ color: '#e2e8f0' }}>{fmt.format(contribution / 12)}</strong>
                    </div>
                    <div style={{ width: '1px', background: 'rgba(255,255,255,0.1)' }}></div>
                    <div style={{ textAlign: 'center' }}>
                      <span style={{ display: 'block', fontSize: '0.7rem', textTransform: 'uppercase', marginBottom: '0.2rem' }}>Per Bi-Weekly</span>
                      <strong style={{ color: '#e2e8f0' }}>{fmt.format(contribution / 26)}</strong>
                    </div>
                    <div style={{ width: '1px', background: 'rgba(255,255,255,0.1)' }}></div>
                    <div style={{ textAlign: 'center' }}>
                      <span style={{ display: 'block', fontSize: '0.7rem', textTransform: 'uppercase', marginBottom: '0.2rem' }}>Per Week</span>
                      <strong style={{ color: '#e2e8f0' }}>{fmt.format(contribution / 52)}</strong>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Layer Cake */}
          <div className="tax-panel">
            <div className="tax-panel-header">
              <span className="tax-panel-title"><BarChart3 size={15} /> Tax Layer Cake</span>
              <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                Indigo stripes = RRSP Shield
              </span>
            </div>
            {result ? (
              <LayerCakeBar layers={result.layers} income={annualIncome} />
            ) : (
              <div className="tax-empty">Enter your income above.</div>
            )}
          </div>

          {/* Bracket Reference */}
          <BracketReference settings={settings} />
        </div>

        {/* ── Right: Sidebar ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

          {/* Next Milestone */}
          {result && <NextMilestoneCard result={result} contribution={contribution} settings={settings} />}

          {/* Sweet Spot Info */}
          {result && (
            <div className="tax-panel">
              <div className="tax-panel-header">
                <span className="tax-panel-title"><TrendingDown size={15} /> Sweet Spot Analysis</span>
              </div>
              <div className="tax-panel-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                  <span style={{ color: '#94a3b8' }}>Optimal "bracket drop" contribution</span>
                  <span style={{ color: '#c7d2fe', fontWeight: 700 }}>{fmt.format(result.sweetSpotContribution)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                  <span style={{ color: '#94a3b8' }}>Room left in current bracket</span>
                  <span style={{ color: '#fbbf24', fontWeight: 700 }}>{fmt.format(result.remainingRoomInCurrentBracket)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                  <span style={{ color: '#94a3b8' }}>Refund per $1,000 contributed</span>
                  <span style={{ color: '#6ee7b7', fontWeight: 700 }}>
                    {fmt.format((result.totalRefund / Math.max(contribution, 1)) * 1000)}
                  </span>
                </div>
                <hr style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.07)', margin: '0.25rem 0' }} />
                <div style={{ fontSize: '0.74rem', color: '#64748b', lineHeight: 1.6 }}>
                  The "sweet spot" is the minimum contribution needed to drop your top taxable dollar into the next lower combined bracket, maximizing the refund rate on every dollar contributed.
                </div>
              </div>
            </div>
          )}

          {/* Save Scenario */}
          <div className="tax-panel">
            <div className="tax-panel-header">
              <span className="tax-panel-title"><Save size={15} /> Save This Scenario</span>
            </div>
            <div className="tax-panel-body">
              <button
                id="tax-save-scenario-btn"
                className={`save-btn ${saveState === 'saved' ? 'saved' : ''}`}
                onClick={handleSave}
                disabled={saveState === 'saving' || !result}
              >
                {saveState === 'saved'
                  ? <><Check size={16} /> Scenario Saved!</>
                  : saveState === 'saving'
                  ? 'Saving…'
                  : <><Save size={16} /> Save Current Scenario</>}
              </button>
              <p style={{ fontSize: '0.72rem', color: '#475569', textAlign: 'center', marginTop: '0.5rem' }}>
                Snapshots are persisted to your local database.
              </p>
            </div>
          </div>

          {/* Saved Scenarios History */}
          <div className="tax-panel">
            <div className="tax-panel-header">
              <span className="tax-panel-title"><History size={15} /> Scenario History</span>
              <span style={{ fontSize: '0.72rem', color: '#64748b' }}>{scenarios.length} saved</span>
            </div>
            <div className="tax-panel-body" style={{ padding: '0.5rem 0.75rem' }}>
              {!scenariosLoaded && <div className="tax-empty">Loading…</div>}
              {scenariosLoaded && scenarios.length === 0 && (
                <div className="tax-empty">No saved scenarios yet. Save one above!</div>
              )}
              {scenarios.length > 0 && (
                <table className="scenarios-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Income</th>
                      <th>RRSP</th>
                      <th>Refund</th>
                      <th>Rate</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {scenarios.slice(0, 10).map(s => (
                      <tr key={s.id}>
                        <td style={{ whiteSpace: 'nowrap' }}>
                          {new Date(s.savedAt).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })}
                        </td>
                        <td>{fmt.format(s.annualIncome)}</td>
                        <td>{fmt.format(s.rrspContribution)}</td>
                        <td style={{ color: '#6ee7b7' }}>{fmt.format(s.totalRefund)}</td>
                        <td>
                          <span className={rateClass(s.effectiveRate / 100)}>
                            {s.effectiveRate.toFixed(1)}%
                          </span>
                        </td>
                        <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <button 
                            onClick={() => handleLoadScenario(s)} 
                            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#93c5fd', padding: '0.2rem', marginRight: '0.5rem' }} 
                            title="Load Scenario into Calculator">
                            <Eye size={14} />
                          </button>
                          <button 
                            onClick={() => handleDeleteScenario(s.id)} 
                            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#f87171', padding: '0.2rem' }} 
                            title="Delete Scenario">
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>
      {showSettingsModal && (
        <SettingsModal 
          settings={settings} 
          onSave={saveSettings} 
          onClose={() => setShowSettingsModal(false)} 
        />
      )}
    </div>
  );
};

const SettingsModal: React.FC<{ settings: TaxSettings, onSave: (s: TaxSettings) => void, onClose: () => void }> = ({ settings, onSave, onClose }) => {
  const [draft, setDraft] = useState<TaxSettings>(JSON.parse(JSON.stringify(settings)));

  const handleBracketChange = (type: 'federalBrackets' | 'provincialBrackets', index: number, field: keyof TaxBracket, value: number) => {
    const updated = { ...draft };
    const bracket = updated[type][index];
    if (field === 'rate') {
      bracket.rate = value / 100;
    } else {
      bracket[field] = value;
    }
    setDraft(updated);
  };

  const handleAbatementChange = (val: number) => {
    setDraft({ ...draft, abatement: val / 100 });
  };

  return (
    <div className="tax-modal-overlay">
      <div className="tax-modal-content">
        <div className="tax-modal-header">
          <h2>Edit Tax Brackets</h2>
          <button className="tax-modal-close" onClick={onClose}>&times;</button>
        </div>
        <div className="tax-modal-body">
          <div className="tax-settings-section">
            <h3>Federal Brackets</h3>
            <div className="tax-settings-grid header">
              <span>Min Income</span><span>Max Income</span><span>Rate %</span>
            </div>
            {draft.federalBrackets.map((b, i) => (
              <div key={i} className="tax-settings-grid">
                <input type="number" value={b.minIncome} onChange={(e) => handleBracketChange('federalBrackets', i, 'minIncome', Number(e.target.value))} className="tax-input" />
                <input type="number" value={b.maxIncome === Infinity ? '' : b.maxIncome} placeholder="Infinity" onChange={(e) => handleBracketChange('federalBrackets', i, 'maxIncome', e.target.value ? Number(e.target.value) : Infinity)} className="tax-input" />
                <input type="number" step="0.1" value={+(b.rate * 100).toFixed(2)} onChange={(e) => handleBracketChange('federalBrackets', i, 'rate', Number(e.target.value))} className="tax-input" />
              </div>
            ))}
          </div>

          <div className="tax-settings-section">
            <h3>Provincial Brackets</h3>
            <div className="tax-settings-grid header">
              <span>Min Income</span><span>Max Income</span><span>Rate %</span>
            </div>
            {draft.provincialBrackets.map((b, i) => (
              <div key={i} className="tax-settings-grid">
                <input type="number" value={b.minIncome} onChange={(e) => handleBracketChange('provincialBrackets', i, 'minIncome', Number(e.target.value))} className="tax-input" />
                <input type="number" value={b.maxIncome === Infinity ? '' : b.maxIncome} placeholder="Infinity" onChange={(e) => handleBracketChange('provincialBrackets', i, 'maxIncome', e.target.value ? Number(e.target.value) : Infinity)} className="tax-input" />
                <input type="number" step="0.1" value={+(b.rate * 100).toFixed(2)} onChange={(e) => handleBracketChange('provincialBrackets', i, 'rate', Number(e.target.value))} className="tax-input" />
              </div>
            ))}
          </div>

          <div className="tax-settings-section abatement">
            <label>Provincial Abatement Rate %</label>
            <input type="number" step="0.1" value={+(draft.abatement * 100).toFixed(2)} onChange={(e) => handleAbatementChange(Number(e.target.value))} className="tax-input" />
          </div>

        </div>
        <div className="tax-modal-footer">
          <button className="btn bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-md" onClick={onClose}>Cancel</button>
          <button className="btn bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-md" onClick={() => onSave(draft)}>Save Changes</button>
        </div>
      </div>
    </div>
  );
};

export default TaxOptimizer;
