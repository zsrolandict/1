'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { supabaseBrowser, supabaseConfigured } from '@/lib/auth/supabase-browser';
import { useIdentity } from './Identity';

/**
 * Fiók a felső sávban: bejelentkezve a név és „Kilépés”, anélkül „Belépés”.
 * Ha a bejelentkezés nincs beállítva (fejlesztői gép), semmit nem mutat,
 * hogy ne ígérjünk olyat, ami nem működik.
 */
export default function AccountLink() {
  const me = useIdentity();
  const router = useRouter();
  if (!supabaseConfigured) return null;
  if (me.source === 'login' && me.name) {
    return (
      <span className="flex items-center gap-2 py-3 text-sm text-slate-600">
        <span className="max-w-[12rem] truncate" title={me.name}>
          {me.name}
        </span>
        <button
          onClick={async () => {
            await supabaseBrowser().auth.signOut();
            router.push('/login');
          }}
          className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-800"
        >
          <LogOut className="h-3.5 w-3.5" /> Kilépés
        </button>
      </span>
    );
  }
  return (
    <Link href="/login" className="py-3 text-sm text-slate-500 hover:text-slate-800">
      Belépés
    </Link>
  );
}
