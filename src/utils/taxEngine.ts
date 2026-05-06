/**
 * Tax Engine — Quebec RRSP Bracket Optimizer
 * ============================================
 * Implements the "top-down cascade" algorithm to calculate CRA and RQ refunds
 * separately, using 2026 Federal and Quebec provincial tax brackets.
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

/** Returns the marginal rate at a given income from a bracket array. */
function getMarginalRate(income: number, brackets: TaxBracket[]): number {
  if (income <= 0) return 0;
  const bracket = [...brackets].reverse().find(b => income > b.minIncome);
  return bracket ? bracket.rate : 0;
}

/**
 * Top-Down Cascade Refund
 * Calculates the tax savings of shielding income from `incomeHigh`
 * down to `incomeLow` through a given set of brackets.
 *
 * Step B from the spec:
 *   For each bracket: Overlap = min(incomeHigh, bracket.max) - max(incomeLow, bracket.min)
 *   If Overlap > 0 → Layer_Refund = Overlap * rate * rateMultiplier
 */
function cascadeRefund(
  incomeHigh: number,
  incomeLow: number,
  brackets: TaxBracket[],
  rateMultiplier: number
): number {
  if (incomeHigh <= incomeLow || incomeHigh <= 0) return 0;
  let refund = 0;
  for (const b of brackets) {
    const bMax = b.maxIncome === Infinity ? 1e9 : b.maxIncome;
    const overlap = Math.min(incomeHigh, bMax) - Math.max(incomeLow, b.minIncome);
    if (overlap > 0) {
      refund += overlap * b.rate * rateMultiplier;
    }
  }
  return refund;
}

// ─── Layer Cake ───────────────────────────────────────────────────────────────

export function buildLayerCakeData(
  federalTaxableIncome: number,
  rrspContribution: number,
  settings: TaxSettings
): LayerCakeSegment[] {
  if (federalTaxableIncome <= 0) return [];
  const { federalBrackets, provincialBrackets, abatement } = settings;

  // Build breakpoints from both bracket sets within income range
  const pointSet = new Set<number>([0, federalTaxableIncome]);
  for (const b of [...federalBrackets, ...provincialBrackets]) {
    if (b.minIncome > 0 && b.minIncome < federalTaxableIncome) pointSet.add(b.minIncome);
    if (b.maxIncome !== Infinity && b.maxIncome < federalTaxableIncome) pointSet.add(b.maxIncome);
  }
  const breakpoints = Array.from(pointSet).sort((a, b) => a - b);

  // Build raw bands
  const bands: LayerCakeSegment[] = [];
  for (let i = 0; i < breakpoints.length - 1; i++) {
    const from = breakpoints[i];
    const to   = breakpoints[i + 1];
    const mid  = (from + to) / 2;
    const fedRate  = getMarginalRate(mid, federalBrackets) * (1 - abatement);
    const provRate = getMarginalRate(mid, provincialBrackets);
    bands.push({
      label: `$${Math.round(from).toLocaleString('en-CA')} – $${Math.round(to).toLocaleString('en-CA')}`,
      amount: to - from,
      federalRate: fedRate,
      provincialRate: provRate,
      combinedRate: fedRate + provRate,
      isShielded: false,
      partialShield: 0,
    });
  }

  // Merge adjacent bands with same combined rate
  const merged: LayerCakeSegment[] = [];
  for (const band of bands) {
    const last = merged[merged.length - 1];
    if (last && Math.abs(last.combinedRate - band.combinedRate) < 0.0001) {
      // Extend the last segment's label and amount
      const labelFrom = last.label.split(' – ')[0];
      last.label = `${labelFrom} – $${Math.round(parseFloat(band.label.split(' – ')[1].replace(/[$,]/g, ''))).toLocaleString('en-CA')}`;
      last.amount += band.amount;
    } else {
      merged.push({ ...band });
    }
  }

  // Apply RRSP shield top-down
  const shieldAmount = Math.min(Math.max(rrspContribution, 0), federalTaxableIncome);
  let shieldRemaining = shieldAmount;
  for (let i = merged.length - 1; i >= 0 && shieldRemaining > 0; i--) {
    const layer = merged[i];
    if (shieldRemaining >= layer.amount) {
      layer.isShielded = true;
      layer.partialShield = 1;
      shieldRemaining -= layer.amount;
    } else {
      layer.partialShield = shieldRemaining / layer.amount;
      shieldRemaining = 0;
    }
  }
  return merged;
}

// ─── Main Optimization ───────────────────────────────────────────────────────

