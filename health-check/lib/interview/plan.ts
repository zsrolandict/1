import { adjustmentsFor } from '@/lib/engagement/adjustments';
import type { EngagementKind } from '@/lib/engagement/kinds';
import { scoreRisk } from '@/lib/risk/engine';
import type { Pillar, RiskItem } from '@/lib/risk/types';
import { buildInterviewGuide, MINUTES_PER_QUESTION } from './guide';
import { ROLE_LABEL } from './questionBank';
import type { GuideContext, InterviewQuestion, IntervieweeRole } from './types';

/**
 * Interjúterv: kivel beszéljünk, milyen sorrendben, mennyi ideig, miért és
 * miről. Az átvilágítás típusából és a bejelölt kockázatokból áll össze;
 * a témák ugyanabból a kérdésbankból jönnek, mint a részletes kérdéslista.
 */

export type InterviewPriority = 'REQUIRED' | 'RECOMMENDED';

export interface PlannedInterview {
  role: IntervieweeRole;
  /** A típushoz illő megnevezés (pl. utódlásnál „Kijelölt utód / helyettes”). */
  label: string;
  priority: InterviewPriority;
  order: number;
  minutes: number;
  /** Miért kell vele beszélni – a típusból és a bejelölt kockázatokból. */
  why: string[];
  /** A legfontosabb 4 téma a részletes kérdéslistából. */
  topics: InterviewQuestion[];
  questionCount: number;
  tip?: string;
}

interface RoleSpec {
  role: IntervieweeRole;
  priority: InterviewPriority;
  why: string;
  label?: string;
  tip?: string;
}

/** Típusonkénti alapterv – a sorrend is ez. */
const KIND_PLAN: Record<EngagementKind, RoleSpec[]> = {
  HEALTH_CHECK: [
    { role: 'OWNER_CEO', priority: 'REQUIRED', why: 'Stratégia, növekedési korlátok, a számok mögötti történet.' },
    { role: 'CFO', priority: 'REQUIRED', why: 'Eredményminőség, likviditás, kontrollok.' },
    { role: 'OPS_LEAD', priority: 'RECOMMENDED', why: 'Működési szűk keresztmetszetek, beszállítók.' },
    { role: 'HR_LEAD', priority: 'RECOMMENDED', why: 'Munkaerő, fluktuáció, jogviszonyok.' },
  ],
  VENDOR_DD: [
    { role: 'OWNER_CEO', priority: 'REQUIRED', why: 'Eladási szándék, árelvárás, és amit a vevő biztosan kérdezni fog.' },
    { role: 'CFO', priority: 'REQUIRED', why: 'Normalizált EBITDA, forgótőke, mérlegen kívüli tételek: ezekből lesz a vételár.' },
    { role: 'SALES_LEAD', priority: 'RECOMMENDED', why: 'Vevői szerződések, tulajdonosváltási záradékok, pipeline.' },
    { role: 'KEY_PERSON', priority: 'RECOMMENDED', why: 'Megtartás a tranzakció után: a vevő ezt külön árazza.', tip: 'Csak akkor, ha a tulajdonos engedi, hogy a kulcsember tudjon az eladásról.' },
  ],
  BUY_SIDE_DD: [
    { role: 'OWNER_CEO', priority: 'REQUIRED', label: 'Eladó / ügyvezető', why: 'Az eladói nyilatkozatok és szavatosságok alapja.' },
    { role: 'CFO', priority: 'REQUIRED', why: 'Eredményminőség, függő kötelezettségek, forgótőke.' },
    { role: 'SALES_LEAD', priority: 'REQUIRED', why: 'A bevétel stabilitása: top vevők, lejáratok, kilépési jogok.' },
    { role: 'OPS_LEAD', priority: 'RECOMMENDED', why: 'Kapacitás, beszállítói függés, beruházási igény.' },
    { role: 'KEY_PERSON', priority: 'RECOMMENDED', why: 'Kit kell megtartani a zárás után, és milyen feltétellel.' },
  ],
  FINANCING_READINESS: [
    { role: 'CFO', priority: 'REQUIRED', why: 'Ezt kérdezi először a bank: cash-flow, kovenánsok, biztosítékok.', tip: 'Vele kezdjük: az ő számai adják a többi interjú alapját.' },
    { role: 'OWNER_CEO', priority: 'REQUIRED', why: 'A finanszírozás célja, tulajdonosi kezesség, tőkeemelési hajlandóság.' },
    { role: 'SALES_LEAD', priority: 'RECOMMENDED', why: 'Vevőállomány, fizetési fegyelem, behajtás.' },
    { role: 'OPS_LEAD', priority: 'RECOMMENDED', why: 'Beruházási igény és kapacitás a tervhez.' },
  ],
  SUCCESSION: [
    { role: 'OWNER_CEO', priority: 'REQUIRED', label: 'Alapító / átadó', why: 'Az átadás elképzelése, tulajdonosi struktúra, családi megállapodások.' },
    { role: 'KEY_PERSON', priority: 'REQUIRED', label: 'Kijelölt utód / helyettes', why: 'Egyezik-e az elképzelése az alapítóéval; mit visz már ma önállóan.', tip: 'Az alapító jelenléte nélkül beszéljünk vele, különben nem kapunk őszinte képet.' },
    { role: 'CFO', priority: 'RECOMMENDED', why: 'Cégérték, a család és a cég vagyonának szétválasztása.' },
    { role: 'HR_LEAD', priority: 'RECOMMENDED', why: 'Ki bizonytalanodhat el a vezetőváltáskor.' },
  ],
  COMPLIANCE_AUDIT: [
    { role: 'CFO', priority: 'REQUIRED', why: 'Adózás, kapcsolt ügyletek, korábbi ellenőrzések.' },
    { role: 'HR_LEAD', priority: 'REQUIRED', why: 'Munkaidő, jogviszonyok, kötelező szabályzatok.' },
    { role: 'IT_LEAD', priority: 'REQUIRED', why: 'Személyes adatok kezelése, hozzáférések, incidensek.' },
    { role: 'OPS_LEAD', priority: 'RECOMMENDED', why: 'Engedélyek, munkavédelem, hatósági előírások.' },
  ],
  POST_MERGER: [
    { role: 'OWNER_CEO', priority: 'REQUIRED', label: 'Új ügyvezetés / integrációs vezető', why: 'Integrációs célok és az első 100 nap prioritásai.' },
    { role: 'HR_LEAD', priority: 'REQUIRED', why: 'Kulcsemberek megtartása, bérezés és kultúra összehangolása.' },
    { role: 'KEY_PERSON', priority: 'REQUIRED', why: 'Maradási szándék és aggodalmak: a legnagyobb integrációs kockázat.', tip: 'Bizalmas, négyszemközti beszélgetés; az álneves jegyzetet csak a HR-szakértő látja.' },
    { role: 'OPS_LEAD', priority: 'RECOMMENDED', why: 'Párhuzamos folyamatok és rendszerek.' },
    { role: 'IT_LEAD', priority: 'RECOMMENDED', why: 'Rendszerek és hozzáférések összevonása.' },
  ],
};

