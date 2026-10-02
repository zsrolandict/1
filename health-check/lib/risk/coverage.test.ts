import { describe, expect, it } from 'vitest';
import { CHECKLIST, isVisible } from '@/lib/intake/checklist';
import { buildRequestList, EMPTY_PROFILE } from '@/lib/intake/requests';
import { ENGAGEMENT_KINDS } from '@/lib/engagement/kinds';
import { DEFAULT_CATALOG } from './catalog';
import { computeCoverage, COVERAGE_GATE, COVERAGE_PILLAR_MIN, setCoverageOverride, type CoverageOverrides } from './coverage';
import { coverageNotice } from './coverageText';
import { assess } from './engine';
import type { Pillar, RiskItem } from './types';

/**
 * Audit K2: dinamikus nevező, lefedettség, minősítési kapu.
 * A nem vizsgált pillér nem kaphat 100-at; részleges felmérés nem lehet Zöld.
 */

const W = ENGAGEMENT_KINDS.HEALTH_CHECK.weights;
const full: Record<Pillar, number> = { FINANCE: 1, LEGAL: 1, OPERATIONS: 1, HR: 1 };
const cov = (c: Partial<Record<Pillar, number>>) => ({ FINANCE: 0, LEGAL: 0, OPERATIONS: 0, HR: 0, ...c });

/** Zöld tétel (1×1, kitettség nélkül) a megadott pillérben. */
const green = (pillar: Pillar, id: string = pillar): RiskItem => ({
  ...DEFAULT_CATALOG[0],
  id,
  code: `T-${id}`,
  pillar,
  identified: true,
  likelihood: 1,
  impact: 1,
  exposureHuf: 0,
  valuation: undefined,
});
const red = (pillar: Pillar, id = `R-${pillar}`): RiskItem => ({ ...green(pillar, id), likelihood: 5, impact: 5 });

describe('lefedettség számítása (lib/risk/coverage.ts)', () => {
  it('pillérenként a megválaszolt kérdések és a beérkezett kötelező iratok arányának átlaga; „nem releváns” irat nem számít', () => {
    const fin = CHECKLIST.filter((q) => q.pillar === 'FINANCE' && isVisible(q, {}, []));
    const finDocs = buildRequestList(EMPTY_PROFILE, 'HEALTH_CHECK').filter((d) => d.pillar === 'FINANCE' && d.priority === 'REQUIRED');
    expect(fin.length).toBeGreaterThan(1);
    expect(finDocs.length).toBeGreaterThan(1);
    const answers = { [fin[0].id]: fin[0].type === 'YES_NO' ? true : fin[0].type === 'CHOICE' ? fin[0].choices![0].value : 10 };
    const requestStatus = { [finDocs[0].id]: 'RECEIVED' as const, [finDocs[1].id]: 'NA' as const };
    const c = computeCoverage({ answers, profile: EMPTY_PROFILE, kind: 'HEALTH_CHECK', requestStatus });
    const visible = CHECKLIST.filter((q) => q.pillar === 'FINANCE' && isVisible(q, answers, [])).length;
    expect(c.FINANCE.questions).toEqual({ answered: 1, total: visible });
    expect(c.FINANCE.documents).toEqual({ received: 1, total: finDocs.length - 1 });
    expect(c.FINANCE.measured).toBeCloseTo((1 / visible + 1 / (finDocs.length - 1)) / 2, 10);
    expect(c.LEGAL.measured).toBe(0);
  });

  it('felülbírálás: indoklás nélkül nem megy; naplóz; visszaállítható automatikusra; ugyanarra nem ír új bejegyzést', () => {
    expect(() => setCoverageOverride({}, [], 'HR', 'EXAMINED', '  ', 'Teszt Elek')).toThrow(/indoklás/);
    const a = setCoverageOverride({}, [], 'HR', 'EXAMINED', 'HR-vezetői interjú lefedte', 'Teszt Elek', '2026-10-02T10:00:00Z');
    expect(a.overrides.HR).toMatchObject({ state: 'EXAMINED', by: 'Teszt Elek' });
    expect(a.log).toEqual([{ pillar: 'HR', from: 'AUTO', to: 'EXAMINED', reason: 'HR-vezetői interjú lefedte', by: 'Teszt Elek', at: '2026-10-02T10:00:00Z' }]);
    expect(setCoverageOverride(a.overrides, a.log, 'HR', 'EXAMINED', 'újra', 'X')).toEqual(a);
    const b = setCoverageOverride(a.overrides, a.log, 'HR', null, 'mégis a kérdőív számít', 'Teszt Elek');
    expect(b.overrides.HR).toBeUndefined();
    expect(b.log.map((e) => `${e.from}→${e.to}`)).toEqual(['AUTO→EXAMINED', 'EXAMINED→AUTO']);
    const c = computeCoverage({ answers: {}, profile: EMPTY_PROFILE, kind: 'HEALTH_CHECK', requestStatus: {}, overrides: a.overrides as CoverageOverrides });
    expect(c.HR).toMatchObject({ measured: 0, value: 1 });
  });
});

