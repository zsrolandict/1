import { describe, expect, it } from 'vitest';
import { ENGAGEMENT_KINDS } from '@/lib/engagement/kinds';
import { adjustmentsFor } from '@/lib/engagement/adjustments';
import { CHECKLIST, checklistQuestion, evaluateChecklist, questionIdsIn } from '@/lib/intake/checklist';
import { SAMPLE_ANSWERS } from '@/lib/intake/samples/checklist';
import { getScenario, SCENARIOS } from '@/lib/scenarios';
import { DEFAULT_CATALOG } from './catalog';
import { computeCoverage } from './coverage';
import { dominant } from './dominant';
import { assess, type EngineOptions } from './engine';
import type { Pillar, RiskAssessment, RiskItem } from './types';
import { EMPTY_PROFILE } from '@/lib/intake/requests';

/**
 * Összefoglaló szélsőérték-csomag: a motor a legszélsőségesebb bemenetekre
 * is pontosan, végesen és determinisztikusan számol (audit K1–K7 lezárása).
 */

const PILLARS: Pillar[] = ['FINANCE', 'LEGAL', 'OPERATIONS', 'HR'];
const W = ENGAGEMENT_KINDS.HEALTH_CHECK.weights;
const FULL = { FINANCE: 1, LEGAL: 1, OPERATIONS: 1, HR: 1 };
const opts = (o: Partial<EngineOptions> = {}): Partial<EngineOptions> => ({ pillarWeights: W, coverage: FULL, ...o });

/** A teljes katalógus azonosítva, megadott értékekkel, kitettség-képlet nélkül. */
const all = (l: 1 | 2 | 3 | 4 | 5, i: 1 | 2 | 3 | 4 | 5, exposureHuf: number): RiskItem[] =>
  DEFAULT_CATALOG.map((r) => ({ ...r, identified: true, likelihood: l, impact: i, exposureHuf, valuation: undefined }));

const count = (p: Pillar, items: RiskItem[]) => items.filter((r) => r.pillar === p).length;
const weighted = (scores: Partial<Record<Pillar, number>>) => {
  const ps = PILLARS.filter((p) => scores[p] != null);
  const w = ps.reduce((a, p) => a + W[p], 0);
  return Math.round(ps.reduce((a, p) => a + scores[p]! * W[p], 0) / w);
};

/** Minden számszerű kimenet véges. */
function finite(a: RiskAssessment) {
  for (const r of a.risks) for (const v of [r.score, r.exposureHuf, r.expectedLossHuf, r.priority, r.fee.base]) expect(Number.isFinite(v)).toBe(true);
  for (const v of [a.totals.expectedLossHuf, a.totals.grossExposureHuf, a.pipeline.totalFeeHuf]) expect(Number.isFinite(v)).toBe(true);
}

