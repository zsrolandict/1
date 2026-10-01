import { KIND_ADJUSTMENTS_STATUS } from '@/lib/engagement/adjustments';
import { FIN_THRESHOLDS } from '@/lib/intake/financials/thresholds';
import { DEFAULT_OPTIONS, PROBABILITY } from './engine';
import { EXPERT_PARAMETERS } from './parameters';

/**
 * Feltevés-nyilvántartás: minden olyan szám és szabály, amely az eredményt
 * befolyásolja, de nem a vizsgált cég adataiból jön, hanem a módszertanból.
 * Egy helyen, hogy ne legyen rejtett állandó: a felület (Miért? panel),
 * a levezetés-munkafüzet és a dokumentáció ebből dolgozik.
 *
 * Állapot: egyik sem kalibrált lezárt projektek tényleges kimenetein; a
 * jóváhagyott értékeknél a felelős szakértő döntött, a többi kezdő javaslat.
 */

export type AssumptionStatus = 'APPROVED' | 'PROPOSAL';

export interface Assumption {
  id: string;
  label: string;
  value: string;
  /** Mire hat az eredményben. */
  effect: string;
  /** Honnan jön az érték. */
  basis: string;
  status: AssumptionStatus;
  owner: string;
  code: string;
}

export const ASSUMPTION_STATUS_LABEL: Record<AssumptionStatus, string> = {
  APPROVED: 'Jóváhagyva',
  PROPOSAL: 'Kezdő javaslat',
};

const pct = (x: number) => `${Math.round(x * 100)}%`;
const huf = (x: number) => `${(x / 1_000_000).toLocaleString('hu-HU')} M Ft`;
const fin = Object.values(FIN_THRESHOLDS);
const params = Object.values(EXPERT_PARAMETERS);

