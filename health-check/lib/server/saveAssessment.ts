import { z } from 'zod';
import { CompanySchema, CoverageLogSchema, CoverageOverridesSchema, ItemSchema } from '@/lib/backupSchema';
import { adjustmentsFor } from '@/lib/engagement/adjustments';
import { ENGAGEMENT_KINDS, type EngagementKind } from '@/lib/engagement/kinds';
import { sanitizeAnswers } from '@/lib/intake/checklist';
import { normalizeProfile } from '@/lib/intake/requests';
import { sanitizeRequestStatus } from '@/lib/intake/state';
import { computeCoverage, coverageValues, type CoverageOverrides } from '@/lib/risk/coverage';
import { assess } from '@/lib/risk/engine';
import type { RiskAssessment, RiskItem } from '@/lib/risk/types';

/**
 * Mentés előkészítése a szerveren (audit K13, K8): a kliens csak BEMENETET küld
 * (tételek, válaszok, iratállapot, cégadat, lefedettségi felülbírálás); a
 * kérdőívet és az iratállapotot ugyanazzal a sémával szűrjük, mint betöltéskor,
 * az értékelést (pontszám, besorolás, lefedettség, riport-pillanatkép) a szerver
 * számolja a motorral. Kliens által küldött pontszám nem kerül az adatbázisba.
 */
export const SaveRequestSchema = z.object({
  expectedRevision: z.number().int().min(0),
  items: z.array(ItemSchema).max(2000),
  answers: z.record(z.string(), z.unknown()).default({}),
  requestStatus: z.record(z.string(), z.unknown()).default({}),
  company: CompanySchema,
  coverageOverrides: CoverageOverridesSchema.optional(),
  coverageLog: CoverageLogSchema.optional(),
});
export type SaveRequest = z.infer<typeof SaveRequestSchema>;

export interface EngagementForSave {
  kind: EngagementKind;
  materiality_huf: number;
  case_profile: unknown;
}

export interface SaveRpcArgs {
  p_engagement: string;
  p_expected_revision: number;
  p_items: RiskItem[];
  p_answers: Record<string, unknown>;
  p_request_status: Record<string, unknown>;
  p_workspace: Record<string, unknown>;
  p_snapshot: RiskAssessment;
}

/**
 * A motor által számolt (ScoredRisk) mezők: az ItemSchema a mentések
 * kompatibilitása miatt átengedi az ismeretlen kulcsokat, ezért ezeket itt
 * kifejezetten eldobjuk – kliens által küldött pontszám, besorolás vagy díj
 * így a tárolt tételbe sem kerülhet be.
 */
const DERIVED_KEYS = [
  'baseLikelihood',
  'baseImpact',
  'adjustment',
  'exposureSource',
  'exposureExplanation',
  'score',
  'rag',
  'materialityOverride',
  'probability',
  'expectedLossHuf',
  'quickWin',
  'priority',
  'window',
  'fee',
  'feeByDivision',
  'healthScore',
] as const;

export function stripDerived(item: Record<string, unknown>): RiskItem {
  const out = { ...item };
  for (const k of DERIVED_KEYS) delete out[k];
  return out as unknown as RiskItem;
}

export function prepareSave(engagementId: string, req: SaveRequest, eng: EngagementForSave): { args: SaveRpcArgs; invalidAnswers: string[] } {
  const items = req.items.map((it) => stripDerived(it as Record<string, unknown>));
  const { answers, invalid } = sanitizeAnswers(req.answers);
  const requestStatus = sanitizeRequestStatus(req.requestStatus);
  const profile = normalizeProfile((eng.case_profile ?? {}) as Record<string, unknown>);
  const overrides = (req.coverageOverrides ?? {}) as CoverageOverrides;
  const coverage = computeCoverage({ answers, profile, kind: eng.kind, requestStatus, overrides });
  const snapshot = assess(items, {
    company: req.company,
    materialityHuf: Number(eng.materiality_huf),
    adjustments: adjustmentsFor(eng.kind),
    pillarWeights: ENGAGEMENT_KINDS[eng.kind].weights,
    coverage: coverageValues(coverage),
  });
  return {
    args: {
      p_engagement: engagementId,
      p_expected_revision: req.expectedRevision,
      p_items: items,
      p_answers: answers,
      p_request_status: requestStatus,
      p_workspace: { company: req.company, coverageOverrides: overrides, coverageLog: req.coverageLog ?? [] },
      p_snapshot: snapshot,
    },
    invalidAnswers: Object.keys(invalid),
  };
}

/** PostgreSQL-hibakód → HTTP-válasz (a részletek nem szivárognak ki). */
export function saveErrorStatus(code: string | undefined): { status: number; error: string } {
  if (code === '40001') return { status: 409, error: 'Közben valaki más mentett. Töltsd újra a projektet, és ismételd meg a módosítást.' };
  if (code === '42501') return { status: 403, error: 'Ehhez a mentéshez nincs jogosultság (projekt vagy pillér).' };
  if (code === '23514' || code === '22P02' || code === '23502') return { status: 400, error: 'Érvénytelen adat a mentésben – semmi nem módosult.' };
  return { status: 500, error: 'A mentés nem sikerült – semmi nem módosult.' };
}
