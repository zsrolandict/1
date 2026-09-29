/**
 * Szerveroldali szabályok az AI-hívásokra.
 *
 * 1. Adatkezelés: éles buildben (NODE_ENV=production) az AI csak akkor fut,
 *    ha az üzemeltető kifejezetten megerősítette, hogy a beállított
 *    szolgáltatóval adatfeldolgozói szerződés (DPA) van, fizetős, EU-s
 *    adatkezeléssel (`AI_DPA_CONFIRMED=1`). Az ingyenes Gemini-kulcs ezt nem
 *    teljesíti (a beküldött adat fejlesztésre is felhasználható).
 * 2. Hívásszám-korlát felhasználónként, hogy egy fiók (vagy ellopott
 *    munkamenet) ne égethesse el a keretet.
 */

type Env = Record<string, string | undefined>;

export type PolicyResult = { ok: true } | { ok: false; status: number; error: string };

export function dataPolicy(env: Env = process.env): PolicyResult {
  if (env.NODE_ENV !== 'production') return { ok: true };
  if (env.AI_DPA_CONFIRMED === '1') return { ok: true };
  return {
    ok: false,
    status: 503,
    error:
      'Éles módban az AI csak adatfeldolgozói szerződéssel (DPA) rendelkező, fizetős, EU-s szolgáltatóval használható. ' +
      'Ha ez megvan, az üzemeltető állítsa be: AI_DPA_CONFIRMED=1.',
  };
}

export type LimitKind = 'ai' | 'transcribe';

export function limitFor(kind: LimitKind, env: Env = process.env): number {
  const raw = kind === 'ai' ? env.AI_RATE_LIMIT_PER_HOUR : env.TRANSCRIBE_RATE_LIMIT_PER_HOUR;
  const n = Number(raw);
  if (Number.isFinite(n) && n > 0) return Math.floor(n);
  return kind === 'ai' ? 40 : 10;
}

/**
 * Csúszóablakos számláló a memóriában. Egy szerverpéldányon belül érvényes;
 * több példánynál (serverless) közös tár kell (pl. Supabase-tábla vagy Redis).
 */
export class RateLimiter {
  private hits = new Map<string, number[]>();
  constructor(private windowMs = 3_600_000) {}

  hit(key: string, limit: number, now = Date.now()): { ok: true } | { ok: false; retryAfterSec: number } {
    const from = now - this.windowMs;
    const list = (this.hits.get(key) ?? []).filter((t) => t > from);
    if (list.length >= limit) {
      this.hits.set(key, list);
      return { ok: false, retryAfterSec: Math.max(1, Math.ceil((list[0] + this.windowMs - now) / 1000)) };
    }
    list.push(now);
    this.hits.set(key, list);
    if (this.hits.size > 10_000) this.prune(from);
    return { ok: true };
  }

  private prune(from: number) {
    for (const [k, v] of this.hits) {
      if (!v.some((t) => t > from)) this.hits.delete(k);
    }
  }
}
