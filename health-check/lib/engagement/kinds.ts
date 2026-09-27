import type { Pillar } from '@/lib/risk/types';

/**
 * Átvilágítás-típusok. A motor, a katalógus és az interjúmodul ugyanaz,
 * a típus csak a hangsúlyokat, a keretet és a riport címzettjét állítja.
 */
export type EngagementKind =
  | 'HEALTH_CHECK'
  | 'VENDOR_DD'
  | 'BUY_SIDE_DD'
  | 'FINANCING_READINESS'
  | 'SUCCESSION'
  | 'COMPLIANCE_AUDIT'
  | 'POST_MERGER';

export interface EngagementKindProfile {
  kind: EngagementKind;
  label: string;
  /** Kinek szól a riport – ez határozza meg a hangnemet és a kérdések élét. */
  audience: string;
  purpose: string;
  /** Pillérsúlyok (összeg = 1): a kérdéssorrend és a keret-javaslat alapja. */
  weights: Record<Pillar, number>;
  hourBudget: number;
  /** Mely katalógustételeket érdemes minden esetben megkérdezni. */
  focusRiskCodes: string[];
  /** Típus-specifikus extra interjúkérdés-csoport kulcsa (questionBank). */
  extraTopic: string;
}

export const ENGAGEMENT_KINDS: Record<EngagementKind, EngagementKindProfile> = {
  HEALTH_CHECK: {
    kind: 'HEALTH_CHECK',
    label: 'Vállalati Health Check',
    audience: 'tulajdonos / ügyvezetés',
    purpose: 'Általános állapotfelmérés és 90 napos javítási terv.',
    weights: { FINANCE: 0.3, LEGAL: 0.25, OPERATIONS: 0.25, HR: 0.2 },
    hourBudget: 18,
    focusRiskCodes: ['FIN-02', 'LEG-02', 'OPS-01', 'HR-01'],
    extraTopic: 'GROWTH',
  },
  VENDOR_DD: {
    kind: 'VENDOR_DD',
    label: 'Vendor Due Diligence (eladói)',
    audience: 'eladó és potenciális vevők',
    purpose: 'Eladás előtti feltárás: a vevő által várhatóan talált hibák előzetes javítása, értékvédelem.',
    weights: { FINANCE: 0.35, LEGAL: 0.3, OPERATIONS: 0.15, HR: 0.2 },
    hourBudget: 21,
    focusRiskCodes: ['FIN-01', 'FIN-02', 'LEG-01', 'LEG-02', 'HR-01'],
    extraTopic: 'TRANSACTION',
  },
  BUY_SIDE_DD: {
    kind: 'BUY_SIDE_DD',
    label: 'Buy-side Due Diligence (vevői)',
    audience: 'vevő / befektető',
    purpose: 'Célpont átvilágítása: árazási és szerződéses (garancia, kártalanítás) következmények.',
    weights: { FINANCE: 0.35, LEGAL: 0.3, OPERATIONS: 0.2, HR: 0.15 },
    hourBudget: 21,
    focusRiskCodes: ['FIN-01', 'FIN-02', 'FIN-04', 'LEG-01', 'LEG-02', 'OPS-01'],
    extraTopic: 'TRANSACTION',
  },
  FINANCING_READINESS: {
    kind: 'FINANCING_READINESS',
    label: 'Finanszírozási felkészültség',
    audience: 'bank / tőkebefektető',
    purpose: 'Hitel- vagy tőkebevonás előtt: kovenánsok, cash-flow minőség, biztosítékok.',
    weights: { FINANCE: 0.5, LEGAL: 0.2, OPERATIONS: 0.2, HR: 0.1 },
    hourBudget: 18,
    focusRiskCodes: ['FIN-02', 'FIN-03', 'FIN-04', 'OPS-01'],
    extraTopic: 'FINANCING',
  },
  SUCCESSION: {
    kind: 'SUCCESSION',
    label: 'Generációváltás / utódlás',
    audience: 'alapító család',
    purpose: 'Tulajdonosi és vezetői átadás előkészítése, kulcsember-függőség csökkentése.',
    weights: { FINANCE: 0.2, LEGAL: 0.3, OPERATIONS: 0.15, HR: 0.35 },
    hourBudget: 20,
    focusRiskCodes: ['HR-01', 'LEG-03', 'FIN-02'],
    extraTopic: 'SUCCESSION',
  },
  COMPLIANCE_AUDIT: {
    kind: 'COMPLIANCE_AUDIT',
    label: 'Megfelelőségi audit',
    audience: 'ügyvezetés / felügyelőbizottság',
    purpose: 'Adó-, munkajogi, GDPR- és hatósági megfelelés ellenőrzése.',
    weights: { FINANCE: 0.3, LEGAL: 0.35, OPERATIONS: 0.15, HR: 0.2 },
    hourBudget: 19,
    focusRiskCodes: ['FIN-01', 'FIN-04', 'LEG-04', 'OPS-04', 'HR-02', 'HR-03'],
    extraTopic: 'COMPLIANCE',
  },
  POST_MERGER: {
    kind: 'POST_MERGER',
    label: 'Akvizíció utáni integráció',
    audience: 'új tulajdonos',
    purpose: 'Első 100 nap: integrációs kockázatok, kulcsemberek megtartása, folyamatok egységesítése.',
    weights: { FINANCE: 0.25, LEGAL: 0.2, OPERATIONS: 0.3, HR: 0.25 },
    hourBudget: 20,
    focusRiskCodes: ['HR-01', 'HR-04', 'OPS-02', 'OPS-01'],
    extraTopic: 'INTEGRATION',
  },
};

export const ENGAGEMENT_KIND_LIST = Object.values(ENGAGEMENT_KINDS);
