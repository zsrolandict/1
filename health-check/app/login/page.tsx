'use client';

import { useEffect, useState } from 'react';
import { KeyRound, Loader2, Mail } from 'lucide-react';
import { supabaseBrowser, supabaseConfigured } from '@/lib/auth/supabase-browser';
import { BrandLogo } from '@/components/ui/BrandMark';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  // A visszatérési pont hibája (pl. meghívás nélküli fiók) – csak a böngészőben olvasható.
  const [returned, setReturned] = useState<string | null>(null);
  useEffect(() => {
    const id = requestAnimationFrame(() => setReturned(new URLSearchParams(window.location.search).get('hiba')));
    return () => cancelAnimationFrame(id);
  }, []);

  const redirectTo = () => `${window.location.origin}/auth/callback`;

  const sendLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setState('sending');
    // shouldCreateUser: false – csak előre meghívott felhasználó léphet be.
    const { error } = await supabaseBrowser().auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo(), shouldCreateUser: false },
    });
    setState(error ? 'error' : 'sent');
  };

  const microsoft = () => supabaseBrowser().auth.signInWithOAuth({ provider: 'azure', options: { redirectTo: redirectTo(), scopes: 'email' } });

  return (
    <main className="mx-auto max-w-md px-4 py-16">
      <div className="rounded-2xl border border-slate-200/80 bg-white p-8 shadow-[0_8px_30px_rgba(15,23,42,0.06)]">
        <BrandLogo tone="light" />
        <h1 className="mt-6 text-2xl font-bold tracking-tight text-slate-900">Belépés</h1>
        <p className="mt-1 text-sm text-slate-500">ICT Health Check – belső tanácsadói eszköz.</p>
        {!supabaseConfigured ? (
          <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
            A bejelentkezés még nincs beállítva (Supabase). A felület demó módban használható; az AI-funkciók zárva vannak.
          </p>
        ) : (
          <div className="mt-6 space-y-4">
            <button
              onClick={microsoft}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700"
            >
              <KeyRound className="h-4 w-4" /> Belépés céges Microsoft-fiókkal
            </button>
            <div className="text-center text-xs text-slate-400">vagy (ügyfeleknek és külsős szakértőknek)</div>
            <form onSubmit={sendLink} className="space-y-2">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@ceg.hu"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
              <button
                disabled={state === 'sending'}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                {state === 'sending' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                Belépési link küldése
              </button>
            </form>
            {state === 'sent' && <p className="text-sm text-emerald-700">Elküldtük a belépési linket, ha a cím szerepel a meghívottak között.</p>}
            {state === 'error' && <p className="text-sm text-red-700">A link küldése nem sikerült. Próbálja újra később.</p>}
            {returned === 'meghivas' && (
              <p role="alert" className="text-sm text-red-700">
                Ehhez a fiókhoz nincs meghívás, vagy az e-mail-cím domainje nem engedélyezett. Kérjen meghívást a projekt partnerétől.
              </p>
            )}
            {returned === '1' && (
              <p role="alert" className="text-sm text-red-700">
                A belépés nem sikerült vagy lejárt a link. Kérjen újat.
              </p>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
