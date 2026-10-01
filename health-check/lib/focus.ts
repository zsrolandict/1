import { requestIntakeTab, type PageId } from '@/lib/guide';
import type { SourceLink } from '@/lib/risk/trail';

/**
 * Ugrás egy adott elemre (forrásra, kockázati sorra), akár oldalváltáson át:
 * a kérés a lap munkamenetébe kerül, a céloldal betöltés után megkeresi,
 * odagörget és rövid kiemeléssel jelzi.
 */
const KEY = 'ict-hc:focus';
export const FOCUS_EVENT = 'ict-hc:focus';

/** Ennél régebbi kérés már nem ugrat (pl. ha a cél nem jelent meg). */
const MAX_AGE_MS = 6000;

export function requestFocus(anchor: string): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ anchor, at: Date.now() }));
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent(FOCUS_EVENT, { detail: anchor }));
}

export function peekFocus(): string | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const { anchor, at } = JSON.parse(raw) as { anchor?: unknown; at?: unknown };
    return typeof anchor === 'string' && typeof at === 'number' && Date.now() - at < MAX_AGE_MS ? anchor : null;
  } catch {
    return null;
  }
}

export function clearFocus(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

/** Forrás megnyitása: oldal, adatgyűjtési fül, elem. */
export function openSource(link: SourceLink, go: ((page: PageId) => void) | undefined, current: PageId | undefined): void {
  if (link.tab) requestIntakeTab(link.tab);
  if (link.anchor) requestFocus(link.anchor);
  if (link.page !== current) go?.(link.page);
}
