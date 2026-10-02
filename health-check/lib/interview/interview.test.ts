import { describe, expect, it } from 'vitest';
import { DEFAULT_CATALOG } from '@/lib/risk/catalog';
import { applySuggestion } from '@/lib/risk/store';
import { azureToTranscript } from './transcribe.server';
import { buildInterviewGuide, estimateMinutes } from './guide';
import { SAMPLE_ANALYSIS_RAW, SAMPLE_FACTS, SAMPLE_MISSING_DOCUMENTS, SAMPLE_NOTES } from './sample';
import { findQuote, formatMs, normalize, notesToTranscript, verifyAnalysis } from './transcript';

describe('buildInterviewGuide', () => {
  const base = {
    kind: 'VENDOR_DD' as const,
    risks: DEFAULT_CATALOG,
    missingDocuments: SAMPLE_MISSING_DOCUMENTS,
    facts: SAMPLE_FACTS,
  };

  it('HR-vezetőnek csak HR kérdések jutnak', () => {
    const qs = buildInterviewGuide({ ...base, role: 'HR_LEAD' });
    expect(qs.length).toBeGreaterThan(0);
    expect(qs.every((q) => q.pillar === 'HR')).toBe(true);
  });

  it('azonosított red flagre célzott kérdés készül, nem azonosítottra nem', () => {
    const qs = buildInterviewGuide({ ...base, role: 'OWNER_CEO' });
    const codes = qs.flatMap((q) => (q.source.type === 'RED_FLAG' ? [q.source.code] : []));
    expect(codes).toContain('LEG-01'); // azonosított a katalógusban
    expect(codes).not.toContain('LEG-03'); // nem azonosított
  });

  it('hiányzó dokumentum kötelező kérdés a pénzügyi vezetőnek', () => {
    const qs = buildInterviewGuide({ ...base, role: 'CFO' });
    const doc = qs.find((q) => q.source.type === 'MISSING_DOCUMENT');
    expect(doc?.priority).toBe(1);
    expect(doc?.text).toContain('Transzferár-nyilvántartás');
  });

  it('kötelező kérdések elöl, nincs duplikátum', () => {
    const qs = buildInterviewGuide({ ...base, role: 'OWNER_CEO' });
    const firstNonP1 = qs.findIndex((q) => q.priority !== 1);
    expect(qs.slice(firstNonP1).every((q) => q.priority !== 1)).toBe(true);
    expect(new Set(qs.map((q) => q.text)).size).toBe(qs.length);
  });

  it('a típus-specifikus kérdések a típustól függenek', () => {
    const vdd = buildInterviewGuide({ ...base, role: 'OWNER_CEO' });
    const succ = buildInterviewGuide({ ...base, role: 'OWNER_CEO', kind: 'SUCCESSION' });
    const kindQs = (qs: typeof vdd) => qs.filter((q) => q.source.type === 'KIND').map((q) => q.text);
    expect(kindQs(succ).some((t) => t.includes('utód'))).toBe(true);
    expect(kindQs(vdd)).not.toEqual(kindQs(succ));
    expect(estimateMinutes(vdd)).toBeGreaterThan(0);
  });
});

describe('notesToTranscript', () => {
  it('időbélyeges, beszélős jegyzetet ismer fel', () => {
    const t = notesToTranscript(SAMPLE_NOTES);
    expect(t.timed).toBe(true);
    expect(t.segments[1]).toMatchObject({ speaker: 'Ügyvezető', startMs: 32_000 });
  });

  it('szabad szöveg: nincs kitalált időbélyeg', () => {
    const t = notesToTranscript('Első bekezdés\nfolytatás\n\nMásodik bekezdés');
    expect(t.timed).toBe(false);
    expect(t.segments).toHaveLength(2);
    expect(t.segments[0].text).toBe('Első bekezdés folytatás');
  });
});

