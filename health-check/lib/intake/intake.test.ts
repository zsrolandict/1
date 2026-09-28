import { describe, expect, it } from 'vitest';
import { strToU8, zipSync } from 'fflate';
import { assess } from '@/lib/risk/engine';
import { DEFAULT_CATALOG } from '@/lib/risk/catalog';
import { getScenario, SCENARIOS } from '@/lib/scenarios';
import { applyCompanySuggestion, applyIntakeSuggestion, templateFor } from './apply';
import { CHECKLIST, checklistProgress, evaluateChecklist, isVisible } from './checklist';
import { SAMPLE_ANSWERS } from './samples/checklist';
import { SAMPLE_REF_DATE, sampleTableCsv } from './samples/tables';
import { analyzeTable } from './tables/metrics';
import { decodeText, isoToDay, parseCsv, parseDay, parseNumber, parseXlsx } from './tables/parse';
import { detectColumns, missingColumns, TABLE_KINDS, type TableKind } from './tables/spec';

describe('kérdőív', () => {
  it('30 alapkérdés + ágazati kérdések, egyedi azonosítók, minden szabály létező tételre mutat', () => {
    expect(CHECKLIST.filter((q) => !q.sectors)).toHaveLength(30);
    expect(new Set(CHECKLIST.map((q) => q.id)).size).toBe(CHECKLIST.length);
    for (const q of CHECKLIST) {
      for (const r of q.rules) {
        if (r.code) expect(templateFor(r.code), `${q.id} ${r.code}`).toBeDefined();
        else expect(r.title).toBeTruthy();
        for (const c of Object.values(r.codeByKind ?? {})) expect(templateFor(c!)).toBeDefined();
      }
    }
  });

  it('feltételes kérdés csak a megfelelő válasz után látszik', () => {
    const q02 = CHECKLIST.find((q) => q.id === 'Q02')!;
    expect(isVisible(q02, {})).toBe(false);
    expect(isVisible(q02, { Q01: true })).toBe(false);
    expect(isVisible(q02, { Q01: false })).toBe(true);
  });

  it('rejtett kérdés válasza nem számít', () => {
    const r = evaluateChecklist({ Q01: true, Q02: 5 }, 'HEALTH_CHECK');
    expect(r.suggestions.find((s) => s.code === 'FIN-01')).toBeUndefined();
  });

  it('több szabály egy tételre: a legsúlyosabb érvényes, a képlet a válaszból', () => {
    const r = evaluateChecklist({ Q09: 'IGEN', Q10: 38 }, 'VENDOR_DD');
    const coc = r.suggestions.find((s) => s.code === 'LEG-01')!;
    expect(coc).toMatchObject({ likelihood: 3, impact: 5, valuationPatch: { type: 'REVENUE_SHARE', share: 0.38 } });
    expect(coc.evidence).toContain('Q09');
    expect(coc.evidence).toContain('38%');
  });

  it('típusfüggő tételkód: finanszírozásnál FIK-02, egyébként HC-02', () => {
    expect(evaluateChecklist({ Q08: false }, 'HEALTH_CHECK').suggestions[0].code).toBe('HC-02');
    expect(evaluateChecklist({ Q08: false }, 'FINANCING_READINESS').suggestions[0].code).toBe('FIK-02');
  });

  it('minden megválaszolt kérdésből tény lesz, de nem interjúkérdés', () => {
    const r = evaluateChecklist(SAMPLE_ANSWERS.gyarto, 'VENDOR_DD');
    expect(r.facts.length).toBe(checklistProgress(SAMPLE_ANSWERS.gyarto).answered);
    expect(r.facts.every((f) => f.askInInterview === false)).toBe(true);
  });

  it('minden mintaesethez van teljes válaszsor', () => {
    for (const sc of SCENARIOS) {
      const p = checklistProgress(SAMPLE_ANSWERS[sc.id]);
      expect(p.answered, sc.id).toBe(p.total);
    }
  });

  it('a gyártó minta a kézi értékeléshez közeli képet ad (üres mátrixból)', () => {
    const empty = DEFAULT_CATALOG.map((r) => ({ ...r, identified: false }));
    const { suggestions } = evaluateChecklist(SAMPLE_ANSWERS.gyarto, 'VENDOR_DD');
    const items = suggestions.reduce((acc, s) => applyIntakeSuggestion(acc, s), empty);
    const codes = items.filter((r) => r.identified).map((r) => r.code);
    for (const c of ['FIN-01', 'FIN-02', 'LEG-01', 'LEG-02', 'OPS-01', 'HR-01', 'HR-02']) expect(codes).toContain(c);
    const fin01 = items.find((r) => r.code === 'FIN-01')!;
    expect(fin01.valuation?.formula).toMatchObject({ type: 'PER_ITEM', count: 4 });
    expect(fin01.source).toBe('CHECKLIST');
  });
});

