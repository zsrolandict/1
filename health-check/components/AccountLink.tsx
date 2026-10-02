'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LogIn, LogOut } from 'lucide-react';
import { supabaseConfigured } from '@/lib/auth/supabase-browser';
import { useIdentity } from './Identity';

/**
 * Fiók az oldalsáv alján: bejelentkezve a név és „Kilépés”, anélkül „Belépés”.
 * Ha a bejelentkezés nincs beállítva (fejlesztői gép), semmit nem mutat,
 * hogy ne ígérjünk olyat, ami nem működik.
 */
export default function AccountLink() {
  const me = useIdentity();
  const router = useRouter();
  if (!supabaseConfigured) return null;
  if (me.source === 'login' && me.name) {
    return (
      <span className="flex items-center gap-2 text-sm text-slate-300">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white" aria-hidden>
          {me.name.slice(0, 1).toUpperCase()}
        </span>
        <span className="min-w-0 flex-1 truncate" title={me.name}>
          {me.name}
        </span>
        <button
          onClick={async () => {
            // A munkamenet HttpOnly sütiben van: a kilépést a szerver végzi (minden eszközön).
            await fetch('/auth/signout', { method: 'POST' }).catch(() => {});
            router.push('/login');
          }}
          aria-label="Kilépés"
          title="Kilépés"
          className="rounded p-1 text-slate-500 hover:bg-white/10 hover:text-white"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </span>
    );
  }
  return (
    <Link href="/login" className="inline-flex items-center gap-2 text-sm text-slate-300 hover:text-white">
      <LogIn className="h-4 w-4" /> Belépés
    </Link>
  );
}
