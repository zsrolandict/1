import { DIVISION_LABEL } from '@/lib/risk/catalog';
import { DIVISIONS } from '@/lib/risk/engine';
import type { RiskItem, ScoredRisk } from '@/lib/risk/types';
import { estimateRemediation } from '@/lib/remediation/estimate';
import { BILLING_RATES, ROLE_SHORT } from '@/lib/remediation/rates';
import type { CellValue, Sheet } from './xlsx';

/**
 * A levezetés-munkafüzet javítási díj munkalapjai, élő képletekkel:
 * Óradíjak (üzletág × szint) és Javítási díj (tételenként lépések: óra =
 * alapóra + egységenkénti óra × terjedelem; díj = óra × óradíj; sáv).
 * A sárga cellák átírhatók: terjedelem, órák, óradíjak, sávszorzók, kézi díj.
 */

const RATES = "'Óradíjak'";
const LEV = "'Levezetés'";
const ROLES = ['PARTNER', 'SENIOR', 'JUNIOR'] as const;

/**
 * @param items a Levezetés munkalap sorai (azonos sorrendben), a hivatkozásokhoz
 * @param scored az azonosított tételek értékelése (ezekhez készül terv)
 */
export function buildFeeSheets(items: RiskItem[], scored: ScoredRisk[]): Sheet[] {
  const rates: Sheet = {
    name: 'Óradíjak',
    columns: [
      { header: 'Üzletág', width: 18 },
      ...ROLES.map((r) => ({ header: ROLE_SHORT[r], width: 12, format: 'inputHuf' as const })),
      { header: 'Felelős', width: 18 },
      { header: 'Állapot', width: 16 },
    ],
    rows: DIVISIONS.map((d) => [
      DIVISION_LABEL[d],
      ...ROLES.map((r) => ({ v: BILLING_RATES[d].rates[r], fmt: 'inputHuf' as const })),
      BILLING_RATES[d].owner,
      BILLING_RATES[d].approved ? 'Jóváhagyva' : 'Kezdő javaslat',
    ]),
  };
  const lastRateRow = DIVISIONS.length + 1;
  const rateOf = (r: number) => `INDEX(${RATES}!$B$2:$D$${lastRateRow},MATCH(C${r},${RATES}!$A$2:$A$${lastRateRow},0),MATCH(D${r},${RATES}!$B$1:$D$1,0))`;

  const n = items.length + 1;
  const rows: CellValue[][] = [];
  for (const risk of scored) {
    const e = estimateRemediation(risk);
    const hdr = rows.length + 2;
    rows.push([
      risk.code,
      risk.title,
      null,
      null,
      null,
      null,
      e.driver ? { v: e.driver.value, fmt: 'inputDec' } : null,
      null,
      null,
      null,
      { v: e.spread[0], fmt: 'inputDec' },
      { v: e.spread[1], fmt: 'inputDec' },
      null,
      `Cél: ${e.goal}${e.driver ? ` Terjedelem (G): ${e.driver.label}, ${e.driver.unit}.` : ''}`,
    ]);
    const first = rows.length + 2;
    for (const st of e.steps) {
      const r = rows.length + 2;
      const tpl = !st.overridden;
      rows.push([
        risk.code,
        `${st.index + 1}. ${st.label}`,
        DIVISION_LABEL[st.division],
        ROLE_SHORT[st.role],
        { v: st.baseHours, fmt: 'inputDec' },
        { v: st.perUnit, fmt: 'inputDec' },
        e.driver ? { f: `G${hdr}`, v: e.driver.value, fmt: 'dec' } : null,
        tpl ? { f: e.driver ? `E${r}+F${r}*G${r}` : `E${r}`, v: st.hours, fmt: 'dec' } : { v: st.hours, fmt: 'inputDec' },
        { f: rateOf(r), v: st.rate, fmt: 'huf' },
        { f: `ROUND(H${r}*I${r},0)`, v: st.feeHuf, fmt: 'huf' },
        null,
        null,
        null,
        tpl ? st.detail : `Kézzel átírt óra (sablon: ${st.hoursFormula}). ${st.detail}`,
      ]);
    }
    const last = rows.length + 1;
    const t = rows.length + 2;
    const manual = e.source === 'MANUAL';
    const lead = `IFERROR(AND(INDEX(${LEV}!$D$2:$D$${n},MATCH(A${t},${LEV}!$A$2:$A$${n},0))=1,INDEX(${LEV}!$T$2:$T$${n},MATCH(A${t},${LEV}!$A$2:$A$${n},0))<>"Zöld"),FALSE)`;
    rows.push([
      risk.code,
      manual ? 'Érvényes díj (kézi)' : 'Összesen (várható)',
      null,
      null,
      null,
      null,
      null,
      { f: `SUM(H${first}:H${last})`, v: e.hours, fmt: 'dec' },
      null,
      manual ? { v: e.fee.base, fmt: 'inputHuf' } : { f: `SUM(J${first}:J${last})`, v: e.fee.base, fmt: 'huf' },
      manual ? { f: `J${t}`, v: e.fee.low, fmt: 'huf' } : { f: `ROUND(J${t}*K${hdr}/10000,0)*10000`, v: e.fee.low, fmt: 'huf' },
      manual ? { f: `J${t}`, v: e.fee.high, fmt: 'huf' } : { f: `ROUND(J${t}*L${hdr}/10000,0)*10000`, v: e.fee.high, fmt: 'huf' },
      { f: `IF(${lead},"igen","")`, v: risk.rag !== 'GREEN' ? 'igen' : '' },
      manual
        ? `Kézi díj; a terv szerint ${e.planFeeHuf.toLocaleString('hu-HU')} Ft.${e.note ? ` ${e.note}` : ''}`
        : `Sáv: ${e.uncertainty} Ügyfél ráfordítása: kb. ${e.client.days} nap.${e.external.length ? ` Nincs a díjban: ${e.external.join('; ')}.` : ''}`,
    ]);
  }
  const end = rows.length + 1;
  const leads = scored.filter((r) => r.rag !== 'GREEN').map((r) => estimateRemediation(r).fee);
  const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
  rows.push([]);
  rows.push([
    'Ajánlat',
    'Összesen (nem zöld tételek)',
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    { f: `SUMIFS(J$2:J$${end},M$2:M$${end},"igen")`, v: sum(leads.map((f) => f.base)), fmt: 'huf' },
    { f: `SUMIFS(K$2:K$${end},M$2:M$${end},"igen")`, v: sum(leads.map((f) => f.low)), fmt: 'huf' },
    { f: `SUMIFS(L$2:L$${end},M$2:M$${end},"igen")`, v: sum(leads.map((f) => f.high)), fmt: 'huf' },
    null,
    'A riport Ajánlat része és a program díjösszesítője ugyanezt az összeget mutatja.',
  ]);

  const fees: Sheet = {
    name: 'Javítási díj',
    columns: [
      { header: 'Kód', width: 9 },
      { header: 'Tétel / lépés', width: 40, format: 'wrap' },
      { header: 'Üzletág', width: 14 },
      { header: 'Szint', width: 9 },
      { header: 'Alapóra', width: 9, format: 'dec' },
      { header: 'Óra / egység', width: 10, format: 'dec' },
      { header: 'Terjedelem', width: 11, format: 'dec' },
      { header: 'Óra', width: 9, format: 'dec' },
      { header: 'Óradíj', width: 11, format: 'huf' },
      { header: 'Díj (várható)', width: 14, format: 'huf' },
      { header: 'Alsó (fejlécsor: szorzó)', width: 15, format: 'huf' },
      { header: 'Felső (fejlécsor: szorzó)', width: 15, format: 'huf' },
      { header: 'Ajánlatba', width: 10 },
      { header: 'Megjegyzés', width: 70, format: 'wrap' },
    ],
    rows,
  };
  return [rates, fees];
}