describe('dinamikus nevező és minősítési kapu (lib/risk/engine.ts)', () => {
  it('lefedettség nélkül (régi hívó) minden pillér vizsgált, nincs kapu', () => {
    const a = assess([green('FINANCE')], { pillarWeights: W });
    expect(Object.values(a.pillars).every((p) => p.state === 'EXAMINED' && p.coverage == null)).toBe(true);
    expect(a.totals).toMatchObject({ coverage: null, qualified: true, rag: 'GREEN' });
  });

  it('a nem vizsgált pillér nem ad 100-at: kiesik a nevezőből, a súlyok a vizsgáltakra normálódnak', () => {
    const items = [red('FINANCE')];
    const legacy = assess(items, { pillarWeights: W });
    const k2 = assess(items, { pillarWeights: W, coverage: cov({ FINANCE: 1 }) });
    // Régen: a három üres pillér 100-zal „felhúzta” az összesítettet.
    expect(legacy.totals.healthScore).toBe(Math.round(40 * W.FINANCE + 100 * (1 - W.FINANCE)));
    // Most: csak a Pénzügy számít.
    expect(k2.totals.healthScore).toBe(40);
    for (const p of ['LEGAL', 'OPERATIONS', 'HR'] as Pillar[]) {
      expect(k2.pillars[p]).toMatchObject({ state: 'NOT_EXAMINED', healthScore: null, rag: 'UNRATED' });
    }
  });

  it('alacsony lefedettségű pillér megállapítással „részben vizsgált”: beszámít, de nem lehet Zöld', () => {
    const a = assess([green('HR'), green('FINANCE')], { pillarWeights: W, coverage: cov({ FINANCE: 1, LEGAL: 1, OPERATIONS: 1, HR: 0.2 }) });
    expect(a.pillars.HR).toMatchObject({ state: 'PARTIAL', rag: 'UNRATED' });
    expect(a.pillars.HR.healthScore).not.toBeNull();
    expect(a.pillars.FINANCE).toMatchObject({ state: 'EXAMINED', rag: 'GREEN' });
  });

  it('kapu: 80% alatt csupa jó eredménnyel sem Zöld; a pontszám megmarad; Piros és Sárga nem változik', () => {
    const items = (['FINANCE', 'LEGAL', 'OPERATIONS', 'HR'] as Pillar[]).map((p) => green(p));
    const partial = assess(items, { pillarWeights: W, coverage: cov({ FINANCE: 0.6, LEGAL: 0.6, OPERATIONS: 0.6, HR: 0.6 }) });
    expect(partial.totals).toMatchObject({ qualified: false, rag: 'UNRATED' });
    expect(partial.totals.healthScore).toBeGreaterThan(90);
    expect(coverageNotice(partial)!.title).toBe('Részleges / nem minősített felmérés');
    const withRed = assess([...items, red('LEGAL')], { pillarWeights: W, coverage: cov({ FINANCE: 0.6, LEGAL: 0.6, OPERATIONS: 0.6, HR: 0.6 }) });
    expect(withRed.totals.rag).toBe('RED');
    const ok = assess(items, { pillarWeights: W, coverage: full });
    expect(ok.totals).toMatchObject({ qualified: true, rag: 'GREEN', coverage: 1 });
    expect(coverageNotice(ok)).toBeNull();
  });

  it('küszöbök határán: pontosan 50% vizsgált, pontosan 80% minősített; az összesített lefedettség súlyozott', () => {
    const at = assess([], { pillarWeights: W, coverage: { FINANCE: COVERAGE_PILLAR_MIN, LEGAL: 1, OPERATIONS: 1, HR: 1 } });
    expect(at.pillars.FINANCE.state).toBe('EXAMINED');
    const below = assess([], { pillarWeights: W, coverage: { FINANCE: COVERAGE_PILLAR_MIN - 0.001, LEGAL: 1, OPERATIONS: 1, HR: 1 } });
    expect(below.pillars.FINANCE.state).toBe('NOT_EXAMINED');
    const gate = assess([], { pillarWeights: { FINANCE: 0.5, LEGAL: 0.5, OPERATIONS: 0, HR: 0 }, coverage: { FINANCE: 1, LEGAL: 0.6, OPERATIONS: 0, HR: 0 } });
    expect(gate.totals.coverage).toBeCloseTo(COVERAGE_GATE, 10);
    expect(gate.totals.qualified).toBe(true);
  });

  it('egy vizsgált pillér sincs: nem értékelhető (nincs pontszám, nincs minősítés), nem 100 / Zöld', () => {
    const a = assess([], { pillarWeights: W, coverage: cov({}) });
    expect(a.totals).toMatchObject({ healthScore: null, rag: 'UNRATED', coverage: 0, qualified: false });
    expect(coverageNotice(a)!.title).toBe('Nem értékelhető felmérés');
  });

  it('érvénytelen lefedettségi érték (NaN, negatív, 1 fölötti) 0–1 közé kerül', () => {
    const a = assess([], { pillarWeights: W, coverage: { FINANCE: NaN, LEGAL: -1, OPERATIONS: 5, HR: 1 } });
    expect([a.pillars.FINANCE.coverage, a.pillars.LEGAL.coverage, a.pillars.OPERATIONS.coverage]).toEqual([0, 0, 1]);
  });
});
