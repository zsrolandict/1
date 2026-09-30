'use client';

import type { ReactNode } from 'react';
import { BriefcaseBusiness, ChevronRight, ClipboardList, Mic, ShieldAlert, type LucideIcon } from 'lucide-react';
import { PAGE_IDS, PAGE_LABEL, type PageId } from '@/lib/guide';
import { pageVisible } from '@/lib/modules';
import { BrandLogo } from '../ui/BrandMark';
import { useNav } from '../Nav';
import { useModules } from '../useModules';

const PAGE_ICON: Record<PageId, LucideIcon> = { adatok: ClipboardList, interjuk: Mic, matrix: ShieldAlert, projekt: BriefcaseBusiness };

/**
 * Az alkalmazás kerete: bal oldalt sötét oldalsáv (logó, oldalak, fiók),
 * jobbra fehér felső sáv (hol vagy, projektválasztó) és a tartalom.
 * A Next-alkalmazás és az előnézet is ezt használja.
 */
export default function AppShell({
  project,
  account,
  banner,
  children,
}: {
  /** A felső sáv jobb oldala (projektválasztó). */
  project: ReactNode;
  /** Az oldalsáv alja (belépés, fiók). */
  account?: ReactNode;
  /** A felső sáv fölötti figyelmeztetés (előnézet). */
  banner?: ReactNode;
  children: ReactNode;
}) {
  const nav = useNav();
  const { isOn } = useModules();
  const pages = PAGE_IDS.filter((p) => pageVisible(p, isOn));

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 flex h-screen w-60 shrink-0 flex-col bg-navy-900 text-slate-300 print:hidden">
        <div className="border-b border-white/5 px-5 py-5">
          <BrandLogo />
        </div>
        <nav aria-label="Oldalak" className="flex-1 overflow-y-auto px-3 py-4">
          <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Munkafolyamat</p>
          <ul className="space-y-1">
            {pages.map((p) => {
              const Icon = PAGE_ICON[p];
              const active = nav?.page === p;
              return (
                <li key={p}>
                  <button
                    onClick={() => nav?.go(p)}
                    aria-current={active ? 'page' : undefined}
                    className={`group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition ${
                      active ? 'bg-brand-600 text-white shadow-[0_4px_14px_rgba(41,82,227,0.35)]' : 'text-slate-300 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <Icon className={`h-[18px] w-[18px] shrink-0 ${active ? 'text-white' : 'text-slate-500 group-hover:text-slate-300'}`} aria-hidden />
                    <span className="flex-1">{PAGE_LABEL[p]}</span>
                    {active && <ChevronRight className="h-4 w-4 opacity-70" aria-hidden />}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="space-y-2 border-t border-white/5 px-5 py-4 text-xs">
          {account}
          <p className="flex items-center gap-2 text-slate-500">
            <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-300">Béta</span>
            Belső tanácsadói eszköz
          </p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {banner}
        <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b border-slate-200 bg-white/95 px-6 backdrop-blur print:hidden">
          <p className="flex items-center gap-1.5 text-sm text-slate-500">
            Munkaterület
            <ChevronRight className="h-3.5 w-3.5 text-slate-300" aria-hidden />
            <span className="font-semibold text-slate-900">{nav ? PAGE_LABEL[nav.page] : ''}</span>
          </p>
          <nav aria-label="Projekt" className="ml-auto">
            {project}
          </nav>
        </header>
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
