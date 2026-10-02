import { describe, expect, it } from 'vitest';
import { applyIntakeSuggestion } from '@/lib/intake/apply';
import type { IntakeSuggestion } from '@/lib/intake/types';
import { DEFAULT_CATALOG } from './catalog';
import { deriveRisk } from './derivation';
import { getScenario } from '@/lib/scenarios';
import { assess, scoreRisk } from './engine';
import { applySuggestion } from './store';
import { addEntry, itemsFromAnchor, missingReasons, recordChange, setReason, sourceCount, trailOf } from './trail';
import type { RiskItem } from './types';

const base = (): RiskItem => ({ ...DEFAULT_CATALOG.find((r) => r.code === 'LEG-01')!, identified: false, trail: undefined, history: undefined });
const exposure = (r: RiskItem) => r.exposureHuf;
const at = (min: number) => new Date(Date.UTC(2026, 9, 1, 10, min));

const sug = (over: Partial<IntakeSuggestion> = {}): IntakeSuggestion => ({
  key: 'DOC:d1:0:LEG-01:45',
  origin: 'AI_DOCUMENT',
  code: 'LEG-01',
  pillar: 'LEGAL',
  title: 'Change of Control',
  rationale: 'Tulajdonosváltáskor felmondható.',
  evidence: '„azonnali hatállyal felmondhatja” – szerzodes.pdf, 7. oldal',
  ref: 'szerzodes.pdf, 7. oldal',
  quote: 'azonnali hatállyal felmondhatja',
  link: { page: 'adatok', tab: 'documents', anchor: 'doc-d1' },
  likelihood: 4,
  impact: 5,
  confidence: 0.8,
  ...over,
});

describe('bizonyíték-lánc', () => {
  it('elfogadáskor külön bejegyzés: hely, idézet, indoklás, hatás, elfogadó, ugrási cél', () => {
    const [r] = applyIntakeSuggestion([base()], sug(), undefined, 'Kiss Anna');
    const [e] = trailOf(r);
    expect(e).toMatchObject({
      kind: 'AI_DOCUMENT',
      actor: 'AI',
      ref: 'szerzodes.pdf, 7. oldal',
      quote: 'azonnali hatállyal felmondhatja',
      rationale: 'Tulajdonosváltáskor felmondható.',
      confidence: 0.8,
      acceptedBy: 'Kiss Anna',
      link: { page: 'adatok', tab: 'documents', anchor: 'doc-d1' },
    });
    expect(e.effect).toContain('azonosítva');
    expect(r.reasoning).toBeTruthy();
  });

  it('a második forrás nem írja felül az elsőt; a hatás mutatja az emelést', () => {
    let items = applyIntakeSuggestion([base()], sug({ likelihood: 3, impact: 4 }), undefined, 'A');
    items = applyIntakeSuggestion(
      items,
      sug({
        key: 'CHK:x',
        origin: 'CHECKLIST',
        ref: 'Q09 – Igen',
        quote: undefined,
        link: { page: 'adatok', tab: 'checklist', anchor: 'q-Q09' },
        likelihood: 4,
        impact: 5,
      }),
      undefined,
      'B',
    );
    const trail = trailOf(items[0]);
    expect(trail.map((e) => e.kind)).toEqual(['AI_DOCUMENT', 'CHECKLIST']);
    expect(trail[1].effect).toContain('valószínűség 3→4');
    expect(sourceCount(items[0])).toBe(2);
    expect(itemsFromAnchor(items, 'q-Q09')).toHaveLength(1);
  });

  it('ugyanaz a forrás kétszer nem kerül be', () => {
    const once = applyIntakeSuggestion([base()], sug());
    const twice = applyIntakeSuggestion(once, sug());
    expect(trailOf(twice[0])).toHaveLength(1);
  });

  it('cégkivonatból jövő javaslat külön forrásként látszik', () => {
    const [r] = applyIntakeSuggestion([base()], sug({ key: 'REG:x:45', origin: 'CROSS_CHECK' }));
    expect(trailOf(r)[0].kind).toBe('REGISTRY');
  });

  it('interjúból elfogadott javaslat idézettel és helyszínnel', () => {
    const flag = {
      templateCode: 'LEG-01',
      pillar: 'LEGAL',
      title: 'CoC',
      rationale: 'Elhangzott.',
      quote: 'bármikor felmondhatnak',
      likelihood: 4,
      impact: 4,
      exposureHufEstimate: null,
      confidence: 0.7,
    };
    const [r] = applySuggestion([base()], flag as never, 'ev', undefined, { ref: 'Ügyvezető interjú, 12:41', by: 'C' });
    expect(trailOf(r)[0]).toMatchObject({ kind: 'AI_INTERVIEW', ref: 'Ügyvezető interjú, 12:41', quote: 'bármikor felmondhatnak', acceptedBy: 'C' });
  });

  it('régi mentés: a szöveges bizonyítékból egy bejegyzés', () => {
    const r = { ...base(), identified: true, source: 'CHECKLIST' as const, evidence: 'Ügyfélkérdőív: Q09' };
    expect(trailOf(r)).toEqual([expect.objectContaining({ kind: 'CHECKLIST', actor: 'RULE', ref: 'Ügyfélkérdőív: Q09' })]);
  });

  it('addEntry nem módosítja az eredeti tételt', () => {
    const r = base();
    addEntry(r, { kind: 'MANUAL', actor: 'EXPERT', ref: 'x' });
    expect(r.trail).toBeUndefined();
  });
});

