'use client';

import { useState } from 'react';
import { KeyRound, Loader2, Mail } from 'lucide-react';
import { supabaseBrowser, supabaseConfigured } from '@/lib/auth/supabase-browser';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

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
    <main className="mx-auto max-w-sm px-4 py-16">
      <h1 className="text-xl font-semibold text-slate-900">Belépés</h1>
      {!supabaseConfigured ? (
        <p className="mt-4 rounded-md bg-amber-50 p-3 text-sm text-amber-900">
          A bejelentkezés még nincs beállítva (Supabase). A felület demó módban használható; az AI-funkciók zárva vannak.
        </p>
      ) : (
        <div className="mt-6 space-y-4">
          <button
            onClick={microsoft}
            className="flex w-full items-center justify-center gap-2 rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
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
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
            />
            <button
              disabled={state === 'sending'}
              className="flex w-full items-center justify-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              {state === 'sending' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
              Belépési link küldése
            </button>
          </form>
          {state === 'sent' && <p className="text-sm text-emerald-700">Elküldtük a belépési linket, ha a cím szerepel a meghívottak között.</p>}
          {state === 'error' && <p className="text-sm text-red-700">A link küldése nem sikerült. Próbálja újra később.</p>}
        </div>
      )}
    </main>
  );
}