describe('findQuote / verifyAnalysis', () => {
  const transcript = notesToTranscript(SAMPLE_NOTES);

  it('ékezet- és írásjel-független egyezés, helyes időbélyeg', () => {
    const m = findQuote(transcript, 'ok adjak a forgalom nagyjabol harmadat!');
    expect(m?.startMs).toBe(32_000);
    expect(normalize('Árvíztűrő, TÜKÖR-fúrógép')).toBe('arvizturo tukor furogep');
  });

  it('kiszűri a leiratban nem szereplő idézetet és az ismeretlen tényre hivatkozó ellentmondást', () => {
    const raw = {
      ...SAMPLE_ANALYSIS_RAW,
      contradictions: [...SAMPLE_ANALYSIS_RAW.contradictions, { ...SAMPLE_ANALYSIS_RAW.contradictions[0], conflictingFactId: 'NINCS-ILYEN' }],
    };
    const res = verifyAnalysis(raw, transcript, SAMPLE_FACTS);
    expect(res.suggestedRedFlags).toHaveLength(3);
    expect(res.contradictions).toHaveLength(3);
    expect(res.discardedUnverified).toBe(2);
    expect(res.discarded).toHaveLength(2);
    for (const d of res.discarded!) expect(d.reason.length).toBeGreaterThan(10);
    expect(res.contradictions[0].severity).toBe('HIGH');
    expect(res.contradictions[0].conflictingSource).toContain('Nordwind');
    expect(res.statements[0].speaker).toBe('Ügyvezető');
  });

  it('túl rövid idézet nem bizonyíték', () => {
    expect(findQuote(transcript, 'igen')).toBeNull();
  });

  it('formatMs', () => {
    expect(formatMs(65_000)).toBe('01:05');
    expect(formatMs(3_725_000)).toBe('1:02:05');
    expect(formatMs(null)).toBe('');
  });
});

describe('azureToTranscript', () => {
  it('beszélőnként összevonja az egymást követő mondatokat', () => {
    const t = azureToTranscript({
      durationMilliseconds: 9000,
      phrases: [
        { offsetMilliseconds: 0, durationMilliseconds: 2000, text: 'Jó napot.', speaker: 1 },
        { offsetMilliseconds: 2500, durationMilliseconds: 1000, text: 'Kezdhetjük?', speaker: 1 },
        { offsetMilliseconds: 4000, durationMilliseconds: 3000, text: 'Igen, persze.', speaker: 2 },
      ],
    });
    expect(t.segments).toHaveLength(2);
    expect(t.segments[0]).toMatchObject({ speaker: 'Beszélő 1', text: 'Jó napot. Kezdhetjük?', endMs: 3500 });
    expect(t.timed).toBe(true);
  });
});

describe('applySuggestion', () => {
  const s = {
    templateCode: 'LEG-03',
    pillar: 'LEGAL' as const,
    title: 't',
    rationale: 'r',
    quote: 'q',
    startMs: null,
    likelihood: 4 as const,
    impact: 1 as const,
    exposureHufEstimate: 2_000_000,
    confidence: 0.8,
  };

  it('nem azonosított katalógustételt azonosít: a javaslat párja érvényes (a katalógus-alapérték nem megállapítás, K6)', () => {
    const items = applySuggestion(DEFAULT_CATALOG, s, 'idézet');
    const leg03 = items.find((r) => r.code === 'LEG-03')!;
    expect(leg03.identified).toBe(true);
    expect([leg03.likelihood, leg03.impact]).toEqual([4, 1]);
    expect(leg03.exposureHuf).toBe(2_000_000);
    expect(leg03.source).toBe('AI_INTERVIEW');
    expect(items).toHaveLength(DEFAULT_CATALOG.length);
  });

  it('azonosított tételnél a domináns pár marad: nem keveredik új, senki által nem állított kombináció (K6)', () => {
    const base = DEFAULT_CATALOG.map((r) => (r.code === 'LEG-03' ? { ...r, identified: true, likelihood: 2 as const, impact: 2 as const } : r));
    // 2×2 = 4 és 4×1 = 4: holtverseny → a nagyobb hatású (a meglévő) marad; nem lesz 4×2.
    const tie = applySuggestion(base, s, 'idézet').find((r) => r.code === 'LEG-03')!;
    expect([tie.likelihood, tie.impact]).toEqual([2, 2]);
    // Erősebb javaslat (5×3 = 15) egészében felülírja.
    const strong = applySuggestion(base, { ...s, likelihood: 5, impact: 3 }, 'idézet').find((r) => r.code === 'LEG-03')!;
    expect([strong.likelihood, strong.impact]).toEqual([5, 3]);
  });

  it('ismeretlen kódnál új egyedi tétel jön létre', () => {
    const items = applySuggestion(DEFAULT_CATALOG, { ...s, templateCode: null, title: 'Új' }, 'idézet');
    expect(items).toHaveLength(DEFAULT_CATALOG.length + 1);
    expect(items[0]).toMatchObject({ code: 'CUS-01', title: 'Új', identified: true });
  });
});
