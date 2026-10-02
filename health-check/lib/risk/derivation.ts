import { describeAdjustment } from '@/lib/engagement/adjustments';
import { RAG_LABEL, WINDOW_LABEL } from './catalog';
import { DEFAULT_OPTIONS, formatHufShort, ragFromScore } from './engine';
import type { Pillar, PillarSummary, ScoredRisk } from './types';

/**
 * Levezetés szövegesen: hogyan lett egy tétel pontszáma, besorolása és várható
 * vesztesége, illetve hogyan áll össze a Health Score. Ugyanazokból a
 * számokból, amelyekből a motor számol (engine.ts), csak ember számára.
 */

export interface DerivationStep {
  label: string;
  value: string;
  note?: string;
}

const LEVEL_NAME: Record<number, string> = { 1: 'Az 1-es', 2: 'A 2-es', 3: 'A 3-as', 4: 'A 4-es', 5: 'Az 5-ös' };

export interface DerivationContext {
  /** Van-e forrás a bizonyíték-láncban (ha nincs, a katalógus-alapértékből indul). */
  hasSources?: boolean;
  /** A tétel prioritása és a legnagyobb várható veszteség (csak azonosított tételnél). */
  priority?: { value: number; maxLossHuf: number };
  quickWinMaxDays?: number;
}

export function deriveRisk(eff: Omit<ScoredRisk, 'priority'>, materialityHuf: number, ctx: DerivationContext = {}): DerivationStep[] {
  const steps: DerivationStep[] = [
    {
      label: 'Megadott érték',
      value: `valószínűség ${eff.baseLikelihood} × hatás ${eff.baseImpact}`,
      note:
        ctx.hasSources === false
          ? 'A katalógus alapértéke: szakértői becslés, ehhez a céghez még nincs forrás.'
          : ctx.hasSources
            ? 'A forrásokból vagy a szakértő döntéséből (lásd: Miért van a listában?).'
            : undefined,
    },
  ];
  if (eff.adjustment) {
    steps.push({
      label: 'Az átvilágítás célja miatt',
      value: `${describeAdjustment(eff.adjustment)} → ${eff.likelihood} × ${eff.impact}`,
      note: eff.adjustment.reason,
    });
  }
  const scoreRag = ragFromScore(eff.score);
  steps.push({
    label: 'Pontszám',
    value: `${eff.likelihood} × ${eff.impact} = ${eff.score} → ${RAG_LABEL[scoreRag]}`,
    note: 'Sávok: 15-től piros, 8–14 sárga, 7-ig zöld.',
  });
  steps.push({
    label: 'Kitettség',
    value: formatHufShort(eff.exposureHuf),
    note: eff.exposureExplanation,
  });
  steps.push({
    label: 'Várható veszteség',
    value: `${formatHufShort(eff.exposureHuf)} × ${Math.round(eff.probability * 100)}% = ${formatHufShort(eff.expectedLossHuf)}`,
    note: `${LEVEL_NAME[eff.likelihood]} valószínűséghez ${Math.round(eff.probability * 100)}% tartozik.`,
  });
  if (eff.materialityOverride) {
    steps.push({
      label: 'Lényegességi küszöb',
      value: `${formatHufShort(eff.expectedLossHuf)} ≥ ${formatHufShort(materialityHuf)} → ${RAG_LABEL.RED}`,
      note: 'A várható veszteség eléri a küszöböt, ezért a pontszámtól függetlenül piros.',
    });
  }
  steps.push({ label: 'Besorolás', value: RAG_LABEL[eff.rag] });
  const maxDays = ctx.quickWinMaxDays ?? DEFAULT_OPTIONS.quickWinMaxDays;
  steps.push({
    label: 'Időablak',
    value: WINDOW_LABEL[eff.window],
    note: eff.quickWin
      ? `Quick win: nem zöld, és ${eff.remediationDays} munkanap ≤ ${maxDays}.`
      : eff.rag === 'RED'
        ? `Piros, és a javítás ${eff.remediationDays} munkanap (> ${maxDays}).`
        : eff.rag === 'AMBER'
          ? `Sárga, és a javítás ${eff.remediationDays} munkanap (> ${maxDays}).`
          : 'Zöld: nem sürgős.',
  });
  if (ctx.priority && eff.identified) {
    const { value, maxLossHuf } = ctx.priority;
    const lossShare = maxLossHuf > 0 ? eff.expectedLossHuf / maxLossHuf : 0;
    steps.push({
      label: 'Prioritás',
      value: value.toLocaleString('hu-HU', { maximumFractionDigits: 2 }),
      note: `0,5 × ${eff.score}/25 + 0,5 × ${formatHufShort(eff.expectedLossHuf)}/${formatHufShort(maxLossHuf)} (${Math.round(lossShare * 100)}%)${eff.quickWin ? ' + 0,15 quick win' : ''}. Ez adja a sorrendet az akciótervben.`,
    });
  }
  const factor = 1 - (eff.score / 25) * 0.6;
  if (eff.identified)
    steps.push({
      label: 'Hatás a pillér-egészségre',
      value: `× ${factor.toLocaleString('hu-HU', { maximumFractionDigits: 3 })}`,
      note: `1 − ${eff.score}/25 × 0,6. A pillér-egészség a pillér tételeinek szorzóiból: 100 × szorzat.`,
    });
  return steps;
}

export interface HealthDerivation {
  /** score null = nem vizsgált pillér (kimarad a nevezőből). */
  pillars: { pillar: Pillar; score: number | null; weight: number; items: number }[];
  total: number | null;
}

export function deriveHealth(pillars: Record<Pillar, PillarSummary>, weights: Record<Pillar, number>, total: number | null): HealthDerivation {
  return {
    pillars: (Object.keys(pillars) as Pillar[]).map((p) => ({
      pillar: p,
      score: pillars[p].healthScore,
      weight: weights[p] ?? 0,
      items: pillars[p].identified,
    })),
    total,
  };
}
