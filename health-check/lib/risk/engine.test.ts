import { describe, expect, it } from 'vitest';
import { assess, formatHufShort, ragFromScore, scoreRisk } from './engine';
import { DEFAULT_CATALOG } from './catalog';
import type { RiskItem } from './types';

const base: RiskItem = {
  id: 'T-1', code: 'T-1', pillar: 'LEGAL', title: 't', description: '',
  identified: true, likelihood: 3, impact: 3, exposureHuf: 1_000_000, remediationDays: 10,
  remediation: '', division: 'LEGAL', serviceFeeHuf: 500_000,
};

describe('ragFromScore', () => {
  it('küszöbök: <8 zöld, 8–14 sárga, ≥15 piros', () => {
    expect(ragFromScore(7)).toBe('GREEN');
    expect(ragFromScore(8)).toBe('AMBER');
    expect(ragFromScore(14)).toBe('AMBER');
    expect(ragFromScore(15)).toBe('RED');
  });
});

describe('scoreRisk', () => {
  it('a küszöböt elérő VÁRHATÓ veszteség pirosra emel', () => {
    // V5 (90%) × 60 M = 54 M ≥ 50 M → piros, pedig a pontszám csak 10
    const r = scoreRisk({ ...base, likelihood: 5, impact: 2, exposureHuf: 60_000_000 });
    expect(r.score).toBe(10);
    expect(r.rag).toBe('RED');
    expect(r.materialityOverride).toBe(true);
  });

  it('nagy, de valószínűtlen kitettség nem lesz automatikusan piros', () => {
    // V1 (5%) × 600 M = 30 M < 50 M → a pontszám dönt (2 → zöld)
    const r = scoreRisk({ ...base, likelihood: 1, impact: 2, exposureHuf: 600_000_000 });
    expect(r.rag).toBe('GREEN');
    expect(r.materialityOverride).toBe(false);
  });

  it('várható veszteség = kitettség × valószínűség', () => {
    const r = scoreRisk({ ...base, likelihood: 3, exposureHuf: 10_000_000 });
    expect(r.expectedLossHuf).toBe(4_000_000);
  });

  it('quick win: nem zöld és ≤ 5 munkanap → 0–30 nap', () => {
    const r = scoreRisk({ ...base, remediationDays: 5 });
    expect(r.quickWin).toBe(true);
    expect(r.window).toBe('D0_30');
  });

  it('zöld tétel sosem quick win, backlogba kerül', () => {
    const r = scoreRisk({ ...base, likelihood: 1, impact: 1, remediationDays: 1 });
    expect(r.quickWin).toBe(false);
    expect(r.window).toBe('BACKLOG');
  });
});

describe('assess', () => {
  it('csak az azonosított tételeket számolja', () => {
    const res = assess([base, { ...base, id: 'T-2', identified: false }]);
    expect(res.totals.identified).toBe(1);
  });

  it('üres listánál minden pillér 100 és zöld', () => {
    const res = assess([]);
    expect(res.totals.healthScore).toBe(100);
    expect(res.totals.rag).toBe('GREEN');
    expect(res.pipeline.creditHuf).toBe(0);
  });

  it('a kredit legfeljebb az audit díj', () => {
    const res = assess([{ ...base, serviceFeeHuf: 5_000_000 }]);
    expect(res.pipeline.totalFeeHuf).toBe(5_000_000);
    expect(res.pipeline.creditHuf).toBe(1_200_000);
    expect(res.pipeline.netAfterCreditHuf).toBe(3_800_000);
  });

  it('a kredit nem haladhatja meg a megrendelt remediációt', () => {
    const res = assess([{ ...base, serviceFeeHuf: 300_000 }]);
    expect(res.pipeline.creditHuf).toBe(300_000);
    expect(res.pipeline.netAfterCreditHuf).toBe(0);
  });

  it('zöld tételből nem lesz lead', () => {
    const res = assess([{ ...base, likelihood: 1, impact: 1 }]);
    expect(res.pipeline.totalFeeHuf).toBe(0);
  });

  it('akcióterv lefedi az összes azonosított tételt, prioritás szerint', () => {
    const res = assess(DEFAULT_CATALOG);
    const planned = Object.values(res.actionPlan).flat();
    expect(planned).toHaveLength(res.totals.identified);
    for (let i = 1; i < res.risks.length; i++) {
      expect(res.risks[i - 1].priority).toBeGreaterThanOrEqual(res.risks[i].priority);
    }
  });

  it('bármely piros pillér pirossá teszi az összesítést', () => {
    const res = assess(DEFAULT_CATALOG);
    expect(res.pillars.LEGAL.rag).toBe('RED');
    expect(res.totals.rag).toBe('RED');
  });
});

describe('formatHufShort', () => {
  it('M / Mrd rövidítés', () => {
    expect(formatHufShort(12_500_000)).toBe('12,5 M Ft');
    expect(formatHufShort(1_200_000_000)).toBe('1,2 Mrd Ft');
  });
});
