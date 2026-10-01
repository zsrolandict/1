import type { Role } from '@/lib/timesheet/timesheet';
import type { Division } from '@/lib/risk/types';

/**
 * Számlázási óradíjak (nettó Ft/óra) üzletágonként és szintenként – a javítási
 * tervek díjbecslésének alapja. HELYKITÖLTŐK: az üzletágak vezetői hagyják jóvá
 * (`approved: true`, dátummal); amíg nincs jóváhagyva, a felület és a riport jelzi.
 *
 * Nem azonos az óraszám-követés belső önköltségével (`lib/timesheet` DEFAULT_RATES):
 * az a ráfordítás költsége, ez az ügyfélnek kiszámlázott díj.
 */
export interface DivisionRates {
  rates: Record<Role, number>;
  owner: string;
  approved: boolean;
  approvedAt?: string;
}

export const BILLING_RATES: Record<Division, DivisionRates> = {
  LEGAL: { rates: { PARTNER: 60_000, SENIOR: 38_000, JUNIOR: 22_000 }, owner: 'ICT Jog', approved: false },
  TAX: { rates: { PARTNER: 55_000, SENIOR: 35_000, JUNIOR: 20_000 }, owner: 'ICT Adó', approved: false },
  ACCOUNTING: { rates: { PARTNER: 40_000, SENIOR: 24_000, JUNIOR: 14_000 }, owner: 'ICT Könyvelés', approved: false },
  HR: { rates: { PARTNER: 45_000, SENIOR: 28_000, JUNIOR: 16_000 }, owner: 'ICT HR', approved: false },
  ADVISORY: { rates: { PARTNER: 55_000, SENIOR: 35_000, JUNIOR: 20_000 }, owner: 'ICT Tanácsadás', approved: false },
};

export const ROLE_SHORT: Record<Role, string> = { PARTNER: 'partner', SENIOR: 'szenior', JUNIOR: 'junior' };

export function rateOf(division: Division, role: Role): number {
  return BILLING_RATES[division].rates[role];
}

export const RATES_APPROVED = Object.values(BILLING_RATES).every((d) => d.approved);
