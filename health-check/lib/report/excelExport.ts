import { formatAdjustment } from '@/lib/engagement/adjustments';
import { ENGAGEMENT_KINDS } from '@/lib/engagement/kinds';
import { DIVISION_LABEL, PILLAR_LABEL, RAG_LABEL, WINDOW_LABEL } from '@/lib/risk/catalog';
import { DIVISIONS, PILLARS, WINDOWS } from '@/lib/risk/engine';
import type { RiskSource } from '@/lib/risk/types';
import { REMEDIATION_LABEL } from '@/lib/risk/followup';
import { buildBuyerQuestions } from './buyerQuestions';
import type { ReportInput } from './model';
import { writeXlsx, type Sheet } from './xlsx';
import { hasRevenue } from '@/lib/risk/valuation';

/**
 * Red Flag értékelés → olvasható Excel a tanácsadóknak (szűrhető, továbbküldhető).
 * Ugyanazokból a számokból készül, mint a képernyő és a PDF-riport.
 */

const SOURCE: Record<RiskSource, string> = {
  MANUAL: 'Szakértő',
  CHECKLIST: 'Kérdőív',
  DATA_TABLE: 'Adattábla',
  AI_DOCUMENT: 'AI · dokumentum',
  AI_INTERVIEW: 'AI · interjú',
  CROSS_CHECK: 'Keresztellenőrzés',
  AI_SYNTHESIS: 'AI · összkép',
  FINANCIALS: 'Pénzügyi alapadat',
};

const huf = (n: number) => `${Math.round(n).toLocaleString('hu-HU')} Ft`;

