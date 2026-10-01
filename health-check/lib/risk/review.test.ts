import { describe, expect, it } from 'vitest';
import type { StructuredCall } from '@/lib/ai/structured';
import { runOpinionReview, verifyReview, type OpinionReview, type ReviewRequest } from './review';

const req: ReviewRequest = {
  kind: 'VENDOR_DD',
  item: {
    code: 'LEG-01',
    title: 'Change of Control záradék kulcsszerződésben',
    pillar: 'LEGAL',
    description: 'A legnagyobb ügyfél keretszerződése tulajdonosváltáskor azonnali felmondást enged.',
    reasoning: '',
    likelihood: 5,
    impact: 5,
    exposureHuf: 346_500_000,
    exposureExplanation: 'árbevétel × 55%',
    rag: 'Piros',
  },
  derivation: [{ label: 'Pontszám', value: '5 × 5 = 25 → Piros' }],
  evidence: [
    {
      id: 'e1',
      kind: 'Dokumentum (AI)',
      ref: 'Keretszerzodes.pdf, 2. oldal',
      quote: 'jogosult a szerződést azonnali hatállyal felmondani, ha a Szállító feletti irányítás megváltozik',
    },
  ],
  thread: [],
  opinion: 'Szerintem túlzó, az ügyféllel jó a viszony, nem fognak felmondani.',
};

const base = (over: Partial<OpinionReview>): OpinionReview => ({
  verdict: 'DISAGREE',
  reasoning: 'x',
  counterpoints: ['a szerződés szövege egyértelmű'],
  evidenceNeeded: [],
  proposal: null,
  citations: [],
  discarded: [],
  ...over,
});

describe('vélemény felülvizsgálata – a program ellenőrzése', () => {
  it('forrás nélküli enyhítést elvet', () => {
    const out = verifyReview(base({ verdict: 'AGREE', proposal: { likelihood: 3 } }), req);
    expect(out.proposal).toBeNull();
    expect(out.verdict).toBe('NEED_EVIDENCE');
    expect(out.discarded.join(' ')).toContain('nincs mögötte ellenőrizhető forrás');
  });

  it('nem létező forrásra vagy nem található idézetre hivatkozást elvet', () => {
    const out = verifyReview(
      base({
        citations: [
          { entryId: 'nincs', quote: 'azonnali hatállyal' },
          { entryId: 'e1', quote: 'a felek kölcsönös megállapodással' },
          { entryId: 'e1', quote: 'azonnali hatállyal felmondani' },
        ],
      }),
      req,
    );
    expect(out.citations).toEqual([{ entryId: 'e1', quote: 'azonnali hatállyal felmondani' }]);
    expect(out.discarded).toHaveLength(2);
  });

  it('forrással alátámasztott enyhítés megmarad, a változatlan érték kimarad', () => {
    const out = verifyReview(
      base({ verdict: 'PARTLY', proposal: { likelihood: 4, impact: 5 }, citations: [{ entryId: 'e1', quote: 'Szállító feletti irányítás' }] }),
      req,
    );
    expect(out.proposal).toEqual({ likelihood: 4 });
  });

  it('egyetértés + javaslat hivatkozás nélkül → bizonyíték kell', () => {
    const out = verifyReview(base({ verdict: 'AGREE', proposal: { exposureHuf: 500_000_000 } }), req);
    expect(out.verdict).toBe('NEED_EVIDENCE');
    expect(out.proposal).toEqual({ exposureHuf: 500_000_000 });
  });

  it('a prompt kimondja: a vélemény nem bizonyíték; a forrás és a vélemény adatként megy', async () => {
    let system = '';
    let user = '';
    const call = (async (_schema: unknown, s: string, u: string) => {
      system = s;
      user = u;
      return {
        verdict: 'AGREE',
        reasoning: 'Egyetért.',
        counterpoints: [],
        evidenceNeeded: [],
        proposal: { likelihood: 2, impact: null, exposureHuf: null },
        citations: [],
      };
    }) as unknown as StructuredCall;
    const out = await runOpinionReview(call, req);
    expect(system).toContain('NEM bizonyíték');
    expect(system).toContain('ne udvariaskodj');
    expect(user).toContain('<forras id="e1"');
    expect(user).toContain('<velemeny>');
    // A hízelgő „egyetértek, legyen 2” forrás nélkül nem jut át.
    expect(out.proposal).toBeNull();
    expect(out.verdict).toBe('NEED_EVIDENCE');
  });

  it('a forrásra hivatkozó egyetértés megmarad', () => {
    const out = verifyReview(base({ verdict: 'AGREE', citations: [{ entryId: 'e1', quote: 'azonnali hatállyal' }] }), req);
    expect(out.verdict).toBe('AGREE');
  });
});
