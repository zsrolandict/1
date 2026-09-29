'use client';

import { Fragment, useEffect, useState, type ReactNode } from 'react';
import { RELOAD_EVENT } from '@/lib/risk/store';
import { useActiveProjectId } from './useProjects';

/**
 * Projektváltáskor (vagy ha a projekt adatai kívülről változtak, pl. a
 * kalauzból) az oldal tartalma újraindul, és a tárolóból tölt be.
 */
export default function ProjectScope({ children }: { children: ReactNode }) {
  const id = useActiveProjectId();
  const [rev, setRev] = useState(0);
  useEffect(() => {
    const onReload = () => setRev((n) => n + 1);
    window.addEventListener(RELOAD_EVENT, onReload);
    return () => window.removeEventListener(RELOAD_EVENT, onReload);
  }, []);
  return <Fragment key={`${id || 'init'}:${rev}`}>{children}</Fragment>;
}
