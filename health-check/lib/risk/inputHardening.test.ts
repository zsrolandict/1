import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_CATALOG } from './catalog';
import { assess, clampScale, scoreRisk } from './engine';
import { clearQuarantine, loadProject, loadQuarantine } from './store';
import type { RiskItem } from './types';
import { computeFormula, DEFAULT_COMPANY, MAX_COUNT } from './valuation';

/**
 * Audit K1, K3, K4: érvénytelen bemenet nem eredményezhet csendben zöld
 * besorolást, NaN vagy végtelen értéket, és a tárolóból betöltés ugyanazzal
 * a sémával ellenőriz, mint a fájlból visszatöltés.
 */

class MemoryStorage {
  private m = new Map<string, string>();
  getItem(k: string) {
    return this.m.has(k) ? this.m.get(k)! : null;
  }
  setItem(k: string, v: string) {
    this.m.set(k, String(v));
  }
  removeItem(k: string) {
    this.m.delete(k);
  }
  clear() {
    this.m.clear();
  }
}
const storage = new MemoryStorage();
(globalThis as { localStorage?: unknown }).localStorage = storage;

/** Kitettség-képlet nélküli, kézi összegű tétel – a skála hatása tisztán látszik. */
const base: RiskItem = { ...DEFAULT_CATALOG.find((r) => r.code === 'LEG-03')!, identified: true, valuation: undefined, exposureHuf: 1_000_000 };
const perItem = (count: unknown, unitAmountHuf: unknown = 2_000_000): RiskItem => ({
  ...base,
  valuation: { formula: { type: 'PER_ITEM', count: count as number, unitAmountHuf: unitAmountHuf as number, label: 'teszt' }, overrideHuf: null },
});

/** Minden számszerű kimenet véges (se NaN, se végtelen). */
function expectFinite(items: RiskItem[]) {
  const a = assess(items);
  for (const r of a.risks) {
    for (const v of [r.likelihood, r.impact, r.score, r.exposureHuf, r.expectedLossHuf, r.priority, r.probability]) expect(Number.isFinite(v)).toBe(true);
  }
  for (const v of [a.totals.healthScore, a.totals.expectedLossHuf, a.totals.grossExposureHuf, a.pipeline.totalFeeHuf]) expect(Number.isFinite(v)).toBe(true);
  return a;
}

describe('K1 + K3: skálaértékek szigorú kezelése (lib/risk/engine.ts)', () => {
  it('clampScale: szám, szöveges szám, határon kívüli, hiányzó és érvénytelen érték', () => {
    expect(clampScale(3)).toBe(3);
    expect(clampScale(3.6)).toBe(4);
    expect(clampScale(0)).toBe(1);
    expect(clampScale(9)).toBe(5);
    expect(clampScale('4')).toBe(4);
    expect(clampScale(' 2 ')).toBe(2);
    // Hiányzó / érvénytelen: a legsúlyosabb – nem lehet belőle csendben zöld.
    for (const bad of [undefined, null, NaN, Infinity, -Infinity, '', 'négy', {}, [], true]) expect(clampScale(bad)).toBe(5);
  });

  it('szöveges „4” valószínűség 4 marad, nem fűződik össze (K3)', () => {
    const r = scoreRisk({ ...base, likelihood: '4' as never, impact: 2 });
    expect(r.likelihood).toBe(4);
    expect(r.score).toBe(8);
    // Típus-korrekcióval (+1) is számként adódik össze: 5, nem „41”.
    const adj = scoreRisk({ ...base, likelihood: '4' as never, impact: 2 }, { adjustments: { 'LEG-03': { dL: 1, reason: 'teszt' } } });
    expect(adj.likelihood).toBe(5);
    expect(adj.baseLikelihood).toBe(4);
  });

  it('hiányzó (undefined) valószínűség: nem NaN, nem zöld, a Health Score véges (K1)', () => {
    const a = expectFinite([{ ...base, likelihood: undefined as never, impact: 3 }]);
    expect(a.risks[0].likelihood).toBe(5);
    expect(a.risks[0].score).toBe(15);
    expect(a.risks[0].rag).not.toBe('GREEN');
    expect(a.totals.healthScore).toBeLessThan(100);
  });

  it('NaN hatás és mindkét érték hiánya: a legsúlyosabb besorolás, véges számokkal', () => {
    const a = expectFinite([
      { ...base, id: 'a', impact: NaN as never },
      { ...base, id: 'b', likelihood: undefined as never, impact: undefined as never },
    ]);
    expect(a.risks.find((r) => r.id === 'a')!.impact).toBe(5);
    expect(a.risks.find((r) => r.id === 'b')!.score).toBe(25);
    expect(a.risks.every((r) => r.rag !== 'GREEN')).toBe(true);
  });
});

