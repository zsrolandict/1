import { describe, expect, it } from 'vitest';
import { getScenario } from '@/lib/scenarios';
import { crossChecks, partnerKey } from './crossChecks';
import { SAMPLE_ANSWERS } from './samples/checklist';
import { SAMPLE_DOCUMENTS, sampleDocumentRecord } from './samples/documents';
import { SAMPLE_PROFILES } from './samples/profiles';
import { SAMPLE_REF_DATE, sampleTableCsv } from './samples/tables';
import { EMPTY_INTAKE, type IntakeState } from './state';
import { buildSources, runSynthesis } from './synthesis';
import { analyzeTable } from './tables/metrics';
import { isoToDay, parseCsv } from './tables/parse';
import { detectColumns, type TableKind } from './tables/spec';

function table(kind: TableKind, csv: string, fileName = 't.csv') {
  const grid = parseCsv(csv);
  const d = detectColumns(kind, grid);
  return analyzeTable(
    { kind, fileName, grid, headerRow: d.headerRow, mapping: d.mapping, refDay: isoToDay(SAMPLE_REF_DATE) },
    { company: getScenario('gyarto').company },
  );
}

describe('keresztellenőrzés', () => {
  it('cégnév-összevetés cégforma és ékezet nélkül', () => {
    expect(partnerKey('Példa Holding Kft.')).toBe(partnerKey('PELDA HOLDING kft'));
  });

  it('kérdőív szerint rendben ↔ dokumentum szerint nem: súlyos ellentmondás (könyvelő, indexálás)', () => {
    const state: IntakeState = {
      ...EMPTY_INTAKE,
      profile: SAMPLE_PROFILES.konyvelo,
      answers: SAMPLE_ANSWERS.konyvelo,
      documents: [sampleDocumentRecord(SAMPLE_DOCUMENTS.konyvelo[0], 'd1')],
    };
    const { conflicts } = crossChecks(state, 'SUCCESSION');
    const c = conflicts.find((x) => x.a.statement.startsWith('QK3'));
    expect(c).toBeDefined();
    expect(c!.severity).toBe('HIGH');
    expect(c!.b.source).toContain('Konyvelesi_megbizasi_szerzodes_minta.docx');
  });

  it('kérdőív száma ↔ tábla: 18 százalékpontos eltérés közepes', () => {
    const sc = getScenario('epitoipar');
    const t = sampleTableCsv('SALES_BY_CUSTOMER', sc);
    const state: IntakeState = { ...EMPTY_INTAKE, answers: { Q22: 20 }, tables: { SALES_BY_CUSTOMER: table('SALES_BY_CUSTOMER', t.csv, t.fileName) } };
    const c = crossChecks(state, 'FINANCING_READINESS').conflicts;
    expect(c).toHaveLength(1);
    expect(c[0]).toMatchObject({ severity: 'MEDIUM', topic: 'Legnagyobb vevő aránya' });
  });

  it('táblák együtt: kapcsolt fél a vevők között, oda-vissza partner, 180 napon túli követelés', () => {
    const sales = table('SALES_BY_CUSTOMER', 'Vevő;Árbevétel\nPélda Holding Kft.;100 000 000\nAlfa Kft.;400 000 000\nBéta Zrt.;500 000 000');
    const purch = table('PURCHASES_BY_SUPPLIER', 'Szállító;Beszerzés\nBéta Zrt.;50 000 000\nGamma Kft.;300 000 000');
    const rel = table('RELATED_PARTY', 'Kapcsolt fél;Ügylet;Érték;TP-nyilvántartás\nPELDA HOLDING KFT;Menedzsment;60 000 000;igen');
    const ar = table('AR_AGING', 'Vevő;Nyitott összeg;Esedékesség\nAlfa Kft.;30 000 000;2025.10.01.\nBéta Zrt.;70 000 000;2026.06.20.');
    const state: IntakeState = { ...EMPTY_INTAKE, tables: { SALES_BY_CUSTOMER: sales, PURCHASES_BY_SUPPLIER: purch, RELATED_PARTY: rel, AR_AGING: ar } };
    const titles = crossChecks(state, 'HEALTH_CHECK').suggestions.map((s) => s.title);
    expect(titles).toContain('Kapcsolt fél a vevők vagy szállítók között');
    expect(titles).toContain('Oda-vissza üzleti kapcsolat (vevő és szállító egyben)');
    expect(titles).toContain('180 napon túli követelés – értékvesztés vizsgálandó');
  });

  it('az interjúk AI-ellentmondásai is egy helyen, a tény szövegével', () => {
    const sc = getScenario('it-fejleszto');
    const rec = {
      role: 'OWNER_CEO' as const,
      alias: 'Ügyvezető',
      heldAt: null,
      notes: '',
      transcript: null,
      speakerNames: {},
      analysisIsSample: true,
      accepted: [],
      asked: [],
      analysis: { ...sc.interview!.analysis, discardedUnverified: 0 },
    };
    const c = crossChecks(EMPTY_INTAKE, 'VENDOR_DD', { OWNER_CEO: rec }, sc.facts).conflicts.filter((x) => x.origin === 'AI_INTERVIEW');
    expect(c.length).toBe(sc.interview!.analysis.contradictions.length);
    expect(c[0].b.statement).not.toMatch(/^F\d$/);
  });
});

