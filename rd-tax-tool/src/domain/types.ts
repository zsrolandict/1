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
 * Company size per the Kkv tv. (group level, incl. linked enterprises).
 * Innovation contribution (Inno. tv. 17. §): micro and small enterprises are
 * exempt; medium and large enterprises are liable.
 */
export type CompanySize = 'MICRO_SMALL' | 'MEDIUM' | 'LARGE';

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
  phdHeadcount: number;
  /** Annual gross wages of doctoral students / doctoral candidates. */
  doctoralGrossWages: number;
  doctoralHeadcount: number;
  /** Months the researchers were employed in the tax year (1–12); drives the monthly caps. */
  researcherMonths: number;
  /** Direct materials consumed by the R&D project. */
  materialCosts: number;
  /** Testing, measurement and prototype costs. */
  prototypeCosts: number;
  /** Fees paid to independent R&D subcontractors. */
  subcontractorCosts: number;
}

/**
 * How the wages of R&D staff without a doctorate are relieved:
 * - CIT: counted in the Tao double deduction (default).
 * - SZOCHO_16: 50% szocho relief under Szocho tv. 16. §; the same wages then
 *   cannot be deducted under Tao. tv. 7. § (1) t).
 */
export type EngineerRelief = 'CIT' | 'SZOCHO_16';

export interface TaxParameters {
  engineerRelief: EngineerRelief;
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
  /** Szocho tv. 15. §: PhD researchers, 100% up to the monthly wage cap. */
  phdSaving: number;
  /** Wages above the PhD monthly cap (no relief on this part). */
  phdWagesOverCap: number;
  /** Szocho tv. 15. §: doctoral students, 50% up to the monthly wage cap. */
  doctoralSaving: number;
  doctoralWagesOverCap: number;
  /** Szocho tv. 16. §: only when the SZOCHO_16 route is chosen, else 0. */
  engineerSaving: number;
  totalSaving: number;
  /** Contribution still payable after the relief. */
  payableContribution: number;
}

/** Side-by-side value of the two relief routes for non-PhD engineer wages. */
export interface EngineerRouteComparison {
  /** Nominal Tao saving attributable to engineer wages (× 9%). */
  citNominal: number;
  /** Part of that realisable this year given the pre-tax profit. */
  citImmediate: number;
  /** Szocho tv. 16. § saving (× 6.5%), realised monthly. */
  szocho16: number;
  recommended: EngineerRelief;
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
  /** Base for HIPA and the innovation contribution. */
  directRdCost: number;
  personnelCost: number;
  /** Base for the Tao deduction (engineer wages removed on the SZOCHO_16 route). */
  citDeductibleBase: number;
  engineerRoutes: EngineerRouteComparison;
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

/** Red flags that apply to every industry. */
export type GeneralRedFlagId =
  | 'PRODUCTION_PREP'
  | 'ROUTINE_QA'
  | 'CUSTOMER_CUSTOMISATION'
  | 'NO_HYPOTHESIS'
  | 'NO_TIME_TRACKING';

/** Industry-specific red flags (typical NAV reclassification patterns). */
export type IndustryRedFlagId =
  | 'TOOLING_CERTIFICATION'
  | 'MACHINE_RECONFIGURATION'
  | 'SCALE_UP'
  | 'STANDARD_MATERIAL_TESTING'
  | 'RECIPE_VARIANT'
  | 'ROUTINE_SHELF_LIFE'
  | 'EMC_CERTIFICATION'
  | 'COMPONENT_REPLACEMENT'
  | 'SOFTWARE_MAINTENANCE'
  | 'DATA_MIGRATION_REPORTING';

export type RedFlagId = GeneralRedFlagId | IndustryRedFlagId;

export interface AuditAnswers {
  ratings: Record<FrascatiCriterionId, CriterionRating>;
  /** Only flags relevant to the client's industry are scored. */
  redFlags: Partial<Record<RedFlagId, boolean>>;
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

/**
 * Tamper-evidence seal. The hash covers the canonical JSON of the case data
 * plus the seal metadata, so any later edit makes verification fail.
 * The timestamp comes from the advisor's device clock: it is not a
 * qualified (eIDAS) timestamp.
 */
export interface AuditSeal {
  algorithm: 'SHA-256';
  /** ISO 8601, UTC. */
  sealedAt: string;
  sealedBy: string;
  engineVersion: string;
  hash: string;
}

export interface Assessment {
  client: ClientProfile;
  costs: RdCostInputs;
  params: TaxParameters;
  audit: AuditAnswers;
  /** Present while the case is sealed (read-only). */
  seal: AuditSeal | null;
  /** Earlier seals, kept when a sealed case is reopened as a new version. */
  sealHistory: AuditSeal[];
}
