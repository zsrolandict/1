'use client';

import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { BriefcaseBusiness, ChevronRight, ClipboardList, Compass, Mic, PanelLeftClose, PanelLeftOpen, ShieldAlert, type LucideIcon } from 'lucide-react';
import { GUIDE_STATE_EVENT, PAGE_IDS, PAGE_LABEL, toggleGuide, type PageId } from '@/lib/guide';
import { pageVisible } from '@/lib/modules';
import { BrandLogo, BrandMark } from '../ui/BrandMark';
import { useNav } from '../Nav';
import { useModules } from '../useModules';

const PAGE_ICON: Record<PageId, LucideIcon> = { adatok: ClipboardList, interjuk: Mic, matrix: ShieldAlert, projekt: BriefcaseBusiness };

// Összecsukott oldalsáv: nézőnkénti kényelmi beállítás (ha a tároló nem érhető el, csak memóriában).
const COLLAPSE_KEY = 'ict-hc:sidebar-collapsed';
const COLLAPSE_EVENT = 'ict-hc:sidebar';
let memCollapsed = false;
function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === '1';
  } catch {
    return memCollapsed;
  }
}
function setCollapsed(v: boolean) {
  memCollapsed = v;
  try {
    localStorage.setItem(COLLAPSE_KEY, v ? '1' : '0');
  } catch {
    /* csak memóriában */
  }
  window.dispatchEvent(new Event(COLLAPSE_EVENT));
}
function subscribeCollapsed(cb: () => void) {
  window.addEventListener(COLLAPSE_EVENT, cb);
  window.addEventListener('storage', cb);
  return () => {
    window.removeEventListener(COLLAPSE_EVENT, cb);
    window.removeEventListener('storage', cb);
  };
}

/**
 * Az alkalmazás kerete: bal oldalt sötét oldalsáv (logó, oldalak, kalauz, fiók),
 * jobbra fehér felső sáv (hol vagy, projektválasztó) és a tartalom.
 * Az oldalsáv ikonsávvá csukható (kisebb laptopon több hely a táblázatoknak).
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
  const collapsed = useSyncExternalStore(subscribeCollapsed, readCollapsed, () => false);
  const [guideOpen, setGuideOpen] = useState(false);
  useEffect(() => {
    const onState = (e: Event) => setGuideOpen(Boolean((e as CustomEvent<boolean>).detail));
    window.addEventListener(GUIDE_STATE_EVENT, onState);
    return () => window.removeEventListener(GUIDE_STATE_EVENT, onState);
  }, []);

  const item = (active: boolean) =>
    `group flex w-full items-center gap-3 rounded-lg py-2.5 text-left text-sm font-medium transition ${collapsed ? 'justify-center px-0' : 'px-3'} ${
      active ? 'bg-brand-600 text-white shadow-[0_4px_14px_rgba(41,82,227,0.35)]' : 'text-slate-300 hover:bg-white/5 hover:text-white'
    }`;
  const icon = (active: boolean) => `h-[18px] w-[18px] shrink-0 ${active ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'}`;

  return (
    <div className="flex min-h-screen">
      <aside
        className={`sticky top-0 flex h-screen shrink-0 flex-col bg-navy-900 text-slate-300 transition-[width] print:hidden ${collapsed ? 'w-[68px]' : 'w-60'}`}
      >
        <div className={`border-b border-white/5 py-5 ${collapsed ? 'flex justify-center px-0' : 'px-5'}`}>
          {collapsed ? <BrandMark className="h-9 w-9" /> : <BrandLogo />}
        </div>
        <nav aria-label="Oldalak" className={`flex-1 overflow-y-auto py-4 ${collapsed ? 'px-2.5' : 'px-3'}`}>
          {!collapsed && <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Munkafolyamat</p>}
          <ul className="space-y-1">
            {pages.map((p) => {
              const Icon = PAGE_ICON[p];
              const active = nav?.page === p;
              return (
                <li key={p}>
                  <button
                    onClick={() => nav?.go(p)}
                    aria-current={active ? 'page' : undefined}
                    title={collapsed ? PAGE_LABEL[p] : undefined}
                    className={item(active)}
                  >
                    <Icon className={icon(active)} aria-hidden />
                    <span className={collapsed ? 'sr-only' : 'flex-1'}>{PAGE_LABEL[p]}</span>
                    {active && !collapsed && <ChevronRight className="h-4 w-4 opacity-70" aria-hidden />}
                  </button>
                </li>
              );
            })}
          </ul>
          {!collapsed && <p className="mt-6 px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Segítség</p>}
          <button
            onClick={toggleGuide}
            aria-pressed={guideOpen}
            title={collapsed ? 'Kalauz' : undefined}
            className={`${item(false)} ${collapsed ? 'mt-6' : ''} ${guideOpen ? 'bg-white/10 text-white' : ''}`}
          >
            <Compass className={icon(false)} aria-hidden />
            <span className={collapsed ? 'sr-only' : 'flex-1'}>Kalauz</span>
          </button>
        </nav>
        <div className={`space-y-3 border-t border-white/5 py-4 text-xs ${collapsed ? 'px-2.5' : 'px-5'}`}>
          {!collapsed && account}
          <button
            onClick={() => setCollapsed(!collapsed)}
            aria-label={collapsed ? 'Oldalsáv kinyitása' : 'Oldalsáv összecsukása'}
            title={collapsed ? 'Oldalsáv kinyitása' : 'Oldalsáv összecsukása'}
            className={`flex items-center gap-2 rounded-lg py-1.5 text-slate-400 hover:bg-white/5 hover:text-white ${collapsed ? 'w-full justify-center' : '-mx-2 px-2'}`}
          >
            {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            {!collapsed && 'Összecsukás'}
          </button>
          {!collapsed && (
            <p className="flex items-center gap-2 text-slate-400">
              <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-200">Béta</span>
              Belső tanácsadói eszköz
            </p>
          )}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {banner}
        <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b border-slate-200 bg-white/95 px-6 backdrop-blur print:hidden">
          <p className="flex shrink-0 items-center gap-1.5 text-sm text-slate-500">
            Munkaterület
            <ChevronRight className="h-3.5 w-3.5 text-slate-300" aria-hidden />
            <span className="font-semibold text-slate-900">{nav ? PAGE_LABEL[nav.page] : ''}</span>
          </p>
          <nav aria-label="Projekt" className="ml-auto min-w-0">
            {project}
          </nav>
        </header>
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
