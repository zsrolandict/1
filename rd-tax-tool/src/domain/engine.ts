/**
 * Savings calculation engine.
 *
 * Pure functions only: no React, no I/O. Every figure shown in the UI and in
 * the executive report is derived from `calculateSavings`, so the report can
 * never drift from the calculator.
 */
import { isInnovationContributionLiable, TAX_RATES } from './constants';
import type {
  ClientProfile,
  CorporateTaxResult,
  EngineerRouteComparison,
  RdCostInputs,
  SavingsResult,
  SzochoResult,
  TaxParameters,
} from './types';

/** Negative or non-finite inputs are treated as zero. */
const nonNegative = (value: number): number =>
  Number.isFinite(value) && value > 0 ? value : 0;

const round = (value: number): number => Math.round(value);

/** Months of employment in the year, clamped to 1–12. */
const months = (costs: RdCostInputs): number =>
  Math.max(1, Math.min(12, Math.floor(nonNegative(costs.researcherMonths) || 12)));

/** Annual wage eligible for a capped relief: min(wages, headcount × months × monthly cap). */
function cappedWages(wages: number, headcount: number, monthCount: number, monthlyCap: number) {
  const total = nonNegative(wages);
  const cap = Math.floor(nonNegative(headcount)) * monthCount * monthlyCap;
  const eligible = Math.min(total, cap);
  return { eligible, overCap: total - eligible };
}

/**
 * Szocho reliefs:
 * - 15. § PhD / scientific degree: 100% of 13%, on at most 500 000 Ft gross wage per person per month.
 * - 15. § doctoral students / candidates: 50% of 13%, on at most 200 000 Ft per person per month.
 * - 16. § other R&D staff: 50% of 13%, only on the SZOCHO_16 route (then no Tao deduction on those wages).
 */
export function calculateSzocho(costs: RdCostInputs, params: Pick<TaxParameters, 'engineerRelief'>): SzochoResult {
  const monthCount = months(costs);
  const engineerWages = nonNegative(costs.engineerGrossWages);
  const phd = cappedWages(costs.phdGrossWages, costs.phdHeadcount, monthCount, TAX_RATES.SZOCHO_PHD_MONTHLY_CAP);
  const doctoral = cappedWages(
    costs.doctoralGrossWages,
    costs.doctoralHeadcount,
    monthCount,
    TAX_RATES.SZOCHO_DOCTORAL_MONTHLY_CAP,
  );

  const allWages = engineerWages + nonNegative(costs.phdGrossWages) + nonNegative(costs.doctoralGrossWages);
  const fullContribution = allWages * TAX_RATES.SZOCHO;

  const phdSaving = phd.eligible * TAX_RATES.SZOCHO * TAX_RATES.SZOCHO_RELIEF_PHD;
  const doctoralSaving = doctoral.eligible * TAX_RATES.SZOCHO * TAX_RATES.SZOCHO_RELIEF_DOCTORAL;
  const engineerSaving =
    params.engineerRelief === 'SZOCHO_16' ? engineerWages * TAX_RATES.SZOCHO * TAX_RATES.SZOCHO_RELIEF_16 : 0;
  const totalSaving = phdSaving + doctoralSaving + engineerSaving;

  return {
    fullContribution: round(fullContribution),
    phdSaving: round(phdSaving),
    phdWagesOverCap: round(phd.overCap),
    doctoralSaving: round(doctoralSaving),
    doctoralWagesOverCap: round(doctoral.overCap),
    engineerSaving: round(engineerSaving),
    totalSaving: round(totalSaving),
    payableContribution: round(fullContribution - totalSaving),
  };
}

/**
 * Direct R&D cost: own personnel cost + materials + prototypes/testing +
 * independent subcontractors. This is the HIPA and innovation-contribution base.
 *
 * The Tao base is the same, except on the SZOCHO_16 route, where the engineer
 * wages (and their szocho) are excluded because they already got the 16. § relief.
 */
