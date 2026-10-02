import type { RiskItem } from '@/lib/risk/types';

/**
 * Adatbázis-sor → RiskItem. A hiteles mezők (értékek, napló-tömbök) a védett
 * oszlopokból jönnek, a többi (képlet, indoklás…) az `item` mezőből – így a
 * kliens a napló tartalmát nem tudja az `item`-en keresztül becsempészni.
 */
export interface RedFlagRow {
  id: string;
  item_key: string | null;
  item_code: string | null;
  item: Record<string, unknown> | null;
  pillar: RiskItem['pillar'];
  title: string;
  description: string | null;
  identified: boolean;
  likelihood: number;
  impact: number;
  exposure_huf: number;
  remediation_days: number;
  remediation: string | null;
  division: RiskItem['division'];
  service_fee_huf: number;
  source: string | null;
  evidence_trail: unknown[];
  change_log: unknown[];
  discussion: unknown[];
  remediation_plan: Record<string, unknown> | null;
  ignore_kind_adjustment: boolean;
}

export function rowToItem(row: RedFlagRow): RiskItem {
  const extra = { ...(row.item ?? {}) } as Partial<RiskItem>;
  delete extra.trail;
  delete extra.history;
  delete extra.discussion;
  return {
    ...extra,
    id: row.item_key ?? row.id,
    code: row.item_code ?? extra.code ?? row.id,
    pillar: row.pillar,
    title: row.title,
    description: row.description ?? '',
    identified: row.identified,
    likelihood: row.likelihood as RiskItem['likelihood'],
    impact: row.impact as RiskItem['impact'],
    exposureHuf: Number(row.exposure_huf),
    remediationDays: row.remediation_days,
    remediation: row.remediation ?? '',
    division: row.division,
    serviceFeeHuf: Number(row.service_fee_huf),
    source: (row.source ?? 'MANUAL') as RiskItem['source'],
    trail: row.evidence_trail as RiskItem['trail'],
    history: row.change_log as RiskItem['history'],
    discussion: row.discussion as RiskItem['discussion'],
    plan: (row.remediation_plan ?? {}) as RiskItem['plan'],
    ignoreKindAdjustment: row.ignore_kind_adjustment,
  };
}
