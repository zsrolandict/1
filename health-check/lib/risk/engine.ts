import { estimateRemediation } from '@/lib/remediation/estimate';
import { COVERAGE_GATE, COVERAGE_PILLAR_MIN } from './coverageRules';
import type { ActionWindow, Division, Pillar, PillarState, PillarSummary, Rag, RiskAssessment, RiskItem, Scale5, ScoredRisk } from './types';
import { DEFAULT_COMPANY, resolveExposure, type CompanyProfile } from './valuation';
import type { KindAdjustments } from '@/lib/engagement/adjustments';

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
   * Lényegességi küszöb (Ft). Ha egy tétel VÁRHATÓ vesztesége
   * (kitettség × valószínűség) eléri, a pontszámtól függetlenül PIROS.
   * Így egy nagy, de valószínűtlen kitettség nem lesz automatikusan piros,
   * a típus-korrekció viszont (a valószínűségen át) ide is hat.
   * 1–5 Mrd Ft árbevételű KKV-nál jellemzően az EBITDA 5%-a; alapértelmezés 50 M Ft.
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
  /** Típusfüggő valószínűség/hatás-korrekciók tételkódonként. */
  adjustments?: KindAdjustments;
  /**
   * Vizsgálati lefedettség pillérenként (0–1, `lib/risk/coverage.ts`). Ha
   * meg van adva: a nem vizsgált pillér kiesik a pontszám nevezőjéből, és a
   * minősítési kapu alatt nem adható Zöld. Hiányában (régi hívók, tesztek)
   * minden pillér vizsgáltnak számít – a felület és a riport mindig átadja.
   */
  coverage?: Partial<Record<Pillar, number>>;
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

/**
 * 1–5 skálára igazítás. Szövegként érkező szám is számként számít (különben
 * a „4” + 1 szövegösszefűzés lenne); hiányzó vagy érvénytelen érték a
 * legsúlyosabb (5): adathiány miatt egy tétel nem lehet csendben zöld.
 */
export const clampScale = (n: unknown): Scale5 => {
  const x = typeof n === 'number' ? n : typeof n === 'string' && n.trim() !== '' ? Number(n) : NaN;
  return (Number.isFinite(x) ? Math.min(5, Math.max(1, Math.round(x))) : 5) as Scale5;
};

