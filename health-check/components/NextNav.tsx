'use client';

import { useMemo, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { NavProvider, PAGE_PATH, pageFromPath, type Nav } from './Nav';

/** A Next-alkalmazás navigációja (útvonalak). */
export function NextNavProvider({ children }: { children: ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const value = useMemo<Nav>(() => ({ page: pageFromPath(path), go: (p) => router.push(PAGE_PATH[p]) }), [path, router]);
  return <NavProvider value={value}>{children}</NavProvider>;
}
