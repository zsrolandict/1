'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { supabaseConfigured } from '@/lib/auth/supabase-browser';
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
      // A munkamenet HttpOnly sütiben van: a böngésző nem olvassa, a szerver adja vissza a profilt.
      const res = await fetch('/api/me', { cache: 'no-store' });
      if (!res.ok || cancelled) return;
      const { user } = (await res.json()) as { user: { name: string | null; role: string | null } | null };
      if (!user || cancelled) return;
      setIdentity({
        name: user.name,
        role: ROLE[user.role ?? ''] ?? null,
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
