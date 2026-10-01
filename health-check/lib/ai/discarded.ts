/**
 * Amit az AI javasolt, de a program utólagos ellenőrzése kiszűrt (például az
 * idézet nem található a forrásban). A felület listázza, hogy a tanácsadó
 * lássa, mi esett ki és miért; a kiszűrt elem nem kerül a javaslatok közé.
 */
export interface DiscardedItem {
  /** Milyen elem volt (pl. „Javasolt kockázat”, „Állítás”, „Tulajdonos”). */
  what: string;
  /** Az AI által adott tartalom röviden. */
  text: string;
  /** Az AI által megadott idézet (ahogy a modell írta). */
  quote: string;
  /** Miért esett ki. */
  reason: string;
}

export const NOT_FOUND = 'Az idézet szó szerint nem található a forrásban.';

const cut = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

export function discardedItem(what: string, text: string, quote: string, reason = NOT_FOUND): DiscardedItem {
  return { what, text: cut(text.trim(), 300), quote: cut(quote.trim(), 400), reason };
}
