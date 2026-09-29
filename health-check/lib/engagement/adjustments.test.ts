import { describe, expect, it } from 'vitest';
import { DEFAULT_CATALOG } from '@/lib/risk/catalog';
import { assess, scoreRisk } from '@/lib/risk/engine';
import { SCENARIOS } from '@/lib/scenarios';
import { adjustmentsFor, formatAdjustment, KIND_ADJUSTMENTS } from './adjustments';
import { KIND_RISKS } from './kindRisks';
import { ENGAGEMENT_KIND_LIST } from './kinds';

const coc = DEFAULT_CATALOG.find((r) => r.code === 'LEG-01')!; // V3 × H5, 228 M Ft (képlet)

describe('típusfüggő korrekció', () => {
  it('Change of Control: Health Checknél enyhébb, eladásnál szinte biztos', () => {
    const hc = scoreRisk(coc, { adjustments: adjustmentsFor('HEALTH_CHECK'), materialityHuf: 1e12 });
    const vdd = scoreRisk(coc, { adjustments: adjustmentsFor('VENDOR_DD'), materialityHuf: 1e12 });
    expect(hc).toMatchObject({ likelihood: 2, impact: 5, score: 10, rag: 'AMBER', baseLikelihood: 3 });
    expect(vdd).toMatchObject({ likelihood: 5, impact: 5, score: 25, rag: 'RED' });
    expect(vdd.expectedLossHuf).toBeGreaterThan(hc.expectedLossHuf);
    expect(vdd.adjustment?.reason).toContain('tranzakció');
  });

  it('a szakértő tételenként kikapcsolhatja', () => {
    const r = scoreRisk({ ...coc, ignoreKindAdjustment: true }, { adjustments: adjustmentsFor('VENDOR_DD') });
    expect(r.likelihood).toBe(3);
    expect(r.adjustment).toBeUndefined();
  });

  it('a skála 1–5 között marad', () => {
    const r = scoreRisk({ ...coc, likelihood: 5 }, { adjustments: adjustmentsFor('VENDOR_DD') });
    expect(r.likelihood).toBe(5);
    expect(r.adjustment).toBeUndefined(); // nem változott, nem jelöljük
  });

  it('ugyanazokra a válaszokra típusonként más kép: besorolás, akcióterv, pipeline', () => {
    const sc = SCENARIOS.find((s) => s.id === 'konyvelo')!;
    const run = (kind: 'SUCCESSION' | 'FINANCING_READINESS') =>
      assess(sc.items, { company: sc.company, materialityHuf: sc.materialityHuf, adjustments: adjustmentsFor(kind) });
    const succ = run('SUCCESSION');
    const fin = run('FINANCING_READINESS');
    const rag = (res: typeof succ, code: string) => res.risks.find((r) => r.code === code)?.rag;
    expect(rag(succ, 'LEG-03')).not.toBe(rag(fin, 'LEG-03')); // létesítő okirat: utódlásnál súlyosabb
    expect(succ.totals.expectedLossHuf).not.toBe(fin.totals.expectedLossHuf);
    expect(JSON.stringify(succ.actionPlan)).not.toBe(JSON.stringify(fin.actionPlan));
  });

  it('minden korrekció létező tételre vonatkozik, indoklással, ±2-n belül', () => {
    const codes = new Set([
      ...DEFAULT_CATALOG.map((r) => r.code),
      ...Object.values(KIND_RISKS)
        .flat()
        .map((r) => r.code),
      ...SCENARIOS.flatMap((s) => s.items.map((r) => r.code)),
    ]);
    for (const k of ENGAGEMENT_KIND_LIST) {
      for (const [code, a] of Object.entries(KIND_ADJUSTMENTS[k.kind])) {
        expect(codes.has(code), `${k.kind} ${code}`).toBe(true);
        expect(a.reason.length).toBeGreaterThan(15);
        expect(Math.abs(a.dL ?? 0)).toBeLessThanOrEqual(2);
        expect(Math.abs(a.dI ?? 0)).toBeLessThanOrEqual(2);
      }
    }
  });

  it('formatAdjustment', () => {
    expect(formatAdjustment({ dL: 2, reason: 'x' })).toBe('V+2');
    expect(formatAdjustment({ dL: -1, dI: 1, reason: 'x' })).toBe('V−1 H+1');
  });
});