describe('K4: darabszám-alapú kitettség korlátai (lib/risk/valuation.ts)', () => {
  it('végtelen darabszám: 0 Ft, érvénytelen-jelzéssel; a várható veszteség és az összesítők végesek', () => {
    const a = expectFinite([perItem(Infinity)]);
    expect(a.risks[0].exposureHuf).toBe(0);
    expect(a.risks[0].expectedLossHuf).toBe(0);
    expect(a.risks[0].exposureExplanation).toContain('Érvénytelen');
  });

  it('NaN, negatív és szöveges darabszám vagy egységár: 0 Ft, érvénytelen-jelzéssel', () => {
    for (const [count, unit] of [
      [NaN, 2_000_000],
      [-3, 2_000_000],
      ['5', 2_000_000],
      [4, -1],
      [4, NaN],
      [4, Infinity],
      [undefined, 2_000_000],
    ] as const) {
      const r = computeFormula({ type: 'PER_ITEM', count: count as number, unitAmountHuf: unit as number, label: 'x' }, DEFAULT_COMPANY);
      expect(r.valueHuf, `${String(count)} × ${String(unit)}`).toBe(0);
      expect(r.explanation).toContain('Érvénytelen');
    }
  });

  it('a felső korlát fölötti darabszám a korlátra vág, és a magyarázat jelzi', () => {
    const r = computeFormula({ type: 'PER_ITEM', count: MAX_COUNT * 10, unitAmountHuf: 1_000, label: 'x' }, DEFAULT_COMPANY);
    expect(r.valueHuf).toBe(MAX_COUNT * 1_000);
    expect(r.explanation).toContain('felső korlát');
  });

  it('érvénytelen kézi összeg és felülírás: 0 Ft, nem NaN', () => {
    const a = expectFinite([
      { ...base, id: 'm', exposureHuf: NaN as never },
      { ...perItem(4), id: 'o', valuation: { ...perItem(4).valuation!, overrideHuf: Infinity } },
    ]);
    expect(a.risks.every((r) => r.exposureHuf === 0)).toBe(true);
  });
});

describe('K1: böngészős betöltés a fájlbetöltés sémájával (lib/risk/store.ts)', () => {
  const id = 'proj-audit';
  const key = `ict-hc:workspace:v3:${id}`;
  beforeEach(() => {
    storage.clear();
    clearQuarantine(id);
  });

  it('sémán elbukó tétel nem kerül az értékelésbe, hanem karanténba – az ép tételek megmaradnak', () => {
    const good = { ...base, id: 'ok' };
    const bad = [
      { ...base, id: 'b1', likelihood: '4' },
      { ...base, id: 'b2', likelihood: undefined },
      { ...base, id: 'b3', impact: 9 },
      { ...base, id: 'b4', exposureHuf: -5 },
      { ...base, id: 'b5', likelihood: 2.5 },
      'nem is objektum',
    ];
    storage.setItem(key, JSON.stringify({ scenarioId: 'ures', companyName: 'X', items: [good, ...bad] }));
    const ws = loadProject(id);
    expect(ws.items.map((r) => r.id)).toEqual(['ok']);
    const q = loadQuarantine(id);
    expect(q).toHaveLength(bad.length);
    expect(q.find((x) => (x.raw as { id?: string }).id === 'b3')!.reason).toContain('impact');
    // Újratöltés nem duplikálja a karantént.
    loadProject(id);
    expect(loadQuarantine(id)).toHaveLength(bad.length);
  });

  it('hibás cégadat mezőnként alapértékre áll, a jó mezők megmaradnak; hibás küszöb és típus a mintáé', () => {
    storage.setItem(
      key,
      JSON.stringify({
        scenarioId: 'ures',
        companyName: 'X',
        company: { revenueHuf: 'sok', grossMarginPct: 0.4, actualDsoDays: -1, industryDsoDays: 50 },
        materialityHuf: -1,
        kind: 'NEM_LETEZO',
        items: [],
      }),
    );
    const ws = loadProject(id);
    expect(ws.company.grossMarginPct).toBe(0.4);
    expect(ws.company.industryDsoDays).toBe(50);
    expect(ws.company.revenueHuf).toBe(DEFAULT_COMPANY.revenueHuf);
    expect(ws.company.actualDsoDays).toBe(DEFAULT_COMPANY.actualDsoDays);
    expect(ws.materialityHuf).toBeGreaterThanOrEqual(0);
    expect(ws.kind).not.toBe('NEM_LETEZO');
  });

  it('lefedettségi felülbírálás (K2): az érvényes megmarad, az indoklás nélküli vagy hibás szerkezetű kimarad', () => {
    const okOverride = { HR: { state: 'EXAMINED', reason: 'HR-interjú lefedte', by: 'Teszt Elek', at: '2026-10-02T10:00:00Z' } };
    const log = [{ pillar: 'HR', from: 'AUTO', to: 'EXAMINED', reason: 'HR-interjú lefedte', by: 'Teszt Elek', at: '2026-10-02T10:00:00Z' }];
    storage.setItem(key, JSON.stringify({ scenarioId: 'ures', companyName: 'X', items: [], coverageOverrides: okOverride, coverageLog: log }));
    expect(loadProject(id)).toMatchObject({ coverageOverrides: okOverride, coverageLog: log });
    storage.setItem(key, JSON.stringify({ scenarioId: 'ures', companyName: 'X', items: [], coverageOverrides: { HR: { state: 'EXAMINED', reason: '' } } }));
    expect(loadProject(id).coverageOverrides).toBeUndefined();
  });
});
