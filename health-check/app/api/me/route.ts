import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/auth/guard.server';
import { authMode } from '@/lib/auth/mode';

/** A bejelentkezett felhasználó neve és szerepköre (a böngésző a HttpOnly munkamenetet nem olvassa). */
export async function GET() {
  if (authMode() !== 'SUPABASE') return NextResponse.json({ user: null });
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.json({ user: null }, { status: 401 });
  const { data: profile } = await supabase.from('profiles').select('full_name, role').eq('id', data.user.id).maybeSingle();
  return NextResponse.json(
    { user: { name: profile?.full_name ?? data.user.email ?? null, role: profile?.role ?? null } },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
