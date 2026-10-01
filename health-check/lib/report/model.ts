import { ENGAGEMENT_KINDS, type EngagementKind } from '@/lib/engagement/kinds';
import { WINDOWS } from '@/lib/risk/engine';
import type { Pillar, RiskAssessment, ScoredRisk } from '@/lib/risk/types';
import { EXPERT_PARAMETERS } from '@/lib/risk/parameters';
import type { CompanyProfile } from '@/lib/risk/valuation';
import { historyOf, missingReasons, trailOf, type ChangeEntry, type EvidenceEntry } from '@/lib/risk/trail';
import { FIN_THRESHOLDS_APPROVED } from '@/lib/intake/financials/thresholds';
import type { ReportScope } from './scope';

export interface ReportInput {
  companyName: string;
  kind: EngagementKind;
  company: CompanyProfile;
  materialityHuf: number;
  assessment: RiskAssessment;
  /** ISO dátum; alapértelmezés: most. Tesztben rögzíthető. */
  generatedAt?: string;
  preparedBy?: string;
  /** Vizsgálati terjedelem: mit láttunk és mit nem (hiányzik = a fejezet kimarad). */
  scope?: ReportScope;
}

export interface ReportModel extends ReportInput {
  generatedAt: string;
  kindLabel: string;
  audience: string;
  /** A riport nézőpontja az átvilágítás típusa szerint. */
  reportLens: string;
  weights: Record<Pillar, number>;
  /** A 3 legnagyobb prioritású piros/sárga tétel a vezetői összefoglalóba. */
  topFindings: ScoredRisk[];
  /** Részletezőbe: csak piros és sárga, prioritás szerint. */
  detailed: ScoredRisk[];
  /** Azonosított zöld tételek száma (csak megemlítjük). */
  greenCount: number;
  /** Nem jóváhagyott szakértői paraméterre épülő tételek – a módszertani részben jelezzük. */
  unapprovedParameterRisks: ScoredRisk[];
  aiSourcedCount: number;
  /** Típusfüggő korrekcióval módosított tételek. */
  adjustedRisks: ScoredRisk[];
  /** Bizonyítéktár: azonosított tételenként a források és a szakértői módosítások. */
  evidenceBook: { risk: ScoredRisk; entries: EvidenceEntry[]; changes: ChangeEntry[] }[];
  /** Indoklás nélküli csökkentések – kiadás előtt rendezendő (belső jelzés). */
  unexplained: { risk: ScoredRisk; changes: ChangeEntry[] }[];
  /** Van-e pénzügyi szabályból jövő tétel, miközben a küszöbök még nincsenek jóváhagyva. */
  unapprovedFinancialThresholds: boolean;
}

export function buildReportModel(input: ReportInput): ReportModel {
  const { assessment } = input;
  const nonGreen = assessment.risks.filter((r) => r.rag !== 'GREEN');
  const unapproved = assessment.risks.filter((r) => {
    const f = r.valuation?.formula;
    if (r.exposureSource !== 'FORMULA' || f?.type !== 'PER_ITEM' || !f.paramKey) return false;
    const p = EXPERT_PARAMETERS[f.paramKey];
    return !p.approved && f.unitAmountHuf === p.valueHuf;
  });
  const profile = ENGAGEMENT_KINDS[input.kind];
  return {
    ...input,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    kindLabel: profile.label,
    audience: profile.audience,
    reportLens: profile.reportLens,
    weights: profile.weights,
    topFindings: nonGreen.slice(0, 3),
    detailed: nonGreen,
    greenCount: assessment.risks.length - nonGreen.length,
    unapprovedParameterRisks: unapproved,
    adjustedRisks: assessment.risks.filter((r) => r.adjustment),
    evidenceBook: assessment.risks.map((r) => ({ risk: r, entries: trailOf(r), changes: historyOf(r) })),
    unexplained: assessment.risks.map((r) => ({ risk: r, changes: missingReasons(r) })).filter((x) => x.changes.length > 0),
    unapprovedFinancialThresholds: !FIN_THRESHOLDS_APPROVED && assessment.risks.some((r) => trailOf(r).some((e) => e.kind === 'FINANCIALS')),
    aiSourcedCount: assessment.risks.filter((r) => trailOf(r).some((e) => e.actor === 'AI')).length,
  };
}

/** Az indoklás első mondata – a vezetői összefoglaló tömör soraihoz. */
export function firstSentence(text: string | undefined, max = 220): string {
  if (!text) return '';
  const m = text.match(/^(.+?[.!?])(\s|$)/);
  const s = (m ? m[1] : text).trim();
  return s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s;
}

export function formatDateHu(iso: string): string {
  return new Date(iso).toLocaleDateString('hu-HU', { year: 'numeric', month: 'long', day: 'numeric' });
}

export const WINDOW_ORDER = WINDOWS;