describe('javaslat beolvasztása', () => {
  const base = DEFAULT_CATALOG.map((r) => ({ ...r }));

  it('azonosított tételnél nem csökkenti a súlyosságot', () => {
    const hr01 = base.find((r) => r.code === 'HR-01')!; // V3 × H5, azonosított
    const items = applyIntakeSuggestion(base, {
      key: 'k', origin: 'CHECKLIST', code: 'HR-01', pillar: 'HR', title: '', rationale: '', evidence: 'teszt',
      likelihood: 2, impact: 2,
    });
    expect(items.find((r) => r.code === 'HR-01')).toMatchObject({ likelihood: hr01.likelihood, impact: hr01.impact, identified: true });
  });

  it('nem azonosított tételnél a javaslat értékei érvényesek', () => {
    const items = applyIntakeSuggestion(base, {
      key: 'k', origin: 'DATA_TABLE', code: 'FIN-03', pillar: 'FINANCE', title: '', rationale: '', evidence: 'e',
      likelihood: 2, impact: 2,
    });
    expect(items.find((r) => r.code === 'FIN-03')).toMatchObject({ likelihood: 2, impact: 2, identified: true, source: 'DATA_TABLE' });
  });

  it('hiányzó tételt a sablonból vesz fel (típus-tétel)', () => {
    const items = applyIntakeSuggestion(base, {
      key: 'k', origin: 'CHECKLIST', code: 'SUC-01', pillar: 'LEGAL', title: '', rationale: '', evidence: 'e',
      likelihood: 3, impact: 4,
    });
    expect(items).toHaveLength(base.length + 1);
    expect(items[0]).toMatchObject({ code: 'SUC-01', identified: true, likelihood: 3, impact: 4 });
  });

  it('a képlet paraméterét a tényadat váltja, a szakértői felülírás marad', () => {
    const withOverride = base.map((r) => (r.code === 'LEG-01' ? { ...r, valuation: { ...r.valuation!, overrideHuf: 99 } } : r));
    const items = applyIntakeSuggestion(withOverride, {
      key: 'k', origin: 'CHECKLIST', code: 'LEG-01', pillar: 'LEGAL', title: '', rationale: '', evidence: 'e',
      likelihood: 3, impact: 5, valuationPatch: { type: 'REVENUE_SHARE', share: 0.2 },
    });
    const v = items.find((r) => r.code === 'LEG-01')!.valuation!;
    expect(v.formula).toMatchObject({ share: 0.2 });
    expect(v.overrideHuf).toBe(99);
  });

  it('ismeretlen kód nélkül új egyedi tétel', () => {
    const items = applyIntakeSuggestion(base, {
      key: 'k', origin: 'CHECKLIST', code: null, pillar: 'LEGAL', title: 'Per', rationale: 'r', evidence: 'e',
      likelihood: 3, impact: 4,
    });
    expect(items[0]).toMatchObject({ code: 'CUS-01', title: 'Per', source: 'CHECKLIST' });
  });
});

