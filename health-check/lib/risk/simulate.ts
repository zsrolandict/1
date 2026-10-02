import { assess, type EngineOptions } from './engine';
import type { RiskAssessment, RiskItem } from './types';

/**
 * „Mi lenne, ha…?” – ha a kiválasztott tételeket megoldják, hogyan
 * változik a kép. Megoldott tétel: kikerül az azonosítottak közül.
 * Csökkentett tétel: a valószínűség 1-re esik (maradványkockázat).
 */
export type FixMode = 'RESOLVE' | 'MITIGATE';

export interface Simulation {
  before: RiskAssessment;
  after: RiskAssessment;
  fixedCount: number;
  /** A kiválasztott javítások becsült ICT-díja. */
  costHuf: number;
  /** Leghosszabb javítás munkanapban (párhuzamos munkát feltételezve). */
  maxDays: number;
  expectedLossReductionHuf: number;
  grossExposureReductionHuf: number;
  /** null, ha előtte vagy utána nem értékelhető. */
  healthScoreGain: number | null;
  /** Várható veszteség-csökkenés / díj; null, ha nincs díj. */
  returnMultiple: number | null;
}

export function applyFixes(items: RiskItem[], fixIds: Set<string>, mode: FixMode): RiskItem[] {
  return items.map((r) => {
    if (!fixIds.has(r.id) || !r.identified) return r;
    return mode === 'RESOLVE' ? { ...r, identified: false } : { ...r, likelihood: 1, ignoreKindAdjustment: true };
  });
}

export function simulate(items: RiskItem[], opts: Partial<EngineOptions>, fixIds: Set<string>, mode: FixMode = 'RESOLVE'): Simulation {
  const before = assess(items, opts);
  const after = assess(applyFixes(items, fixIds, mode), opts);
  const fixed = before.risks.filter((r) => fixIds.has(r.id));
  const costHuf = fixed.reduce((s, r) => s + r.fee.base, 0);
  const expectedLossReductionHuf = before.totals.expectedLossHuf - after.totals.expectedLossHuf;
  return {
    before,
    after,
    fixedCount: fixed.length,
    costHuf,
    maxDays: fixed.reduce((m, r) => Math.max(m, r.remediationDays), 0),
    expectedLossReductionHuf,
    grossExposureReductionHuf: before.totals.grossExposureHuf - after.totals.grossExposureHuf,
    healthScoreGain: after.totals.healthScore != null && before.totals.healthScore != null ? after.totals.healthScore - before.totals.healthScore : null,
    returnMultiple: costHuf > 0 ? expectedLossReductionHuf / costHuf : null,
  };
}

/** Előre összeállított változatok a gyors összevetéshez. */
export function presetFixes(a: RiskAssessment, preset: 'QUICK_WINS' | 'RED' | 'D0_30' | 'ALL_NON_GREEN'): Set<string> {
  switch (preset) {
    case 'QUICK_WINS':
      return new Set(a.risks.filter((r) => r.quickWin).map((r) => r.id));
    case 'RED':
      return new Set(a.risks.filter((r) => r.rag === 'RED').map((r) => r.id));
    case 'D0_30':
      return new Set(a.actionPlan.D0_30.map((r) => r.id));
    default:
      return new Set(a.risks.filter((r) => r.rag !== 'GREEN').map((r) => r.id));
  }
}
