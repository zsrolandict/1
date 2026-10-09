import { NextResponse } from 'next/server';
import { distributedHit } from '@/lib/auth/rateLimit';
import { supabaseServer } from '@/lib/auth/guard.server';

/** A szerveres mentés kérésének felső mérete (a böngészős tárhely nagyságrendje). */
export const MAX_SAVE_BYTES = 12 * 1024 * 1024;
/** Mentés és projektművelet felhasználónként, óránként (automatikus mentés ~1,5 mp-enként, szerkesztés közben). */
export const SAVE_LIMIT_PER_HOUR = 1200;

/**
 * JSON-kéréstörzs olvasása méretkorláttal: a törzset darabonként olvassuk, és a
 * korlát átlépésekor abbahagyjuk – a Content-Length hiánya vagy hamis értéke sem
 * kerüli meg. null: hibás JSON; 'too_large': túl nagy.
 */
export async function readJsonLimited(req: Request, maxBytes = MAX_SAVE_BYTES): Promise<unknown | null | 'too_large'> {
  const declared = Number(req.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > maxBytes) return 'too_large';
  if (!req.body) return null;
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel().catch(() => {});
      return 'too_large';
    }
    chunks.push(value);
  }
  const buf = new Uint8Array(size);
  let off = 0;
  for (const c of chunks) {
    buf.set(c, off);
    off += c.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder().decode(buf));
  } catch {
    return null;
  }
}

export const tooLarge = () => NextResponse.json({ error: 'A mentés túl nagy (12 MB fölött). Töröld a nem használt iratelemzéseket.' }, { status: 413 });

/** Elosztott hívásszám-korlát a szerveres írásokra (0014 rate_limit_hit); zárva marad, ha nem ellenőrizhető. */
export async function limitWrites(): Promise<NextResponse | null> {
  const hit = await distributedHit(await supabaseServer(), 'save', SAVE_LIMIT_PER_HOUR);
  if (hit.ok) return null;
  if ('unavailable' in hit && hit.unavailable) return NextResponse.json({ error: 'A mentés most nem ellenőrizhető, próbáld újra.' }, { status: 503 });
  return NextResponse.json({ error: 'Túl sok mentési kérés. Várj egy kicsit.' }, { status: 429, headers: { 'Retry-After': String(hit.retryAfterSec) } });
}
