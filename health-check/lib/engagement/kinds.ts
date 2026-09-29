import type { Pillar } from '@/lib/risk/types';

/**
 * Átvilágítás-típusok. A motor, a katalógus és az interjúmodul ugyanaz,
 * a típus csak a hangsúlyokat, a keretet és a riport címzettjét állítja.
 */
export type EngagementKind = 'HEALTH_CHECK' | 'VENDOR_DD' | 'BUY_SIDE_DD' | 'FINANCING_READINESS' | 'SUCCESSION' | 'COMPLIANCE_AUDIT' | 'POST_MERGER';

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
  /** A riport nézőpontja: a vezetői összefoglalóban és az ajánlatban jelenik meg. */
  reportLens: string;
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
    reportLens: 'A megállapításokat a tulajdonos szemszögéből rangsoroltuk: mi veszélyezteti a cég stabil működését és növekedését, és mi javítható gyorsan.',
  },
  VENDOR_DD: {
    kind: 'VENDOR_DD',
    label: 'Vendor Due Diligence (eladói)',
    audience: 'eladó és potenciális vevők',
    purpose: 'Eladás előtti feltárás: a vevő által várhatóan talált hibák előzetes javítása, értékvédelem.',
    weights: { FINANCE: 0.35, LEGAL: 0.3, OPERATIONS: 0.15, HR: 0.2 },
    hourBudget: 21,
    focusRiskCodes: ['FIN-01', 'FIN-02', 'LEG-01', 'LEG-02', 'HR-01'],
    reportLens:
      'Ezeket a pontokat egy vevő átvilágítása nagy valószínűséggel feltárja. Javításuk az eladás előtt a vételár és a tárgyalási pozíció védelmét szolgálja.',
  },
  BUY_SIDE_DD: {
    kind: 'BUY_SIDE_DD',
    label: 'Buy-side Due Diligence (vevői)',
    audience: 'vevő / befektető',
    purpose: 'Célpont átvilágítása: árazási és szerződéses (garancia, kártalanítás) következmények.',
    weights: { FINANCE: 0.35, LEGAL: 0.3, OPERATIONS: 0.2, HR: 0.15 },
    hourBudget: 21,
    focusRiskCodes: ['FIN-01', 'FIN-02', 'FIN-04', 'LEG-01', 'LEG-02', 'OPS-01'],
    reportLens:
      'A megállapítások a vevő szemszögéből készültek: a vételár, a szavatossági nyilatkozatok és a kártalanítási feltételek tárgyalásához adnak alapot.',
  },
  FINANCING_READINESS: {
    kind: 'FINANCING_READINESS',
    label: 'Finanszírozási felkészültség',
    audience: 'bank / tőkebefektető',
    purpose: 'Hitel- vagy tőkebevonás előtt: kovenánsok, cash-flow minőség, biztosítékok.',
    weights: { FINANCE: 0.5, LEGAL: 0.2, OPERATIONS: 0.2, HR: 0.1 },
    hourBudget: 18,
    focusRiskCodes: ['FIN-02', 'FIN-03', 'FIN-04', 'OPS-01'],
    reportLens:
      'Ezeket a kérdéseket egy bank vagy befektető a hitelbírálat során várhatóan felteszi. Rendezésük javítja a finanszírozás esélyét és feltételeit.',
  },
  SUCCESSION: {
    kind: 'SUCCESSION',
    label: 'Generációváltás / utódlás',
    audience: 'alapító család',
    purpose: 'Tulajdonosi és vezetői átadás előkészítése, kulcsember-függőség csökkentése.',
    weights: { FINANCE: 0.2, LEGAL: 0.3, OPERATIONS: 0.15, HR: 0.35 },
    hourBudget: 20,
    focusRiskCodes: ['HR-01', 'LEG-03', 'FIN-02'],
    reportLens: 'A megállapítások az átadás előtti teendőket mutatják: mi veszélyezteti a cég működését és értékét a tulajdonos és a vezetés váltásakor.',
  },
  COMPLIANCE_AUDIT: {
    kind: 'COMPLIANCE_AUDIT',
    label: 'Megfelelőségi audit',
    audience: 'ügyvezetés / felügyelőbizottság',
    purpose: 'Adó-, munkajogi, GDPR- és hatósági megfelelés ellenőrzése.',
    weights: { FINANCE: 0.3, LEGAL: 0.35, OPERATIONS: 0.15, HR: 0.2 },
    hourBudget: 19,
    focusRiskCodes: ['FIN-01', 'FIN-04', 'LEG-04', 'OPS-04', 'HR-02', 'HR-03'],
    reportLens:
      'A megállapítások a jogszabályi és hatósági megfelelés hiányait mutatják. A piros tételek hatósági ellenőrzés esetén közvetlen bírságkockázatot jelentenek.',
  },
  POST_MERGER: {
    kind: 'POST_MERGER',
    label: 'Akvizíció utáni integráció',
    audience: 'új tulajdonos',
    purpose: 'Első 100 nap: integrációs kockázatok, kulcsemberek megtartása, folyamatok egységesítése.',
    weights: { FINANCE: 0.25, LEGAL: 0.2, OPERATIONS: 0.3, HR: 0.25 },
    hourBudget: 20,
    focusRiskCodes: ['HR-01', 'HR-04', 'OPS-02', 'OPS-01'],
    reportLens: 'A megállapítások az integráció első 100 napjának kockázatait és teendőit rangsorolják, az új tulajdonos szemszögéből.',
  },
};

export const ENGAGEMENT_KIND_LIST = Object.values(ENGAGEMENT_KINDS);

/** Projektvezetésre fenntartott órák (egyeztetés, review, riport-kiadás). */
export const PM_HOURS = 2;

/**
 * Az óraszámkeret pillérenkénti bontása a típus súlyai szerint
 * (legnagyobb maradék módszerrel egész órákra, összege = keret − PM).
 */
export function hourSplit(kind: EngagementKind): { pillar: Pillar; hours: number }[] {
  const p = ENGAGEMENT_KINDS[kind];
  const available = p.hourBudget - PM_HOURS;
  const raw = (Object.keys(p.weights) as Pillar[]).map((pillar) => ({ pillar, exact: available * p.weights[pillar] }));
  const out = raw.map((r) => ({ pillar: r.pillar, hours: Math.floor(r.exact), rest: r.exact - Math.floor(r.exact) }));
  let missing = available - out.reduce((a, r) => a + r.hours, 0);
  for (const r of [...out].sort((a, b) => b.rest - a.rest)) {
    if (missing <= 0) break;
    r.hours += 1;
    missing -= 1;
  }
  return out.map(({ pillar, hours }) => ({ pillar, hours }));
}
