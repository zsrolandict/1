/**
 * A pénzügyi szabályok küszöbei. KEZDŐ JAVASLATOK: a pénzügyi és a jogi
 * szakértő hagyja jóvá őket (a riport módszertani része jelzi, amíg nincs
 * jóváhagyva). Egy helyen, hogy a jóváhagyás után egyszerűen átírhatók legyenek.
 */
export interface Threshold {
  value: number;
  label: string;
  owner: string;
  approved: boolean;
}

export const FIN_THRESHOLDS = {
  REVENUE_DROP: { value: 0.2, label: 'Árbevétel-csökkenés az előző évhez képest', owner: 'Pénzügyi szakértő', approved: false },
  EBITDA_MARGIN_DROP: { value: 0.05, label: 'EBITDA-ráta romlása (százalékpont)', owner: 'Pénzügyi szakértő', approved: false },
  NET_DEBT_EBITDA: { value: 3.5, label: 'Nettó adósság / EBITDA felső határa', owner: 'Pénzügyi szakértő', approved: false },
  CURRENT_RATIO: { value: 1, label: 'Likviditási ráta alsó határa', owner: 'Pénzügyi szakértő', approved: false },
  DSO_WORSENING: { value: 15, label: 'Vevői fizetési idő romlása (nap)', owner: 'Pénzügyi szakértő', approved: false },
  RECONCILE_TOLERANCE: { value: 0.1, label: 'Beszámoló és adattábla eltérésének tűrése', owner: 'Pénzügyi szakértő', approved: false },
  TURNOVER: { value: 0.2, label: 'Éves fluktuáció felső határa', owner: 'HR-szakértő', approved: false },
  HEADCOUNT_TOLERANCE: { value: 0.25, label: 'Létszám-eltérés tűrése (melléklet ↔ tényállás)', owner: 'HR-szakértő', approved: false },
  LOAN_MATURITY_MONTHS: { value: 12, label: 'Közeli hitellejárat (hónap)', owner: 'Pénzügyi szakértő', approved: false },
} satisfies Record<string, Threshold>;

export type ThresholdKey = keyof typeof FIN_THRESHOLDS;

export const FIN_THRESHOLDS_APPROVED = Object.values(FIN_THRESHOLDS).every((t) => t.approved);
