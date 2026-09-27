import type {
  ActionWindow,
  Division,
  Pillar,
  PillarSummary,
  Rag,
  RiskAssessment,
  RiskItem,
  Scale5,
  ScoredRisk,
} from './types';
import { DEFAULT_COMPANY, resolveExposure, type CompanyProfile } from './valuation';

export const PILLARS: Pillar[] = ['FINANCE', 'LEGAL', 'OPERATIONS', 'HR'];
export const DIVISIONS: Division[] = ['LEGAL', 'TAX', 'ACCOUNTING', 'HR', 'ADVISORY'];
export const WINDOWS: ActionWindow[] = ['D0_30', 'D31_60', 'D61_90', 'BACKLOG'];

/** Expressz audit belépő díja (nettó). 100%-ban beszámítható remediációba. */
export const AUDIT_FEE_HUF = 1_200_000;

/** Valószínűségi skála → becsült bekövetkezési valószínűség. */
export const PROBABILITY: Record<Scale5, number> = {
  1: 0.05,
  2: 0.2,
  3: 0.4,
  4: 0.65,
  5: 0.9,
};

export interface EngineOptions {
  /**
   * Lényegességi küszöb (Ft). Ha egy tétel bruttó kitettsége eléri,
   * a pontszámtól függetlenül PIROS. 1–5 Mrd Ft árbevételű KKV-nál
   * jellemzően az EBITDA 5%-a; alapértelmezés 50 M Ft.
   */
  materialityHuf: number;
  /** Quick win: legfeljebb ennyi munkanap alatt javítható. */
  quickWinMaxDays: number;
  /** A beszámítható audit díj. */
  auditFeeHuf: number;
  /** Cégadatok a forintosító képletekhez. */
  company: CompanyProfile;
  /**
   * Pillérsúlyok az összesített Health Score-hoz (az átvilágítás típusa adja).
   * Hiányzik: egyenlő súly.
   */
  pillarWeights?: Record<Pillar, number>;
}

export const DEFAULT_OPTIONS: EngineOptions = {
  materialityHuf: 50_000_000,
  quickWinMaxDays: 5,
  auditFeeHuf: AUDIT_FEE_HUF,
  company: DEFAULT_COMPANY,
};

export function ragFromScore(score: number): Rag {
  if (score >= 15) return 'RED';
  if (score >= 8) return 'AMBER';
  return 'GREEN';
}

const RAG_RANK: Record<Rag, number> = { GREEN: 0, AMBER: 1, RED: 2 };

export function worstRag(a: Rag, b: Rag): Rag {
  return RAG_RANK[a] >= RAG_RANK[b] ? a : b;
}

export function scoreRisk(risk: RiskItem, opts: EngineOptions = DEFAULT_OPTIONS): Omit<ScoredRisk, 'priority'> {
  const score = risk.likelihood * risk.impact;
  const resolved = resolveExposure(risk, opts.company);
  const exposure = resolved.valueHuf;
  let rag = ragFromScore(score);
  if (exposure >= opts.materialityHuf) rag = 'RED';

  const probability = PROBABILITY[risk.likelihood];
  const expectedLossHuf = Math.round(exposure * probability);
  const quickWin = rag !== 'GREEN' && risk.remediationDays <= opts.quickWinMaxDays;

  let window: ActionWindow;
  if (quickWin) window = 'D0_30';
  else if (rag === 'RED') window = 'D31_60';
  else if (rag === 'AMBER') window = 'D61_90';
  else window = 'BACKLOG';

  return {
    ...risk,
    exposureHuf: exposure,
    exposureSource: resolved.source,
    exposureExplanation: resolved.explanation,
    score,
    rag,
    probability,
    expectedLossHuf,
    quickWin,
    window,
  };
}

/**
 * Egészségpontszám: minden azonosított kockázat a pontszámával arányosan
 * "lecsíp" a maradékból (multiplikatív), így a pontszám 0–100 között marad,
 * és egy-egy kritikus tétel erősebben hat, mint sok apró.
 */
function healthScore(risks: Pick<ScoredRisk, 'score'>[]): number {
  const remaining = risks.reduce((acc, r) => acc * (1 - (r.score / 25) * 0.6), 1);
  return Math.round(remaining * 100);
}

function pillarRag(summary: Omit<PillarSummary, 'rag'>): Rag {
  if (summary.red > 0 || summary.healthScore < 40) return 'RED';
  if (summary.amber > 0 || summary.healthScore < 70) return 'AMBER';
  return 'GREEN';
}

function emptyRecord<K extends string, V>(keys: readonly K[], make: () => V): Record<K, V> {
  return Object.fromEntries(keys.map((k) => [k, make()])) as Record<K, V>;
}

