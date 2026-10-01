import { describe, expect, it } from 'vitest';
import { DEFAULT_CATALOG } from '@/lib/risk/catalog';
import { FINANCIAL_RISKS } from '@/lib/risk/financialRisks';
import { SECTOR_RISKS } from '@/lib/risk/sectorRisks';
import { KIND_RISKS } from '@/lib/engagement/kindRisks';
import { assess } from '@/lib/risk/engine';
import type { RiskItem } from '@/lib/risk/types';
import { estimateRemediation, PLAN_TEMPLATES } from './estimate';
import { BILLING_RATES } from './rates';

const ALL: RiskItem[] = [...DEFAULT_CATALOG, ...FINANCIAL_RISKS, ...Object.values(SECTOR_RISKS).flat(), ...Object.values(KIND_RISKS).flat()];
const item = (code: string) => ALL.find((r) => r.code === code)!;

describe('javítási terv és díj', () => {
  it('minden katalógustételhez van tételre szabott terv, értelmes tartalommal', () => {
    for (const r of ALL) {
      const t = PLAN_TEMPLATES[r.code];
      expect(t, r.code).toBeDefined();
      expect(t.steps.length, r.code).toBeGreaterThanOrEqual(2);
      expect(t.goal.length, r.code).toBeGreaterThan(20);
      expect(t.spread[0]).toBeLessThan(1);
      expect(t.spread[1]).toBeGreaterThan(1);
      for (const s of t.steps) expect(s.perUnit && !t.driver, `${r.code}: egységenkénti óra terjedelem nélkül`).toBeFalsy();
      expect(estimateRemediation(r).source).toBe('TEMPLATE');
    }
  });

  it('díj = Σ óra × óradíj; a terjedelem a lépések óráit skálázza', () => {
    const r = item('LEG-02');
    const e = estimateRemediation(r);
    expect(e.fee.base).toBe(e.steps.reduce((a, s) => a + s.hours * BILLING_RATES[s.division].rates[s.role], 0));
    const more = estimateRemediation({ ...r, plan: { driver: 20 } });
    expect(more.driver).toMatchObject({ value: 20, origin: 'ITEM' });
    expect(more.fee.base).toBeGreaterThan(e.fee.base);
    const extra = more.steps.reduce((a, s) => a + s.perUnit * 12 * s.rate, 0);
    expect(more.fee.base - e.fee.base).toBe(extra);
  });

  it('a terjedelem a kitettség-képlet darabszámából jön, ha a sablon így kéri', () => {
    const r = item('FIN-01');
    const e = estimateRemediation(r);
    expect(e.driver?.origin).toBe('VALUATION');
    const f = r.valuation!.formula;
    expect(e.driver?.value).toBe(f.type === 'PER_ITEM' ? f.count : -1);
  });

  it('sáv: a várható érték szorzója, tízezresre kerekítve', () => {
    const e = estimateRemediation(item('FIN-02'));
    expect(e.fee.low).toBe(Math.round((e.fee.base * e.spread[0]) / 10_000) * 10_000);
    expect(e.fee.high).toBe(Math.round((e.fee.base * e.spread[1]) / 10_000) * 10_000);
    expect(e.fee.low).toBeLessThan(e.fee.base);
    expect(e.fee.high).toBeGreaterThan(e.fee.base);
  });

  it('kézzel átírt óra és kézi díj; a terv kézi díjnál is látszik', () => {
    const r = item('LEG-03');
    const e = estimateRemediation({ ...r, plan: { hours: { '0': 10 } } });
    expect(e.steps[0]).toMatchObject({ hours: 10, overridden: true });
    const m = estimateRemediation({ ...r, plan: { feeOverrideHuf: 500_000, note: 'egyeztetett' } });
    expect(m.source).toBe('MANUAL');
    expect(m.fee).toEqual({ low: 500_000, base: 500_000, high: 500_000 });
    expect(m.planFeeHuf).toBe(estimateRemediation(r).planFeeHuf);
  });

  it('sablon nélküli tétel: régi egyösszegű díj kézi díjként, nélküle általános sablon', () => {
    const custom = { ...item('LEG-03'), code: 'CUS-1', serviceFeeHuf: 0 };
    expect(estimateRemediation(custom).source).toBe('GENERIC');
    expect(estimateRemediation({ ...custom, serviceFeeHuf: 750_000 })).toMatchObject({ source: 'MANUAL', fee: { base: 750_000 } });
  });

  it('a díjösszesítő a lépések üzletága szerint bont, és csak a nem zöld tételeket számolja', () => {
    const r = { ...item('LEG-01'), identified: true, likelihood: 5 as const, impact: 5 as const };
    const res = assess([r]);
    const e = estimateRemediation(r);
    expect(res.pipeline.totalFeeHuf).toBe(e.fee.base);
    expect(res.pipeline.byDivision.ADVISORY.feeHuf).toBe(e.byDivision.ADVISORY);
    expect(res.pipeline.byDivision.LEGAL.feeHuf).toBe(e.byDivision.LEGAL);
    expect(res.pipeline.byDivision.LEGAL.count).toBe(1);
    expect(assess([{ ...r, likelihood: 1, impact: 1, exposureHuf: 0, valuation: undefined }]).pipeline.totalFeeHuf).toBe(0);
  });
});
