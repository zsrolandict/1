/**
 * Software IP-box engine: the whole life of one software asset.
 *
 *  Development   original build + capitalised enhancements (továbbfejlesztés);
 *                each is notified to NAV separately within 75 days
 *                (Tao. tv. 4. § 5.) – a missed notification cannot be made up.
 *  Nexus         cumulative over the asset's life (Tao. tv. 7. § (22)–(25)):
 *                min(1, own × 1.3 / (own + related-party + acquired)).
 *  Royalty       per tax year: Tao deduction = min(50% × royalty profit × nexus,
 *                50% × pre-tax profit) (Tao. tv. 7. § (1) s)), ≈ 4.5% effective
 *                Tao with full nexus. HIPA: royalty income deductible in full,
 *                no nexus (Htv. 39. § (1)). SaaS income counts only if the
 *                contracts and invoices separate a copyright licence fee.
 *  Sale          gain = price − book value. Exempt only if the original was
 *                notified on time and held ≥ 1 year from the original
 *                acquisition (not restarted by enhancements). Enhancements not
 *                notified on time make their share of the gain taxable.
 */
import { IP_RULES, isInnovationContributionLiable, TAX_RATES } from './constants';
import type {
  ClientProfile,
  ComponentResult,
  NotificationDeadline,
  NotificationStatus,
  QualificationLevel,
  RoyaltyYearResult,
  SoftwareAssetInputs,
  SoftwareComponent,
  SoftwareQualification,
  SoftwareResult,
} from './types';

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
const addYears = (d: Date, years: number): Date =>
  new Date(Date.UTC(d.getUTCFullYear() + years, d.getUTCMonth(), d.getUTCDate()));

/** Notification window from capitalisation / completion. */
export function notificationDeadline(capitalizedOn: string, reportedOn: string, today: Date): NotificationDeadline {
  const start = parseDate(capitalizedOn);
  if (!start) return { status: 'NO_DATE', dueDate: '', daysLeft: 0 };
  const due = new Date(start.getTime() + IP_RULES.NOTIFICATION_DAYS * DAY_MS);
  const reported = parseDate(reportedOn);
  const daysLeft = Math.round((due.getTime() - startOfUtcDay(today).getTime()) / DAY_MS);
  let status: NotificationStatus;
  if (reported) status = reported.getTime() <= due.getTime() ? 'REPORTED_ON_TIME' : 'REPORTED_LATE';
  else status = daysLeft >= 0 ? 'OPEN' : 'MISSED';
  return { status, dueDate: toIsoDate(due), daysLeft };
}

type NexusInputs = Pick<SoftwareComponent, 'ownCosts' | 'relatedPartyCosts' | 'acquisitionCosts'>;

/** Cumulative nexus over the given components. */
export function nexusRatio(components: readonly NexusInputs[]): number {
  let own = 0;
  let total = 0;
  for (const c of components) {
    own += nonNegative(c.ownCosts);
    total += nonNegative(c.ownCosts) + nonNegative(c.relatedPartyCosts) + nonNegative(c.acquisitionCosts);
  }
  return total === 0 ? 0 : Math.min(1, (own * IP_RULES.NEXUS_UPLIFT) / total);
}

/** Components capitalised by the end of `year` (undated ones are included). */
const componentsUpTo = (components: readonly SoftwareComponent[], year: number) =>
  components.filter((c) => {
    const d = parseDate(c.capitalizedOn);
    return !d || d.getUTCFullYear() <= year;
  });

/** Urgency order for the headline deadline: act on open windows first. */
function mostUrgent(deadlines: NotificationDeadline[]): NotificationDeadline {
  const rank: Record<NotificationStatus, number> = { OPEN: 0, NO_DATE: 1, MISSED: 2, REPORTED_LATE: 3, REPORTED_ON_TIME: 4 };
  return (
    [...deadlines].sort((a, b) => rank[a.status] - rank[b.status] || a.daysLeft - b.daysLeft)[0] ?? {
      status: 'NO_DATE',
      dueDate: '',
      daysLeft: 0,
    }
  );
}