describe('szélsőérték-csomag', () => {
  it('1. teljes minimális projekt (1×1, 0 Ft mindenhol): minden zöld, pontos pillérértékek, nincs veszteség és ajánlat', () => {
    const items = all(1, 1, 0);
    const a = assess(items, opts());
    finite(a);
    expect(a.risks.every((r) => r.score === 1 && r.rag === 'GREEN' && r.expectedLossHuf === 0 && r.window === 'BACKLOG')).toBe(true);
    const expected: Partial<Record<Pillar, number>> = {};
    for (const p of PILLARS) {
      expected[p] = Math.round(100 * (1 - (1 / 25) * 0.6) ** count(p, items));
      expect(a.pillars[p]).toMatchObject({ healthScore: expected[p], state: 'EXAMINED' });
    }
    expect(a.totals).toMatchObject({ healthScore: weighted(expected), rag: 'GREEN', qualified: true, red: 0, amber: 0, expectedLossHuf: 0 });
    expect(a.pipeline.totalFeeHuf).toBe(0); // zöld tételből nincs javítási megbízás
  });

  it('2. teljes maximális projekt (5×5 mindenhol): minden piros, pillérenként 100 × 0,4ⁿ, minden tétel az ajánlatban', () => {
    const items = all(5, 5, 1_000_000_000);
    const a = assess(items, opts());
    finite(a);
    expect(a.risks.every((r) => r.score === 25 && r.rag === 'RED' && r.expectedLossHuf === 900_000_000)).toBe(true);
    const expected: Partial<Record<Pillar, number>> = {};
    for (const p of PILLARS) {
      expected[p] = Math.round(100 * 0.4 ** count(p, items));
      expect(a.pillars[p]).toMatchObject({ healthScore: expected[p], rag: 'RED' });
    }
    expect(a.totals).toMatchObject({ healthScore: weighted(expected), rag: 'RED', red: items.length });
    expect(
      a.pipeline.byDivision.LEGAL.count +
        a.pipeline.byDivision.TAX.count +
        a.pipeline.byDivision.ACCOUNTING.count +
        a.pipeline.byDivision.HR.count +
        a.pipeline.byDivision.ADVISORY.count,
    ).toBe(items.length);
    expect(a.pipeline.totalFeeHuf).toBe(a.risks.reduce((s, r) => s + r.fee.base, 0));
  });

  it('3. teljesen üres / kitöltetlen felmérés: nem értékelhető; teljes lefedettséggel és tétel nélkül 100 / Zöld', () => {
    const empty = evaluateChecklist({}, 'HEALTH_CHECK');
    expect(empty).toMatchObject({ suggestions: [], facts: [] });
    const cov = computeCoverage({ answers: {}, profile: EMPTY_PROFILE, kind: 'HEALTH_CHECK', requestStatus: {} });
    expect(PILLARS.every((p) => cov[p].value === 0)).toBe(true);
    const none = assess([], opts({ coverage: { FINANCE: 0, LEGAL: 0, OPERATIONS: 0, HR: 0 } }));
    expect(none.totals).toMatchObject({ healthScore: null, rag: 'UNRATED', coverage: 0, qualified: false, identified: 0 });
    expect(PILLARS.every((p) => none.pillars[p].state === 'NOT_EXAMINED' && none.pillars[p].healthScore === null)).toBe(true);
    // Vizsgáltuk, és nem találtunk semmit: ez valódi 100 – és csak ekkor Zöld.
    const clean = assess([], opts());
    expect(clean.totals).toMatchObject({ healthScore: 100, rag: 'GREEN', qualified: true });
  });

  it('4. vegyes állapot: 1 pillér 100%, egy részben, kettő nem vizsgált – csak a vizsgáltak számítanak, nincs Zöld', () => {
    const items: RiskItem[] = [...all(1, 1, 0).filter((r) => r.pillar === 'FINANCE'), { ...all(2, 4, 0).find((r) => r.pillar === 'LEGAL')!, id: 'jog-1' }];
    const a = assess(items, opts({ coverage: { FINANCE: 1, LEGAL: 0.3, OPERATIONS: 0, HR: 0.45 } }));
    finite(a);
    expect(PILLARS.map((p) => a.pillars[p].state)).toEqual(['EXAMINED', 'PARTIAL', 'NOT_EXAMINED', 'NOT_EXAMINED']);
    const fin = Math.round(100 * (1 - (1 / 25) * 0.6) ** count('FINANCE', items));
    const leg = Math.round(100 * (1 - (8 / 25) * 0.6));
    expect(a.totals.healthScore).toBe(weighted({ FINANCE: fin, LEGAL: leg }));
    expect(a.totals.coverage).toBeCloseTo((1 * W.FINANCE + 0.3 * W.LEGAL + 0 * W.OPERATIONS + 0.45 * W.HR) / (W.FINANCE + W.LEGAL + W.OPERATIONS + W.HR), 10);
    expect(a.totals.qualified).toBe(false);
    expect(a.totals.rag).toBe('AMBER'); // a sárga jogi tétel látszik; Zöld nem lehetne
    expect(a.pillars.LEGAL.rag).toBe('AMBER');
  });

  it('5. determinizmus: tetszőleges sorrendű azonos bemenet ugyanazt a kimenetet és sorrendet adja', () => {
    // Bemutató cégek + szándékos holtversenyek (azonos pont, veszteség, quick win).
    const ties: RiskItem[] = ['A', 'B', 'C', 'D'].map((x, k) => ({
      ...DEFAULT_CATALOG[k],
      id: `tie-${x}`,
      code: `TIE-${x}`,
      identified: true,
      likelihood: 3,
      impact: 3,
      exposureHuf: 5_000_000,
      valuation: undefined,
      remediationDays: 10,
    }));
    for (const sc of SCENARIOS.filter((s) => s.items.length)) {
      const o = opts({
        company: sc.company,
        materialityHuf: sc.materialityHuf,
        adjustments: adjustmentsFor(sc.kind),
        pillarWeights: ENGAGEMENT_KINDS[sc.kind].weights,
      });
      const items = [...getScenario(sc.id).items, ...ties];
      const ref = JSON.stringify(assess(items, o));
      let seed = 7;
      const rnd = () => (seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31;
      for (let n = 0; n < 25; n++) {
        const shuffled = [...items].sort(() => rnd() - 0.5);
        expect(JSON.stringify(assess(shuffled, o)), `${sc.id} #${n}`).toBe(ref);
      }
      expect(JSON.stringify(assess([...items].reverse(), o))).toBe(ref);
    }
  });

  it('K6: a kérdőív minden javaslata egyetlen illeszkedő szabály párja (nincs kevert L/I); a domináns kiválasztás szabálya', () => {
    let checked = 0;
    for (const [id, answers] of Object.entries(SAMPLE_ANSWERS)) {
      const r = evaluateChecklist(answers, getScenario(id).kind, getScenario(id).sectors ?? []);
      for (const s of r.suggestions) {
        // A javaslatot adó kérdések szabályai erre a tételre: a pár ezek egyike kell legyen, nem keverék.
        const qs = questionIdsIn(s.evidence).map((q) => checklistQuestion(q)!);
        const pairs = qs.flatMap((q) =>
          q.rules.filter((ru) => (ru.codeByKind?.[getScenario(id).kind] ?? ru.code) === s.code).map((ru) => `${ru.likelihood}x${ru.impact}`),
        );
        expect(pairs.length, `${id} ${s.code}`).toBeGreaterThan(0);
        expect(pairs, `${id} ${s.code}`).toContain(`${s.likelihood}x${s.impact}`);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(5);
    // A kiemelés minden kérdést felismer (alap és ágazati azonosító is).
    expect(questionIdsIn(CHECKLIST.map((q) => `${q.id} x`).join('; '))).toEqual(CHECKLIST.map((q) => q.id));
    expect(
      dominant([
        { likelihood: 5, impact: 2 },
        { likelihood: 2, impact: 5 },
      ]),
    ).toEqual({ likelihood: 2, impact: 5 }); // 10 = 10 → nagyobb hatás
    expect(
      dominant([
        { likelihood: 4, impact: 4 },
        { likelihood: 5, impact: 3 },
      ]),
    ).toEqual({ likelihood: 4, impact: 4 }); // 16 > 15
    expect(
      dominant([
        { likelihood: 3, impact: 4, n: 1 },
        { likelihood: 3, impact: 4, n: 2 },
      ])!.n,
    ).toBe(1); // azonos pár: az első marad
    // Valós szabálycsoport: Q22 45%-nál két szabály (3×4 és 3×5) → 3×5, nem 3×5 és 3×4 keveréke.
    expect(evaluateChecklist({ Q22: 45 }, 'HEALTH_CHECK').suggestions[0]).toMatchObject({ likelihood: 3, impact: 5 });
    // Q24 igen (3×5) + Q26 NEM (4×5) a HR-01-re → 4×5.
    expect(evaluateChecklist({ Q24: true, Q26: 'NEM' }, 'HEALTH_CHECK').suggestions.find((s) => s.code === 'HR-01')).toMatchObject({
      likelihood: 4,
      impact: 5,
    });
  });
});