describe('táblázat beolvasás', () => {
  it('magyar és angol számformátum', () => {
    expect(parseNumber('1 234 567,89')).toBeCloseTo(1234567.89);
    expect(parseNumber('1.234.567')).toBe(1234567);
    expect(parseNumber('1,234,567.5')).toBe(1234567.5);
    expect(parseNumber('12,5%')).toBe(12.5);
    expect(parseNumber('-3 000 Ft')).toBe(-3000);
    expect(parseNumber('(3 000)')).toBe(-3000);
    expect(parseNumber('abc')).toBeNull();
  });

  it('dátumformátumok és Excel-sorszám', () => {
    const d = isoToDay('2026-03-15');
    expect(parseDay('2026.03.15.')).toBe(d);
    expect(parseDay('2026. 03. 15.')).toBe(d);
    expect(parseDay('15.03.2026')).toBe(d);
    expect(parseDay(46096)).toBe(d); // Excel: 2026-03-15
  });

  it('Windows-1250 CSV (magyar Excel-mentés)', () => {
    const bytes = new Uint8Array([0x56, 0x65, 0x76, 0xf5, 0x3b, 0xd6, 0x73, 0x73, 0x7a, 0x65, 0x67]); // "Vevő;Összeg"
    expect(decodeText(bytes)).toBe('Vevő;Összeg');
  });

  it('CSV idézőjelekkel és pontosvesszővel', () => {
    expect(parseCsv('a;b\n"x; y";"he said ""hi"""\n')).toEqual([['a', 'b'], ['x; y', 'he said "hi"']]);
  });

  it('XLSX: megosztott szöveg, szám, üres cella', () => {
    const sheet = `<worksheet><sheetData>
      <row r="1"><c r="A1" t="s"><v>0</v></c><c r="C1" t="s"><v>1</v></c></row>
      <row r="2"><c r="A2" t="inlineStr"><is><t>Példa &amp; Társa Kft.</t></is></c><c r="C2"><v>1500000</v></c></row>
    </sheetData></worksheet>`;
    const bytes = zipSync({
      'xl/sharedStrings.xml': strToU8('<sst><si><t>Vevő</t></si><si><r><t>Nettó </t></r><r><t>árbevétel</t></r></si></sst>'),
      'xl/worksheets/sheet1.xml': strToU8(sheet),
    });
    expect(parseXlsx(bytes)).toEqual([['Vevő', null, 'Nettó árbevétel'], ['Példa & Társa Kft.', null, 1500000]]);
  });

  it('oszlopfelismerés és hiányzó oszlop jelzése', () => {
    const d = detectColumns('AR_AGING', [['Riport'], ['Vevő neve', 'Nyitott összeg (Ft)', 'Fizetési határidő']]);
    expect(d.headerRow).toBe(1);
    expect(d.mapping).toMatchObject({ partner: 0, amount: 1, dueDate: 2 });
    expect(missingColumns('AR_AGING', d.mapping)).toEqual([]);
    expect(missingColumns('AR_AGING', { partner: 0, amount: 1 })).toHaveLength(1);
  });
});

function runSample(kind: TableKind, scenarioId: string, salesTotalHuf?: number) {
  const sc = getScenario(scenarioId);
  const { fileName, csv } = sampleTableCsv(kind, sc);
  const grid = parseCsv(csv);
  const d = detectColumns(kind, grid);
  expect(missingColumns(kind, d.mapping), `${scenarioId} ${kind}`).toEqual([]);
  return analyzeTable({ kind, fileName, grid, headerRow: d.headerRow, mapping: d.mapping, refDay: isoToDay(SAMPLE_REF_DATE) }, { company: sc.company, salesTotalHuf });
}