const notifiedOrPending = (s: NotificationStatus) => s === 'REPORTED_ON_TIME' || s === 'OPEN';

export function calculateSoftware(
  sw: SoftwareAssetInputs,
  client: Pick<ClientProfile, 'taxYear' | 'profitBeforeTax' | 'annualRevenue' | 'companySize'>,
  hipaRate: number,
  today: Date = new Date(),
): SoftwareResult {
  const components: ComponentResult[] = sw.components.map((c) => ({
    id: c.id,
    name: c.name || (c.kind === 'ORIGINAL' ? 'Eredeti fejlesztés' : 'Továbbfejlesztés'),
    kind: c.kind,
    capitalizedValue: nonNegative(c.capitalizedValue),
    deadline: notificationDeadline(c.capitalizedOn, c.reportedOn, today),
  }));
  const deadline = mostUrgent(components.map((c) => c.deadline));
  if (!sw.enabled) return disabledResult(components, deadline);
  const royaltyQualifies = sw.revenueModel === 'LICENSE' || sw.saasLicenceSeparated;
  const rate = Math.min(nonNegative(hipaRate), TAX_RATES.HIPA_MAX);
  const liable = isInnovationContributionLiable(client.companySize);

  const years: RoyaltyYearResult[] = [...sw.royaltyYears]
    .sort((a, b) => a.year - b.year)
    .map((y) => {
      const ratio = nexusRatio(componentsUpTo(sw.components, y.year));
      const royaltyProfit = Math.max(0, nonNegative(y.royaltyIncome) - nonNegative(y.relatedCosts));
      const deduction = royaltyQualifies
        ? Math.min(
            royaltyProfit * IP_RULES.ROYALTY_DEDUCTION_SHARE * ratio,
            nonNegative(y.profitBeforeTax) * IP_RULES.ROYALTY_PROFIT_CAP_SHARE,
          )
        : 0;
      // HIPA / innovation contribution: royalty income deductible in full, no nexus.
      const hipaBase =
        royaltyQualifies && sw.hipaRoyaltyDeduction
          ? Math.min(nonNegative(y.royaltyIncome), nonNegative(client.annualRevenue))
          : 0;
      const citSaving = deduction * TAX_RATES.CIT;
      const hipaSaving = hipaBase * rate;
      const innovationContributionSaving = liable ? hipaBase * TAX_RATES.INNOVATION_CONTRIBUTION : 0;
      return {
        year: y.year,
        nexusRatio: ratio,
        royaltyProfit: round(royaltyProfit),
        deduction: round(deduction),
        citSaving: round(citSaving),
        hipaSaving: round(hipaSaving),
        innovationContributionSaving: round(innovationContributionSaving),
        total: round(citSaving + hipaSaving + innovationContributionSaving),
      };
    });

  const warnings: string[] = [];
  if (!royaltyQualifies) {
    warnings.push(
      'A SaaS-bevétel alapesetben szolgáltatás, nem jogdíj: jogdíjkedvezmény csak akkor számolható, ha az ÁSZF / szerződés szerzői jogi licencet ad, és a számla elkülöníti a licencdíjat. Most csak a K+F-költségkedvezmények érvényesek.',
    );
  }
  for (const c of components) {
    if (c.deadline.status === 'OPEN') {
      warnings.push(
        `„${c.name}” bejelentése ${c.deadline.dueDate}-ig esedékes a NAV-nál (még ${c.deadline.daysLeft} nap); a ${IP_RULES.NOTIFICATION_DAYS} napos határidő jogvesztő.`,
      );
    } else if (c.deadline.status === 'MISSED' || c.deadline.status === 'REPORTED_LATE') {
      warnings.push(
        c.kind === 'ORIGINAL'
          ? `Az eredeti fejlesztés ${IP_RULES.NOTIFICATION_DAYS} napos bejelentése elmaradt / késett: az eladási nyereség kedvezménye nem érvényesíthető.`
          : `„${c.name}” továbbfejlesztés nem lett határidőben bejelentve: eladáskor az erre jutó értéknövekmény nyeresége adóköteles.`,
      );
    }
  }

  const current = years.find((y) => y.year === client.taxYear);
  if (royaltyQualifies && !current && sw.royaltyYears.length > 0) {
    warnings.push(`Nincs jogdíjsor a vizsgált ${client.taxYear}. adóévre; az éves összesítő ezért 0 Ft IP-box megtakarítást tartalmaz.`);
  }
  const currentInput = sw.royaltyYears.find((y) => y.year === client.taxYear);
  const currentProfit = current?.royaltyProfit ?? 0;

  // ---- Sale ---------------------------------------------------------------
  const gain = Math.max(0, nonNegative(sw.salePrice) - nonNegative(sw.saleBookValue));
  const reasons: string[] = [];
  let exemptShare = 0;
  let saleDeduction = 0;
  const saleDate = parseDate(sw.saleDate);
  const original = sw.components.find((c) => c.kind === 'ORIGINAL');
  const originalResult = components.find((c) => c.kind === 'ORIGINAL');

  if (gain > 0) {
    let blocked = false;
    if (!original || !originalResult) {
      reasons.push('Hiányzik az eredeti fejlesztés.');
      blocked = true;
    } else {
      const s = originalResult.deadline.status;
      if (s === 'NO_DATE') {
        reasons.push('Hiányzik az eredeti fejlesztés aktiválási dátuma.');
        blocked = true;
      } else if (s === 'MISSED' || s === 'REPORTED_LATE') {
        reasons.push('Az eredeti fejlesztést nem jelentették be határidőben – az eladási kedvezmény nem jár.');
        blocked = true;
      } else if (s === 'OPEN') {
        reasons.push(`Az eredeti fejlesztés bejelentése még hátravan (${originalResult.deadline.dueDate}-ig).`);
      }
      const acquired = parseDate(original.capitalizedOn);
      if (acquired && saleDate && saleDate.getTime() < addYears(acquired, IP_RULES.MIN_HOLDING_YEARS).getTime()) {
        reasons.push(
          `Az eladásig nem telik el ${IP_RULES.MIN_HOLDING_YEARS} év az eredeti szerzés óta (a továbbfejlesztés nem indítja újra, de az eredetitől számítva sincs meg).`,
        );
        blocked = true;
      }
    }

    if (!blocked) {
      const inScope = sw.components
        .map((c, i) => ({ c, r: components[i]! }))
        .filter(({ c }) => {
          const d = parseDate(c.capitalizedOn);
          return !saleDate || !d || d.getTime() <= saleDate.getTime();
        });
      const totalValue = inScope.reduce((sum, { r }) => sum + r.capitalizedValue, 0);
      const exemptValue = inScope
        .filter(({ r }) => notifiedOrPending(r.deadline.status))
        .reduce((sum, { r }) => sum + r.capitalizedValue, 0);
      exemptShare = totalValue > 0 ? exemptValue / totalValue : 1;
      if (totalValue === 0) reasons.push('Az aktivált értékek nincsenek megadva: a teljes nyereséget mentesnek feltételezzük.');
      for (const { r } of inScope) {
        if (r.kind === 'ENHANCEMENT' && !notifiedOrPending(r.deadline.status)) {
          reasons.push(`„${r.name}” nincs határidőben bejelentve: az értéknövekményére jutó nyereség adóköteles.`);
        }
      }
      const saleYear = saleDate ? saleDate.getUTCFullYear() : client.taxYear;
      const ratio = sw.applyNexusToSaleGain ? nexusRatio(componentsUpTo(sw.components, saleYear)) : 1;
      saleDeduction = gain * exemptShare * ratio;
    }
  }

  const annualSaving = current?.total ?? 0;
  const currentNexus = current?.nexusRatio ?? nexusRatio(componentsUpTo(sw.components, client.taxYear));

  const qualification = qualify({
    royaltyQualifies,
    components,
    nexus: currentNexus,
    hasRoyalty: (currentInput?.royaltyIncome ?? 0) > 0,
    annualSaving,
    gain,
    saleDeduction,
    exemptShare,
  });

  return {
    enabled: sw.enabled,
    qualification,
    royaltyQualifies,
    components,
    years,
    nexusRatio: currentNexus,
    royaltyProfit: currentProfit,
    royaltyDeduction: current?.deduction ?? 0,
    royaltyCitSaving: current?.citSaving ?? 0,
    effectiveRoyaltyCitRate:
      currentProfit > 0 && currentInput ? (currentProfit * TAX_RATES.CIT - (current?.citSaving ?? 0)) / currentProfit : 0,
    hipaSaving: current?.hipaSaving ?? 0,
    innovationContributionSaving: current?.innovationContributionSaving ?? 0,
    annualSaving,
    deadline,
    sale: {
      gain: round(gain),
      exemptShare,
      deduction: round(saleDeduction),
      taxablePart: round(gain - saleDeduction),
      citSaving: round(saleDeduction * TAX_RATES.CIT),
      eligible: gain > 0 && saleDeduction > 0,
      reasons,
    },
    warnings,
  };
}

