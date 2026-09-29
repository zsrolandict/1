import { describe, expect, it } from 'vitest';
import { adjustmentsFor } from '@/lib/engagement/adjustments';
import { ENGAGEMENT_KINDS } from '@/lib/engagement/kinds';
import { assess } from '@/lib/risk/engine';
import { getScenario } from '@/lib/scenarios';
import { buildBuyerQuestions, buyerQuestionsText } from './buyerQuestions';
import { buildWorkbook } from './excelExport';

const sc = getScenario('it-fejleszto');
const a = assess(sc.items, { company: sc.company, materialityHuf: sc.materialityHuf, adjustments: adjustmentsFor(sc.kind), pillarWeights: ENGAGEMENT_KINDS[sc.kind].weights });

describe('vevői kérdéslista', () => {
  it('minden piros és sárga tételhez kérdés, válaszvázlat és iratlista', () => {
    const list = buildBuyerQuestions(a);
    expect(list).toHaveLength(a.totals.red + a.totals.amber);
    for (const q of list) {
      expect(q.questions.length).toBeGreaterThan(0);
      expect(q.documents.length).toBeGreaterThan(0);
      expect(q.answerDraft).toContain('Állapot:');
    }
    expect(list.find((q) => q.code === 'LEG-01')!.questions[0]).toContain('Change of Control');
  });

  it('ismeretlen kódú tételhez pillérenkénti általános kérdés', () => {
    const custom = { ...a, risks: [{ ...a.risks[0], code: 'CUS-01', pillar: 'HR' as const }] };
    expect(buildBuyerQuestions(custom)[0].questions[0]).toContain('munkatársakat');
  });

  it('a javítás állapota a válaszvázlatban', () => {
    const done = { ...a, risks: [{ ...a.risks[0], remediationStatus: 'DONE' as const }] };
    expect(buildBuyerQuestions(done)[0].answerDraft).toContain('Kész');
  });

  it('szöveges export és Excel-munkalap eladói átvilágításnál', () => {
    expect(buyerQuestionsText('Példa', buildBuyerQuestions(a))).toContain('Válaszvázlat:');
    const input = { companyName: sc.companyName, kind: sc.kind, company: sc.company, materialityHuf: sc.materialityHuf, assessment: a };
    expect(buildWorkbook(input).map((s) => s.name)).toContain('Vevői kérdések');
    expect(buildWorkbook({ ...input, kind: 'HEALTH_CHECK' }).map((s) => s.name)).not.toContain('Vevői kérdések');
  });
});