describe('mutatók a mintatáblákból', () => {
  it('minden mintaeset minden táblája feldolgozható', () => {
    for (const sc of SCENARIOS) for (const k of TABLE_KINDS) expect(runSample(k, sc.id).rows).toBeGreaterThan(0);
  });

  it('építőipar: lejárt állomány egy vevőnél, DSO a cégadatokkal egyezik', () => {
    const a = runSample('AR_AGING', 'epitoipar');
    const fin03 = a.result.suggestions.find((s) => s.code === 'FIN-03')!;
    expect(fin03).toMatchObject({ likelihood: 4, impact: 4 });
    expect(fin03.rationale).toContain('egyetlen vevőnél');
    const dso = Number(a.metrics.find((m) => m.label.startsWith('DSO'))!.value.split(' ')[0]);
    expect(Math.abs(dso - 94)).toBeLessThanOrEqual(1);
  });

  it('vevőkoncentráció: az IT-cégnél 55% → OPS-05, a képlet aránya a tényadat', () => {
    const a = runSample('SALES_BY_CUSTOMER', 'it-fejleszto');
    const s = a.result.suggestions.find((x) => x.code === 'OPS-05')!;
    expect(s.impact).toBe(5);
    expect(s.valuationPatch).toEqual({ type: 'REVENUE_SHARE', share: 0.55 });
    expect(a.totalHuf).toBeCloseTo(2_100_000_000, -3);
  });

  it('kapcsolt ügyletek: 50 M Ft feletti, nyilvántartás nélküli ügyletek száma', () => {
    const a = runSample('RELATED_PARTY', 'gyarto');
    expect(a.result.suggestions[0]).toMatchObject({ code: 'FIN-01', valuationPatch: { type: 'PER_ITEM', count: 4 } });
  });

  it('beszállítói koncentráció csak 40% felett', () => {
    expect(runSample('PURCHASES_BY_SUPPLIER', 'gyarto').result.suggestions[0]?.code).toBe('OPS-01');
    expect(runSample('PURCHASES_BY_SUPPLIER', 'konyvelo').result.suggestions).toHaveLength(0);
  });

  it('a DSO-javaslat a vevőnkénti árbevétellel számol, ha az is megvan', () => {
    const withSales = runSample('AR_AGING', 'gyarto', 4_800_000_000);
    const s = withSales.result.companySuggestions.find((c) => c.field === 'actualDsoDays')!;
    expect(s.value).toBe(36);
    const company = applyCompanySuggestion(getScenario('gyarto').company, s);
    expect(company.actualDsoDays).toBe(36);
  });

  it('a mátrix újraszámol: az elfogadott táblajavaslat a kitettséget is módosítja', () => {
    const sc = getScenario('it-fejleszto');
    const s = runSample('SALES_BY_CUSTOMER', 'it-fejleszto').result.suggestions[0];
    const before = assess(sc.items, { company: sc.company });
    const after = assess(applyIntakeSuggestion(sc.items, s, sc.company), { company: sc.company });
    expect(after.totals.grossExposureHuf).toBeGreaterThan(before.totals.grossExposureHuf);
  });
});

import { documentToIntake } from './documents/toIntake';
import { chunkText, docxToText } from './documents/extract';
import { redactText } from './documents/redact';
import { findQuoteInPages } from './documents/verify';
import { SAMPLE_DOCUMENTS, sampleDocumentRecord } from './samples/documents';

describe('dokumentumok', () => {
  it('maszkolja a személyes azonosítókat', () => {
    const counts: Record<string, number> = {};
    const t = redactText('tel.: +36 30 123 4567, e-mail: a.b@pelda.example, adóazonosító: 8123456789, számla: 11700000-22222222', counts);
    expect(t).toBe('tel.: [telefon], e-mail: [e-mail], adóazonosító: [adóazonosító], számla: [bankszámla]');
    expect(counts).toMatchObject({ telefon: 1, 'e-mail': 1, 'adóazonosító jel': 1, bankszámla: 1 });
  });

  it('idézet keresése oldalhatáron át, oldalszámmal', () => {
    const pages = [{ label: '1. oldal', text: 'Első oldal vége: a szerződés' }, { label: '2. oldal', text: 'azonnali hatállyal felmondható.' }];
    expect(findQuoteInPages(pages, 'a szerződés azonnali hatállyal')).toBe(0);
    expect(findQuoteInPages(pages, 'azonnali hatállyal felmondható')).toBe(1);
    expect(findQuoteInPages(pages, 'ilyen szöveg nincs benne sehol')).toBeNull();
  });

  it('Word-szöveg kinyerése és szakaszolás', () => {
    const xml = '<w:document><w:body><w:p><w:r><w:t>Első &amp; bekezdés</w:t></w:r></w:p><w:p><w:r><w:t xml:space="preserve">Második </w:t></w:r><w:r><w:t>sor</w:t></w:r></w:p></w:body></w:document>';
    const bytes = zipSync({ 'word/document.xml': strToU8(xml) });
    expect(docxToText(bytes)).toBe('Első & bekezdés\nMásodik sor');
    expect(chunkText('a'.repeat(3000) + '\n' + 'b'.repeat(3000))).toHaveLength(2);
  });

  it('mintadokumentumok: a kitalált idézet kiesik, a többi oldalszámmal megmarad', () => {
    for (const [id, docs] of Object.entries(SAMPLE_DOCUMENTS)) {
      docs.forEach((d, i) => {
        const rec = sampleDocumentRecord(d, `${id}-${i}`);
        expect(rec.analysis.findings.length, d.fileName).toBeGreaterThan(0);
        expect(rec.analysis.findings.every((f) => f.pageIndex != null)).toBe(true);
        expect(rec.analysis.facts.length, d.fileName).toBe(d.analysis.facts.length);
        const expectedDiscard = d.analysis.findings.filter((f) => f.title === 'Engedményezési tilalom').length;
        expect(rec.analysis.discardedUnverified, d.fileName).toBe(expectedDiscard);
      });
    }
    const keret = sampleDocumentRecord(SAMPLE_DOCUMENTS.gyarto[0], 'k');
    expect(keret.redactions).toMatchObject({ telefon: 2, 'e-mail': 2 });
    const intake = documentToIntake(keret);
    expect(intake.suggestions[0].evidence).toContain('2. oldal');
    expect(intake.facts.every((f) => f.askInInterview !== false)).toBe(true);
  });
});

