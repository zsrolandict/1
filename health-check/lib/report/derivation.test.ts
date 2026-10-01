import { describe, expect, it } from 'vitest';
import { strFromU8, unzipSync } from 'fflate';
import { HyperFormula } from 'hyperformula';
import { adjustmentsFor } from '@/lib/engagement/adjustments';
import { ENGAGEMENT_KINDS } from '@/lib/engagement/kinds';
import { assess } from '@/lib/risk/engine';
import type { RiskItem } from '@/lib/risk/types';
import { getScenario, SCENARIOS } from '@/lib/scenarios';
import { buildDerivationWorkbook, exportDerivation } from './derivationWorkbook';
import type { CellObj, Sheet } from './xlsx';

/** A munkafüzet képleteinek kiértékelése táblázatkezelő-motorral (mint az Excel megnyitáskor). */
function evaluate(sheets: Sheet[], edit?: (sheets: Sheet[]) => void) {
  const copy: Sheet[] = JSON.parse(JSON.stringify(sheets));
  edit?.(copy);
  const data = Object.fromEntries(
    copy.map((s) => [
      s.name,
      [
        s.columns.map((c) => c.header),
        ...s.rows.map((row) =>
          row.map((v) => {
            if (v != null && typeof v === 'object') return (v as CellObj).f ? `=${(v as CellObj).f}` : ((v as CellObj).v ?? null);
            return v ?? null;
          }),
        ),
      ],
    ]),
  );
  const hf = HyperFormula.buildFromSheets(data, { licenseKey: 'gpl-v3', useArrayArithmetic: true });
  const get = (sheet: string, row: number, col: number) => hf.getCellValue({ sheet: hf.getSheetId(sheet)!, row, col });
  return { get, sheets: copy };
}

function setup(id: string, change?: (items: RiskItem[]) => RiskItem[]) {
  const sc = getScenario(id);
  const items = change ? change(sc.items) : sc.items;
  const opts = {
    company: sc.company,
    materialityHuf: sc.materialityHuf,
    adjustments: adjustmentsFor(sc.kind),
    pillarWeights: ENGAGEMENT_KINDS[sc.kind].weights,
  };
  const input = { companyName: sc.companyName, kind: sc.kind, company: sc.company, materialityHuf: sc.materialityHuf, assessment: assess(items, opts) };
  return { sc, items, input, opts };
}

describe('levezetés-munkafüzet', () => {
  it('minden képlet ugyanazt adja, mint a program (minden bemutató cégnél)', () => {
    for (const sc of SCENARIOS.filter((s) => s.items.length)) {
      const { items, input } = setup(sc.id);
      const sheets = buildDerivationWorkbook(input, items);
      const { get } = evaluate(sheets);
      let checked = 0;
      for (const s of sheets.filter((x) => ['Levezetés', 'Pillérek'].includes(x.name))) {
        s.rows.forEach((row, r) =>
          row.forEach((cell, c) => {
            if (cell == null || typeof cell !== 'object' || !(cell as CellObj).f) return;
            const want = (cell as CellObj).v;
            const got = get(s.name, r + 1, c);
            if (typeof want === 'number') expect(got as number, `${sc.id} ${s.name} ${r + 2}:${c}`).toBeCloseTo(want, 3);
            else expect(got ?? '', `${sc.id} ${s.name} ${r + 2}:${c}`).toBe(want ?? '');
            checked++;
          }),
        );
      }
      expect(checked).toBeGreaterThan(100);
    }
  });

  it('mi lenne, ha: egy tétel kivétele a munkafüzetben = ugyanaz, mint a programban', () => {
    const { items, input } = setup('it-fejleszto');
    const target = items.findIndex((r) => r.identified);
    const sheets = buildDerivationWorkbook(input, items);
    const { get } = evaluate(sheets, (s) => {
      const lev = s.find((x) => x.name === 'Levezetés')!;
      (lev.rows[target][3] as CellObj).v = 0;
    });
    const after = setup('it-fejleszto', (xs) => xs.map((r, i) => (i === target ? { ...r, identified: false } : r)));
    const totalRow = 5; // fejléc + 4 pillér után
    expect(get('Pillérek', totalRow, 5)).toBe(after.input.assessment.totals.healthScore);
  });

  it('az árbevétel átírása a képletes kitettségeken átfut', () => {
    const { items, input, opts } = setup('it-fejleszto');
    const sheets = buildDerivationWorkbook(input, items);
    const { get } = evaluate(sheets, (s) => {
      const par = s.find((x) => x.name === 'Paraméterek')!;
      (par.rows[10][1] as CellObj).v = 4_200_000_000; // 12. sor: árbevétel
    });
    const after = assess(items, { ...opts, company: { ...opts.company, revenueHuf: 4_200_000_000 } });
    expect(get('Pillérek', 5, 7)).toBe(after.totals.grossExposureHuf);
  });

  it('vélemények munkalap: a vélemény, az ítélet, az elvetett elemek és a döntés', () => {
    const { input } = setup('it-fejleszto');
    const items = getScenario('it-fejleszto').items.map((r, i) =>
      i === 0
        ? {
            ...r,
            discussion: [
              { id: 'o1', at: '2026-10-01T10:00:00.000Z', by: 'Teszt Elek', role: 'EXPERT' as const, text: 'Túlzó.' },
              {
                id: 'a1',
                at: '2026-10-01T10:00:05.000Z',
                by: null,
                role: 'AI' as const,
                text: 'Forrás nélkül nem enyhíthető.',
                review: {
                  verdict: 'NEED_EVIDENCE' as const,
                  reasoning: 'Forrás nélkül nem enyhíthető.',
                  counterpoints: ['A katalógus-alapérték óvatos.'],
                  evidenceNeeded: ['Aláírt szerződés'],
                  proposal: { likelihood: 2 as const },
                  citations: [],
                  discarded: ['A súlyosságot csökkentő javaslatot a program elvetette.'],
                  basis: { likelihood: 4, impact: 4, exposureHuf: 1 },
                },
                decision: { kind: 'REJECTED' as const, by: 'Teszt Elek', at: '2026-10-01T10:01:00.000Z' },
              },
            ],
          }
        : r,
    );
    const op = buildDerivationWorkbook(input, items).find((s) => s.name === 'Vélemények')!;
    expect(op.rows).toHaveLength(2);
    expect(op.rows[1].join(' ')).toContain('Bizonyíték kell');
    expect(op.rows[1].join(' ')).toContain('valószínűség 4 → 2');
    expect(op.rows[1].join(' ')).toContain('Elvetve (Teszt Elek');
    expect(buildDerivationWorkbook(input, getScenario('it-fejleszto').items).some((s) => s.name === 'Vélemények')).toBe(false);
  });

  it('valódi XLSX: képletek, újraszámolás megnyitáskor, sárga bemenetek', () => {
    const { items, input } = setup('konyvelo');
    const files = unzipSync(exportDerivation(input, items));
    expect(strFromU8(files['xl/workbook.xml'])).toContain('fullCalcOnLoad="1"');
    const lev = strFromU8(files['xl/worksheets/sheet2.xml']);
    expect(lev).toContain('<f>I2*J2</f>');
    expect(strFromU8(files['xl/styles.xml'])).toContain('FFFEF3C7');
  });
});
