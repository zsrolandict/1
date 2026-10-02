import { clampPair, mergeFinding } from '@/lib/risk/dominant';
import { KIND_RISKS } from '@/lib/engagement/kindRisks';
import { catalogDefault, PILLAR_LABEL } from '@/lib/risk/catalog';
import { sectorRiskTemplate } from '@/lib/risk/sectorRisks';
import { financialRiskTemplate } from '@/lib/risk/financialRisks';
import type { RiskItem, RiskSource, Scale5 } from '@/lib/risk/types';
import { DEFAULT_COMPANY, resolveExposure, type CompanyProfile, type Valuation } from '@/lib/risk/valuation';
import { SCENARIOS } from '@/lib/scenarios';
import { addEntry, describeEffect, trailOf, type TrailKind } from '@/lib/risk/trail';
import { ORIGIN_LABEL, type CompanySuggestion, type IntakeOrigin, type IntakeSuggestion, type ValuationPatch } from './types';

const SOURCE: Record<IntakeOrigin, RiskSource> = {
  FINANCIALS: 'FINANCIALS',
  CHECKLIST: 'CHECKLIST',
  DATA_TABLE: 'DATA_TABLE',
  AI_DOCUMENT: 'AI_DOCUMENT',
  CROSS_CHECK: 'CROSS_CHECK',
  AI_SYNTHESIS: 'AI_SYNTHESIS',
};

const SECTOR_ITEMS = new Map(SCENARIOS.flatMap((s) => s.items).map((r) => [r.code, r] as const));
const KIND_ITEMS = new Map(
  Object.values(KIND_RISKS)
    .flat()
    .map((r) => [r.code, r] as const),
);

/** Tétel-sablon kód alapján: alapkatalógus › típus-tétel › ágazati katalógus › pénzügyi alapadat › mintacég tétele. */
export function templateFor(code: string): RiskItem | undefined {
  return catalogDefault(code) ?? KIND_ITEMS.get(code) ?? sectorRiskTemplate(code) ?? financialRiskTemplate(code) ?? SECTOR_ITEMS.get(code);
}

const clamp5 = (n: number): Scale5 => Math.min(5, Math.max(1, Math.round(n))) as Scale5;

function appendEvidence(current: string | undefined, next: string): string {
  if (!current) return next;
  return current.includes(next) ? current : `${current} · ${next}`;
}

/** A képlet paraméterét a tényadat váltja fel; a szakértői felülírás marad. */
function patchValuation(v: Valuation | undefined, patch: ValuationPatch | undefined): Valuation | undefined {
  if (!v || !patch || v.formula.type !== patch.type) return v;
  if (patch.type === 'REVENUE_SHARE' && v.formula.type === 'REVENUE_SHARE') {
    return { ...v, formula: { ...v.formula, share: Math.min(1, Math.max(0, patch.share)) } };
  }
  if (patch.type === 'PER_ITEM' && v.formula.type === 'PER_ITEM') {
    return { ...v, formula: { ...v.formula, count: Math.max(0, Math.round(patch.count)) } };
  }
  return v;
}

/** A forrásban szereplő összeg csak emelheti a kitettséget. */
function raiseExposure(r: RiskItem, estimate: number | null | undefined, company: CompanyProfile): Partial<RiskItem> {
  if (estimate == null) return {};
  if (estimate <= resolveExposure(r, company).valueHuf) return {};
  if (r.valuation && r.valuation.formula.type !== 'MANUAL') {
    return { valuation: { ...r.valuation, overrideHuf: estimate } };
  }
  return { exposureHuf: estimate };
}

/**
 * Elfogadott javaslat beolvasztása a kockázati listába.
 *  - Már azonosított tételnél a súlyosságot sosem csökkentjük (a szakértő korábbi döntése).
 *  - Még nem azonosított tételnél a javaslat értékei érvényesek.
 *  - A lista nem tartalmazza, de van sablonja → a sablonból vesszük fel.
 *  - Egyébként új, egyedi tétel.
 */
export function applyIntakeSuggestion(items: RiskItem[], s: IntakeSuggestion, company: CompanyProfile = DEFAULT_COMPANY, by: string | null = null): RiskItem[] {
  const withTrail = (before: RiskItem, after: RiskItem): RiskItem =>
    addEntry(
      after,
      {
        kind: trailKind(s),
        actor: s.origin.startsWith('AI_') ? 'AI' : 'RULE',
        ref: s.ref ?? s.evidence,
        quote: s.quote,
        rationale: s.rationale,
        effect: describeEffect(before, after, s.exposureHufEstimate),
        confidence: s.confidence,
        acceptedBy: by,
        link: s.link,
      },
      trailOf(before),
    );
  const merge = (r: RiskItem): RiskItem => {
    const withValuation: RiskItem = { ...r, valuation: patchValuation(r.valuation, s.valuationPatch) };
    return withTrail(r, {
      ...withValuation,
      identified: true,
      // Domináns szabály (K6): a meglévő megállapítás és a javaslat közül az erősebb pár egészében.
      ...clampPair(mergeFinding(r, s)),
      ...raiseExposure(withValuation, s.exposureHufEstimate, company),
      source: SOURCE[s.origin],
      evidence: appendEvidence(r.identified ? r.evidence : undefined, s.evidence),
      // Meglévő tételnél is megmarad az új forrás indoklása (ha még nincs saját).
      reasoning: r.reasoning || s.rationale,
    });
  };

  const existing = s.code ? items.find((r) => r.code === s.code) : undefined;
  if (existing) return items.map((r) => (r.id === existing.id ? merge(r) : r));

  const template = s.code ? templateFor(s.code) : undefined;
  if (template) return [merge({ ...template, identified: false, evidence: undefined }), ...items];

  const n = items.filter((r) => r.id.startsWith('CUS-')).length + 1;
  const code = `CUS-${String(n).padStart(2, '0')}`;
  const blank = { identified: false, likelihood: clamp5(s.likelihood), impact: clamp5(s.impact) };
  return [
    withTrail(blank as RiskItem, {
      id: `${code}-${Date.now().toString(36)}`,
      code,
      pillar: s.pillar,
      title: s.title,
      description: `${PILLAR_LABEL[s.pillar]} · ${ORIGIN_LABEL[s.origin].toLowerCase()}`,
      reasoning: s.rationale,
      identified: true,
      likelihood: clamp5(s.likelihood),
      impact: clamp5(s.impact),
      exposureHuf: s.exposureHufEstimate ?? 0,
      remediationDays: 5,
      remediation: '',
      division: 'ADVISORY',
      serviceFeeHuf: 0,
      source: SOURCE[s.origin],
      evidence: s.evidence,
    }),
    ...items,
  ];
}

/** A cégkivonatból jövő javaslat keresztellenőrzés-eredetű, de a láncban külön forrás. */
function trailKind(s: IntakeSuggestion): TrailKind {
  if (s.key.startsWith('REG:')) return 'REGISTRY';
  return SOURCE[s.origin];
}

export function applyCompanySuggestion(company: CompanyProfile, s: CompanySuggestion): CompanyProfile {
  return { ...company, [s.field]: s.value };
}

/** Már érvényben van-e a javaslat (pl. mert korábban elfogadták vagy a szakértő beállította). */
export function isCompanySuggestionApplied(company: CompanyProfile, s: CompanySuggestion): boolean {
  return company[s.field] === s.value;
}
