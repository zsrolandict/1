import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { dataPolicy, limitFor, RateLimiter, type LimitKind } from '@/lib/ai/policy';
import { authMode, isStaffRole, type AuthMode } from './mode';
import { logEvent } from '@/lib/monitoring';
import { distributedHit } from './rateLimit';
import { AUTH_COOKIE_OPTIONS } from './cookies';

export { AUTH_COOKIE_OPTIONS };

export type Access = { ok: true; mode: AuthMode; userId: string | null; role: string | null } | { ok: false; response: NextResponse };

export async function supabaseServer() {
  const store = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookieOptions: AUTH_COOKIE_OPTIONS,
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          /* Server Componentből hívva nem írható – a route handler megteszi */
        }
      },
    },
  });
}

/**
 * Minden szerveroldali AI-végpont első lépése. Ügyfél-felhasználó és
 * bejelentkezés nélküli hívó nem éri el a Claude / Azure kulcsokat.
 */
export async function requireStaff(): Promise<Access> {
  const mode = authMode();
  if (mode === 'DEMO') return { ok: true, mode, userId: null, role: null };
  if (mode === 'LOCKED') {
    return {
      ok: false,
      response: NextResponse.json({ error: 'A bejelentkezés nincs beállítva a szerveren, ezért az AI-funkciók zárva vannak.' }, { status: 503 }),
    };
  }

  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    return { ok: false, response: NextResponse.json({ error: 'Bejelentkezés szükséges.' }, { status: 401 }) };
  }
  // A profiles táblán RLS van: a felhasználó a saját sorát olvashatja.
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', data.user.id).maybeSingle();
  if (!isStaffRole(profile?.role)) {
    return { ok: false, response: NextResponse.json({ error: 'Ehhez a funkcióhoz nincs jogosultsága.' }, { status: 403 }) };
  }
  return { ok: true, mode, userId: data.user.id, role: profile.role };
}

/** Csak fejlesztői (DEMO) módban: egy folyamat, memóriában. Élesben az adatbázis számol. */
const devLimiter = new RateLimiter();

/**
 * AI-végpontok őre: belső felhasználó + adatkezelési szabály (DPA éles
 * módban) + hívásszám-korlát felhasználónként.
 */
export async function requireAi(req: Request, kind: LimitKind = 'ai'): Promise<Access> {
  const access = await requireStaff();
  if (!access.ok) return access;
  const policy = dataPolicy();
  if (!policy.ok) {
    logEvent({ event: 'ai_blocked_policy' });
    return { ok: false, response: NextResponse.json({ error: policy.error }, { status: policy.status }) };
  }
  // Élesben elosztott korlát az adatbázisban (audit K11): a kulcs a bejelentkezett
  // felhasználó (auth.uid()), nem kliens által küldött fejléc; minden szerverpéldány
  // ugyanazt a számlálót látja. Hiba esetén zárva (a költséges AI-hívás nem fut).
  const hit = access.mode === 'SUPABASE' ? await distributedHit(await supabaseServer(), kind, limitFor(kind)) : devLimiter.hit(`${kind}:local`, limitFor(kind));
  void req;
  if (!hit.ok && 'unavailable' in hit && hit.unavailable) {
    logEvent({ event: 'api_error', status: 503, kind: 'rate_limit_unavailable' });
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'A hívásszám-korlát most nem ellenőrizhető, ezért az AI-funkció átmenetileg zárva. Próbálja újra később.' },
        { status: 503 },
      ),
    };
  }
  if (!hit.ok) {
    logEvent({ event: 'ai_rate_limited', kind });
    return {
      ok: false,
      response: NextResponse.json(
        { error: `Túl sok AI-kérés egy órán belül. Próbálja újra ${Math.ceil(hit.retryAfterSec / 60)} perc múlva.` },
        { status: 429, headers: { 'Retry-After': String(hit.retryAfterSec) } },
      ),
    };
  }
  return access;
}