/**
 * Overall verdict:
 *  NONE    – no software relief is available at all (no royalty relief and no exempt sale gain)
 *  PARTIAL – some relief is available, but something reduces or endangers it
 *  FULL    – royalty relief with 100% nexus, every notification on time, exempt sale (if planned)
 */
function qualify(input: {
  royaltyQualifies: boolean;
  components: ComponentResult[];
  nexus: number;
  hasRoyalty: boolean;
  annualSaving: number;
  gain: number;
  saleDeduction: number;
  exemptShare: number;
}): SoftwareQualification {
  const issues: string[] = [];
  if (!input.royaltyQualifies) issues.push('A SaaS-bevétel elkülönített licencdíj nélkül szolgáltatás: jogdíjkedvezmény nem jár.');
  for (const c of input.components) {
    const s = c.deadline.status;
    if (c.kind === 'ORIGINAL' && (s === 'MISSED' || s === 'REPORTED_LATE'))
      issues.push('Az eredeti fejlesztés bejelentése elmaradt / késett: eladási kedvezmény nem jár.');
    else if (s === 'MISSED' || s === 'REPORTED_LATE')
      issues.push(`„${c.name}” nincs határidőben bejelentve: értéknövekménye eladáskor adóköteles.`);
    else if (s === 'OPEN') issues.push(`„${c.name}” bejelentése folyamatban – még ${c.deadline.daysLeft} nap.`);
    else if (s === 'NO_DATE') issues.push(`„${c.name}”: az aktiválás dátuma hiányzik.`);
  }
  if (input.royaltyQualifies && input.hasRoyalty && input.nexus < 1)
    issues.push(`Nexus ${Math.round(input.nexus * 1000) / 10}%: a jogdíjkedvezmény arányosan kisebb.`);
  if (input.gain > 0 && input.saleDeduction === 0) issues.push('A tervezett eladás nyeresége nem mentes.');
  else if (input.gain > 0 && input.exemptShare < 1) issues.push('Az eladási nyereség csak részben mentes.');

  const benefit = input.annualSaving > 0 || input.saleDeduction > 0;
  const level: QualificationLevel = !benefit ? 'NONE' : issues.length > 0 ? 'PARTIAL' : 'FULL';
  return { level, issues };
}

function disabledResult(components: ComponentResult[], deadline: NotificationDeadline): SoftwareResult {
  return {
    enabled: false,
    qualification: { level: 'NONE', issues: [] },
    royaltyQualifies: false,
    components,
    years: [],
    nexusRatio: 0,
    royaltyProfit: 0,
    royaltyDeduction: 0,
    royaltyCitSaving: 0,
    effectiveRoyaltyCitRate: 0,
    hipaSaving: 0,
    innovationContributionSaving: 0,
    annualSaving: 0,
    deadline,
    sale: { gain: 0, exemptShare: 0, deduction: 0, taxablePart: 0, citSaving: 0, eligible: false, reasons: [] },
    warnings: [],
  };
}
