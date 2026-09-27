/**
 * Domain types for the ICT Európa R&D tax diagnostic tool.
 *
 * All monetary values are whole Hungarian forints (HUF) per tax year.
 * All rates are decimal fractions (0.13 = 13%), never percentages.
 */

// ---------------------------------------------------------------------------
// 1. Client & project
// ---------------------------------------------------------------------------

export type Industry =
  | 'MACHINERY_AUTOMATION'
  | 'CHEMICALS_MATERIALS'
  | 'FOOD'
  | 'ELECTRONICS_IOT'
  | 'SOFTWARE_DIGITAL'
  | 'OTHER';

/**
 * Company size as it matters for the innovation contribution (Inno. tv.):
 * micro/small/medium enterprises are exempt, everyone else is liable.
 */
export type CompanySize = 'SME' | 'LIABLE';

export interface ClientProfile {
  companyName: string;
  /** Hungarian tax number, format 12345678-1-12. */
  taxNumber: string;
  industry: Industry;
  projectName: string;
  /** Tax year under review (e.g. 2025). */
  taxYear: number;
  annualRevenue: number;
  /** Adózás előtti eredmény – may be negative. */
  profitBeforeTax: number;
  companySize: CompanySize;
  advisorName: string;
}

// ---------------------------------------------------------------------------
// 2. Cost inputs
// ---------------------------------------------------------------------------

export interface RdCostInputs {
  /** Annual gross wages of R&D engineers/developers without a doctorate. */
  engineerGrossWages: number;
  /** Annual gross wages of researchers holding a PhD / scientific degree. */
  phdGrossWages: number;
  /** Direct materials consumed by the R&D project. */
  materialCosts: number;
  /** Testing, measurement and prototype costs. */
  prototypeCosts: number;
  /** Fees paid to independent R&D subcontractors. */
  subcontractorCosts: number;
}

export interface TaxParameters {
  /** Local business tax (HIPA) rate set by the municipality, max 2%. */
  hipaRate: number;
  /**
   * Whether the employer's social contribution tax still payable after the
   * relief is added to the direct personnel cost base. Conservative default:
   * false (only gross wages are counted).
   */
  includeEmployerContribution: boolean;
  /** Number of past open tax years to model for self-revision (0–5). */
  selfRevisionYears: number;
}

// ---------------------------------------------------------------------------
// 3. Calculation results
// ---------------------------------------------------------------------------

export interface SzochoResult {
  /** 13% contribution that would be due without any relief. */
  fullContribution: number;
  engineerSaving: number;
  phdSaving: number;
  totalSaving: number;
  /** Contribution still payable after the relief. */
  payableContribution: number;
}

export interface CorporateTaxResult {
  /** Direct R&D cost deducted a second time from the CIT base. */
  deductibleBase: number;
  /** Nominal saving: deductibleBase × 9% (the headline figure). */
  nominalSaving: number;
  /** Portion realisable this year given the positive pre-tax profit. */
  immediateSaving: number;
  /** Portion that becomes a loss carry-forward instead of cash this year. */
  deferredSaving: number;
}

export interface SavingsResult {
  directRdCost: number;
  personnelCost: number;
  szocho: SzochoResult;
  corporateTax: CorporateTaxResult;
  hipaSaving: number;
  innovationContributionSaving: number;
  /** Szocho + Tao (nominal) + HIPA + innovation contribution. */
  totalAnnualSaving: number;
  /** Total saving as a share of the direct R&D cost (0–1). */
  effectiveSubsidyRate: number;
  /** totalAnnualSaving × (1 + selfRevisionYears): current + past years. */
  multiYearPotential: number;
  warnings: string[];
}

// ---------------------------------------------------------------------------
// 4. SZTNH / Frascati risk audit
// ---------------------------------------------------------------------------

export type FrascatiCriterionId =
  | 'NOVELTY'
  | 'CREATIVITY'
  | 'UNCERTAINTY'
  | 'SYSTEMATIC'
  | 'TRANSFERABILITY';

/** 0 = criterion not met … 4 = fully met and evidenced. */
export type CriterionRating = 0 | 1 | 2 | 3 | 4;

export type RedFlagId =
  | 'PRODUCTION_PREP'
  | 'ROUTINE_QA'
  | 'CUSTOMER_CUSTOMISATION'
  | 'NO_HYPOTHESIS'
  | 'NO_TIME_TRACKING';

export interface AuditAnswers {
  ratings: Record<FrascatiCriterionId, CriterionRating>;
  redFlags: Record<RedFlagId, boolean>;
  notes: string;
}

export type RiskLevel = 'GREEN' | 'YELLOW' | 'RED';

export interface CriterionScore {
  id: FrascatiCriterionId;
  rating: CriterionRating;
  weight: number;
  points: number;
}

export interface AuditResult {
  criterionScores: CriterionScore[];
  /** Weighted score before red-flag penalties (0–100). */
  baseScore: number;
  penalty: number;
  /** Final score after penalties and knock-out caps (0–100). */
  score: number;
  level: RiskLevel;
  /** Human-readable reasons why the score was capped below GREEN/YELLOW. */
  knockOuts: string[];
  /** Concrete remediation actions for weak criteria and raised flags. */
  recommendations: string[];
}

// ---------------------------------------------------------------------------
// 5. Aggregate
// ---------------------------------------------------------------------------

export interface Assessment {
  client: ClientProfile;
  costs: RdCostInputs;
  params: TaxParameters;
  audit: AuditAnswers;
}