export function buildWorkbook(input: ReportInput): Sheet[] {
  const { assessment: a, company } = input;
  const kind = ENGAGEMENT_KINDS[input.kind];
  const date = (input.generatedAt ?? new Date().toISOString()).slice(0, 10);

  const summary: Sheet = {
    name: 'Összefoglaló',
    columns: [
      { header: 'Mutató', width: 38 },
      { header: 'Érték', width: 26 },
      { header: 'Megjegyzés', width: 60, format: 'wrap' },
    ],
    rows: [
      ['Cég', input.companyName, null],
      ['Átvilágítás típusa', kind.label, kind.audience],
      ['Készült', date, null],
      ['Összesített besorolás', RAG_LABEL[a.totals.rag], null],
      ['Health Score (0–100)', a.totals.healthScore, 'Pillérek súlyozott átlaga, 100 = nincs azonosított kockázat'],
      ['Azonosított tételek', a.totals.identified, `${a.totals.red} piros · ${a.totals.amber} sárga · ${a.totals.green} zöld`],
      ['Bruttó kitettség', huf(a.totals.grossExposureHuf), null],
      ['Várható veszteség', huf(a.totals.expectedLossHuf), 'kitettség × valószínűség'],
      ['Lényegességi küszöb', huf(input.materialityHuf), 'E fölötti várható veszteség pontszámtól függetlenül piros'],
      [
        'Árbevétel',
        hasRevenue(company) ? huf(company.revenueHuf) : 'nincs megadva',
        hasRevenue(company) ? null : 'A forintosított összegek árbevétel nélkül 0 Ft-ot mutatnak',
      ],
      ['Fedezet', `${Math.round(company.grossMarginPct * 100)}%`, null],
      ['DSO / iparági DSO', `${company.actualDsoDays} / ${company.industryDsoDays} nap`, null],
      ['Javasolt remediáció összesen', huf(a.pipeline.totalFeeHuf), null],
      ['Beszámítható kredit', huf(a.pipeline.creditHuf), 'A befizetett audit díjból'],
      ['Nettó fizetendő', huf(a.pipeline.netAfterCreditHuf), null],
    ],
  };

  const risks: Sheet = {
    name: 'Kockázatok',
    columns: [
      { header: 'Kód', width: 9 },
      { header: 'Pillér', width: 14 },
      { header: 'Tétel', width: 44, format: 'wrap' },
      { header: 'Besorolás', width: 11 },
      { header: 'Valószínűség (1–5)', width: 12, format: 'int' },
      { header: 'Hatás (1–5)', width: 10, format: 'int' },
      { header: 'Pontszám', width: 10, format: 'int' },
      { header: 'Típusfüggő korrekció', width: 16 },
      { header: 'Kitettség', width: 16, format: 'huf' },
      { header: 'Valószínűség', width: 12, format: 'pct' },
      { header: 'Várható veszteség', width: 16, format: 'huf' },
      { header: 'Forintosítás', width: 40, format: 'wrap' },
      { header: 'Forrás', width: 14 },
      { header: 'Bizonyíték', width: 50, format: 'wrap' },
      { header: 'Javasolt intézkedés', width: 44, format: 'wrap' },
      { header: 'Ütemezés', width: 26 },
      { header: 'Munkanap', width: 10, format: 'int' },
      { header: 'Felelős divízió', width: 15 },
      { header: 'Becsült díj', width: 14, format: 'huf' },
      { header: 'Javítás állapota', width: 16 },
      { header: 'Indoklás', width: 70, format: 'wrap' },
    ],
    rows: a.risks.map((r) => [
      r.code,
      PILLAR_LABEL[r.pillar],
      r.title,
      RAG_LABEL[r.rag] + (r.materialityOverride ? ' (küszöb)' : ''),
      r.likelihood,
      r.impact,
      r.score,
      r.adjustment ? formatAdjustment(r.adjustment) : '',
      r.exposureHuf,
      r.probability,
      r.expectedLossHuf,
      r.exposureExplanation,
      SOURCE[r.source ?? 'MANUAL'],
      r.evidence ?? '',
      r.remediation,
      WINDOW_LABEL[r.window] + (r.quickWin ? ' ⚡' : ''),
      r.remediationDays,
      DIVISION_LABEL[r.division],
      r.serviceFeeHuf,
      REMEDIATION_LABEL[r.remediationStatus ?? 'OPEN'],
      r.reasoning ?? '',
    ]),
  };

  const plan: Sheet = {
    name: 'Akcióterv',
    columns: [
      { header: 'Időablak', width: 30 },
      { header: 'Kód', width: 9 },
      { header: 'Tétel', width: 44, format: 'wrap' },
      { header: 'Besorolás', width: 11 },
      { header: 'Javasolt intézkedés', width: 60, format: 'wrap' },
      { header: 'Munkanap', width: 10, format: 'int' },
      { header: 'Felelős divízió', width: 15 },
    ],
    rows: WINDOWS.flatMap((w) =>
      a.actionPlan[w].map((r) => [WINDOW_LABEL[w], r.code, r.title, RAG_LABEL[r.rag], r.remediation, r.remediationDays, DIVISION_LABEL[r.division]]),
    ),
  };

  const offer: Sheet = {
    name: 'Ajánlat',
    columns: [
      { header: 'Divízió', width: 18 },
      { header: 'Tételek', width: 10, format: 'int' },
      { header: 'Becsült díj', width: 16, format: 'huf' },
    ],
    rows: [
      ...DIVISIONS.filter((d) => a.pipeline.byDivision[d].count > 0).map((d) => [
        DIVISION_LABEL[d],
        a.pipeline.byDivision[d].count,
        a.pipeline.byDivision[d].feeHuf,
      ]),
      ['Összesen', null, a.pipeline.totalFeeHuf],
      ['Beszámítható kredit', null, -a.pipeline.creditHuf],
      ['Nettó', null, a.pipeline.netAfterCreditHuf],
    ],
  };

  const pillars: Sheet = {
    name: 'Pillérek',
    columns: [
      { header: 'Pillér', width: 16 },
      { header: 'Health Score', width: 12, format: 'int' },
      { header: 'Besorolás', width: 11 },
      { header: 'Piros', width: 8, format: 'int' },
      { header: 'Sárga', width: 8, format: 'int' },
      { header: 'Zöld', width: 8, format: 'int' },
      { header: 'Bruttó kitettség', width: 16, format: 'huf' },
      { header: 'Várható veszteség', width: 16, format: 'huf' },
      { header: 'Súly', width: 8, format: 'pct' },
    ],
    rows: PILLARS.map((p) => {
      const s = a.pillars[p];
      return [PILLAR_LABEL[p], s.healthScore, RAG_LABEL[s.rag], s.red, s.amber, s.green, s.grossExposureHuf, s.expectedLossHuf, kind.weights[p]];
    }),
  };

  const buyer: Sheet = {
    name: 'Vevői kérdések',
    columns: [
      { header: 'Kód', width: 9 },
      { header: 'Tétel', width: 40, format: 'wrap' },
      { header: 'Besorolás', width: 11 },
      { header: 'Várható vevői kérdések', width: 60, format: 'wrap' },
      { header: 'Válaszvázlat', width: 60, format: 'wrap' },
      { header: 'Szükséges iratok', width: 40, format: 'wrap' },
    ],
    rows: buildBuyerQuestions(a).map((q) => [q.code, q.title, RAG_LABEL[q.rag], q.questions.join('\n'), q.answerDraft, q.documents.join('\n')]),
  };

  const sheets = [summary, risks, plan, offer, pillars];
  // Eladói és vevői átvilágításnál a vevői kérdéslista is része a munkafüzetnek.
  if (input.kind === 'VENDOR_DD' || input.kind === 'BUY_SIDE_DD') sheets.push(buyer);
  return sheets;
}

export function exportExcel(input: ReportInput): Uint8Array {
  return writeXlsx(buildWorkbook(input));
}
