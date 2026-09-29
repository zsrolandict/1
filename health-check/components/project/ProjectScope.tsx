'use client';

import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react';
import { RefreshCw } from 'lucide-react';
import { rememberPage, RELOAD_EVENT, setActiveProject } from '@/lib/risk/store';
import { useNav } from '../Nav';
import { useActiveProjectId } from './useProjects';

/**
 * Az aktív projekt kerete:
 * - projektváltáskor (vagy ha a projekt adatai kívülről változtak, pl. a
 *   kalauzból) az oldal újraindul, és a tárolóból tölt be;
 * - megjegyzi, melyik oldalon jársz, hogy később ott folytathasd;
 * - `?projekt=<id>` a címben: ez a lap azt a projektet nyitja (új lapon
 *   indított projekt);
 * - ha ugyanezt a projektet egy másik lapon is módosítják, szól.
 */
export default function ProjectScope({ children }: { children: ReactNode }) {
  const id = useActiveProjectId();
  const nav = useNav();
  const [rev, setRev] = useState(0);
  const [otherTab, setOtherTab] = useState(false);

  useEffect(() => {
    const onReload = () => setRev((n) => n + 1);
    window.addEventListener(RELOAD_EVENT, onReload);
    try {
      const url = new URL(window.location.href);
      const requested = url.searchParams.get('projekt');
      if (requested) {
        setActiveProject(requested);
        url.searchParams.delete('projekt');
        window.history.replaceState(null, '', url.toString());
      }
    } catch {
      /* keretben tiltott lehet */
    }
    return () => window.removeEventListener(RELOAD_EVENT, onReload);
  }, []);

  // Oldalváltáskor jegyezzük meg az oldalt (projektváltáskor nem: az a régi oldal lenne).
  const lastPage = useRef(nav?.page);
  useEffect(() => {
    if (!nav || !id || lastPage.current === nav.page) return;
    lastPage.current = nav.page;
    rememberPage(id, nav.page);
  }, [nav, id]);

  // Másik böngészőlap ugyanezt a projektet írta.
  useEffect(() => {
    setOtherTab(false);
    if (!id) return;
    const onStorage = (e: StorageEvent) => {
      if (e.key?.startsWith('ict-hc:') && !e.key.startsWith('ict-hc:backup:') && e.key.endsWith(`:${id}`)) setOtherTab(true);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [id]);

  return (
    <>
      {otherTab && (
        <div role="status" className="border-b border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900 print:hidden">
          <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-3">
            <span>
              <b>Ezt a projektet egy másik böngészőlapon is módosították.</b> Frissítsd, különben az itteni mentés felülírhatja az ottani változást.
            </span>
            <button
              onClick={() => {
                setOtherTab(false);
                setRev((n) => n + 1);
              }}
              className="inline-flex items-center gap-1 rounded-md bg-amber-800 px-2.5 py-1 text-xs font-medium text-white hover:bg-amber-900"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Frissítés
            </button>
          </div>
        </div>
      )}
      <Fragment key={`${id || 'init'}:${rev}`}>{children}</Fragment>
    </>
  );
}
