/**
 * Szerveroldali, strukturált napló: egy esemény = egy JSON-sor a standard
 * kimeneten. A hosting (pl. Vercel, Fly.io) naplógyűjtője kereshető
 * mezőkként látja, így riasztás állítható rá (pl. `event=ai_call ok=false`
 * arány, `event=ai_rate_limited`). Tartalmat (dokumentum, leirat, prompt),
 * személyes adatot és kulcsot SOHA nem naplózunk – csak metaadatot.
 */
export type MonitoringEvent =
  | { event: 'ai_call'; provider: string; ok: boolean; ms: number; error?: string }
  | { event: 'api_error'; status: number; kind: string }
  | { event: 'ai_rate_limited'; kind: string }
  | { event: 'ai_blocked_policy' };

type Sink = (line: string) => void;
let sink: Sink = (line) => console.log(line);

/** Teszthez vagy külső gyűjtőhöz (pl. Sentry) más kimenet állítható be. */
export function setMonitoringSink(s: Sink): void {
  sink = s;
}

export function logEvent(e: MonitoringEvent, now = new Date()): void {
  try {
    sink(JSON.stringify({ ts: now.toISOString(), app: 'ict-health-check', ...e }));
  } catch {
    /* a napló hibája soha ne törje el a kérést */
  }
}

/** Egy AI-hívás időzítése és naplózása (a hiba típusát, nem az üzenetét). */
export async function timedAiCall<T>(provider: string, fn: () => Promise<T>): Promise<T> {
  const start = Date.now();
  try {
    const out = await fn();
    logEvent({ event: 'ai_call', provider, ok: true, ms: Date.now() - start });
    return out;
  } catch (e) {
    logEvent({ event: 'ai_call', provider, ok: false, ms: Date.now() - start, error: e instanceof Error ? e.name : 'unknown' });
    throw e;
  }
}
