import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/auth/guard.server';
import { authMode } from '@/lib/auth/mode';
import { safeRedirectPath } from '@/lib/auth/redirect';

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
  return NextResponse.redirect(new URL(error ? '/login?hiba=1' : target, url.origin));
}
