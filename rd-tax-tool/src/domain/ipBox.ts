/**
 * IP-box: reliefs on income from qualifying intangibles (software, patents).
 *
 *   nexus            = min(1, own × 1.3 / (own + related-party + acquisition))
 *   royalty profit   = royalty income − attributable costs
 *   Tao deduction    = min(50% × royalty profit × nexus, 50% × pre-tax profit)
 *   Tao saving       = deduction × 9%   (≈ 4.5% effective rate with full nexus)
 *
 * Sale of a notified ("bejelentett") intangible: the gain × nexus is
 * deductible if the asset was notified to NAV within 60 days of acquisition
 * and held for at least one year. A missed notification cannot be made up.
 *
 * Rules marked VERIFY in IP_RULES and the HIPA share are assumptions to be
 * confirmed by the tax team.
 */
import { IP_RULES, isInnovationContributionLiable, TAX_RATES } from './constants';
import type { ClientProfile, IpBoxInputs, IpBoxResult, IpDeadlineStatus } from './types';

const nonNegative = (value: number): number => (Number.isFinite(value) && value > 0 ? value : 0);
const round = (value: number): number => Math.round(value);

const DAY_MS = 86_400_000;

/** Parses yyyy-mm-dd as a UTC date; null when empty or invalid. */
export function parseDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const d = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

const toIsoDate = (d: Date): string => d.toISOString().slice(0, 10);
const startOfUtcDay = (d: Date): Date => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
const addDays = (d: Date, days: number): Date => new Date(d.getTime() + days * DAY_MS);
const addYears = (d: Date, years: number): Date =>
  new Date(Date.UTC(d.getUTCFullYear() + years, d.getUTCMonth(), d.getUTCDate()));

export function nexusRatio(ip: Pick<IpBoxInputs, 'nexusOwnCosts' | 'nexusRelatedPartyCosts' | 'nexusAcquisitionCosts'>): number {
  const own = nonNegative(ip.nexusOwnCosts);
  const total = own + nonNegative(ip.nexusRelatedPartyCosts) + nonNegative(ip.nexusAcquisitionCosts);
  if (total === 0) return 0;
  return Math.min(1, (own * IP_RULES.NEXUS_UPLIFT) / total);
}

/** 60-day notification window from acquisition / creation. */
export function notificationDeadline(ip: Pick<IpBoxInputs, 'acquiredOn' | 'reportedOn'>, today: Date) {
  const acquired = parseDate(ip.acquiredOn);
  if (!acquired) return { status: 'NO_DATE' as IpDeadlineStatus, dueDate: '', daysLeft: 0 };
  const due = addDays(acquired, IP_RULES.NOTIFICATION_DAYS);
  const reported = parseDate(ip.reportedOn);
  const daysLeft = Math.round((due.getTime() - startOfUtcDay(today).getTime()) / DAY_MS);

  let status: IpDeadlineStatus;
  if (reported) status = reported.getTime() <= due.getTime() ? 'REPORTED_ON_TIME' : 'REPORTED_LATE';
  else status = daysLeft >= 0 ? 'OPEN' : 'MISSED';

  return { status, dueDate: toIsoDate(due), daysLeft };
}

