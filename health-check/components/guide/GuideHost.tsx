'use client';

import { usePathname, useRouter } from 'next/navigation';
import type { PageId } from '@/lib/guide';
import Guide from './Guide';

const PATH: Record<PageId, string> = { adatok: '/adatok', interjuk: '/interjuk', matrix: '/', projekt: '/projekt' };

/** A kalauz a Next-alkalmazásban: az útvonalból tudja, melyik oldalon vagyunk. */
export default function GuideHost() {
  const path = usePathname();
  const router = useRouter();
  if (path === '/login') return null;
  const page = ((Object.keys(PATH) as PageId[]).find((p) => PATH[p] === path) ?? 'matrix') as PageId;
  return <Guide page={page} go={(p) => router.push(PATH[p])} />;
}