export function scoreRisk(risk: RiskItem, options: Partial<EngineOptions> = {}): Omit<ScoredRisk, 'priority'> {
  const plan = estimateRemediation(risk);
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const adj = risk.ignoreKindAdjustment ? undefined : opts.adjustments?.[risk.code];
  const baseLikelihood = clampScale(risk.likelihood);
  const baseImpact = clampScale(risk.impact);
  const likelihood = clampScale(baseLikelihood + (adj?.dL ?? 0));
  const impact = clampScale(baseImpact + (adj?.dI ?? 0));
  const adjusted = likelihood !== baseLikelihood || impact !== baseImpact;
  const score = likelihood * impact;
  const resolved = resolveExposure(risk, opts.company);
  const exposure = resolved.valueHuf;
  const probability = PROBABILITY[likelihood];
  const expectedLossHuf = Math.round(exposure * probability);
  let rag = ragFromScore(score);
  const materialityOverride = rag !== 'RED' && expectedLossHuf >= opts.materialityHuf;
  if (materialityOverride) rag = 'RED';
  const quickWin = rag !== 'GREEN' && risk.remediationDays <= opts.quickWinMaxDays;

  let window: ActionWindow;
  if (quickWin) window = 'D0_30';
  else if (rag === 'RED') window = 'D31_60';
  else if (rag === 'AMBER') window = 'D61_90';
  else window = 'BACKLOG';

  return {
    ...risk,
    likelihood,
    impact,
    baseLikelihood,
    baseImpact,
    adjustment: adjusted && adj ? adj : undefined,
    exposureHuf: exposure,
    exposureSource: resolved.source,
    exposureExplanation: resolved.explanation,
    score,
    rag,
    materialityOverride,
    probability,
    expectedLossHuf,
    quickWin,
    window,
    fee: { ...plan.fee, hours: plan.hours, source: plan.source },
    feeByDivision: plan.byDivision,
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

function pillarRag(summary: { red: number; amber: number; healthScore: number }): Rag {
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
    const raw = pillarRag(base);
    const coverage = opts.coverage ? clampCoverage(opts.coverage[pillar]) : null;
    const state: PillarState = coverage == null || coverage >= COVERAGE_PILLAR_MIN ? 'EXAMINED' : base.identified > 0 ? 'PARTIAL' : 'NOT_EXAMINED';
    pillars[pillar] = {
      ...base,
      healthScore: state === 'NOT_EXAMINED' ? null : base.healthScore,
      rag: state === 'NOT_EXAMINED' || (state === 'PARTIAL' && raw === 'GREEN') ? 'UNRATED' : raw,
      rawRag: raw,
      coverage,
      state,
    } as PillarSummary;
  }

  const pillarList = PILLARS.map((p) => pillars[p]);
  // Dinamikus nevező: csak a vizsgált (vagy megállapítással bíró) pillérek számítanak.
  const included = pillarList.filter((p) => p.state !== 'NOT_EXAMINED');
  const coverageTotal = opts.coverage ? weightedCoverage(pillarList, opts.pillarWeights) : null;
  const qualified = coverageTotal == null || coverageTotal >= COVERAGE_GATE;
  const rawTotal = included.map((p) => (p as PillarSummary & { rawRag: Rag }).rawRag).reduce<Rag>(worstRag, 'GREEN');
  for (const p of pillarList) delete (p as Partial<PillarSummary & { rawRag: Rag }>).rawRag;
  const totals = {
    identified: risks.length,
    red: sum(pillarList.map((p) => p.red)),
    amber: sum(pillarList.map((p) => p.amber)),
    green: sum(pillarList.map((p) => p.green)),
    grossExposureHuf: sum(pillarList.map((p) => p.grossExposureHuf)),
    expectedLossHuf: sum(pillarList.map((p) => p.expectedLossHuf)),
    healthScore: included.length ? weightedHealth(included, opts.pillarWeights) : null,
    // Kapu: nem vizsgálható semmi, vagy részleges lefedettség mellett nem adható Zöld (Piros és Sárga marad).
    rag: !included.length || (rawTotal === 'GREEN' && !qualified) ? ('UNRATED' as const) : rawTotal,
    coverage: coverageTotal,
    qualified,
  };

  const actionPlan = emptyRecord(WINDOWS, () => [] as ScoredRisk[]);
  for (const r of risks) actionPlan[r.window].push(r);

  // Keresztértékesítés: csak a nem-zöld tételekből lesz lead.
  const byDivision = emptyRecord(DIVISIONS, () => ({ count: 0, feeHuf: 0 }));
  for (const r of risks) {
    if (r.rag === 'GREEN') continue;
    byDivision[r.division].count += 1;
    for (const [d, fee] of Object.entries(r.feeByDivision) as [Division, number][]) byDivision[d].feeHuf += Math.max(0, fee || 0);
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

/** Súlyozott átlag a megadott (vizsgált) pillérekre; a súlyok ezekre normálódnak. */
function weightedHealth(pillars: PillarSummary[], weights?: Record<Pillar, number>): number {
  const score = (p: PillarSummary) => p.healthScore ?? 0;
  if (!weights) return Math.round(sum(pillars.map(score)) / pillars.length);
  const total = sum(pillars.map((p) => Math.max(0, weights[p.pillar] ?? 0)));
  if (total <= 0) return Math.round(sum(pillars.map(score)) / pillars.length);
  return Math.round(sum(pillars.map((p) => score(p) * Math.max(0, weights[p.pillar] ?? 0))) / total);
}

/** Összesített lefedettség: a pillérsúlyokkal súlyozott átlag (súly nélkül egyszerű átlag). */
function weightedCoverage(pillars: PillarSummary[], weights?: Record<Pillar, number>): number {
  const total = weights ? sum(pillars.map((p) => Math.max(0, weights[p.pillar] ?? 0))) : 0;
  if (!weights || total <= 0) return sum(pillars.map((p) => p.coverage ?? 0)) / pillars.length;
  return sum(pillars.map((p) => (p.coverage ?? 0) * Math.max(0, weights[p.pillar] ?? 0))) / total;
}

const clampCoverage = (x: unknown): number => (typeof x === 'number' && Number.isFinite(x) ? Math.min(1, Math.max(0, x)) : 0);

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
