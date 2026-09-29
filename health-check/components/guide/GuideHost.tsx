'use client';

import { usePathname } from 'next/navigation';
import { useNav } from '../Nav';
import Guide from './Guide';

/** A kalauz a Next-alkalmazásban: a navigációs környezetből tudja, melyik oldalon vagyunk. */
export default function GuideHost() {
  const path = usePathname();
  const nav = useNav();
  if (path === '/login' || !nav) return null;
  return <Guide page={nav.page} go={nav.go} />;
}
