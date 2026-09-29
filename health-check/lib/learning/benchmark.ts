import { adjustmentsFor } from '@/lib/engagement/adjustments';
import { ENGAGEMENT_KINDS, type EngagementKind } from '@/lib/engagement/kinds';
import { templateFor } from '@/lib/intake/apply';
import type { Sector } from '@/lib/intake/requests';
import { assess } from '@/lib/risk/engine';
import type { Pillar, Rag, RiskAssessment } from '@/lib/risk/types';
import { SCENARIOS } from '@/lib/scenarios';
import { markSaved, markSaveFailed } from '@/lib/localSave';

/**
 * Tudástár: a lezárt projektek ANONIMIZÁLT összesítője. Cégnév, adószám,
 * bizonyíték, idézet, összeg és egyedi (CUS-) tételcím nem kerül bele, csak
 * az átvilágítás típusa, az ágazat, egy árbevétel-sáv és a katalógustételek
 * besorolása. Ebből látszik, mi a gyakori egy ágazatban, és hol tér el a
 * katalógus alapértéke a tapasztalattól (kalibrálási javaslat – a katalógust
 * a szakértő módosítja, a program nem).
 */

export type RevenueBand = 'XS' | 'S' | 'M' | 'L';

export const REVENUE_BAND_LABEL: Record<RevenueBand, string> = {
  XS: '500 M Ft alatt',
  S: '500 M – 2 Mrd Ft',
  M: '2 – 10 Mrd Ft',
  L: '10 Mrd Ft felett',
};

export function revenueBand(revenueHuf: number): RevenueBand {
  if (revenueHuf < 500_000_000) return 'XS';
  if (revenueHuf < 2_000_000_000) return 'S';
  if (revenueHuf < 10_000_000_000) return 'M';
  return 'L';
}

export interface BenchmarkItem {
  code: string;
  pillar: Pillar;
  /** Katalógustételnél a katalógus címe; egyedi tételnél üres (anonimitás). */
  title: string;
  likelihood: number;
  impact: number;
  rag: Rag;
}

export interface BenchmarkRecord {
  id: string;
  /** Csak helyi azonosító a felülíráshoz (ugyanaz a projekt kétszer ne számítson). */
  ref: string;
  closedAt: string;
  kind: EngagementKind;
  sectors: Sector[];
  revenueBand: RevenueBand;
  healthScore: number;
  red: number;
  amber: number;
  items: BenchmarkItem[];
  source: 'DEMO' | 'PROJECT';
}

const isCustom = (code: string) => code.startsWith('CUS-');

