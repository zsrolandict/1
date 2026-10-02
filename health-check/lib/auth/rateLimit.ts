/**
 * Elosztott hívásszám-korlát (audit K11) az adatbázis `rate_limit_hit`
 * függvényével (0014). A kulcsot az adatbázis képzi a munkamenetből
 * (auth.uid()), így se X-Forwarded-For hamisítás, se több szerverpéldány nem
 * kerüli meg. Ha a korlát nem ellenőrizhető, zárva marad (fail closed).
 */
export type HitResult = { ok: true } | { ok: false; retryAfterSec: number; unavailable?: boolean };

export interface RpcClient {
  rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }>;
}

export async function distributedHit(client: RpcClient, kind: string, limit: number, windowSeconds = 3600): Promise<HitResult> {
  try {
    const { data, error } = await client.rpc('rate_limit_hit', { p_kind: kind, p_max: limit, p_window_seconds: windowSeconds });
    const row = Array.isArray(data) ? data[0] : data;
    if (error || !row || typeof (row as { ok?: unknown }).ok !== 'boolean') return { ok: false, retryAfterSec: 60, unavailable: true };
    const r = row as { ok: boolean; retry_after: number };
    return r.ok ? { ok: true } : { ok: false, retryAfterSec: Math.max(1, Number(r.retry_after) || 60) };
  } catch {
    return { ok: false, retryAfterSec: 60, unavailable: true };
  }
}
