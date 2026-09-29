import { describe, expect, it } from 'vitest';
import { adjustmentsFor } from '@/lib/engagement/adjustments';
import { ENGAGEMENT_KINDS } from '@/lib/engagement/kinds';
import { getScenario } from '@/lib/scenarios';
import { assess } from './engine';
import { compare, currentAfterRemediation, takeSnapshot } from './followup';

const sc = getScenario('gyarto');
const opts = { company: sc.company, materialityHuf: sc.materialityHuf, adjustments: adjustmentsFor(sc.kind), pillarWeights: ENGAGEMENT_KINDS[sc.kind].weights };

describe('utókövetés', () => {
  const base = assess(sc.items, opts);
  const snap = takeSnapshot(base, 'Átvilágítás zárása', sc.kind, new Date('2026-09-01T10:00:00Z'));

  it('pillanatkép a teljes értékelésről', () => {
    expect(snap.items).toHaveLength(base.totals.identified);
    expect(snap.totals.healthScore).toBe(base.totals.healthScore);
  });

  it('„Kész” tétel megoldottnak számít, az elfogadott kockázat külön jelölt, új és romlott tétel is látszik', () => {
    const [first, second, third] = base.risks;
    const items = sc.items.map((r) => {
      if (r.id === first.id) return { ...r, remediationStatus: 'DONE' as const };
      if (r.id === second.id) return { ...r, remediationStatus: 'ACCEPTED_RISK' as const };
      if (r.id === third.id) return { ...r, likelihood: 5 as const, impact: 5 as const };
      if (r.code === 'LEG-03') return { ...r, identified: true };
      return r;
    });
    const c = compare(snap, items, opts);
    const by = (id: string) => c.changes.find((x) => x.id === id)!;
    expect(by(first.id).change).toBe('RESOLVED');
    expect(by(second.id).change).toBe('ACCEPTED');
    expect(by(third.id).change === 'WORSENED' || third.score === 25).toBe(true);
    expect(c.changes.find((x) => x.code === 'LEG-03')!.change).toBe('NEW');
    expect(c.now.identified).toBe(currentAfterRemediation(items, opts).totals.identified);
    expect(c.counts.RESOLVED).toBe(1);
  });
});