/** Mely kockázat kinél kérdezhető a legjobban (ha a kód nincs itt: pillér szerint). */
const RISK_OWNER: Record<string, IntervieweeRole> = {
  'LEG-01': 'SALES_LEAD', 'EPI-02': 'SALES_LEAD', 'FIN-03': 'CFO',
  'LEG-02': 'IT_LEAD', 'OPS-02': 'IT_LEAD', 'OPS-03': 'IT_LEAD', 'LEG-04': 'IT_LEAD',
  'ITF-01': 'IT_LEAD', 'ITF-03': 'IT_LEAD', 'ITF-04': 'IT_LEAD', 'PMI-02': 'OPS_LEAD',
  'HR-01': 'KEY_PERSON', 'PMI-01': 'KEY_PERSON',
  'SUC-01': 'OWNER_CEO', 'KON-04': 'OWNER_CEO', 'LEG-03': 'OWNER_CEO', 'BUY-01': 'OWNER_CEO', 'EPI-01': 'OWNER_CEO',
};

const PILLAR_OWNER: Record<Pillar, IntervieweeRole> = {
  FINANCE: 'CFO',
  LEGAL: 'OWNER_CEO',
  OPERATIONS: 'OPS_LEAD',
  HR: 'HR_LEAD',
};

export function riskOwner(risk: RiskItem): IntervieweeRole {
  return RISK_OWNER[risk.code] ?? PILLAR_OWNER[risk.pillar];
}

export function buildInterviewPlan(ctx: Omit<GuideContext, 'role'>): PlannedInterview[] {
  const specs = new Map<IntervieweeRole, RoleSpec & { reasons: string[] }>();
  for (const s of KIND_PLAN[ctx.kind]) specs.set(s.role, { ...s, reasons: [s.why] });

  // A bejelölt kockázatok bevonnak újabb interjúalanyokat, a pirosak kötelezővé tesznek.
  for (const r of ctx.risks) {
    if (!r.identified) continue;
    const owner = riskOwner(r);
    const red = scoreRisk(r, { adjustments: adjustmentsFor(ctx.kind) }).rag === 'RED';
    const reason = `Bejelölt kockázat: ${r.code} ${r.title}${red ? ' (piros)' : ''}`;
    const spec = specs.get(owner);
    if (spec) {
      spec.reasons.push(reason);
      if (red) spec.priority = 'REQUIRED';
    } else {
      specs.set(owner, { role: owner, priority: red ? 'REQUIRED' : 'RECOMMENDED', why: reason, reasons: [reason] });
    }
  }

  const baseOrder = KIND_PLAN[ctx.kind].map((s) => s.role);
  const ordered = [...specs.values()].sort((a, b) => {
    const ia = baseOrder.indexOf(a.role);
    const ib = baseOrder.indexOf(b.role);
    if (ia !== -1 || ib !== -1) return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    return (a.priority === 'REQUIRED' ? 0 : 1) - (b.priority === 'REQUIRED' ? 0 : 1);
  });

  return ordered.map((s, i) => {
    const guide = buildInterviewGuide({ ...ctx, role: s.role });
    const core = guide.filter((q) => q.priority <= 2);
    const minutes = Math.min(75, Math.max(30, Math.round((core.length * MINUTES_PER_QUESTION) / 15) * 15));
    return {
      role: s.role,
      label: s.label ?? ROLE_LABEL[s.role],
      priority: s.priority,
      order: i + 1,
      minutes,
      why: s.reasons.slice(0, 4),
      topics: guide.slice(0, 4),
      questionCount: guide.length,
      tip: s.tip,
    };
  });
}

/** A terv össz-interjúideje (kötelező, illetve minden interjú) percben. */
export function planMinutes(plan: PlannedInterview[]): { required: number; all: number } {
  return {
    required: plan.filter((p) => p.priority === 'REQUIRED').reduce((a, p) => a + p.minutes, 0),
    all: plan.reduce((a, p) => a + p.minutes, 0),
  };
}

export const CLOSING_TIP =
  'Az interjúk végén egy rövid (15 perces) záró egyeztetésen az ügyvezetővel tisztázzuk az interjúkban és a dokumentumokban talált ellentmondásokat.';
