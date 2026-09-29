/**
 * Helyi (böngészős) mentés nyilvántartása: mikor írtunk utoljára, hogy a
 * felület kiírhassa („Helyben mentve – 2 perce”). A tárolók ezt hívják
 * minden sikeres írás után.
 */

const KEY = 'ict-hc:last-saved';
export const SAVED_EVENT = 'ict-hc:saved';

export function markSaved(now = Date.now()): void {
  try {
    localStorage.setItem(KEY, String(now));
  } catch {
    return;
  }
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(SAVED_EVENT));
}

export function lastSaved(): number | null {
  try {
    const v = Number(localStorage.getItem(KEY));
    return Number.isFinite(v) && v > 0 ? v : null;
  } catch {
    return null;
  }
}

/** „most”, „2 perce”, „3 órája”, „4 napja”. */
export function ago(ts: number, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - ts) / 1000));
  if (s < 45) return 'most';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} perce`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} órája`;
  return `${Math.round(h / 24)} napja`;
}
