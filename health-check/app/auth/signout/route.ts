import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/auth/guard.server';
import { authMode } from '@/lib/auth/mode';

/**
 * Kilépés a szerveren: a munkamenetet minden eszközön visszavonja (scope: global),
 * és törli a HttpOnly sütiket. Csak saját oldalról indított POST (Origin-ellenőrzés).
 */
export async function POST(req: Request) {
  const origin = req.headers.get('origin');
  const self = new URL(req.url).origin;
  if (origin && origin !== self) return NextResponse.json({ error: 'Tiltott kérés.' }, { status: 403 });
  if (authMode() === 'SUPABASE') {
    const supabase = await supabaseServer();
    await supabase.auth.signOut({ scope: 'global' });
  }
  return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
}
