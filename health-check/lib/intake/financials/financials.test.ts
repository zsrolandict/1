import { describe, expect, it } from 'vitest';
import { DEFAULT_COMPANY } from '@/lib/risk/valuation';
import { sampleDocumentRecord, SAMPLE_DOCUMENTS } from '../samples/documents';
import { verifyDocumentAnalysis } from '../documents/verify';
import { redactText } from '../documents/redact';
import { acceptPending, markReceived, pendingExtractions, rejectPending, requestsFor } from './approve';
import { factValue, statedToHuf } from './extract';
import { EMPTY_FINANCIALS, normalizeFinancials, setFact, setYearValue, yearRatios, type FinancialProfile } from './model';
import { financialFindings } from './rules';

const src = { kind: 'MANUAL' as const, ref: 'Kézi bevitel', at: '2026-10-01T00:00:00Z' };
const ctx = { kind: 'VENDOR_DD' as const, company: DEFAULT_COMPANY, materialityHuf: 50_000_000, refDate: new Date('2026-10-01') };

function profile(): FinancialProfile {
  let f = EMPTY_FINANCIALS;
  const set = (year: number, vals: Record<string, number>) => {
    for (const [k, v] of Object.entries(vals)) f = setYearValue(f, year, k as never, v, src);
  };
  set(2025, {
    revenue: 3_800e6,
    materialCosts: 2_900e6,
    personnelCosts: 400e6,
    operatingProfit: -30e6,
    depreciation: 60e6,
    equity: 40e6,
    shareCapital: 50e6,
    currentAssets: 1_400e6,
    shortTermLiabilities: 1_500e6,
    longTermLiabilities: 400e6,
    cash: 50e6,
    receivables: 980e6,
  });
  set(2024, { revenue: 5_000e6, operatingProfit: 250e6, depreciation: 58e6, equity: 45e6, shareCapital: 50e6, receivables: 1_000e6 });
  return f;
}

describe('kiolvasás értelmezése', () => {
  it('ezer forint, zárójeles negatív, magyar tagolás', () => {
    expect(statedToHuf('2 104 350', 'THOUSAND_HUF')).toBe(2_104_350_000);
    expect(statedToHuf('(30 900)', 'THOUSAND_HUF')).toBe(-30_900_000);
    expect(statedToHuf('–12 400', 'HUF')).toBe(-12_400);
  });

  it('tények a mező típusa szerint', () => {
    expect(factValue('auditOpinion', 'Minősített vélemény')).toBe('QUALIFIED');
    expect(factValue('auditOpinion', 'véleménynyilvánítás visszautasítása')).toBe('DISCLAIMER');
    expect(factValue('goingConcern', 'nem')).toBe(false);
    expect(factValue('grantSustainUntil', '2027.12.31')).toBe('2027-12-31');
    expect(factValue('contingentHuf', '650 000', 'THOUSAND_HUF')).toBe(650_000_000);
    expect(factValue('turnoverPct', '23%')).toBeCloseTo(0.23);
  });

  it('maszkolás: a beszámoló számoszlopai maradnak, a valódi TAJ-szám nem', () => {
    expect(redactText('Követelések 475 900 451 300')).toBe('Követelések 475 900 451 300');
    expect(redactText('TAJ: 123 456 789.')).toBe('TAJ: [TAJ].');
  });

  it('a számnak szerepelnie kell az idézetben, az idézetnek az iratban', () => {
    const pages = [{ label: '1. oldal', text: 'Értékesítés nettó árbevétele 1 954 220 2 104 350' }];
    const out = verifyDocumentAnalysis(
      {
        documentType: 'x',
        summary: '',
        findings: [],
        facts: [],
        missingProvisions: [],
        financials: {
          unit: 'THOUSAND_HUF',
          values: [
            {
              field: 'revenue',
              year: 2025,
              valueHuf: 2_104_350_000,
              stated: '2 104 350',
              quote: 'Értékesítés nettó árbevétele 1 954 220 2 104 350',
              pageIndex: null,
            },
            { field: 'revenue', year: 2023, valueHuf: 9e9, stated: '9 000 000', quote: 'Értékesítés nettó árbevétele 1 954 220 2 104 350', pageIndex: null },
            { field: 'cash', year: 2025, valueHuf: 1e6, stated: '1 000', quote: 'Pénzeszközök 1 000 kitalált sor', pageIndex: null },
          ],
          facts: [],
        },
      },
      pages,
    );
    expect(out.financials!.values.map((v) => v.year)).toEqual([2025]);
    expect(out.discardedUnverified).toBe(2);
  });
});

