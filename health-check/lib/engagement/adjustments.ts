import type { EngagementKind } from './kinds';

/**
 * Típusfüggő korrekció: ugyanaz a tény más súlyú attól függően, miért
 * vizsgáljuk a céget. Pl. a Change of Control záradék Health Checknél alvó
 * kockázat, eladásnál viszont a tranzakció biztosan kiváltja.
 *
 * JAVASLAT: az értékeket a szakértőknek jóvá kell hagyniuk
 * (lásd KIND_ADJUSTMENTS_STATUS). A szakértő tételenként kikapcsolhatja.
 */
export interface KindAdjustment {
  /** Valószínűség-módosítás (−2…+2). */
  dL?: number;
  /** Hatás-módosítás (−2…+2). */
  dI?: number;
  reason: string;
}

export type KindAdjustments = Record<string, KindAdjustment>;

export const KIND_ADJUSTMENTS_STATUS = {
  approved: false,
  note: 'Kezdő javaslat; a pillérfelelős szakértők jóváhagyására vár.',
};

const TX = 'A tervezett tranzakció a záradékot biztosan kiváltja.';

export const KIND_ADJUSTMENTS: Record<EngagementKind, KindAdjustments> = {
  HEALTH_CHECK: {
    'LEG-01': { dL: -1, reason: 'Nincs tervezett tulajdonosváltás; a záradék csak tranzakciónál lép életbe.' },
  },
  VENDOR_DD: {
    'LEG-01': { dL: 2, reason: TX },
    'LEG-02': { dI: 1, reason: 'A vevő a szellemi tulajdon jogcímét a vételár alapjának tekinti.' },
    'LEG-03': { dL: 1, reason: 'A záráshoz a vevő rendezett társasági dokumentációt kér.' },
    'FIN-01': { dL: 1, reason: 'A vevői átvilágítás a kapcsolt ügyleteket biztosan vizsgálja.' },
    'FIN-02': { dI: 1, reason: 'A normalizált EBITDA közvetlenül a vételárat határozza meg.' },
    'HR-01': { dI: 1, reason: 'A vevő a kulcsember-függőséget vételár-csökkentéssel vagy earn-outtal árazza.' },
    'ITF-01': { dL: 1, reason: 'Befektetői átvilágításon a licenceket rendszeresen szkennelik.' },
  },
  BUY_SIDE_DD: {
    'LEG-01': { dL: 2, reason: TX },
    'LEG-02': { dI: 1, reason: 'A megvásárolt fő eszköz jogcíme bizonytalan.' },
    'FIN-01': { dL: 1, reason: 'A zárás előtti időszak adókockázata a vevőnél jelentkezik.' },
    'FIN-02': { dI: 1, reason: 'Az eredményminőség közvetlenül a vételárat érinti.' },
    'FIN-04': { dL: 1, reason: 'A zárás utáni adóellenőrzés kockázata a vevőt terheli.' },
    'HR-01': { dI: 1, reason: 'A kulcsember távozása a megvásárolt érték jelentős részét viheti el.' },
    'OPS-01': { dI: 1, reason: 'A vevő a bevétel és a fedezet stabilitását árazza.' },
  },
  FINANCING_READINESS: {
    'LEG-01': { dL: -1, reason: 'Nincs tervezett tulajdonosváltás.' },
    'FIN-02': { dI: 1, reason: 'A hitelképesség a fenntartható EBITDA-n alapul.' },
    'FIN-03': { dI: 1, reason: 'A bank a forgótőkét és a vevőminőséget vizsgálja elsőként.' },
    'OPS-01': { dI: 1, reason: 'Egy beszállítói kiesés a cash-flow-t és a törlesztést veszélyezteti.' },
    'HR-04': { dI: -1, reason: 'A hitelbírálat szempontjából másodlagos.' },
    'EPI-02': { dI: 0, dL: 1, reason: 'A bank a megrendelői koncentrációt külön kockázatként kezeli.' },
  },
  SUCCESSION: {
    'HR-01': { dL: 1, reason: 'Az átadás pontosan ezt a függőséget teszi próbára.' },
    'LEG-03': { dL: 2, reason: 'Az üzletrész-átruházáshoz rendezett létesítő okirat kell.' },
    'HR-04': { dI: 1, reason: 'Vezetőváltáskor nő a kulcsmunkatársak kilépési hajlandósága.' },
    'FIN-01': { dL: -1, reason: 'Tranzakciós vizsgálat nincs; a kockázat a szokásos adóellenőrzésre korlátozódik.' },
  },
  COMPLIANCE_AUDIT: {
    'LEG-01': { dL: -1, reason: 'Megfelelőségi szempontból nem releváns.' },
    'FIN-02': { dI: -1, reason: 'Megfelelőségi szempontból másodlagos.' },
    'FIN-01': { dL: 1, reason: 'Hatósági ellenőrzés kiemelt területe.' },
    'FIN-04': { dL: 1, reason: 'Hatósági ellenőrzés kiemelt területe.' },
    'LEG-04': { dL: 1, reason: 'Hatósági ellenőrzés kiemelt területe.' },
    'HR-02': { dL: 1, reason: 'Munkaügyi és adóellenőrzés kiemelt területe.' },
    'HR-03': { dL: 1, reason: 'Munkaügyi ellenőrzés kiemelt területe.' },
    'OPS-04': { dI: 1, reason: 'Engedély hiányában a tevékenység felfüggeszthető.' },
    'EPI-04': { dL: 1, reason: 'Munkavédelmi ellenőrzés kiemelt területe.' },
    'KON-02': { dL: 1, reason: 'Felügyeleti ellenőrzés kiemelt területe.' },
  },
  POST_MERGER: {
    'LEG-01': { dL: 1, reason: 'A lezajlott tulajdonosváltás után a partnerek élhetnek a felmondási joggal.' },
    'HR-01': { dL: 1, reason: 'Tulajdonosváltás után nő a kulcsemberek távozási hajlandósága.' },
    'HR-04': { dL: 1, reason: 'Az integráció bizonytalansága növeli a fluktuációt.' },
    'OPS-02': { dI: 1, reason: 'Az integráció a rendszerek összevonásán múlik.' },
    'FIN-02': { dI: -1, reason: 'Az akvizíció már lezárult; az eredményminőség már nem árazási kérdés.' },
  },
};

export function adjustmentsFor(kind: EngagementKind | undefined): KindAdjustments | undefined {
  return kind ? KIND_ADJUSTMENTS[kind] : undefined;
}

export function formatAdjustment(a: KindAdjustment): string {
  const part = (label: string, d?: number) => (d ? `${label}${d > 0 ? '+' : '−'}${Math.abs(d)}` : '');
  return [part('V', a.dL), part('H', a.dI)].filter(Boolean).join(' ') || '0';
}
