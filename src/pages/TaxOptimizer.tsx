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
import { useData } from '../context/DataContext';
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

const FormattedNumberInput = ({ value, onChange, className, placeholder, id, style, emptyIsInfinity }: any) => {
  const formatVal = (v: any) => {
    if (v == null || (emptyIsInfinity && v === Infinity)) return '';
    return Number(v).toLocaleString('en-CA');
  };

  const [strValue, setStrValue] = useState(formatVal(value));

  useEffect(() => {
    const currentParsed = Number(strValue.replace(/,/g, ''));
    if (currentParsed !== value && !(emptyIsInfinity && strValue === '' && value === Infinity)) {
      setStrValue(formatVal(value));
    }
  }, [value, strValue, emptyIsInfinity]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/,/g, '');
    if (raw === '') {
      setStrValue('');
      onChange(emptyIsInfinity ? Infinity : 0);
      return;
    }
    if (!isNaN(Number(raw))) {
      setStrValue(e.target.value);
      onChange(Number(raw));
    }
  };

  const handleBlur = () => {
    const raw = Number(strValue.replace(/,/g, ''));
    if (!isNaN(raw) && strValue !== '') {
      setStrValue(formatVal(raw));
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
        <strong style={{ color: rateColor(result.newCombinedRate) }}>{(result.newCombinedRate * 100).toFixed(1)}%</strong> combined bracket.
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

  const [fedIncome, setFedIncome] = useState<number>(120000);
  const [qcIncome, setQcIncome] = useState<number>(120000);
  const [advancedMode, setAdvancedMode] = useState(false);
  const [rrspRoom, setRrspRoom] = useState<number>(30000);
  const [contribution, setContribution] = useState<number>(10000);
  const [result, setResult] = useState<OptimizationResult | null>(null);
  const [scenarios, setScenarios] = useState<TaxScenario[]>([]);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveError, setSaveError] = useState<string>('');
  const [scenariosLoaded, setScenariosLoaded] = useState(false);

  const { accounts, transactions, assets } = useData();
  const rrspAccounts = accounts.filter(a => a.type === 'RRSP');
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');

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
    if (settingsLoaded && fedIncome > 0) {
      setResult(calculateOptimization(fedIncome, advancedMode ? qcIncome : fedIncome, contribution, settings));
    } else {
      setResult(null);
    }
  }, [fedIncome, qcIncome, advancedMode, contribution, settings, settingsLoaded]);

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
    setSaveError('');
    try {
      const body = {
        annualIncome: fedIncome,
        quebecTaxableIncome: advancedMode ? qcIncome : fedIncome,
        rrspContribution: contribution,
        totalRefund: result.totalRefund,
        craRefund: result.craRefund,
        rqRefund: result.rqRefund,
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
      } else {
        const errText = await r.text();
        console.error('[TaxOptimizer] Save failed:', r.status, errText);
        setSaveError(`Server error ${r.status}: ${errText}`);
        setSaveState('error');
        setTimeout(() => setSaveState('idle'), 4000);
      }
    } catch (e: any) {
      console.error('[TaxOptimizer] Save exception:', e);
      setSaveError(e?.message || 'Network error — is the server running?');
      setSaveState('error');
      setTimeout(() => setSaveState('idle'), 4000);
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
    setFedIncome(scenario.annualIncome);
    if (scenario.quebecTaxableIncome && scenario.quebecTaxableIncome !== scenario.annualIncome) {
      setQcIncome(scenario.quebecTaxableIncome);
      setAdvancedMode(true);
    }
    setContribution(scenario.rrspContribution);
    setIsSpousal(scenario.isSpousal ?? false);
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
            <span className="tax-kpi-sub" style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
              <span style={{ color: '#93c5fd' }}>CRA: {fmt.format(result.craRefund)}</span>
              <span style={{ color: '#475569' }}>·</span>
              <span style={{ color: '#c4b5fd' }}>RQ: {fmt.format(result.rqRefund)}</span>
            </span>
          </div>
          <div className="tax-kpi-card" style={{ '--kpi-gradient': 'linear-gradient(135deg,#10b981,#059669)' } as React.CSSProperties}>
            <span className="tax-kpi-label">Effective Savings Rate</span>
            <span className="tax-kpi-value" style={{ color: '#6ee7b7' }}>{result.effectiveTaxSavingsPercentage.toFixed(1)}%</span>
            <span className="tax-kpi-sub">Refund per dollar contributed</span>
          </div>
          <div className="tax-kpi-card" style={{ '--kpi-gradient': 'linear-gradient(135deg,#f59e0b,#d97706)' } as React.CSSProperties}>
            <span className="tax-kpi-label">Top Marginal Rate</span>
            <span className={`tax-kpi-value ${rateClass(result.newCombinedRate)}`}>
              {(result.newCombinedRate * 100).toFixed(1)}%
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
                  <label className="tax-input-label">Estimated Taxable Income (CAD)</label>
                  <FormattedNumberInput
                    id="tax-annual-income"
                    className="tax-input"
                    value={fedIncome}
                    onChange={(v: number) => {
                      setFedIncome(v);
                      if (!advancedMode) setQcIncome(v);
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

              {/* Advanced: Federal / Quebec split */}
              <div style={{ marginTop: '0.75rem' }}>
                <button
                  onClick={() => setAdvancedMode(m => !m)}
                  style={{ fontSize: '0.72rem', color: '#6366f1', background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                >
                  <span>{advancedMode ? '▼' : '▶'}</span> Advanced: Federal / Quebec Split
                </button>
                {advancedMode && (
                  <div style={{ marginTop: '0.5rem', padding: '0.75rem', background: 'rgba(99,102,241,0.07)', borderRadius: '0.5rem', border: '1px solid rgba(99,102,241,0.2)' }}>
                    <p style={{ fontSize: '0.71rem', color: '#818cf8', margin: '0 0 0.5rem' }}>Quebec taxable income is sometimes higher than federal (e.g. employer-paid health premiums).</p>
                    <div className="tax-input-grid">
                      <div className="tax-input-group">
                        <label className="tax-input-label">Federal Taxable Income</label>
                        <FormattedNumberInput id="tax-fed-income" className="tax-input" value={fedIncome}
                          onChange={(v: number) => { setFedIncome(v); if (contribution > v) setContribution(v); }} />
                      </div>
                      <div className="tax-input-group">
                        <label className="tax-input-label">Quebec Taxable Income</label>
                        <FormattedNumberInput id="tax-qc-income" className="tax-input" value={qcIncome}
                          onChange={(v: number) => setQcIncome(v)} />
                      </div>
                    </div>
                  </div>
                )}
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

                {/* RRSP Tracker & Schedule */}
                <div style={{ marginTop: '1.25rem', background: 'rgba(30, 41, 59, 0.5)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '0.5rem', overflow: 'hidden' }}>
                  <div style={{ padding: '0.75rem 1rem', background: 'rgba(0,0,0,0.2)', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#e2e8f0' }}>RRSP Funding Schedule</div>
                    <select
                      value={selectedAccountId}
                      onChange={(e) => setSelectedAccountId(e.target.value)}
                      style={{ background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(255,255,255,0.1)', color: '#e2e8f0', padding: '0.25rem 0.5rem', borderRadius: '0.25rem', fontSize: '0.75rem', outline: 'none' }}
                    >
                      <option value="">Select RRSP Account...</option>
                      {rrspAccounts.map(acc => (
                        <option key={acc.id} value={acc.id}>{acc.name}</option>
                      ))}
                    </select>
                  </div>
                  
                  {(() => {
                    const selectedAcc = accounts.find(a => a.id === selectedAccountId);
                    if (!selectedAcc) {
                       return contribution > 0 ? (
                         <div style={{ padding: '0.75rem', display: 'flex', justifyContent: 'space-around', fontSize: '0.8rem', color: '#94a3b8' }}>
                           <div style={{ textAlign: 'center' }}>
                             <span style={{ display: 'block', fontSize: '0.7rem', textTransform: 'uppercase', marginBottom: '0.2rem' }}>Per Month</span>
                             <strong style={{ color: '#e2e8f0' }}>{fmt.format(contribution / 12)}</strong>
                           </div>
                           <div style={{ width: '1px', background: 'rgba(255,255,255,0.1)' }}></div>
                           <div style={{ textAlign: 'center' }}>
                             <span style={{ display: 'block', fontSize: '0.7rem', textTransform: 'uppercase', marginBottom: '0.2rem' }}>Bi-Weekly</span>
                             <strong style={{ color: '#e2e8f0' }}>{fmt.format(contribution / 26)}</strong>
                           </div>
                           <div style={{ width: '1px', background: 'rgba(255,255,255,0.1)' }}></div>
                           <div style={{ textAlign: 'center' }}>
                             <span style={{ display: 'block', fontSize: '0.7rem', textTransform: 'uppercase', marginBottom: '0.2rem' }}>Per Week</span>
                             <strong style={{ color: '#e2e8f0' }}>{fmt.format(contribution / 52)}</strong>
                           </div>
                         </div>
                       ) : <div style={{ padding: '0.75rem', textAlign: 'center', fontSize: '0.75rem', color: '#64748b' }}>Enter a proposed contribution to see schedule</div>;
                    }

                    const today = new Date();
                    const isFirst60Days = today.getMonth() === 0 || today.getMonth() === 1 || (today.getMonth() === 2 && today.getDate() === 1);
                    const taxYear = isFirst60Days ? today.getFullYear() - 1 : today.getFullYear();
                    
                    const startDate = new Date(taxYear, 0, 1); // Jan 1, Tax Year
                    const endDate = new Date(taxYear + 1, 2, 1); // March 1, Tax Year + 1

                    const ytdDeposits = transactions
                      .filter(t => t.accountId === selectedAccountId && t.type === 'Deposit')
                      .filter(t => {
                         const d = new Date(t.date);
                         return d >= startDate && d <= endDate;
                      })
                      .reduce((sum, t) => sum + (t.amount || 0), 0);
                      
                    const totalAssetValue = assets.filter(a => a.accountId === selectedAccountId).reduce((sum, a) => sum + a.marketValue, 0);
                    const totalValue = totalAssetValue + selectedAcc.cashBalance;
                    
                    const remainingTarget = Math.max(0, contribution - ytdDeposits);
                    
                    const remainingDays = Math.max(1, (endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                    const remainingMonths = Math.max(1, remainingDays / 30.44);
                    const remainingBiWeeks = Math.max(1, remainingDays / 14);
                    const remainingWeeks = Math.max(1, remainingDays / 7);

                    return (
                      <div style={{ padding: '0.75rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.75rem' }}>
                          <span style={{ color: '#94a3b8' }}>Account Value: <strong style={{ color: '#e2e8f0' }}>{fmt.format(totalValue)}</strong></span>
                          <span style={{ color: '#94a3b8' }}>Cash: <strong style={{ color: '#6ee7b7' }}>{fmt.format(selectedAcc.cashBalance)}</strong></span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', fontSize: '0.75rem' }}>
                          <span style={{ color: '#94a3b8' }} title={`Deposits from Jan 1, ${taxYear} to Mar 1, ${taxYear + 1}`}>
                            Contributions: <strong style={{ color: '#f59e0b' }}>{fmt.format(ytdDeposits)}</strong>
                          </span>
                          <span style={{ color: '#94a3b8' }}>Remaining Target: <strong style={{ color: '#c7d2fe' }}>{fmt.format(remainingTarget)}</strong></span>
                        </div>
                        
                        {remainingTarget > 0 ? (
                          <>
                            <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: '#64748b', textAlign: 'center', marginBottom: '0.5rem', letterSpacing: '0.05em' }}>
                              Required schedule before Mar 1, {taxYear + 1}
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-around', fontSize: '0.8rem', color: '#94a3b8', background: 'rgba(0,0,0,0.2)', padding: '0.5rem', borderRadius: '0.25rem' }}>
                              <div style={{ textAlign: 'center' }}>
                                <span style={{ display: 'block', fontSize: '0.7rem', textTransform: 'uppercase', marginBottom: '0.2rem' }}>Per Month</span>
                                <strong style={{ color: '#e2e8f0' }}>{fmt.format(remainingTarget / remainingMonths)}</strong>
                              </div>
                              <div style={{ width: '1px', background: 'rgba(255,255,255,0.1)' }}></div>
                              <div style={{ textAlign: 'center' }}>
                                <span style={{ display: 'block', fontSize: '0.7rem', textTransform: 'uppercase', marginBottom: '0.2rem' }}>Bi-Weekly</span>
                                <strong style={{ color: '#e2e8f0' }}>{fmt.format(remainingTarget / remainingBiWeeks)}</strong>
                              </div>
                              <div style={{ width: '1px', background: 'rgba(255,255,255,0.1)' }}></div>
                              <div style={{ textAlign: 'center' }}>
                                <span style={{ display: 'block', fontSize: '0.7rem', textTransform: 'uppercase', marginBottom: '0.2rem' }}>Per Week</span>
                                <strong style={{ color: '#e2e8f0' }}>{fmt.format(remainingTarget / remainingWeeks)}</strong>
                              </div>
                            </div>
                          </>
                        ) : (
                           <div style={{ textAlign: 'center', fontSize: '0.75rem', color: '#6ee7b7', padding: '0.5rem', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '0.25rem' }}>
                             <Check size={14} style={{ display: 'inline', verticalAlign: 'text-bottom', marginRight: 4 }}/>
                             Target reached for the {taxYear} tax year!
                           </div>
                        )}
                      </div>
                    );
                  })()}
                </div>

                {/* Bracket-crossing warning */}
                {result?.bracketCrossed && (
                  <div style={{ marginTop: '0.75rem', padding: '0.6rem 0.875rem', background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: '0.5rem', fontSize: '0.75rem', color: '#a5b4fc', display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                    <span style={{ fontSize: '1rem' }}>🎯</span>
                    <span><strong>Bracket Drop!</strong> Your contribution crosses a bracket boundary: <strong style={{ color: '#f87171' }}>{(result.currentCombinedRate * 100).toFixed(1)}%</strong> → <strong style={{ color: '#34d399' }}>{(result.newCombinedRate * 100).toFixed(1)}%</strong>. Further contributions shield income at a lower rate.</span>
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
              <LayerCakeBar layers={result.layers} income={fedIncome} />
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
                className={`save-btn ${saveState === 'saved' ? 'saved' : saveState === 'error' ? 'error' : ''}`}
                onClick={handleSave}
                disabled={saveState === 'saving' || !result}
                style={saveState === 'error' ? { background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)', color: '#fca5a5' } : {}}
              >
                {saveState === 'saved'
                  ? <><Check size={16} /> Scenario Saved!</>
                  : saveState === 'saving'
                  ? 'Saving…'
                  : saveState === 'error'
                  ? <><AlertTriangle size={16} /> Save Failed</>
                  : <><Save size={16} /> Save Current Scenario</>}
              </button>
              {saveState === 'error' && saveError && (
                <p style={{ fontSize: '0.7rem', color: '#f87171', textAlign: 'center', marginTop: '0.4rem', wordBreak: 'break-all' }}>
                  {saveError}
                </p>
              )}
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
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.25rem' }}>
                  {scenarios.slice(0, 10).map(s => (
                    <div key={s.id} style={{ background: 'rgba(15,23,42,0.4)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '0.5rem', padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.6rem', position: 'relative' }}>
                      
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.5rem' }}>
                        <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>
                          {new Date(s.savedAt).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button 
                            onClick={() => handleLoadScenario(s)} 
                            style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: '0.25rem', cursor: 'pointer', color: '#a5b4fc', padding: '0.25rem 0.5rem', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.7rem', transition: 'all 0.2s' }} 
                            title="Load Scenario into Calculator">
                            <Eye size={12} /> Load
                          </button>
                          <button 
                            onClick={() => handleDeleteScenario(s.id)} 
                            style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '0.25rem', cursor: 'pointer', color: '#fca5a5', padding: '0.25rem', display: 'flex', alignItems: 'center', transition: 'all 0.2s' }} 
                            title="Delete Scenario">
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                      
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                        <div>
                          <div style={{ fontSize: '0.65rem', color: '#64748b', textTransform: 'uppercase', marginBottom: '0.1rem' }}>Income</div>
                          <div style={{ fontSize: '0.85rem', color: '#e2e8f0', fontWeight: 600 }}>{fmt.format(s.annualIncome)}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: '0.65rem', color: '#64748b', textTransform: 'uppercase', marginBottom: '0.1rem' }}>Contribution</div>
                          <div style={{ fontSize: '0.85rem', color: '#e2e8f0', fontWeight: 600 }}>{fmt.format(s.rrspContribution)}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: '0.65rem', color: '#64748b', textTransform: 'uppercase', marginBottom: '0.1rem' }}>Total Refund</div>
                          <div style={{ fontSize: '0.9rem', color: '#6ee7b7', fontWeight: 700 }}>{fmt.format(s.totalRefund)}</div>
                          {(s.craRefund != null || s.rqRefund != null) && (
                            <div style={{ display: 'flex', gap: '0.5rem', fontSize: '0.65rem', marginTop: '0.15rem' }}>
                              {s.craRefund != null && <span style={{ color: '#93c5fd' }}>CRA: {fmt.format(s.craRefund)}</span>}
                              {s.rqRefund != null && <span style={{ color: '#c4b5fd' }}>RQ: {fmt.format(s.rqRefund)}</span>}
                            </div>
                          )}
                        </div>
                        <div>
                          <div style={{ fontSize: '0.65rem', color: '#64748b', textTransform: 'uppercase', marginBottom: '0.1rem' }}>Savings Rate</div>
                          <div style={{ fontSize: '0.9rem', fontWeight: 600 }} className={rateClass(s.effectiveRate / 100)}>
                            {s.effectiveRate.toFixed(1)}%
                          </div>
                        </div>
                      </div>
                      
                    </div>
                  ))}
                </div>
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
                <FormattedNumberInput value={b.minIncome} onChange={(v: number) => handleBracketChange('federalBrackets', i, 'minIncome', v)} className="tax-input" />
                <FormattedNumberInput value={b.maxIncome} emptyIsInfinity={true} placeholder="Infinity" onChange={(v: number) => handleBracketChange('federalBrackets', i, 'maxIncome', v)} className="tax-input" />
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
                <FormattedNumberInput value={b.minIncome} onChange={(v: number) => handleBracketChange('provincialBrackets', i, 'minIncome', v)} className="tax-input" />
                <FormattedNumberInput value={b.maxIncome} emptyIsInfinity={true} placeholder="Infinity" onChange={(v: number) => handleBracketChange('provincialBrackets', i, 'maxIncome', v)} className="tax-input" />
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
