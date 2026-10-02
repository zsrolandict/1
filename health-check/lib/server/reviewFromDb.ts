import { adjustmentsFor } from '@/lib/engagement/adjustments';
import type { EngagementKind } from '@/lib/engagement/kinds';
import { RAG_LABEL } from '@/lib/risk/catalog';
import { deriveRisk } from '@/lib/risk/derivation';
import { scoreRisk } from '@/lib/risk/engine';
import { buildReviewRequest, type ReviewRequest } from '@/lib/risk/review';
import { trailOf } from '@/lib/risk/trail';
import { DEFAULT_COMPANY, type CompanyProfile } from '@/lib/risk/valuation';
import { CompanySchema } from '@/lib/backupSchema';
import { rowToItem, type RedFlagRow } from './redFlagRow';

/**
 * Az AI-felülvizsgálat kérése a SZERVEREN, az adatbázisból (audit K9): a tétel,
 * a források és a levezetés az RLS-en át olvasott sorból és projektből jön,
 * nem a kliens kéréstörzséből. A kliens csak a tétel azonosítóját és a
 * véleményét küldi – kitalált forrást így nem tud a modell elé tenni.
 */
export interface EngagementRow {
  kind: EngagementKind;
  materiality_huf: number;
  workspace: { company?: unknown } | null;
}

export function companyFrom(workspace: EngagementRow['workspace']): CompanyProfile {
  const src = (workspace?.company && typeof workspace.company === 'object' ? workspace.company : {}) as Record<string, unknown>;
  const out: CompanyProfile = { ...DEFAULT_COMPANY };
  for (const key of Object.keys(CompanySchema.shape) as (keyof CompanyProfile)[]) {
    const r = CompanySchema.shape[key].safeParse(src[key]);
    if (r.success) out[key] = r.data;
  }
  return out;
}

export function reviewRequestFromRow(row: RedFlagRow, eng: EngagementRow, opinion: string): ReviewRequest {
  const item = rowToItem(row);
  const materialityHuf = Number(eng.materiality_huf);
  const eff = scoreRisk(item, { materialityHuf, company: companyFrom(eng.workspace), adjustments: adjustmentsFor(eng.kind) });
  return buildReviewRequest(
    eng.kind,
    item,
    { likelihood: eff.likelihood, impact: eff.impact, exposureHuf: eff.exposureHuf, exposureExplanation: eff.exposureExplanation, rag: RAG_LABEL[eff.rag] },
    deriveRisk(eff, materialityHuf),
    trailOf(item),
    opinion,
  );
}
