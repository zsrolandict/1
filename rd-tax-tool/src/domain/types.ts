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
  /** Part of the above financed from non-refundable grants (excluded from the reliefs). */
  grantFundedCosts: number;
  /**
   * Part of the above incurred under a contract with a higher-education
   * institution or research institute: Tao allows 3× this cost, max 50 M Ft
   * (de minimis aid).
   */
  universityJointCosts: number;
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
  /**
   * HIPA: a cost may reduce the HIPA base only once. When the material cost
   * is already deducted under the general "anyagköltség" line, it cannot be
   * deducted again as R&D cost (NAV guidance).
   */
  hipaMaterialAlreadyDeducted: boolean;
  /** Same for R&D subcontractor fees booked as "alvállalkozói teljesítés". */
  hipaSubcontractorAlreadyDeducted: boolean;
  /**
   * Tao. tv. 7. § (1) t): capitalised development may be deducted in full in
   * the year incurred, or in line with the planned depreciation. Never both.
   */
  citDeductionTiming: 'IMMEDIATE' | 'AMORTIZATION';
  /** Straight-line depreciation period for the AMORTIZATION option (years). */
  amortizationYears: number;
}

// ---------------------------------------------------------------------------
// 2b. Software asset (IP-box)
// ---------------------------------------------------------------------------

/**
 * One capitalised piece of the software: the original development or a later
 * enhancement (aktivált továbbfejlesztés = value increase). Each must be
 * notified to NAV separately within the notification window.
 */
export interface SoftwareComponent {
  id: string;
  kind: 'ORIGINAL' | 'ENHANCEMENT';
  name: string;
  /** Capitalisation / completion date (yyyy-mm-dd); starts the notification window. */
  capitalizedOn: string;
  /** NAV notification date ('' if not yet). */
  reportedOn: string;
  /** Capitalised value (bekerülési érték / értéknövekmény). */
  capitalizedValue: number;
  /** Nexus inputs for this component. */
  ownCosts: number;
  relatedPartyCosts: number;
  acquisitionCosts: number;
}

/** Royalty income of one tax year. */
export interface RoyaltyYear {
  year: number;
  /** Licence / royalty income qualifying as jogdíj. */
  royaltyIncome: number;
  /** Costs attributable to that income. */
  relatedCosts: number;
  /** Pre-tax profit of that year (caps the Tao deduction at 50%). */
  profitBeforeTax: number;
}

/** LICENSE: licence fees; SAAS: cloud subscription; MIXED: both. */
export type RevenueModel = 'LICENSE' | 'SAAS' | 'MIXED';

export interface SoftwareAssetInputs {
  enabled: boolean;
  name: string;
  revenueModel: RevenueModel;
  /**
   * For SaaS / mixed: the contracts (ÁSZF / EULA) grant a copyright licence
   * and invoices separate the licence fee from hosting / SLA fees. Without
   * this, SaaS income is a service, not royalty.
   */
  saasLicenceSeparated: boolean;
  components: SoftwareComponent[];
  royaltyYears: RoyaltyYear[];
  /** HIPA: royalty income is deductible from net revenue (no nexus in the Htv.). */
  hipaRoyaltyDeduction: boolean;
  /** Planned sale / contribution in kind. */
  saleDate: string;
  salePrice: number;
  /** Book value at sale (bekerülési érték − értékcsökkenés). */
  saleBookValue: number;
  /** Apply the nexus ratio to the sale gain as well (conservative default). */
  applyNexusToSaleGain: boolean;
}

export type NotificationStatus = 'NO_DATE' | 'OPEN' | 'MISSED' | 'REPORTED_ON_TIME' | 'REPORTED_LATE';

export interface NotificationDeadline {
  status: NotificationStatus;
  dueDate: string;
  daysLeft: number;
}

export interface ComponentResult {
  id: string;
  name: string;
  kind: SoftwareComponent['kind'];
  capitalizedValue: number;
  deadline: NotificationDeadline;
}

export interface RoyaltyYearResult {
  year: number;
  /** Cumulative nexus up to the end of this year. */
  nexusRatio: number;
  royaltyProfit: number;
  deduction: number;
  citSaving: number;
  hipaSaving: number;
  innovationContributionSaving: number;
  total: number;
}

export interface SoftwareResult {
  enabled: boolean;
  /** False for SaaS income without a separated licence fee. */
  royaltyQualifies: boolean;
  components: ComponentResult[];
  years: RoyaltyYearResult[];
  /** Figures of the tax year under review (feed the annual total). */
  nexusRatio: number;
  royaltyProfit: number;
  royaltyDeduction: number;
  royaltyCitSaving: number;
  effectiveRoyaltyCitRate: number;
  hipaSaving: number;
  innovationContributionSaving: number;
  annualSaving: number;
  /** Most urgent notification across all components. */
  deadline: NotificationDeadline;
  sale: {
    gain: number;
    /** Share of the capitalised value notified on time (0–1). */
    exemptShare: number;
    deduction: number;
    taxablePart: number;
    citSaving: number;
    eligible: boolean;
    reasons: string[];
  };
  warnings: string[];
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
  /** Extra deduction from the CIT base this year (incl. the 3× university uplift). */
  deductibleBase: number;
  /** Deduction left for later years on the AMORTIZATION option. */
  deferredToLaterYears: number;
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
  /** R&D cost eligible for the Tao deduction (grant-funded part and, on the SZOCHO_16 route, engineer wages removed). */
  citDeductibleBase: number;
  /** Extra deduction from the university 3× rule on top of citDeductibleBase. */
  universityUplift: number;
  /** R&D cost that reduces the HIPA / innovation-contribution base (no double deduction). */
  hipaDeductibleBase: number;
  engineerRoutes: EngineerRouteComparison;
  szocho: SzochoResult;
  corporateTax: CorporateTaxResult;
  hipaSaving: number;
  innovationContributionSaving: number;
  ipBox: SoftwareResult;
  /** Szocho + Tao (nominal) + HIPA + innovation contribution + IP-box (annual part). */
  totalAnnualSaving: number;
  /**
   * The szocho, HIPA and innovation savings lower deductible costs, so they
   * raise the Tao base: net = total − 9% × those savings (profitable clients).
   */
  netAfterCitEffect: number;
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
  software: SoftwareAssetInputs;
  /** Present while the case is sealed (read-only). */
  seal: AuditSeal | null;
  /** Earlier seals, kept when a sealed case is reopened as a new version. */
  sealHistory: AuditSeal[];
  /**
   * For cases sealed by an older engine: the data exactly as it was in the
   * file, so the seal is verified against what was hashed (not re-hashed after
   * migration to the current shape). Not itself part of any hash.
   */
  sealedSource: Record<string, unknown> | null;
}