import { SECTOR_QUESTIONS } from './checklist';
import { missingSectorRisks, SECTOR_RISKS } from '@/lib/risk/sectorRisks';
import { buildRequestList } from './requests';

describe('ágazati katalógus', () => {
  it('minden ágazati kérdés szabálya létező tételre mutat, és kódja egyedi', () => {
    const codes = new Set(Object.values(SECTOR_RISKS).flat().map((r) => r.code));
    expect(codes.size).toBe(Object.values(SECTOR_RISKS).flat().length);
    for (const q of SECTOR_QUESTIONS) {
      expect(q.sectors?.length, q.id).toBeGreaterThan(0);
      for (const r of q.rules) expect(templateFor(r.code!), `${q.id} ${r.code}`).toBeDefined();
    }
  });

  it('ágazati kérdés csak a kiválasztott ágazatnál látszik és számít', () => {
    const qk1 = SECTOR_QUESTIONS.find((q) => q.id === 'QK1')!;
    expect(isVisible(qk1, {}, [])).toBe(false);
    expect(isVisible(qk1, {}, ['ACCOUNTING'])).toBe(true);
    expect(evaluateChecklist({ QK1: 10 }, 'SUCCESSION').suggestions).toHaveLength(0);
    const s = evaluateChecklist({ QK1: 10 }, 'SUCCESSION', ['ACCOUNTING']).suggestions;
    expect(s.map((x) => x.code)).toEqual(['KON-01']); // 50 M Ft alatti limit
  });

  it('több ágazat egyszerre: mindkettő kérdései és tételei', () => {
    const sectors = ['MANUFACTURING', 'TRADE'] as const;
    const visible = SECTOR_QUESTIONS.filter((q) => isVisible(q, {}, [...sectors])).map((q) => q.id);
    expect(visible.some((id) => id.startsWith('QG'))).toBe(true);
    expect(visible.some((id) => id.startsWith('QR'))).toBe(true);
    const add = missingSectorRisks([...sectors], DEFAULT_CATALOG);
    expect(add.map((r) => r.code)).toEqual(expect.arrayContaining(['GYA-01', 'KER-01']));
    expect(add.every((r) => !r.identified)).toBe(true);
    // ágazati iratok is mindkettőből
    const titles = buildRequestList({ sectors: [...sectors], headcount: null, flags: [], narrative: '' }, 'HEALTH_CHECK').map((d) => d.id);
    expect(titles).toEqual(expect.arrayContaining(['S12', 'S16']));
  });

  it('a már listában lévő ágazati tételt nem veszi fel újra', () => {
    const sc = getScenario('epitoipar');
    expect(missingSectorRisks(['CONSTRUCTION'], sc.items)).toHaveLength(0);
  });

  it('a mintacégek ágazati kérdései is ki vannak töltve', () => {
    for (const sc of SCENARIOS) {
      const p = checklistProgress(SAMPLE_ANSWERS[sc.id], sc.sectors ?? []);
      expect(p.answered, sc.id).toBe(p.total);
    }
  });
});
