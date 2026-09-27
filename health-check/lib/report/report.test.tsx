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
