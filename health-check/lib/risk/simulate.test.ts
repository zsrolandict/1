import { describe, expect, it } from 'vitest';
import { adjustmentsFor } from '@/lib/engagement/adjustments';
import { ENGAGEMENT_KINDS } from '@/lib/engagement/kinds';
import { getScenario } from '@/lib/scenarios';
import { presetFixes, simulate } from './simulate';

const sc = getScenario('gyarto');
const opts = { company: sc.company, materialityHuf: sc.materialityHuf, adjustments: adjustmentsFor(sc.kind), pillarWeights: ENGAGEMENT_KINDS[sc.kind].weights };

describe('mi lenne, ha', () => {
  it('semmi javítás: nincs változás', () => {
    const s = simulate(sc.items, opts, new Set());
    expect(s.after.totals).toEqual(s.before.totals);
    expect(s.returnMultiple).toBeNull();
  });

  it('a piros tételek megoldása javítja a pontszámot és csökkenti a várható veszteséget', () => {
    const base = simulate(sc.items, opts, new Set()).before;
    const s = simulate(sc.items, opts, presetFixes(base, 'RED'));
    expect(s.fixedCount).toBe(base.totals.red);
    expect(s.after.totals.red).toBe(0);
    expect(s.healthScoreGain).toBeGreaterThan(0);
    expect(s.expectedLossReductionHuf).toBeGreaterThan(0);
    expect(s.costHuf).toBeGreaterThan(0);
    expect(s.returnMultiple).toBeCloseTo(s.expectedLossReductionHuf / s.costHuf);
  });

  it('csökkentés (V=1) kisebb hatású, mint a teljes megoldás', () => {
    const base = simulate(sc.items, opts, new Set()).before;
    const ids = presetFixes(base, 'ALL_NON_GREEN');
    const resolve = simulate(sc.items, opts, ids, 'RESOLVE');
    const mitigate = simulate(sc.items, opts, ids, 'MITIGATE');
    expect(mitigate.after.totals.expectedLossHuf).toBeGreaterThan(resolve.after.totals.expectedLossHuf);
    expect(mitigate.after.totals.identified).toBe(base.totals.identified);
  });
});
