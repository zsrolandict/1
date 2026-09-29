import { describe, expect, it } from 'vitest';
import { adjustmentsFor } from '@/lib/engagement/adjustments';
import { ENGAGEMENT_KINDS } from '@/lib/engagement/kinds';
import { assess } from '@/lib/risk/engine';
import { getScenario } from '@/lib/scenarios';
import { anonymize, calibrations, commonButMissing, demoRecords, filterRecords, revenueBand, stats, upsertRecord, type BenchmarkRecord } from './benchmark';

const sc = getScenario('konyvelo');
const opts = { company: sc.company, materialityHuf: sc.materialityHuf, adjustments: adjustmentsFor(sc.kind), pillarWeights: ENGAGEMENT_KINDS[sc.kind].weights };

describe('tudástár', () => {
  it('az anonim rekordban nincs cégnév, bizonyíték, összeg, egyedi tételcím', () => {
    const items = [
      { ...sc.items[0], id: 'CUS-01-x', code: 'CUS-01', title: 'Példa Erzsébet kulcsszerepe', identified: true, evidence: 'Példa Könyvelő Iroda Kft. szerződés' },
      ...sc.items,
    ];
    const rec = anonymize(assess(items, opts), { ref: 'p1', kind: sc.kind, sectors: ['ACCOUNTING'], revenueHuf: sc.company.revenueHuf });
    const json = JSON.stringify(rec);
    expect(json).not.toContain(sc.companyName);
    expect(json).not.toContain('Példa Erzsébet');
    expect(json).not.toContain('exposure');
    expect(json).not.toContain('evidence');
    expect(rec.items.find((i) => i.code === 'CUS')!.title).toBe('');
    expect(rec.revenueBand).toBe('S');
  });

  it('árbevétel-sávok', () => {
    expect(revenueBand(100e6)).toBe('XS');
    expect(revenueBand(2e9)).toBe('M');
    expect(revenueBand(20e9)).toBe('L');
  });

  it('gyakoriság, szűrés és hasonló projektekben gyakori, itt hiányzó tétel', () => {
    const demo = demoRecords();
    expect(demo).toHaveLength(4);
    expect(demo.every((r) => r.source === 'DEMO')).toBe(true);
    const s = stats(demo);
    expect(s.n).toBe(4);
    expect(s.codes[0].frequency).toBeGreaterThanOrEqual(s.codes[s.codes.length - 1].frequency);
    expect(filterRecords(demo, { sector: 'CONSTRUCTION' })).toHaveLength(1);
    const top = s.codes[0].code;
    expect(commonButMissing(s, [top]).some((c) => c.code === top)).toBe(false);
    expect(commonButMissing(s, []).some((c) => c.code === top)).toBe(s.codes[0].frequency >= 0.5);
  });

  it('kalibrálási javaslat, ha a tapasztalt átlag legalább 1 ponttal eltér', () => {
    const mk = (id: string, L: number): BenchmarkRecord => ({
      id, ref: id, closedAt: '2026-01-01', kind: 'HEALTH_CHECK', sectors: [], revenueBand: 'S', healthScore: 70, red: 1, amber: 0, source: 'PROJECT',
      items: [{ code: 'FIN-01', pillar: 'FINANCE', title: 'x', likelihood: L, impact: 1, rag: 'RED' }],
    });
    const s = stats([mk('a', 1), mk('b', 1), mk('c', 1)]);
    const cal = calibrations(s);
    expect(cal).toHaveLength(1);
    expect(cal[0].observedLikelihood).toBe(1);
    expect(calibrations(stats([mk('a', 1), mk('b', 1)]))).toHaveLength(0); // kevés projekt
  });

  it('ugyanaz a projekt újrafelvételkor lecseréli a régit', () => {
    const a = { ...demoRecords()[0], ref: 'p', source: 'PROJECT' as const };
    expect(upsertRecord(upsertRecord([], a), { ...a, id: 'new' })).toHaveLength(1);
  });
});