export function calculateIpBox(
  ip: IpBoxInputs,
  client: Pick<ClientProfile, 'profitBeforeTax' | 'annualRevenue' | 'companySize'>,
  hipaRate: number,
  today: Date = new Date(),
): IpBoxResult {
  const deadline = notificationDeadline(ip, today);
  const empty: IpBoxResult = {
    enabled: false,
    nexusRatio: 0,
    royaltyProfit: 0,
    royaltyDeduction: 0,
    royaltyCitSaving: 0,
    effectiveRoyaltyCitRate: 0,
    hipaSaving: 0,
    innovationContributionSaving: 0,
    annualSaving: 0,
    deadline,
    sale: { eligible: false, reasons: [], deduction: 0, citSaving: 0 },
    warnings: [],
  };
  if (!ip.enabled) return empty;

  const warnings: string[] = [];
  const ratio = nexusRatio(ip);
  const royaltyProfit = Math.max(0, nonNegative(ip.royaltyIncome) - nonNegative(ip.royaltyRelatedCosts));
  const uncapped = royaltyProfit * IP_RULES.ROYALTY_DEDUCTION_SHARE * ratio;
  const cap = nonNegative(client.profitBeforeTax) * IP_RULES.ROYALTY_PROFIT_CAP_SHARE;
  const royaltyDeduction = Math.min(uncapped, cap);
  const royaltyCitSaving = royaltyDeduction * TAX_RATES.CIT;

  if (royaltyProfit > 0 && ratio === 0) {
    warnings.push('A nexus-arányhoz nincs megadva saját fejlesztési költség, ezért a jogdíjkedvezmény 0 Ft.');
  }
  if (uncapped > cap && royaltyProfit > 0) {
    warnings.push(
      'A jogdíjkedvezmény eléri az adózás előtti eredmény 50%-át; a felette lévő rész nem érvényesíthető.',
    );
  }

  // HIPA / innovation contribution: configurable until the Htv. rule is confirmed.
  const share = Math.max(0, Math.min(1, ip.hipaRoyaltyReliefShare));
  const hipaBaseReduction = Math.min(nonNegative(ip.royaltyIncome), nonNegative(client.annualRevenue)) * share;
  const hipaSaving = hipaBaseReduction * Math.min(nonNegative(hipaRate), TAX_RATES.HIPA_MAX);
  const innovationContributionSaving = isInnovationContributionLiable(client.companySize)
    ? hipaBaseReduction * TAX_RATES.INNOVATION_CONTRIBUTION
    : 0;

  // Sale of a notified intangible.
  const reasons: string[] = [];
  const gain = nonNegative(ip.plannedSaleGain);
  if (gain > 0) {
    if (deadline.status === 'NO_DATE') reasons.push('Hiányzik a szerzés / létrehozás dátuma.');
    if (deadline.status === 'MISSED' || deadline.status === 'REPORTED_LATE')
      reasons.push(`A NAV-bejelentés nem történt meg ${IP_RULES.NOTIFICATION_DAYS} napon belül; ez utólag nem pótolható.`);
    if (deadline.status === 'OPEN')
      reasons.push(`A bejelentés még nincs meg – határidő: ${deadline.dueDate} (${deadline.daysLeft} nap).`);
    const acquired = parseDate(ip.acquiredOn);
    const sale = parseDate(ip.plannedSaleDate);
    if (acquired && sale && sale.getTime() < addYears(acquired, IP_RULES.MIN_HOLDING_YEARS).getTime()) {
      reasons.push(`A tervezett eladásig nem telik el ${IP_RULES.MIN_HOLDING_YEARS} év a szerzés óta.`);
    }
    if (ratio === 0) reasons.push('A nexus-arány 0.');
  }
  // An open deadline is still achievable, so it does not block the estimate.
  const blocking = reasons.filter((r) => !r.startsWith('A bejelentés még nincs meg'));
  const saleEligible = gain > 0 && blocking.length === 0;
  const saleDeduction = saleEligible ? gain * ratio : 0;

  if (deadline.status === 'OPEN') {
    warnings.push(
      `Az immateriális jószágot ${deadline.dueDate}-ig be kell jelenteni a NAV-nak (még ${deadline.daysLeft} nap); utólag nem pótolható.`,
    );
  }
  if (deadline.status === 'MISSED') {
    warnings.push('Az immateriális jószág 60 napos bejelentési határideje lejárt; az eladási nyereség kedvezménye nem érvényesíthető.');
  }

  const annualSaving = royaltyCitSaving + hipaSaving + innovationContributionSaving;

  return {
    enabled: true,
    nexusRatio: ratio,
    royaltyProfit: round(royaltyProfit),
    royaltyDeduction: round(royaltyDeduction),
    royaltyCitSaving: round(royaltyCitSaving),
    effectiveRoyaltyCitRate: royaltyProfit > 0 ? (royaltyProfit * TAX_RATES.CIT - royaltyCitSaving) / royaltyProfit : 0,
    hipaSaving: round(hipaSaving),
    innovationContributionSaving: round(innovationContributionSaving),
    annualSaving: round(annualSaving),
    deadline,
    sale: {
      eligible: saleEligible,
      reasons,
      deduction: round(saleDeduction),
      citSaving: round(saleDeduction * TAX_RATES.CIT),
    },
    warnings,
  };
}