export const ASSUMPTIONS: Assumption[] = [
  {
    id: 'catalog-defaults',
    label: 'Katalógus-alapértékek (valószínűség, hatás, kitettség-képlet, javítási nap, díj)',
    value: 'tételenként',
    effect: 'A kiinduló pontszám és kitettség, amíg forrás vagy szakértő nem módosítja.',
    basis: 'Szakértői becslés tipikus magyar KKV-ra; nem cégspecifikus, nem forrásból.',
    status: 'PROPOSAL',
    owner: 'Pillérfelelős szakértők',
    code: 'lib/risk/catalog.ts',
  },
  {
    id: 'probability',
    label: 'Valószínűség → esély',
    value: ([1, 2, 3, 4, 5] as const).map((l) => `${l}: ${pct(PROBABILITY[l])}`).join(', '),
    effect: 'Várható veszteség = kitettség × esély; ezen át a lényegességi küszöb és a prioritás.',
    basis: 'Szakértői becslés; nem kalibrált bekövetkezési adatokon.',
    status: 'PROPOSAL',
    owner: 'Módszertan',
    code: 'lib/risk/engine.ts › PROBABILITY',
  },
  {
    id: 'rag-bands',
    label: 'Pontszám-sávok',
    value: '15-től piros, 8–14 sárga, 7-ig zöld',
    effect: 'A tétel besorolása (valószínűség × hatás alapján).',
    basis: 'Az 5×5-ös kockázati mátrix szokásos felosztása.',
    status: 'PROPOSAL',
    owner: 'Módszertan',
    code: 'lib/risk/engine.ts › ragFromScore',
  },
  {
    id: 'materiality',
    label: 'Lényegességi küszöb (alapértelmezés)',
    value: huf(DEFAULT_OPTIONS.materialityHuf),
    effect: 'Ha a várható veszteség eléri, a tétel a pontszámtól függetlenül piros.',
    basis: 'Jellemzően az EBITDA kb. 5%-a; projektenként átírható.',
    status: 'PROPOSAL',
    owner: 'Projektvezető',
    code: 'lib/risk/engine.ts › DEFAULT_OPTIONS',
  },
  {
    id: 'health-factor',
    label: 'Health-szorzó tételenként',
    value: '1 − pont/25 × 0,6',
    effect: 'A pillér-egészség a tételek szorzóinak szorzata × 100; egy 25 pontos tétel 40%-ra csökkenti.',
    basis: 'Módszertani választás (a 0,6 meredekség nem kalibrált).',
    status: 'PROPOSAL',
    owner: 'Módszertan',
    code: 'lib/risk/engine.ts › healthScore',
  },
  {
    id: 'pillar-rag',
    label: 'Pillér besorolása',
    value: 'piros: van piros tétel vagy egészség < 40; sárga: van sárga tétel vagy < 70',
    effect: 'A pillér és az összkép színe.',
    basis: 'Módszertani választás.',
    status: 'PROPOSAL',
    owner: 'Módszertan',
    code: 'lib/risk/engine.ts › pillarRag',
  },
  {
    id: 'pillar-weights',
    label: 'Pillérsúlyok',
    value: 'átvilágítás-típusonként',
    effect: 'A súlyozott Health Score.',
    basis: 'Szakértői becslés a típus céljához.',
    status: 'PROPOSAL',
    owner: 'Módszertan',
    code: 'lib/engagement/kinds.ts › weights',
  },
  {
    id: 'kind-adjustments',
    label: 'Típus-korrekciók (±1 valószínűség/hatás tételkódonként)',
    value: 'átvilágítás-típusonként',
    effect: 'A megadott valószínűség és hatás módosítása az átvilágítás célja szerint.',
    basis: KIND_ADJUSTMENTS_STATUS.note,
    status: KIND_ADJUSTMENTS_STATUS.approved ? 'APPROVED' : 'PROPOSAL',
    owner: 'Pillérfelelős szakértők',
    code: 'lib/engagement/adjustments.ts',
  },
  {
    id: 'priority',
    label: 'Prioritás',
    value: '0,5 × pont/25 + 0,5 × várható veszteség / legnagyobb + 0,15 quick win esetén',
    effect: 'A sorrend az akciótervben és a riportban.',
    basis: 'Módszertani választás.',
    status: 'PROPOSAL',
    owner: 'Módszertan',
    code: 'lib/risk/engine.ts › assess',
  },
  {
    id: 'quick-win',
    label: 'Quick win és időablak',
    value: `nem zöld és legfeljebb ${DEFAULT_OPTIONS.quickWinMaxDays} munkanap → 0–30 nap; piros → 31–60; sárga → 61–90; zöld → később`,
    effect: 'Az akcióterv időablaka.',
    basis: 'Módszertani választás.',
    status: 'PROPOSAL',
    owner: 'Módszertan',
    code: 'lib/risk/engine.ts › scoreRisk',
  },
  {
    id: 'exposure-formulas',
    label: 'Kitettség-képletek arányai (érintett árbevétel-arány, fedezet, DSO-rés)',
    value: 'tételenként (a Levezetés lap N–O oszlopa)',
    effect: 'A képlettel számolt kitettség.',
    basis: 'Szakértői becslés; tételenként felülírható.',
    status: 'PROPOSAL',
    owner: 'Pillérfelelős szakértők',
    code: 'lib/risk/catalog.ts, lib/risk/valuation.ts',
  },
  ...params.map((p): Assumption => ({
    id: `param-${p.label}`,
    label: p.label,
    value: huf(p.valueHuf),
    effect: 'Egységösszeg a darabszám-alapú kitettség-képletben.',
    basis: p.note,
    status: p.approved ? 'APPROVED' : 'PROPOSAL',
    owner: p.owner,
    code: 'lib/risk/parameters.ts',
  })),
  ...fin.map((t): Assumption => ({
    id: `fin-${t.label}`,
    label: `Pénzügyi küszöb: ${t.label}`,
    value: String(t.value),
    effect: 'Pénzügyi alapadatokból javasolt tétel (jóváhagyásra vár a mátrixban).',
    basis: 'Kezdő javaslat.',
    status: t.approved ? 'APPROVED' : 'PROPOSAL',
    owner: t.owner,
    code: 'lib/intake/financials/thresholds.ts',
  })),
];

/**
 * Ami továbbra sem vezethető le teljesen: emberi vagy modell-ítélet, amelyet a
 * program dokumentál, de nem tud „kiszámolni”.
 */
export const REMAINING_JUDGEMENT: { label: string; mitigation: string }[] = [
  {
    label: 'Az AI által javasolt 1–5 érték (valószínűség, hatás) és a kitettség-becslés',
    mitigation: 'Idézet kötelező és ellenőrzött; az értéket a szakértő fogadja el vagy írja át, a csökkentést indokolni kell.',
  },
  {
    label: 'Az AI saját bizonyosság-értéke',
    mitigation: 'Önbevallás, nem kalibrált valószínűség; csak tájékoztató, a pontszámba nem számít bele.',
  },
  {
    label: 'Az AI-felülvizsgálat érvelése',
    mitigation: 'A program elveti a nem ellenőrizhető hivatkozást és a forrás nélküli enyhítést; átvétel csak kézzel.',
  },
  {
    label: 'A leirat (hang → szöveg)',
    mitigation: 'Külső szolgáltató; a leirat szerkeszthető, az elemzés csak a leiratból idézhet.',
  },
  {
    label: 'A szakértő saját ítélete (pipálás, átírás)',
    mitigation: 'Változásnapló névvel és időponttal; csökkentésnél kötelező indoklás.',
  },
];
