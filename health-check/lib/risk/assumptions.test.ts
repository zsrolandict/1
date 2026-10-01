import { describe, expect, it } from 'vitest';
import { FIN_THRESHOLDS } from '@/lib/intake/financials/thresholds';
import { ASSUMPTIONS, REMAINING_JUDGEMENT } from './assumptions';
import { DEFAULT_OPTIONS, PROBABILITY } from './engine';
import { EXPERT_PARAMETERS } from './parameters';

describe('feltevés-nyilvántartás', () => {
  const get = (id: string) => ASSUMPTIONS.find((a) => a.id === id)!;

  it('a kiírt értékek a motor tényleges állandói', () => {
    for (const [l, p] of Object.entries(PROBABILITY)) expect(get('probability').value).toContain(`${l}: ${Math.round(p * 100)}%`);
    expect(get('quick-win').value).toContain(`${DEFAULT_OPTIONS.quickWinMaxDays} munkanap`);
    expect(get('materiality').value).toBe(`${DEFAULT_OPTIONS.materialityHuf / 1_000_000} M Ft`);
  });

  it('minden szakértői paraméter és pénzügyi küszöb szerepel, állapottal', () => {
    for (const p of Object.values(EXPERT_PARAMETERS)) expect(ASSUMPTIONS.some((a) => a.label === p.label)).toBe(true);
    for (const t of Object.values(FIN_THRESHOLDS))
      expect(ASSUMPTIONS.some((a) => a.label.endsWith(t.label) && a.status === (t.approved ? 'APPROVED' : 'PROPOSAL'))).toBe(true);
    expect(new Set(ASSUMPTIONS.map((a) => a.id)).size).toBe(ASSUMPTIONS.length);
  });

  it('a nem levezethető ítélet is fel van sorolva, kezeléssel', () => {
    expect(REMAINING_JUDGEMENT.length).toBeGreaterThanOrEqual(4);
    for (const j of REMAINING_JUDGEMENT) expect(j.mitigation.length).toBeGreaterThan(20);
  });
});
