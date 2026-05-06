/**
 * Tax Engine — Quebec RRSP Bracket Optimizer
 * ============================================
 * Uses dynamic Federal and Quebec provincial tax brackets.
 */

import type { TaxBracket, LayerCakeSegment, OptimizationResult, TaxSettings } from '../types';

// ─── 2026 Default Settings ───────────────────────────────────────────────────
export const DEFAULT_QUEBEC_ABATEMENT = 0.165;

export const defaultFederalBrackets: TaxBracket[] = [
  { minIncome: 0,       maxIncome: 58_523,   rate: 0.14   },
  { minIncome: 58_523,  maxIncome: 117_045,  rate: 0.205  },
  { minIncome: 117_045, maxIncome: 181_440,  rate: 0.26   },
  { minIncome: 181_440, maxIncome: 258_482,  rate: 0.29   },
  { minIncome: 258_482, maxIncome: Infinity, rate: 0.33   },
];

export const defaultProvincialBrackets: TaxBracket[] = [
  { minIncome: 0,       maxIncome: 54_345,   rate: 0.14   },
  { minIncome: 54_345,  maxIncome: 108_680,  rate: 0.19   },
  { minIncome: 108_680, maxIncome: 132_245,  rate: 0.24   },
  { minIncome: 132_245, maxIncome: Infinity, rate: 0.2575 },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getFederalRate(income: number, brackets: TaxBracket[]): number {
  const bracket = brackets.slice().reverse().find(b => income > b.minIncome);
  return bracket ? bracket.rate : 0;
}

function getProvincialRate(income: number, brackets: TaxBracket[]): number {
  const bracket = brackets.slice().reverse().find(b => income > b.minIncome);
  return bracket ? bracket.rate : 0;
}

function effectiveFederalRate(rate: number, abatement: number): number {
  return rate * (1 - abatement);
}

function combinedRate(fedRate: number, provRate: number, abatement: number): number {
  return effectiveFederalRate(fedRate, abatement) + provRate;
}

function getAllBreakpoints(federal: TaxBracket[], provincial: TaxBracket[]): number[] {
  const points = new Set<number>();
  [...federal, ...provincial].forEach(b => {
    points.add(b.minIncome);
    if (b.maxIncome !== Infinity) points.add(b.maxIncome);
  });
  return Array.from(points).sort((a, b) => a - b);
}

// ─── Core: Build Layer Cake ───────────────────────────────────────────────────

export function buildLayerCakeData(
  income: number,
  rrspContribution: number,
  settings: TaxSettings
): LayerCakeSegment[] {
  if (income <= 0) return [];

  const { federalBrackets, provincialBrackets, abatement } = settings;
  const allBreakpoints = getAllBreakpoints(federalBrackets, provincialBrackets);
  const bands: { from: number; to: number; fedRate: number; provRate: number }[] = [];
  const breakpoints = [0, ...allBreakpoints.filter(p => p > 0 && p < income), income];

  for (let i = 0; i < breakpoints.length - 1; i++) {
    const from = breakpoints[i];
    const to = breakpoints[i + 1];
    const mid = (from + to) / 2;
    bands.push({
      from,
      to,
      fedRate: getFederalRate(mid, federalBrackets),
      provRate: getProvincialRate(mid, provincialBrackets),
    });
  }

  const merged: typeof bands = [];
  for (const band of bands) {
    const last = merged[merged.length - 1];
    if (
      last &&
      Math.abs(combinedRate(last.fedRate, last.provRate, abatement) - combinedRate(band.fedRate, band.provRate, abatement)) < 0.0001
    ) {
      last.to = band.to;
    } else {
      merged.push({ ...band });
    }
  }

  const clampedShield = Math.min(Math.max(rrspContribution, 0), income);
  let shieldRemaining = clampedShield;

  const layers: LayerCakeSegment[] = merged.map(band => {
    const amount = band.to - band.from;
    const fedR = band.fedRate;
    const provR = band.provRate;
    return {
      label: `$${Math.round(band.from).toLocaleString('en-CA')} – $${band.to === income ? Math.round(income).toLocaleString('en-CA') : Math.round(band.to).toLocaleString('en-CA')}`,
      amount,
      federalRate: effectiveFederalRate(fedR, abatement),
      provincialRate: provR,
      combinedRate: combinedRate(fedR, provR, abatement),
      isShielded: false,
      partialShield: 0,
    };
  });

  for (let i = layers.length - 1; i >= 0 && shieldRemaining > 0; i--) {
    const layer = layers[i];
    if (shieldRemaining >= layer.amount) {
      layer.isShielded = true;
      layer.partialShield = 1;
      shieldRemaining -= layer.amount;
    } else {
      layer.isShielded = false;
      layer.partialShield = shieldRemaining / layer.amount;
      shieldRemaining = 0;
    }
  }

  return layers;
}

// ─── Core: Calculate Optimization ────────────────────────────────────────────

export function calculateOptimization(
  annualIncome: number,
  currentRRSPContribution: number,
  settings: TaxSettings
): OptimizationResult {
  const { federalBrackets, provincialBrackets, abatement } = settings;
  const contribution = Math.max(0, currentRRSPContribution);
  const taxableIncome = Math.max(0, annualIncome - contribution);

  const layers = buildLayerCakeData(annualIncome, contribution, settings);

  const topFedRate = getFederalRate(taxableIncome, federalBrackets);
  const topProvRate = getProvincialRate(taxableIncome, provincialBrackets);
  const currentCombinedRate = combinedRate(topFedRate, topProvRate, abatement);

  let refund = 0;
  let remainingContribution = contribution;
  const allBreakpoints = getAllBreakpoints(federalBrackets, provincialBrackets);

  const breakpoints = [0, ...allBreakpoints.filter(p => p > 0 && p < annualIncome), annualIncome]
    .sort((a, b) => b - a);

  for (let i = 0; i < breakpoints.length - 1 && remainingContribution > 0; i++) {
    const layerTop = breakpoints[i];
    const layerBot = breakpoints[i + 1];
    const layerSize = layerTop - layerBot;
    const applied = Math.min(remainingContribution, layerSize);

    const mid = (layerTop + layerBot) / 2;
    const fedR = getFederalRate(mid, federalBrackets);
    const provR = getProvincialRate(mid, provincialBrackets);
    const rate = combinedRate(fedR, provR, abatement);

    refund += applied * rate;
    remainingContribution -= applied;
  }

  const effectiveTaxSavingsPercentage = contribution > 0 ? (refund / contribution) * 100 : 0;

  const nextBreakpoint = allBreakpoints.slice()
    .filter(p => p < taxableIncome)
    .sort((a, b) => b - a)[0] ?? 0;

  const remainingRoomInCurrentBracket = taxableIncome - nextBreakpoint;
  const sweetSpotContribution = contribution + remainingRoomInCurrentBracket;
  const diminishingReturns = currentCombinedRate < 0.30;

  return {
    taxableIncome,
    totalRefund: refund,
    effectiveTaxSavingsPercentage,
    remainingRoomInCurrentBracket,
    currentCombinedRate,
    sweetSpotContribution,
    layers,
    diminishingReturns,
  };
}