export function assess(items: RiskItem[], partial: Partial<EngineOptions> = {}): RiskAssessment {
  const opts = { ...DEFAULT_OPTIONS, ...partial };
  const scored = items.filter((r) => r.identified).map((r) => scoreRisk(r, opts));

  // Prioritás: fele súly a pontszámon, fele a várható veszteségen (a legnagyobbhoz
  // normálva), quick win bónusszal – így a "gyors, olcsó, fontos" kerül előre.
  const maxLoss = Math.max(1, ...scored.map((r) => r.expectedLossHuf));
  const risks: ScoredRisk[] = scored
    .map((r) => ({
      ...r,
      priority: (r.score / 25) * 0.5 + (r.expectedLossHuf / maxLoss) * 0.5 + (r.quickWin ? 0.15 : 0),
    }))
    .sort((a, b) => b.priority - a.priority);

  const pillars = emptyRecord(PILLARS, () => null as unknown as PillarSummary);
  for (const pillar of PILLARS) {
    const own = risks.filter((r) => r.pillar === pillar);
    const base = {
      pillar,
      identified: own.length,
      red: own.filter((r) => r.rag === 'RED').length,
      amber: own.filter((r) => r.rag === 'AMBER').length,
      green: own.filter((r) => r.rag === 'GREEN').length,
      grossExposureHuf: sum(own.map((r) => r.exposureHuf)),
      expectedLossHuf: sum(own.map((r) => r.expectedLossHuf)),
      healthScore: healthScore(own),
    };
    pillars[pillar] = { ...base, rag: pillarRag(base) };
  }

  const pillarList = PILLARS.map((p) => pillars[p]);
  const totals = {
    identified: risks.length,
    red: sum(pillarList.map((p) => p.red)),
    amber: sum(pillarList.map((p) => p.amber)),
    green: sum(pillarList.map((p) => p.green)),
    grossExposureHuf: sum(pillarList.map((p) => p.grossExposureHuf)),
    expectedLossHuf: sum(pillarList.map((p) => p.expectedLossHuf)),
    healthScore: weightedHealth(pillarList, opts.pillarWeights),
    rag: pillarList.map((p) => p.rag).reduce<Rag>(worstRag, 'GREEN'),
  };

  const actionPlan = emptyRecord(WINDOWS, () => [] as ScoredRisk[]);
  for (const r of risks) actionPlan[r.window].push(r);

  // Keresztértékesítés: csak a nem-zöld tételekből lesz lead.
  const byDivision = emptyRecord(DIVISIONS, () => ({ count: 0, feeHuf: 0 }));
  for (const r of risks) {
    if (r.rag === 'GREEN') continue;
    byDivision[r.division].count += 1;
    byDivision[r.division].feeHuf += Math.max(0, r.serviceFeeHuf || 0);
  }
  const totalFeeHuf = sum(DIVISIONS.map((d) => byDivision[d].feeHuf));
  const creditHuf = Math.min(opts.auditFeeHuf, totalFeeHuf);

  return {
    risks,
    pillars,
    totals,
    actionPlan,
    pipeline: { byDivision, totalFeeHuf, creditHuf, netAfterCreditHuf: totalFeeHuf - creditHuf },
  };
}

function weightedHealth(pillars: PillarSummary[], weights?: Record<Pillar, number>): number {
  if (!weights) return Math.round(sum(pillars.map((p) => p.healthScore)) / pillars.length);
  const total = sum(pillars.map((p) => Math.max(0, weights[p.pillar] ?? 0)));
  if (total <= 0) return Math.round(sum(pillars.map((p) => p.healthScore)) / pillars.length);
  return Math.round(sum(pillars.map((p) => p.healthScore * Math.max(0, weights[p.pillar] ?? 0))) / total);
}

function sum(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0);
}

const hufFormatter = new Intl.NumberFormat('hu-HU', {
  style: 'currency',
  currency: 'HUF',
  maximumFractionDigits: 0,
});

export function formatHuf(value: number): string {
  return hufFormatter.format(value);
}

/** Tömör forma dashboard-kártyákra: 12,5 M Ft / 1,2 Mrd Ft. */
export function formatHufShort(value: number): string {
  const abs = Math.abs(value);
  const fmt = (n: number) => n.toLocaleString('hu-HU', { maximumFractionDigits: 1 });
  if (abs >= 1e9) return `${fmt(value / 1e9)} Mrd Ft`;
  if (abs >= 1e6) return `${fmt(value / 1e6)} M Ft`;
  if (abs >= 1e3) return `${fmt(value / 1e3)} E Ft`;
  return `${Math.round(value)} Ft`;
}
