import { lastPageOf, setActiveProject } from '@/lib/risk/store';
import type { Nav } from '../Nav';

/** Projekt megnyitása ezen a lapon, azon az oldalon, ahol legutóbb abbahagytad. */
export function openProject(id: string, nav: Nav | null): void {
  const page = lastPageOf(id); // előbb olvassuk: a váltás után a jelenlegi oldal ne írja felül
  setActiveProject(id);
  if (nav && nav.page !== page) nav.go(page);
}