export function calculateDirectRdCost(
  costs: RdCostInputs,
  params: TaxParameters,
  szocho: SzochoResult,
): { directRdCost: number; personnelCost: number; citDeductibleBase: number } {
  const engineerWages = nonNegative(costs.engineerGrossWages);
  const grossWages = engineerWages + nonNegative(costs.phdGrossWages) + nonNegative(costs.doctoralGrossWages);
  const personnelCost =
    grossWages + (params.includeEmployerContribution ? szocho.payableContribution : 0);

  const directRdCost =
    personnelCost +
    nonNegative(costs.materialCosts) +
    nonNegative(costs.prototypeCosts) +
    nonNegative(costs.subcontractorCosts);

  let citDeductibleBase = directRdCost;
  if (params.engineerRelief === 'SZOCHO_16') {
    const engineerPayableSzocho = engineerWages * TAX_RATES.SZOCHO - szocho.engineerSaving;
    citDeductibleBase -= engineerWages + (params.includeEmployerContribution ? engineerPayableSzocho : 0);
  }

  return {
    directRdCost: round(directRdCost),
    personnelCost: round(personnelCost),
    citDeductibleBase: round(Math.max(0, citDeductibleBase)),
  };
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
  deductibleBase: number,
  profitBeforeTax: number,
): CorporateTaxResult {
  const base = nonNegative(deductibleBase);
  const nominalSaving = base * TAX_RATES.CIT;
  const usableDeduction = Math.min(base, nonNegative(profitBeforeTax));
  const immediateSaving = usableDeduction * TAX_RATES.CIT;

  return {
    deductibleBase: round(base),
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
 * R&D deduction applies. Micro and small enterprises are exempt (Inno. tv. 17. §).
 */
export function calculateInnovationContribution(
  directRdCost: number,
  client: Pick<ClientProfile, 'companySize' | 'annualRevenue'>,
): number {
  if (!isInnovationContributionLiable(client.companySize)) return 0;
  const deductible = Math.min(nonNegative(directRdCost), nonNegative(client.annualRevenue));
  return round(deductible * TAX_RATES.INNOVATION_CONTRIBUTION);
}

/**
 * Compares the two relief routes for engineer wages. The Tao route is worth
 * more on paper (9% vs 6.5%), but for a loss-making client only the szocho
 * route turns into cash this year.
 */
export function compareEngineerRoutes(
  costs: RdCostInputs,
  params: TaxParameters,
  profitBeforeTax: number,
): EngineerRouteComparison {
  const engineerWages = nonNegative(costs.engineerGrossWages);
  const withCit = { ...params, engineerRelief: 'CIT' as const };
  const withSzocho = { ...params, engineerRelief: 'SZOCHO_16' as const };

  const szochoCit = calculateSzocho(costs, withCit);
  const szocho16 = calculateSzocho(costs, withSzocho);
  const baseCit = calculateDirectRdCost(costs, withCit, szochoCit).citDeductibleBase;
  const base16 = calculateDirectRdCost(costs, withSzocho, szocho16).citDeductibleBase;
  const taoCit = calculateCorporateTax(baseCit, profitBeforeTax);
  const tao16 = calculateCorporateTax(base16, profitBeforeTax);

  const citNominal = taoCit.nominalSaving - tao16.nominalSaving;
  const citImmediate = taoCit.immediateSaving - tao16.immediateSaving;
  const szochoValue = szocho16.engineerSaving;

  return {
    citNominal,
    citImmediate,
    szocho16: szochoValue,
    // Prefer the route that yields more cash in the year under review.
    recommended: engineerWages > 0 && szochoValue > citImmediate ? 'SZOCHO_16' : 'CIT',
  };
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
  const szocho = calculateSzocho(costs, params);
  const { directRdCost, personnelCost, citDeductibleBase } = calculateDirectRdCost(costs, params, szocho);
  const corporateTax = calculateCorporateTax(citDeductibleBase, client.profitBeforeTax);
  const hipaSaving = calculateHipa(directRdCost, params.hipaRate, client.annualRevenue);
  const innovationContributionSaving = calculateInnovationContribution(directRdCost, client);
  const engineerRoutes = compareEngineerRoutes(costs, params, client.profitBeforeTax);

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
  if (nonNegative(costs.phdGrossWages) > 0 && Math.floor(nonNegative(costs.phdHeadcount)) === 0) {
    warnings.push('PhD-s bér van megadva létszám nélkül: a 15. § szerinti havi korlát miatt a kedvezmény 0 Ft. Adja meg a létszámot.');
  }
  if (nonNegative(costs.doctoralGrossWages) > 0 && Math.floor(nonNegative(costs.doctoralHeadcount)) === 0) {
    warnings.push('Doktorandusz bér van megadva létszám nélkül: a kedvezmény 0 Ft. Adja meg a létszámot.');
  }
  if (szocho.phdWagesOverCap > 0) {
    warnings.push(
      `A PhD-s bérek ${huf(szocho.phdWagesOverCap)} része a havi 500 000 Ft/fő korlát felett van; erre nem jár szocho-kedvezmény.`,
    );
  }
  if (szocho.doctoralWagesOverCap > 0) {
    warnings.push(
      `A doktorandusz bérek ${huf(szocho.doctoralWagesOverCap)} része a havi 200 000 Ft/fő korlát felett van; erre nem jár szocho-kedvezmény.`,
    );
  }
  if (engineerRoutes.recommended !== params.engineerRelief && nonNegative(costs.engineerGrossWages) > 0) {
    warnings.push(
      engineerRoutes.recommended === 'SZOCHO_16'
        ? `A mérnöki béreknél a Szocho tv. 16. § szerinti kedvezmény tárgyévben több készpénzt hoz (${huf(
            engineerRoutes.szocho16,
          )}), mint a Tao-levonás realizálható része (${huf(engineerRoutes.citImmediate)}).`
        : `A mérnöki béreknél a Tao-levonás tárgyévben többet ér (${huf(engineerRoutes.citImmediate)}), mint a 16. § szerinti szocho-kedvezmény (${huf(
            engineerRoutes.szocho16,
          )}).`,
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
    citDeductibleBase,
    engineerRoutes,
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
