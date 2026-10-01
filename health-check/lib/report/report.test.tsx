import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { renderToBuffer } from '@react-pdf/renderer';
import { describe, expect, it } from 'vitest';
import { DEFAULT_CATALOG } from '@/lib/risk/catalog';
import { assess } from '@/lib/risk/engine';
import { DEFAULT_COMPANY } from '@/lib/risk/valuation';
import { registerReportFonts } from './fonts';
import { buildReportModel, firstSentence } from './model';
import { ReportDocument } from './ReportDocument';

registerReportFonts(path.resolve(import.meta.dirname, '../../public/fonts'));

const input = {
  companyName: 'Minta Gyártó Kft.',
  kind: 'VENDOR_DD' as const,
  company: DEFAULT_COMPANY,
  materialityHuf: 50_000_000,
  assessment: assess(DEFAULT_CATALOG, { company: DEFAULT_COMPANY }),
  generatedAt: '2026-09-27T10:00:00.000Z',
};

describe('buildReportModel', () => {
  it('top 3 csak piros/sárga, prioritás szerint', () => {
    const m = buildReportModel(input);
    expect(m.topFindings).toHaveLength(3);
    expect(m.topFindings.every((r) => r.rag !== 'GREEN')).toBe(true);
    expect(m.kindLabel).toContain('Vendor');
  });

  it('jelzi a nem jóváhagyott szakértői paraméterre épülő tételt', () => {
    const m = buildReportModel(input);
    expect(m.unapprovedParameterRisks.map((r) => r.code)).toEqual(['FIN-01']);
  });

  it('firstSentence', () => {
    expect(firstSentence('Első mondat. Második.')).toBe('Első mondat.');
    expect(firstSentence(undefined)).toBe('');
  });
});

describe('PDF', () => {
  it('legenerálja a riportot', async () => {
    const buf = await renderToBuffer(<ReportDocument model={buildReportModel(input)} />);
    expect(buf.subarray(0, 5).toString()).toBe('%PDF-');
    const pages = (buf.toString('latin1').match(/\/Type \/Page\b/g) ?? []).length;
    expect(pages).toBeGreaterThanOrEqual(5);
    expect(pages).toBeLessThanOrEqual(7);
    if (process.env.REPORT_OUT) writeFileSync(process.env.REPORT_OUT, buf);
  }, 30_000);
});

describe('bizonyítéktár és vizsgálati terjedelem', () => {
  const items = DEFAULT_CATALOG.map((r) =>
    r.code === 'LEG-01'
      ? {
          ...r,
          trail: [
            {
              id: 'e1',
              kind: 'AI_DOCUMENT' as const,
              actor: 'AI' as const,
              ref: 'Keretszerzodes.pdf, 2. oldal',
              quote: 'azonnali hatállyal felmondhatja',
              acceptedBy: 'Kiss Anna',
              at: '2026-09-30T10:00:00Z',
            },
          ],
          history: [{ at: '2026-09-30T11:00:00Z', by: 'B', field: 'likelihood' as const, from: '4', to: '3', reduces: true }],
        }
      : r,
  );
  const scope = {
    requests: [
      { title: 'Beszámolók', status: 'RECEIVED' as const, statusLabel: 'Beérkezett', required: true },
      { title: 'Hitelszerződések', status: 'MISSING' as const, statusLabel: 'Hiányzik', required: true },
    ],
    documents: [{ fileName: 'Keretszerzodes.pdf', type: 'Vevői szerződés' }],
    tables: [],
    interviews: [{ who: 'Ügyvezető', heldAt: '2026-09-20', analyzed: true }],
    financialYears: [2025, 2024],
    checklist: { answered: 20, total: 26 },
  };
  const full = { ...input, assessment: assess(items, { company: DEFAULT_COMPANY }), scope };

  it('a modell tartalmazza a forrásokat és az indoklás nélküli csökkentést', () => {
    const m = buildReportModel(full);
    expect(m.evidenceBook.find((e) => e.risk.code === 'LEG-01')!.entries[0].ref).toContain('2. oldal');
    expect(m.unexplained.map((u) => u.risk.code)).toEqual(['LEG-01']);
  });

  it('a PDF két új oldallal bővül', async () => {
    const buf = await renderToBuffer(<ReportDocument model={buildReportModel(full)} />);
    const pages = (buf.toString('latin1').match(/\/Type \/Page\b/g) ?? []).length;
    expect(pages).toBeGreaterThanOrEqual(7);
    expect(pages).toBeLessThanOrEqual(10);
  }, 30_000);
});
