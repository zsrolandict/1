import { describe, expect, it } from 'vitest';
import writeExcelFile from 'write-excel-file/node';
import JSZip from 'jszip';
import { findDemo } from './demos';
import { calculateSavings } from './engine';
import { calculateExposure } from './exposure';
import { compareScenarios } from './scenarios';
import { scoreAudit } from './scoring';
import { buildWorkbook } from './workbook';

async function build(demoId: string) {
  const a = findDemo(demoId)!.build();
  const savings = calculateSavings(a.client, a.costs, a.params, a.software);
  const sheets = buildWorkbook({
    assessment: a,
    savings,
    audit: scoreAudit(a.audit, a.client.industry),
    exposure: calculateExposure(a.software, a.client, a.params.hipaRate),
    scenarios: compareScenarios(a).rows,
  });
  const buffer = await writeExcelFile(sheets).toBuffer();
  return { sheets, zip: await JSZip.loadAsync(buffer), savings };
}

describe('Excel export', () => {
  it('writes every sheet of a software case to a valid xlsx', async () => {
    const { sheets, zip } = await build('software-partial');
    expect(sheets.map((s) => s.sheet)).toEqual(['Összesítő', 'Levezetés', 'Szoftver', 'Audit', 'Forgatókönyvek', 'Szabálykönyv']);
    const workbook = await zip.file('xl/workbook.xml')!.async('string');
    expect(workbook).toContain('Levezetés');
  });

  it('puts live formulas on the derivation sheet that point at the right rows', async () => {
    const { zip } = await build('machinery');
    const xml = await zip.file('xl/worksheets/sheet2.xml')!.async('string');
    expect(xml).toContain('<f>ROUND(B3*C3,0)</f>');
    expect(xml).toMatch(/<f>SUM\(D3:D\d+\)<\/f>/);
  });

  it('sums the right rows on the summary sheet', async () => {
    const { zip, sheets } = await build('machinery');
    const xml = await zip.file('xl/worksheets/sheet1.xml')!.async('string');
    // Savings table starts in row 13: 4 R&D rows + the software row.
    expect(xml).toContain('<f>SUM(B13:B17)</f>');
    const row13 = sheets[0]!.data[12]!;
    expect((row13[0] as { value: string }).value).toContain('Tao');
  });

  it('keeps the formula result and the engine figure within rounding', () => {
    // Formula = ROUND(base × rate); engine rounds the same way per line.
    const a = findDemo('machinery')!.build();
    const s = calculateSavings(a.client, a.costs, a.params, a.software);
    expect(Math.round(s.corporateTax.deductibleBase * 0.09)).toBe(s.corporateTax.nominalSaving);
  });
});