describe('változásnapló', () => {
  it('kézi bepipálás: napló + szakértői bejegyzés a láncban', () => {
    const prev = base();
    const next = recordChange(prev, { ...prev, identified: true }, 'Kiss Anna', exposure, at(0));
    expect(next.history).toEqual([expect.objectContaining({ field: 'identified', from: 'nem', to: 'igen', reduces: false, by: 'Kiss Anna' })]);
    expect(trailOf(next)[0]).toMatchObject({ kind: 'MANUAL', actor: 'EXPERT', acceptedBy: 'Kiss Anna' });
  });

  it('csökkentésnél indoklás kell; megírás után eltűnik a hiány', () => {
    const prev = { ...base(), identified: true, likelihood: 4 as const };
    const next = recordChange(prev, { ...prev, likelihood: 2 }, 'A', exposure, at(0));
    expect(missingReasons(next)).toHaveLength(1);
    const ok = setReason(next, 0, 'Bemutatták az aláírt szerződést.');
    expect(missingReasons(ok)).toHaveLength(0);
  });

  it('gyors egymás utáni gépelés egy bejegyzés; visszaállítás után nincs bejegyzés', () => {
    const prev = { ...base(), identified: true, exposureHuf: 100 };
    let r = recordChange(prev, { ...prev, exposureHuf: 1 }, 'A', exposure, at(0));
    r = recordChange(r, { ...r, exposureHuf: 10 }, 'A', exposure, at(0));
    expect(r.history).toHaveLength(1);
    expect(r.history![0]).toMatchObject({ from: '100', to: '10', reduces: true });
    r = recordChange(r, { ...r, exposureHuf: 100 }, 'A', exposure, at(1));
    expect(r.history).toHaveLength(0);
  });

  it('nem azonosított tétel pontozása nem kerül a naplóba', () => {
    const prev = base();
    expect(recordChange(prev, { ...prev, likelihood: 1 }, 'A', exposure).history).toBeUndefined();
  });

  it('később, más felhasználó módosítása új bejegyzés', () => {
    const prev = { ...base(), identified: true, impact: 5 as const };
    let r = recordChange(prev, { ...prev, impact: 4 }, 'A', exposure, at(0));
    r = recordChange(r, { ...r, impact: 3 }, 'B', exposure, at(1));
    expect(r.history!.map((h) => h.by)).toEqual(['A', 'B']);
  });
});

describe('levezetés', () => {
  it('megadott érték → pont → várható veszteség → lényegességi felülbírálat', () => {
    const r = { ...base(), identified: true, likelihood: 2 as const, impact: 3 as const, exposureHuf: 500_000_000, valuation: undefined };
    const eff = scoreRisk(r, { materialityHuf: 40_000_000 });
    const steps = deriveRisk(eff, 40_000_000);
    expect(steps.map((s) => s.label)).toEqual([
      'Megadott érték',
      'Pontszám',
      'Kitettség',
      'Várható veszteség',
      'Lényegességi küszöb',
      'Besorolás',
      'Időablak',
      'Hatás a pillér-egészségre',
    ]);
    expect(steps.find((s) => s.label === 'Besorolás')!.value).toBe('Piros');
  });

  it('a prioritás és a Health-szorzó levezetése ugyanazt adja, mint a motor', () => {
    const sc = getScenario('it-fejleszto');
    const opts = { company: sc.company, materialityHuf: sc.materialityHuf };
    const res = assess(sc.items, opts);
    const maxLossHuf = Math.max(1, ...res.risks.map((r) => r.expectedLossHuf));
    for (const r of res.risks) {
      const steps = deriveRisk(scoreRisk(r, opts), sc.materialityHuf, { priority: { value: r.priority, maxLossHuf }, hasSources: false });
      const note = steps.find((s) => s.label === 'Prioritás')!.note!;
      const recomputed = 0.5 * (r.score / 25) + 0.5 * (r.expectedLossHuf / maxLossHuf) + (note.includes('quick win') ? 0.15 : 0);
      expect(recomputed).toBeCloseTo(r.priority, 9);
      expect(steps[0].note).toContain('katalógus alapértéke');
    }
    for (const p of Object.values(res.pillars)) {
      const own = res.risks.filter((r) => r.pillar === p.pillar);
      const factors = own.map((r) =>
        Number(
          deriveRisk(r, sc.materialityHuf)
            .find((s) => s.label === 'Hatás a pillér-egészségre')!
            .value.slice(2)
            .replace(',', '.'),
        ),
      );
      expect(Math.round(100 * factors.reduce((a, b) => a * b, 1))).toBeCloseTo(p.healthScore!, 0);
    }
  });
});