export function calculateOptimization(
  federalTaxableIncome: number,
  quebecTaxableIncome: number,
  currentRRSPContribution: number,
  settings: TaxSettings
): OptimizationResult {
  const { federalBrackets, provincialBrackets, abatement } = settings;
  const contribution    = Math.max(0, currentRRSPContribution);
  const newFedTaxable   = Math.max(0, federalTaxableIncome - contribution);
  const newQcTaxable    = Math.max(0, quebecTaxableIncome  - contribution);

  // === Step A: Effective rates & cascade ===
  // CRA refund: federal cascade with abatement applied
  const craRefund = cascadeRefund(federalTaxableIncome, newFedTaxable, federalBrackets, 1 - abatement);
  // RQ refund: provincial cascade (no abatement multiplier needed here)
  const rqRefund  = cascadeRefund(quebecTaxableIncome,  newQcTaxable,  provincialBrackets, 1);

  const totalRefund                 = craRefund + rqRefund;
  const effectiveTaxSavingsPercentage = contribution > 0 ? (totalRefund / contribution) * 100 : 0;

  // === Current top combined rate (BEFORE RRSP) ===
  const topFedRate  = getMarginalRate(federalTaxableIncome, federalBrackets) * (1 - abatement);
  const topProvRate = getMarginalRate(quebecTaxableIncome,  provincialBrackets);
  const currentCombinedRate = topFedRate + topProvRate;

  // === New top combined rate (AFTER RRSP) ===
  const newFedRate  = getMarginalRate(newFedTaxable, federalBrackets) * (1 - abatement);
  const newProvRate = getMarginalRate(newQcTaxable,  provincialBrackets);
  const newCombinedRate = newFedRate + newProvRate;

  // === Step C: Sweet Spot — next COMBINED rate drop ===
  // Build candidate contributions that would push either federal or QC income
  // across a bracket boundary. The sweet spot is the smallest such contribution
  // that actually lowers the COMBINED marginal rate.
  const fedBreaks = federalBrackets.map(b => b.minIncome).filter(bp => bp > 0 && bp < federalTaxableIncome);
  const qcBreaks  = provincialBrackets.map(b => b.minIncome).filter(bp => bp > 0 && bp < quebecTaxableIncome);

  // For each fed breakpoint, the required contribution is (federalTaxableIncome - bp)
  // For each QC breakpoint, the required contribution is (quebecTaxableIncome - bp)
  const candidates = [
    ...fedBreaks.map(bp => federalTaxableIncome - bp),
    ...qcBreaks.map(bp => quebecTaxableIncome - bp),
  ].filter(c => c > contribution); // Only candidates ABOVE current contribution

  let sweetSpotContribution = contribution; // default: already at sweet spot
  let remainingRoomInCurrentBracket = 0;

  // Find the smallest contribution that drops the COMBINED rate
  const sortedCandidates = candidates.sort((a, b) => a - b);
  for (const candidate of sortedCandidates) {
    const testFed  = Math.max(0, federalTaxableIncome - candidate);
    const testQc   = Math.max(0, quebecTaxableIncome  - candidate);
    const testCombined = getMarginalRate(testFed, federalBrackets) * (1 - abatement)
                       + getMarginalRate(testQc,  provincialBrackets);
    if (testCombined < currentCombinedRate - 0.001) {
      sweetSpotContribution = candidate;
      remainingRoomInCurrentBracket = Math.max(0, candidate - contribution);
      break;
    }
  }

  // If current contribution already dropped the rate, find the NEXT drop from here
  if (sweetSpotContribution === contribution && newCombinedRate < currentCombinedRate - 0.001) {
    // Already dropped — find next drop above current contribution
    const nextCandidates = [
      ...fedBreaks.map(bp => federalTaxableIncome - bp),
      ...qcBreaks.map(bp => quebecTaxableIncome - bp),
    ].filter(c => c > contribution).sort((a, b) => a - b);

    for (const candidate of nextCandidates) {
      const testFed  = Math.max(0, federalTaxableIncome - candidate);
      const testQc   = Math.max(0, quebecTaxableIncome  - candidate);
      const testCombined = getMarginalRate(testFed, federalBrackets) * (1 - abatement)
                         + getMarginalRate(testQc,  provincialBrackets);
      if (testCombined < newCombinedRate - 0.001) {
        sweetSpotContribution = candidate;
        remainingRoomInCurrentBracket = Math.max(0, candidate - contribution);
        break;
      }
    }
  }

  // === Layer Cake ===
  const layers = buildLayerCakeData(federalTaxableIncome, contribution, settings);

  // === Flags ===
  const diminishingReturns = newCombinedRate < 0.30;
  const bracketCrossed     = newCombinedRate < currentCombinedRate - 0.001;

  return {
    federalTaxableIncome,
    quebecTaxableIncome,
    taxableIncome: newFedTaxable,
    totalRefund,
    craRefund,
    rqRefund,
    effectiveTaxSavingsPercentage,
    remainingRoomInCurrentBracket,
    currentCombinedRate,
    newCombinedRate,
    sweetSpotContribution,
    layers,
    diminishingReturns,
    bracketCrossed,
  };
}