/** Az értékelésből anonim rekord. */
export function anonymize(
  result: RiskAssessment,
  meta: { ref: string; kind: EngagementKind; sectors: Sector[]; revenueHuf: number; source?: BenchmarkRecord['source'] },
  now = new Date(),
): BenchmarkRecord {
  return {
    id: `B${now.getTime().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    ref: meta.ref,
    closedAt: now.toISOString().slice(0, 10),
    kind: meta.kind,
    sectors: [...meta.sectors],
    revenueBand: revenueBand(meta.revenueHuf),
    healthScore: result.totals.healthScore,
    red: result.totals.red,
    amber: result.totals.amber,
    items: result.risks.map((r) => ({
      code: isCustom(r.code) ? 'CUS' : r.code,
      pillar: r.pillar,
      title: isCustom(r.code) ? '' : (templateFor(r.code)?.title ?? r.title),
      // A szakértő által adott (típuskorrekció előtti) értékek: ezek mérhetők össze.
      likelihood: r.baseLikelihood,
      impact: r.baseImpact,
      rag: r.rag,
    })),
    source: meta.source ?? 'PROJECT',
  };
}

/** A négy kitalált mintaesetből készült bemutató rekordok (DEMO címkével). */
export function demoRecords(): BenchmarkRecord[] {
  return SCENARIOS.map((s, i) => {
    const result = assess(s.items, {
      company: s.company,
      materialityHuf: s.materialityHuf,
      adjustments: adjustmentsFor(s.kind),
      pillarWeights: ENGAGEMENT_KINDS[s.kind].weights,
    });
    const rec = anonymize(
      result,
      { ref: `demo:${s.id}`, kind: s.kind, sectors: s.sectors ?? [], revenueHuf: s.company.revenueHuf, source: 'DEMO' },
      new Date(Date.UTC(2026, 0, 1 + i)),
    );
    return { ...rec, id: `DEMO-${s.id}` };
  });
}

export interface BenchmarkFilter {
  kind?: EngagementKind | null;
  sector?: Sector | null;
  revenueBand?: RevenueBand | null;
}

export function filterRecords(records: BenchmarkRecord[], f: BenchmarkFilter): BenchmarkRecord[] {
  return records.filter(
    (r) => (!f.kind || r.kind === f.kind) && (!f.sector || r.sectors.includes(f.sector)) && (!f.revenueBand || r.revenueBand === f.revenueBand),
  );
}

export interface CodeStat {
  code: string;
  title: string;
  pillar: Pillar;
  count: number;
  /** Hány projekt %-ában fordult elő (0–1). */
  frequency: number;
  avgLikelihood: number;
  avgImpact: number;
  redShare: number;
}

export interface BenchmarkStats {
  n: number;
  avgHealth: number | null;
  avgRed: number | null;
  codes: CodeStat[];
  customCount: number;
}

const round1 = (x: number) => Math.round(x * 10) / 10;

export function stats(records: BenchmarkRecord[]): BenchmarkStats {
  const n = records.length;
  const by = new Map<string, { item: BenchmarkItem; projects: Set<string>; l: number; i: number; red: number; k: number }>();
  let customCount = 0;
  for (const rec of records) {
    for (const it of rec.items) {
      if (it.code === 'CUS') {
        customCount++;
        continue;
      }
      const s = by.get(it.code) ?? { item: it, projects: new Set<string>(), l: 0, i: 0, red: 0, k: 0 };
      s.projects.add(rec.id);
      s.l += it.likelihood;
      s.i += it.impact;
      s.red += it.rag === 'RED' ? 1 : 0;
      s.k++;
      by.set(it.code, s);
    }
  }
  const codes = [...by.entries()]
    .map(([code, s]) => ({
      code,
      title: s.item.title,
      pillar: s.item.pillar,
      count: s.projects.size,
      frequency: n ? s.projects.size / n : 0,
      avgLikelihood: round1(s.l / s.k),
      avgImpact: round1(s.i / s.k),
      redShare: s.red / s.k,
    }))
    .sort((a, b) => b.frequency - a.frequency || b.redShare - a.redShare || a.code.localeCompare(b.code));
  const avg = (f: (r: BenchmarkRecord) => number) => (n ? round1(records.reduce((a, r) => a + f(r), 0) / n) : null);
  return { n, avgHealth: avg((r) => r.healthScore), avgRed: avg((r) => r.red), codes, customCount };
}

export interface Calibration {
  code: string;
  title: string;
  n: number;
  catalogLikelihood: number;
  observedLikelihood: number;
  catalogImpact: number;
  observedImpact: number;
}

/**
 * Kalibrálási javaslat: ahol legalább `minN` projektben szerepelt a tétel, és a
 * tapasztalt átlag legalább 1 ponttal eltér a katalógus alapértékétől.
 */
export function calibrations(s: BenchmarkStats, minN = 3): Calibration[] {
  const out: Calibration[] = [];
  for (const c of s.codes) {
    if (c.count < minN) continue;
    const t = templateFor(c.code);
    if (!t) continue;
    if (Math.abs(c.avgLikelihood - t.likelihood) >= 1 || Math.abs(c.avgImpact - t.impact) >= 1) {
      out.push({
        code: c.code,
        title: c.title,
        n: c.count,
        catalogLikelihood: t.likelihood,
        observedLikelihood: c.avgLikelihood,
        catalogImpact: t.impact,
        observedImpact: c.avgImpact,
      });
    }
  }
  return out;
}

/** Hasonló projektekben gyakori (≥ minFreq), itt viszont nincs bejelölve. */
export function commonButMissing(s: BenchmarkStats, identifiedCodes: Iterable<string>, minFreq = 0.5, minN = 2): CodeStat[] {
  if (s.n < minN) return [];
  const have = new Set(identifiedCodes);
  return s.codes.filter((c) => c.frequency >= minFreq && !have.has(c.code));
}

const KEY = 'ict-hc:benchmark:v1';

export function loadBenchmark(): BenchmarkRecord[] {
  try {
    const raw = localStorage.getItem(KEY);
    const list = raw ? (JSON.parse(raw) as BenchmarkRecord[]) : [];
    return Array.isArray(list) ? list.filter((r) => r && r.source === 'PROJECT') : [];
  } catch {
    return [];
  }
}

export function saveBenchmark(list: BenchmarkRecord[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.filter((r) => r.source === 'PROJECT')));
    markSaved();
  } catch {
    markSaveFailed(); // betelt tárhely vagy privát mód: a felület jelzi
  }
}

/** Új rekord felvétele; ugyanannak a projektnek a korábbi rekordját lecseréli. */
export function upsertRecord(list: BenchmarkRecord[], rec: BenchmarkRecord): BenchmarkRecord[] {
  return [rec, ...list.filter((r) => r.ref !== rec.ref)];
}
