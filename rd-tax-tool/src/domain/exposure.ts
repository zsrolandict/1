/**
 * Money at risk: what the notification status and the SaaS contract set-up
 * cost the client, in forints.
 *
 * Every figure comes from re-running the software engine with one input
 * changed, so it follows exactly the same rules as the main calculation:
 *  - LOST       a notification was missed / late: the saving it would have
 *               kept had it been on time (cannot be recovered).
 *  - AT_RISK    a notification window is still open: the saving that is lost
 *               if the deadline passes.
 *  - FOREGONE   SaaS income without a separated licence fee: the yearly
 *               royalty relief a contract / invoice restructuring would unlock.
 */
import { IP_RULES } from './constants';
import { calculateSoftware, parseDate } from './software';
import type { ClientProfile, SoftwareAssetInputs } from './types';

export type ExposureKind = 'LOST' | 'AT_RISK' | 'FOREGONE';

export interface ExposureItem {
  kind: ExposureKind;
  label: string;
  /** Forints; one-off (sale) unless `annual` is true. */
  amount: number;
  annual: boolean;
  detail: string;
}

export interface Exposure {
  items: ExposureItem[];
  lost: number;
  atRisk: number;
  foregoneAnnual: number;
}

type Client = Pick<ClientProfile, 'taxYear' | 'profitBeforeTax' | 'annualRevenue' | 'companySize'>;

const DAY_MS = 86_400_000;
const shiftIso = (iso: string, days: number): string => {
  const d = parseDate(iso);
  return d ? new Date(d.getTime() + days * DAY_MS).toISOString().slice(0, 10) : '';
};

/** Sale saving + annual saving of a variant of the software inputs. */
function value(sw: SoftwareAssetInputs, client: Client, hipaRate: number, today: Date) {
  const r = calculateSoftware(sw, client, hipaRate, today);
  return { sale: r.sale.citSaving, annual: r.annualSaving };
}

export function calculateExposure(sw: SoftwareAssetInputs, client: Client, hipaRate: number, today: Date = new Date()): Exposure {
  const empty: Exposure = { items: [], lost: 0, atRisk: 0, foregoneAnnual: 0 };
  if (!sw.enabled) return empty;

  const base = calculateSoftware(sw, client, hipaRate, today);
  const baseSale = base.sale.citSaving;
  const items: ExposureItem[] = [];
  const planned = base.sale.gain > 0;

  sw.components.forEach((c, i) => {
    const status = base.components[i]?.deadline;
    if (!status || !c.capitalizedOn) return;
    const name = base.components[i]!.name;

    if (status.status === 'MISSED' || status.status === 'REPORTED_LATE') {
      // Had it been notified on time.
      const onTime = { ...sw, components: sw.components.map((x, j) => (j === i ? { ...x, reportedOn: x.capitalizedOn } : x)) };
      const amount = value(onTime, client, hipaRate, today).sale - baseSale;
      if (amount > 0) {
        items.push({
          kind: 'LOST',
          label: name,
          amount,
          annual: false,
          detail: `A ${IP_RULES.NOTIFICATION_DAYS} napos bejelentés elmaradt – ennyivel kevesebb az eladáskori Tao-megtakarítás.`,
        });
      }
    } else if (status.status === 'OPEN') {
      // If the window passes without a notification.
      const late = {
        ...sw,
        components: sw.components.map((x, j) => (j === i ? { ...x, reportedOn: shiftIso(x.capitalizedOn, IP_RULES.NOTIFICATION_DAYS + 1) } : x)),
      };
      const amount = baseSale - value(late, client, hipaRate, today).sale;
      items.push({
        kind: 'AT_RISK',
        label: name,
        amount: Math.max(0, amount),
        annual: false,
        detail: planned
          ? `Bejelentendő ${status.dueDate}-ig (még ${status.daysLeft} nap); ha elmarad, ennyi Tao-megtakarítás vész el eladáskor.`
          : `Bejelentendő ${status.dueDate}-ig (még ${status.daysLeft} nap). Eladás nincs tervezve, de elmulasztva a későbbi eladás kedvezménye sérül.`,
      });
    }
  });

  if (sw.revenueModel !== 'LICENSE' && !sw.saasLicenceSeparated) {
    const amount = value({ ...sw, saasLicenceSeparated: true }, client, hipaRate, today).annual - base.annualSaving;
    if (amount > 0) {
      items.push({
        kind: 'FOREGONE',
        label: 'SaaS-bevétel licencdíj-elkülönítés nélkül',
        amount,
        annual: true,
        detail:
          'Ha az ÁSZF szerzői jogi licencet adna, és a számla elkülönítené a licencdíjat, ennyi jogdíjkedvezmény járna évente (a teljes SaaS-bevételt licencdíjnak feltételezve – felső becslés).',
      });
    }
  }

  const sum = (kind: ExposureKind) => items.filter((x) => x.kind === kind).reduce((s, x) => s + x.amount, 0);
  return { items, lost: sum('LOST'), atRisk: sum('AT_RISK'), foregoneAnnual: sum('FOREGONE') };
}
