'use client';

import { createContext, useContext } from 'react';
import type { PageId } from '@/lib/guide';

/**
 * Oldalváltás egységesen: a Next-alkalmazásban útvonal, az előnézetben fül.
 * A projektválasztó, a kalauz és az üres állapotok ezen át navigálnak.
 */
export interface Nav {
  page: PageId;
  go: (page: PageId) => void;
}

const Ctx = createContext<Nav | null>(null);

export const NavProvider = Ctx.Provider;

export function useNav(): Nav | null {
  return useContext(Ctx);
}

export const PAGE_PATH: Record<PageId, string> = { adatok: '/adatok', interjuk: '/interjuk', matrix: '/', projekt: '/projekt' };

export function pageFromPath(path: string | null): PageId {
  return (Object.keys(PAGE_PATH) as PageId[]).find((p) => PAGE_PATH[p] === path) ?? 'matrix';
}
