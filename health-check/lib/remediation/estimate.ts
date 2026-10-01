import type { Division, RiskItem } from '@/lib/risk/types';
import { BILLING_RATES, rateOf } from './rates';
import { CORE_TEMPLATES } from './templates.core';
import { EXTRA_TEMPLATES, genericTemplate } from './templates.extra';
import type { EstimatedStep, PlanTemplate, RemediationEstimate } from './types';

/**
 * Javítási díj becslése munkalépésekből: lépésenként óra × az üzletág
 * szintenkénti óradíja; a terjedelem (pl. szerződések száma) a lépések óráit
 * skálázza; a sáv a várható érték szorzója. Kézi díj felülírja, de a terv
 * akkor is látszik, összevetésre.
 */

export const PLAN_TEMPLATES: Record<string, PlanTemplate> = { ...CORE_TEMPLATES, ...EXTRA_TEMPLATES };

export function planTemplateFor(code: string): PlanTemplate | undefined {
  return PLAN_TEMPLATES[code];
}

const hu = (x: number) => x.toLocaleString('hu-HU', { maximumFractionDigits: 2 });

/** Tízezres kerekítés a sáv két végén (a várható érték pontos, hogy a levezetés egyezzen). */
export const roundFee = (x: number) => Math.round(x / 10_000) * 10_000;

type PlanInput = Pick<RiskItem, 'code' | 'division' | 'serviceFeeHuf' | 'valuation' | 'plan'>;

export function estimateRemediation(item: PlanInput): RemediationEstimate {
  const tpl = PLAN_TEMPLATES[item.code];
  const template = tpl ?? genericTemplate(item.division);
  const ov = item.plan ?? {};

  let driver: RemediationEstimate['driver'] = null;
  if (template.driver) {
    const f = item.valuation?.formula;
    const fromValuation = template.driver.fromValuation && f?.type === 'PER_ITEM' ? f.count : null;
    const value = ov.driver ?? fromValuation ?? template.driver.default;
    const origin = ov.driver != null ? 'ITEM' : fromValuation != null ? 'VALUATION' : 'TEMPLATE';
    driver = { label: template.driver.label, unit: template.driver.unit, value: Math.max(0, value), origin };
  }

  const steps: EstimatedStep[] = template.steps.map((s, index) => {
    const division: Division = s.division ?? item.division;
    const per = s.perUnit ?? 0;
    const computed = s.hours + per * (driver?.value ?? 0);
    const custom = ov.hours?.[String(index)];
    const hours = custom != null && Number.isFinite(custom) ? Math.max(0, custom) : computed;
    const rate = rateOf(division, s.role);
    const hoursFormula = per && driver ? `${hu(s.hours)} + ${hu(per)} × ${hu(driver.value)} ${driver.unit}` : hu(s.hours);
    return {
      index,
      label: s.label,
      detail: s.detail,
      role: s.role,
      division,
      hours,
      baseHours: s.hours,
      perUnit: per,
      rate,
      feeHuf: Math.round(hours * rate),
      overridden: custom != null,
      hoursFormula,
    };
  });

  const planFeeHuf = steps.reduce((a, s) => a + s.feeHuf, 0);
  const hours = steps.reduce((a, s) => a + s.hours, 0);
  // Régi, egyösszegű díj sablon nélküli tételnél: kézi díjként él tovább.
  const manual = ov.feeOverrideHuf ?? (!tpl && item.serviceFeeHuf > 0 ? item.serviceFeeHuf : null);

  const byDivision: Partial<Record<Division, number>> = {};
  if (manual != null) byDivision[item.division] = manual;
  else for (const s of steps) byDivision[s.division] = (byDivision[s.division] ?? 0) + s.feeHuf;

  const [lo, hi] = template.spread;
  const fee =
    manual != null ? { low: manual, base: manual, high: manual } : { low: roundFee(planFeeHuf * lo), base: planFeeHuf, high: roundFee(planFeeHuf * hi) };

  const divisions = new Set(steps.map((s) => s.division));
  return {
    source: manual != null ? 'MANUAL' : tpl ? 'TEMPLATE' : 'GENERIC',
    goal: template.goal,
    steps,
    driver,
    hours,
    fee,
    planFeeHuf,
    spread: template.spread,
    uncertainty: template.uncertainty,
    client: template.client,
    external: template.external,
    assumptions: template.assumptions,
    byDivision,
    unapprovedRates: [...divisions].some((d) => !BILLING_RATES[d].approved),
    ...(ov.note ? { note: ov.note } : {}),
  };
}