describe('AI-összkép', () => {
  const state: IntakeState = {
    ...EMPTY_INTAKE,
    profile: SAMPLE_PROFILES.konyvelo,
    answers: SAMPLE_ANSWERS.konyvelo,
    documents: [sampleDocumentRecord(SAMPLE_DOCUMENTS.konyvelo[0], 'd1')],
  };
  const sources = buildSources(state, {}, [
    { id: 'CHK-QK3', statement: 'Díjemelési (indexálási) záradék az ügyfélszerződésekben: Igen, mindenhol', source: 'x' },
  ]);

  it('forrásokat épít azonosítóval (tényállás, kérdőív, dokumentum)', () => {
    expect(sources.map((s) => s.id)).toEqual(['T1', 'K1', 'D1']);
  });

  it('csak a megjelölt forrásban szó szerint szereplő idézettel fogad el; kódot csak nem azonosított tételre', async () => {
    const call = (async () => ({
      risks: [
        {
          title: 'Az iroda ingatlanhasználata nincs szerződésben rendezve',
          templateCode: null,
          pillar: 'LEGAL',
          rationale: 'r',
          likelihood: 3,
          impact: 3,
          confidence: 0.8,
          evidence: [{ sourceId: 'T1', quote: 'családi tulajdonú ingatlanban működik' }],
        },
        {
          title: 'Kitalált',
          templateCode: null,
          pillar: 'HR',
          rationale: 'r',
          likelihood: 3,
          impact: 3,
          confidence: 0.9,
          evidence: [{ sourceId: 'D1', quote: 'ez a mondat nincs a dokumentumban' }],
        },
        {
          title: 'Rossz forrás',
          templateCode: null,
          pillar: 'HR',
          rationale: 'r',
          likelihood: 3,
          impact: 3,
          confidence: 0.9,
          evidence: [{ sourceId: 'K1', quote: 'családi tulajdonú ingatlanban működik' }],
        },
        {
          title: 'x',
          templateCode: 'HR-01',
          pillar: 'HR',
          rationale: 'r',
          likelihood: 9,
          impact: 3,
          confidence: 0.5,
          evidence: [{ sourceId: 'T1', quote: 'személyesen az alapítóhoz kötődnek' }],
        },
      ],
    })) as never;
    const existing = getScenario('konyvelo').items; // HR-01 már azonosított
    const r = await runSynthesis(call, { kind: 'SUCCESSION', companyName: 'Példa', sources, existing, pending: [] });
    expect(r.suggestions.map((s) => s.title)).toEqual(['Az iroda ingatlanhasználata nincs szerződésben rendezve', 'x']);
    expect(r.suggestions[1].code).toBeNull(); // HR-01 már azonosított → nem kódoljuk rá
    expect(r.suggestions[1].likelihood).toBe(5);
    expect(r.suggestions[0].evidence).toContain('Előzetes tényállás');
    expect(r.discardedUnverified).toBe(2);
    expect(r.discarded!.map((d) => d.what)).toEqual(['Javasolt kockázat', 'Javasolt kockázat']);
  });
});
