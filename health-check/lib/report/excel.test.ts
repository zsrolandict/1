import { describe, expect, it } from 'vitest';
import { strFromU8, unzipSync, zipSync } from 'fflate';
import { adjustmentsFor } from '@/lib/engagement/adjustments';
import { ENGAGEMENT_KINDS } from '@/lib/engagement/kinds';
import { parseXlsx } from '@/lib/intake/tables/parse';
import { assess } from '@/lib/risk/engine';
import { getScenario } from '@/lib/scenarios';
import { buildWorkbook, exportExcel } from './excelExport';
import { writeXlsx } from './xlsx';

const sc = getScenario('konyvelo');
const assessment = assess(sc.items, {
  company: sc.company,
  materialityHuf: sc.materialityHuf,
  adjustments: adjustmentsFor(sc.kind),
  pillarWeights: ENGAGEMENT_KINDS[sc.kind].weights,
});
const input = { companyName: sc.companyName, kind: sc.kind, company: sc.company, materialityHuf: sc.materialityHuf, assessment, generatedAt: '2026-09-28T10:00:00Z' };

/** Az n. munkalap beolvasása a saját XLSX-olvasóval (az csak az elsőt olvassa, ezért átcsomagoljuk). */
function readSheet(bytes: Uint8Array, n: number) {
  const files = unzipSync(bytes);
  return parseXlsx(zipSync({ 'xl/worksheets/sheet1.xml': files[`xl/worksheets/sheet${n}.xml`] }));
}

describe('Excel-export', () => {
  it('öt munkalap, magyar nevekkel', () => {
    const files = unzipSync(exportExcel(input));
    const wb = strFromU8(files['xl/workbook.xml']);
    for (const n of ['Összefoglaló', 'Kockázatok', 'Akcióterv', 'Ajánlat', 'Pillérek']) expect(wb).toContain(`name="${n}"`);
    expect(files['xl/styles.xml']).toBeDefined();
  });

  it('a kockázatok munkalap ugyanazokat a számokat tartalmazza, mint az értékelés', () => {
    const grid = readSheet(exportExcel(input), 2);
    expect(grid[0].slice(0, 4)).toEqual(['Kód', 'Pillér', 'Tétel', 'Besorolás']);
    expect(grid).toHaveLength(assessment.risks.length + 1);
    const first = assessment.risks[0];
    const row = grid.find((r) => r[0] === first.code)!;
    expect(row[6]).toBe(first.score);
    expect(row[10]).toBe(first.expectedLossHuf);
  });

  it('az összefoglaló a fő mutatókat olvasható formában adja', () => {
    const grid = readSheet(exportExcel(input), 1);
    const get = (label: string) => grid.find((r) => r[0] === label)?.[1];
    expect(get('Cég')).toBe(sc.companyName);
    expect(get('Health Score (0–100)')).toBe(assessment.totals.healthScore);
    expect(String(get('Várható veszteség'))).toMatch(/Ft$/);
  });

  it('az akcióterv minden azonosított tételt tartalmaz', () => {
    const plan = buildWorkbook(input).find((s) => s.name === 'Akcióterv')!;
    expect(plan.rows).toHaveLength(assessment.totals.identified);
  });

  it('különleges karakterek és hosszú munkalapnév biztonságosan', () => {
    const bytes = writeXlsx([{ name: 'Nagyon hosszú munkalapnév: [próba] / 2026 szeptember', columns: [{ header: 'A&B <x>' }], rows: [['„idézet” & <tag> \u0007']] }]);
    const files = unzipSync(bytes);
    expect(strFromU8(files['xl/workbook.xml'])).toMatch(/name="[^"]{1,31}"/);
    expect(readSheet(bytes, 1)).toEqual([['A&B <x>'], ['„idézet” & <tag> ']]);
  });
});
