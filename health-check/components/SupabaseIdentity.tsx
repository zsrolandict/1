'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { supabaseBrowser, supabaseConfigured } from '@/lib/auth/supabase-browser';
import { IdentityProvider, type Identity, type WorkRole } from './Identity';

const ROLE: Record<string, WorkRole> = { partner: 'PARTNER', manager: 'SENIOR', consultant: 'SENIOR' };

/**
 * A bejelentkezett felhasználó neve és szerepköre a Supabase-profilból.
 * Ha nincs beállítva a bejelentkezés, vagy nincs munkamenet, a helyi
 * (böngészőben megadott) névre esik vissza.
 */
export default function SupabaseIdentity({ children }: { children: ReactNode }) {
  const [identity, setIdentity] = useState<Identity | null>(null);
  useEffect(() => {
    if (!supabaseConfigured) return;
    let cancelled = false;
    (async () => {
      const sb = supabaseBrowser();
      const { data } = await sb.auth.getUser();
      if (!data.user || cancelled) return;
      const { data: profile } = await sb.from('profiles').select('full_name, role').eq('id', data.user.id).maybeSingle();
      if (cancelled) return;
      setIdentity({
        name: profile?.full_name || data.user.email || null,
        role: ROLE[profile?.role ?? ''] ?? null,
        source: 'login',
        loading: false,
      });
    })().catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  // null: nincs bejelentkezett felhasználó – a helyi név marad érvényben (a fa szerkezete nem változik).
  return <IdentityProvider value={identity}>{children}</IdentityProvider>;
}