describe('minta beszámoló-csomag', () => {
  it('minden kiolvasott érték átmegy az ellenőrzésen', () => {
    for (const [id, docs] of Object.entries(SAMPLE_DOCUMENTS)) {
      for (const d of docs.filter((x) => x.analysis.financials)) {
        const rec = sampleDocumentRecord(d, `${id}-${d.fileName}`);
        expect(rec.analysis.discardedUnverified, `${id} ${d.fileName}`).toBe(0);
        expect(rec.analysis.financials!.values.length + rec.analysis.financials!.facts.length).toBe(
          d.analysis.financials!.values.length + d.analysis.financials!.facts.length,
        );
      }
    }
  });

  it('jóváhagyás: forrás az irat oldallal és idézettel; elvetett nem jön vissza', () => {
    const doc = sampleDocumentRecord(
      SAMPLE_DOCUMENTS.epitoipar.find((d) => d.analysis.docType === 'FIN_STATEMENT')!,
      'D1',
    );
    let f = EMPTY_FINANCIALS;
    const pending = pendingExtractions([doc], f);
    expect(pending.length).toBeGreaterThan(20);
    const rev = pending.find((p) => p.kind === 'value' && p.field === 'revenue' && p.year === 2025)!;
    f = acceptPending(f, rev, 'Kiss Anna');
    expect(f.years[0].values.revenue).toBe(3_812_600_000);
    expect(f.years[0].sources.revenue).toMatchObject({ kind: 'DOCUMENT', docId: 'D1', ref: expect.stringContaining('1. oldal'), by: 'Kiss Anna' });
    expect(pendingExtractions([doc], f).some((p) => p.key === rev.key)).toBe(false);
    const other = pendingExtractions([doc], f)[0];
    f = rejectPending(f, other);
    expect(pendingExtractions([doc], f).some((p) => p.key === other.key)).toBe(false);
    expect(requestsFor(doc)).toEqual(['B03']);
  });

  it('feltöltéskor a bekérési tétel beérkezett lesz, a „nem releváns” marad', () => {
    expect(markReceived({ B03: 'MISSING', B09: 'NA' }, ['B03', 'B09', 'B10'])).toEqual({ B03: 'RECEIVED', B09: 'NA', B10: 'RECEIVED' });
  });
});

describe('szabályok', () => {
  it('tőkevesztés, árbevétel-esés, EBITDA, likviditás, eladósodottság', () => {
    const r = financialFindings(profile(), ctx);
    const codes = r.suggestions.map((s) => s.code);
    expect(codes).toEqual(expect.arrayContaining(['PA-03', 'PA-04', 'PA-05', 'PA-07', 'PA-06']));
    const pa03 = r.suggestions.find((s) => s.code === 'PA-03')!;
    expect(pa03.rationale).toContain('jogász');
    expect(pa03.ref).toContain('2025. év, Saját tőke');
    expect(pa03.link).toEqual({ page: 'adatok', tab: 'financials', anchor: 'fin-figures' });
  });

  it('könyvvizsgálói vélemény és folytatási bizonytalanság', () => {
    let f = setFact(EMPTY_FINANCIALS, 'auditOpinion', 'QUALIFIED', src);
    f = setFact(f, 'goingConcern', true, src);
    const codes = financialFindings(f, ctx).suggestions.map((s) => [s.code, s.likelihood * s.impact]);
    expect(codes).toEqual(
      expect.arrayContaining([
        ['PA-01', 20],
        ['PA-02', 25],
      ]),
    );
  });

  it('támogatás tulajdonosváltási hozzájárulással tranzakciónál erősebb', () => {
    let f = setFact(EMPTY_FINANCIALS, 'grantHuf', 180e6, src);
    f = setFact(f, 'grantSustainUntil', '2027-12-31', src);
    f = setFact(f, 'grantOwnerChangeConsent', true, src);
    const s = financialFindings(f, ctx).suggestions.find((x) => x.code === 'PA-12')!;
    expect(s.likelihood).toBe(4);
    expect(s.exposureHufEstimate).toBe(180e6);
    expect(financialFindings(f, { ...ctx, kind: 'HEALTH_CHECK' }).suggestions.find((x) => x.code === 'PA-12')!.likelihood).toBe(3);
  });

  it('keresztellenőrzés a vevőnkénti árbevétel táblával és cégadat-javaslat', () => {
    const tables = { SALES_BY_CUSTOMER: { totalHuf: 3_000e6, fileName: 'vevok.xlsx' } } as never;
    const r = financialFindings(profile(), { ...ctx, tables });
    expect(r.suggestions.some((s) => s.code === 'PA-20')).toBe(true);
    expect(r.companySuggestions.map((c) => c.field)).toEqual(expect.arrayContaining(['revenueHuf', 'actualDsoDays']));
  });

  it('mutatók: EBITDA, likviditás, változás', () => {
    const [cur] = yearRatios(profile());
    expect(cur.ebitda).toBe(30e6);
    expect(cur.currentRatio).toBeCloseTo(0.933, 2);
    expect(cur.revenueChange).toBeCloseTo(-0.24, 2);
  });

  it('sérült mentés normalizálása', () => {
    expect(normalizeFinancials({ years: [{ year: NaN } as never], facts: null as never })).toEqual(EMPTY_FINANCIALS);
  });
});
