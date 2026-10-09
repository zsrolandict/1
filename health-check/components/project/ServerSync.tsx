'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { isStaffRole } from '@/lib/auth/mode';
import { supabaseConfigured } from '@/lib/auth/supabase-browser';
import { setServerMode } from '@/lib/sync/serverMode';
import { resolveConflict, startServerSync } from '@/lib/sync/serverSync';
import { useProjects } from './useProjects';
import { useSyncState } from './useSync';

/**
 * Bejelentkezett belső felhasználónál elindítja a szerveres projekttárolást
 * (lib/sync), és ütközésnél döntést kér. Bejelentkezés nélkül (bemutató,
 * előnézet) nem csinál semmit.
 */
export default function ServerSync() {
  useEffect(() => {
    if (!supabaseConfigured) return;
    let stop: (() => void) | undefined;
    let cancelled = false;
    (async () => {
      const res = await fetch('/api/me', { cache: 'no-store' });
      if (!res.ok || cancelled) return;
      const { user } = (await res.json()) as { user: { role: string | null } | null };
      if (!user || !isStaffRole(user.role) || cancelled) return;
      setServerMode(true);
      stop = startServerSync();
    })().catch(() => {});
    return () => {
      cancelled = true;
      stop?.();
    };
  }, []);
  const { activeId } = useProjects();
  return <ConflictBar projectId={activeId} />;
}

function ConflictBar({ projectId }: { projectId: string }) {
  const { status, message } = useSyncState(projectId);
  const [busy, setBusy] = useState(false);
  if (status !== 'conflict') return null;
  const choose = async (keep: 'server' | 'local') => {
    setBusy(true);
    try {
      await resolveConflict(projectId, keep);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div role="alert" className="fixed inset-x-0 bottom-0 z-50 border-t border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950 shadow-lg print:hidden">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-3">
        <AlertTriangle className="h-5 w-5 shrink-0 text-amber-700" />
        <p className="min-w-0 flex-1">
          <b>Mentési ütközés.</b> {message} A helyi módosításaid nincsenek a szerveren. Ha nem vagy biztos benne, előbb mentsd a projektet fájlba (jobb felül).
        </p>
        <button
          disabled={busy}
          onClick={() => choose('server')}
          className="rounded-lg border border-amber-400 bg-white px-3 py-1.5 text-xs font-medium hover:bg-amber-100 disabled:opacity-50"
        >
          A szerver változatát töltöm be (az enyém elvész)
        </button>
        <button
          disabled={busy}
          onClick={() => choose('local')}
          className="rounded-lg bg-amber-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-800 disabled:opacity-50"
        >
          Az enyém marad (a másik mentés felülíródik)
        </button>
      </div>
    </div>
  );
}
