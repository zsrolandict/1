import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/auth/guard.server';
import { authMode } from '@/lib/auth/mode';

/** Magic link / Microsoft-belépés visszatérési pontja: a kódot munkamenetre cseréli. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  // Csak belső útvonalra irányítunk vissza (open redirect ellen).
  const next = url.searchParams.get('next');
  const target = next && next.startsWith('/') && !next.startsWith('//') ? next : '/';

  if (authMode() !== 'SUPABASE' || !code) {
    return NextResponse.redirect(new URL('/login?hiba=1', url.origin));
  }
  const supabase = await supabaseServer();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  return NextResponse.redirect(new URL(error ? '/login?hiba=1' : target, url.origin));
}
