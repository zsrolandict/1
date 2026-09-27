/**
 * What-if scenarios: the same case with one decision changed, re-run through
 * the engine. Each row shows the change in the annual saving, in the cash
 * realisable this year and in the one-off sale saving.
 */
import { TAX_RATES } from './constants';
import { calculateSavings } from './engine';
import type { Assessment, SavingsResult } from './types';

export interface ScenarioDefinition {
  id: string;
  title: string;
  description: string;
  /** False for purely hypothetical rows (e.g. a notification that can no longer be made). */
  applicable: boolean;
  variant: Assessment;
}

export interface ScenarioRow extends Omit<ScenarioDefinition, 'variant'> {
  variant: Assessment;
  annual: number;
  annualDelta: number;
  /** Cash realisable this year: annual saving less the Tao part deferred to later years. */
  thisYearDelta: number;
  saleDelta: number;
}

const UNIVERSITY_SCENARIO_COST = 25_000_000;

/** Saving that turns into cash this year (deferred Tao excluded). */
export const realisableThisYear = (s: SavingsResult): number => s.totalAnnualSaving - s.corporateTax.deferredSaving;

function definitions(a: Assessment, s: SavingsResult): ScenarioDefinition[] {
  const list: ScenarioDefinition[] = [];

  if (a.costs.engineerGrossWages > 0) {
    const toSzocho = a.params.engineerRelief === 'CIT';
    list.push({
      id: 'engineer-route',
      title: toSzocho ? 'Mérnöki bérek: szocho 16. § a Tao-levonás helyett' : 'Mérnöki bérek: Tao-levonás a szocho 16. § helyett',
      description: toSzocho
        ? 'A fokozat nélküli K+F-bérek 6,5%-os havi szocho-kedvezményt kapnak, de kikerülnek a Tao-alapból. Veszteséges évben előnyös.'
        : 'A bérek visszakerülnek a 9%-os Tao-levonásba; nyereséges évben többet ér.',
      applicable: true,
      variant: { ...a, params: { ...a.params, engineerRelief: toSzocho ? 'SZOCHO_16' : 'CIT' } },
    });
  }

  const immediate = a.params.citDeductionTiming === 'IMMEDIATE';
  if (s.citDeductibleBase > 0) {
    list.push({
      id: 'timing',
      title: immediate
        ? `Aktivált fejlesztés levonása ${a.params.amortizationYears} év alatt, az értékcsökkenéssel`
        : 'Aktivált fejlesztés levonása egy összegben, a felmerülés évében',
      description: immediate
        ? 'Idén kevesebb, a következő években több Tao-levonás – akkor érdemes, ha a mostani eredmény nem fedezi a levonást.'
        : 'A teljes K+F-levonás idén érvényesül.',
      applicable: true,
      variant: { ...a, params: { ...a.params, citDeductionTiming: immediate ? 'AMORTIZATION' : 'IMMEDIATE' } },
    });
  }

  if (a.costs.universityJointCosts === 0 && s.citDeductibleBase > 0) {
    const joint = Math.min(UNIVERSITY_SCENARIO_COST, s.citDeductibleBase);
    list.push({
      id: 'university',
      title: `${Math.round(joint / 1e6)} M Ft K+F egyetemmel / kutatóintézettel közösen`,
      description: `A közösen végzett rész háromszorosa vonható le (legfeljebb ${Math.round(TAX_RATES.UNIVERSITY_CAP / 1e6)} M Ft, de minimis).`,
      applicable: true,
      variant: { ...a, costs: { ...a.costs, universityJointCosts: joint } },
    });
  }

  const sw = a.software;
  if (sw.enabled && sw.revenueModel !== 'LICENSE' && !sw.saasLicenceSeparated) {
    list.push({
      id: 'saas-licence',
      title: 'SaaS-szerződések átalakítása: elkülönített licencdíj',
      description: 'Az ÁSZF szerzői jogi licencet ad, a számla elkülöníti a licencdíjat – így a jogdíjkedvezmény érvényesíthető.',
      applicable: true,
      variant: { ...a, software: { ...sw, saasLicenceSeparated: true } },
    });
  }

  if (sw.enabled) {
    const pending = s.ipBox.components.some((c) => c.deadline.status !== 'REPORTED_ON_TIME' && c.deadline.status !== 'NO_DATE');
    if (pending) {
      list.push({
        id: 'notify-all',
        title: 'Minden bejelentés határidőben',
        description: 'Összevetés: mennyit ér, ha minden eredeti fejlesztést és továbbfejlesztést határidőn belül bejelentenek. Az elmulasztott határidő utólag nem pótolható.',
        applicable: false,
        variant: {
          ...a,
          software: { ...sw, components: sw.components.map((c) => (c.capitalizedOn ? { ...c, reportedOn: c.capitalizedOn } : c)) },
        },
      });
    }
  }

  return list;
}

export function compareScenarios(a: Assessment, today: Date = new Date()): { base: SavingsResult; rows: ScenarioRow[] } {
  const base = calculateSavings(a.client, a.costs, a.params, a.software, today);
  const rows = definitions(a, base).map((d) => {
    const r = calculateSavings(d.variant.client, d.variant.costs, d.variant.params, d.variant.software, today);
    return {
      ...d,
      annual: r.totalAnnualSaving,
      annualDelta: r.totalAnnualSaving - base.totalAnnualSaving,
      thisYearDelta: realisableThisYear(r) - realisableThisYear(base),
      saleDelta: r.ipBox.sale.citSaving - base.ipBox.sale.citSaving,
    };
  });
  return { base, rows };
}
