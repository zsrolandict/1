/**
 * Savings calculation engine.
 *
 * Pure functions only: no React, no I/O. Every figure shown in the UI and in
 * the executive report is derived from `calculateSavings`, so the report can
 * never drift from the calculator.
 */
import { TAX_RATES } from './constants';
import type {
  ClientProfile,
  CorporateTaxResult,
  RdCostInputs,
  SavingsResult,
  SzochoResult,
  TaxParameters,
} from './types';

/** Negative or non-finite inputs are treated as zero. */
const nonNegative = (value: number): number =>
  Number.isFinite(value) && value > 0 ? value : 0;

const round = (value: number): number => Math.round(value);

/**
 * Szocho tv. 15. § – researcher / developer relief.
 * Standard R&D staff: 50% of the 13% contribution is waived (6.5% of gross).
 * PhD / scientific degree: the full 13% is waived.
 */
export function calculateSzocho(costs: RdCostInputs): SzochoResult {
  const engineerWages = nonNegative(costs.engineerGrossWages);
  const phdWages = nonNegative(costs.phdGrossWages);

  const fullContribution = (engineerWages + phdWages) * TAX_RATES.SZOCHO;
  const engineerSaving = engineerWages * TAX_RATES.SZOCHO * TAX_RATES.SZOCHO_RELIEF_STANDARD;
  const phdSaving = phdWages * TAX_RATES.SZOCHO * TAX_RATES.SZOCHO_RELIEF_PHD;
  const totalSaving = engineerSaving + phdSaving;

  return {
    fullContribution: round(fullContribution),
    engineerSaving: round(engineerSaving),
    phdSaving: round(phdSaving),
    totalSaving: round(totalSaving),
    payableContribution: round(fullContribution - totalSaving),
  };
}

/**
 * Direct R&D cost: own personnel cost + materials + prototypes/testing +
 * independent subcontractors. This single base drives the CIT, HIPA and
 * innovation-contribution reliefs.
 */
export function calculateDirectRdCost(
  costs: RdCostInputs,
  params: TaxParameters,
  szocho: SzochoResult,
): { directRdCost: number; personnelCost: number } {
  const grossWages = nonNegative(costs.engineerGrossWages) + nonNegative(costs.phdGrossWages);
  const personnelCost =
    grossWages + (params.includeEmployerContribution ? szocho.payableContribution : 0);

  const directRdCost =
    personnelCost +
    nonNegative(costs.materialCosts) +
    nonNegative(costs.prototypeCosts) +
    nonNegative(costs.subcontractorCosts);

  return { directRdCost: round(directRdCost), personnelCost: round(personnelCost) };
}

/**
 * Tao. tv. 7. § (1) t) – the direct R&D cost is deducted once more from the
 * corporate tax base. Headline saving = cost × 9%.
 *
 * The extra deduction only turns into cash this year up to the positive
 * pre-tax profit; the remainder becomes a loss carry-forward. We report both
 * so advisors do not over-promise to loss-making clients.
 */
export function calculateCorporateTax(
  directRdCost: number,
  profitBeforeTax: number,
): CorporateTaxResult {
  const deductibleBase = nonNegative(directRdCost);
  const nominalSaving = deductibleBase * TAX_RATES.CIT;
  const usableDeduction = Math.min(deductibleBase, nonNegative(profitBeforeTax));
  const immediateSaving = usableDeduction * TAX_RATES.CIT;

  return {
    deductibleBase: round(deductibleBase),
    nominalSaving: round(nominalSaving),
    immediateSaving: round(immediateSaving),
    deferredSaving: round(nominalSaving - immediateSaving),
  };
}

/**
 * Htv. 39. § – the direct R&D cost reduces the HIPA base.
 * Capped at the revenue-based upper bound: the HIPA base cannot go below zero.
 */
export function calculateHipa(directRdCost: number, hipaRate: number, annualRevenue: number): number {
  const rate = Math.min(nonNegative(hipaRate), TAX_RATES.HIPA_MAX);
  const deductible = Math.min(nonNegative(directRdCost), nonNegative(annualRevenue));
  return round(deductible * rate);
}

/**
 * Innovation contribution (0.3%) – its base equals the HIPA base, so the same
 * R&D deduction applies. SMEs are not liable, hence no saving for them.
 */
export function calculateInnovationContribution(
  directRdCost: number,
  client: Pick<ClientProfile, 'companySize' | 'annualRevenue'>,
): number {
  if (client.companySize !== 'LIABLE') return 0;
  const deductible = Math.min(nonNegative(directRdCost), nonNegative(client.annualRevenue));
  return round(deductible * TAX_RATES.INNOVATION_CONTRIBUTION);
}

const huf = (value: number): string =>
  `${Math.round(value).toLocaleString('hu-HU')} Ft`;

/**
 * Full pipeline: Szocho + Tao + HIPA + innovation contribution
 * = ÖSSZESÍTETT TISZTA ADÓMEGTAKARÍTÁS.
 */
export function calculateSavings(
  client: ClientProfile,
  costs: RdCostInputs,
  params: TaxParameters,
): SavingsResult {
  const szocho = calculateSzocho(costs);
  const { directRdCost, personnelCost } = calculateDirectRdCost(costs, params, szocho);
  const corporateTax = calculateCorporateTax(directRdCost, client.profitBeforeTax);
  const hipaSaving = calculateHipa(directRdCost, params.hipaRate, client.annualRevenue);
  const innovationContributionSaving = calculateInnovationContribution(directRdCost, client);

  const totalAnnualSaving =
    szocho.totalSaving + corporateTax.nominalSaving + hipaSaving + innovationContributionSaving;

  const years = Math.max(0, Math.min(5, Math.floor(nonNegative(params.selfRevisionYears))));

  const warnings: string[] = [];
  if (corporateTax.deferredSaving > 0) {
    warnings.push(
      `Az adózás előtti eredmény nem fedezi a teljes kétszeres levonást: ${huf(
        corporateTax.deferredSaving,
      )} Tao-hatás csak elhatárolt veszteségként, későbbi években érvényesíthető.`,
    );
  }
  if (directRdCost > nonNegative(client.annualRevenue) && directRdCost > 0) {
    warnings.push(
      'A közvetlen K+F költség meghaladja az árbevételt: a HIPA- és innovációsjárulék-megtakarítás az árbevételig korlátozva szerepel.',
    );
  }
  if (nonNegative(costs.subcontractorCosts) > 0) {
    warnings.push(
      'Alvállalkozói díj csak független féltől igénybe vett K+F szolgáltatásnál vonható le, és csak ha azt az alvállalkozó maga nem érvényesíti.',
    );
  }
  if (params.hipaRate > TAX_RATES.HIPA_MAX) {
    warnings.push('A megadott HIPA-kulcs meghaladja a törvényi 2%-os maximumot; a számítás 2%-kal történt.');
  }

  return {
    directRdCost,
    personnelCost,
    szocho,
    corporateTax,
    hipaSaving,
    innovationContributionSaving,
    totalAnnualSaving,
    effectiveSubsidyRate: directRdCost > 0 ? totalAnnualSaving / directRdCost : 0,
    multiYearPotential: totalAnnualSaving * (1 + years),
    warnings,
  };
}
