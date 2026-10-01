import { describeAdjustment } from '@/lib/engagement/adjustments';
import { RAG_LABEL } from './catalog';
import { formatHufShort, ragFromScore } from './engine';
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

export function deriveRisk(eff: Omit<ScoredRisk, 'priority'>, materialityHuf: number): DerivationStep[] {
  const steps: DerivationStep[] = [{ label: 'Megadott érték', value: `valószínűség ${eff.baseLikelihood} × hatás ${eff.baseImpact}` }];
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
    note: `A ${eff.likelihood}-es valószínűséghez ${Math.round(eff.probability * 100)}% tartozik.`,
  });
  if (eff.materialityOverride) {
    steps.push({
      label: 'Lényegességi küszöb',
      value: `${formatHufShort(eff.expectedLossHuf)} ≥ ${formatHufShort(materialityHuf)} → ${RAG_LABEL.RED}`,
      note: 'A várható veszteség eléri a küszöböt, ezért a pontszámtól függetlenül piros.',
    });
  }
  steps.push({ label: 'Besorolás', value: RAG_LABEL[eff.rag] });
  return steps;
}

export interface HealthDerivation {
  pillars: { pillar: Pillar; score: number; weight: number; items: number }[];
  total: number;
}

export function deriveHealth(pillars: Record<Pillar, PillarSummary>, weights: Record<Pillar, number>, total: number): HealthDerivation {
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
