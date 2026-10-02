import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/auth/guard.server';
import { authMode } from '@/lib/auth/mode';
import { emailDomainAllowed, safeRedirectPath } from '@/lib/auth/redirect';

/** Magic link / Microsoft-belépés visszatérési pontja: a kódot munkamenetre cseréli. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  // Csak saját oldalra irányítunk vissza (open redirect ellen).
  const target = safeRedirectPath(url.searchParams.get('next'), url.origin);

  if (authMode() !== 'SUPABASE' || !code) {
    return NextResponse.redirect(new URL('/login?hiba=1', url.origin));
  }
  const supabase = await supabaseServer();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(new URL('/login?hiba=1', url.origin));
  // Meghívás-kapu (audit K12): csak meghívott (profillal rendelkező) felhasználó, és ha
  // be van állítva, csak engedélyezett e-mail-domainről. Az adatbázis is tiltja (0014).
  const { data } = await supabase.auth.getUser();
  const email = data.user?.email ?? '';
  const { data: profile } = data.user ? await supabase.from('profiles').select('id').eq('id', data.user.id).maybeSingle() : { data: null };
  if (!profile || !emailDomainAllowed(email)) {
    await supabase.auth.signOut({ scope: 'global' });
    return NextResponse.redirect(new URL('/login?hiba=meghivas', url.origin));
  }
  return NextResponse.redirect(new URL(target, url.origin));
}
