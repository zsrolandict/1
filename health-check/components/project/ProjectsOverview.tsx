'use client';

import { useEffect, useMemo, useRef } from 'react';
import { ArrowRight, ExternalLink, X } from 'lucide-react';
import { ENGAGEMENT_KINDS } from '@/lib/engagement/kinds';
import { ago } from '@/lib/localSave';
import { projectProgress } from '@/lib/projectProgress';
import { lastPageOf, type ProjectMeta, type ProjectPage } from '@/lib/risk/store';
import { useModules } from '../useModules';
import { openProject } from './openProject';
import { PAGE_PATH, useNav } from '../Nav';
import { useProjects } from './useProjects';

export const PAGE_LABEL: Record<ProjectPage, string> = {
  adatok: 'Adatgyűjtés',
  interjuk: 'Interjúk',
  matrix: 'Red Flag mátrix',
  projekt: 'Projekt (időkeret)',
};

/**
 * Projektjeim: minden projekt egy helyen, hol tart, mi a következő lépés,
 * és egy kattintással ott folytatható, ahol abbahagytad. Új lapon is
 * megnyitható, így több projekt futhat egyszerre.
 */
export default function ProjectsOverview({ onClose, allowNewTab = true }: { onClose: () => void; allowNewTab?: boolean }) {
  const { activeId, projects } = useProjects();
  const { disabled } = useModules();
  const nav = useNav();
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const rows = useMemo(
    () =>
      [...projects]
        .sort((a, b) => Number(a.isDemo) - Number(b.isDemo) || b.updatedAt.localeCompare(a.updatedAt))
        .map((p) => ({ p, progress: projectProgress(p.id, disabled), page: lastPageOf(p.id) })),
    [projects, disabled],
  );

  const resume = (p: ProjectMeta) => {
    openProject(p.id, nav);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-slate-900/40 p-4 pt-16 print:hidden" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="projects-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-3xl rounded-xl bg-white shadow-2xl"
      >
        <header className="flex items-center gap-2 border-b border-slate-100 px-5 py-4">
          <h2 id="projects-title" className="text-lg font-semibold text-slate-900">
            Projektjeim
          </h2>
          <span className="text-sm text-slate-500">{projects.filter((p) => !p.isDemo).length} saját projekt</span>
          <button ref={closeRef} onClick={onClose} aria-label="Bezárás" className="ml-auto rounded p-1 text-slate-500 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </header>
        <p className="px-5 pt-3 text-sm text-slate-600">
          Egy projekt bármikor félbehagyható: minden módosítás azonnal mentődik, és innen ott folytatod, ahol abbahagytad.
          {allowNewTab && ' Több projekten egyszerre is dolgozhatsz: nyisd meg őket külön böngészőlapon.'}
        </p>
        {rows.length === 0 ? (
          <p className="px-5 py-6 text-sm text-slate-600">Még nincs projekt. Hozz létre újat a projektválasztóban („Új projekt”).</p>
        ) : (
          <ul className="divide-y divide-slate-100 px-2 py-2">
            {rows.map(({ p, progress, page }) => (
              <li key={p.id} className="flex flex-wrap items-center gap-3 rounded-lg px-3 py-3 hover:bg-slate-50">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-slate-900">{p.companyName || 'Névtelen projekt'}</span>
                    {p.isDemo && <span className="rounded bg-indigo-100 px-1.5 text-xs font-medium text-indigo-800">bemutató</span>}
                    {p.id === activeId && <span className="rounded bg-emerald-100 px-1.5 text-xs font-medium text-emerald-800">ezen a lapon nyitva</span>}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-600">
                    {ENGAGEMENT_KINDS[p.kind]?.label} · módosítva {ago(Date.parse(p.updatedAt))} · {progress.identified} azonosított tétel
                  </p>
                  <div className="mt-1.5 flex items-center gap-2">
                    <div
                      className="h-1.5 w-32 overflow-hidden rounded-full bg-slate-200"
                      role="progressbar"
                      aria-valuemin={0}
                      aria-valuemax={progress.total}
                      aria-valuenow={progress.done}
                      aria-label="Haladás"
                    >
                      <div className="h-full bg-slate-800" style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }} />
                    </div>
                    <span className="text-xs text-slate-600">
                      {progress.done}/{progress.total} lépés · {progress.next ? `Következő: ${progress.next.title}` : 'minden lépés kész'}
                    </span>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {allowNewTab && (
                    <a
                      href={`${PAGE_PATH[page]}?projekt=${encodeURIComponent(p.id)}`}
                      target="_blank"
                      rel="noopener"
                      className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1.5 text-xs text-slate-700 hover:bg-white"
                    >
                      <ExternalLink className="h-3.5 w-3.5" /> Új lapon
                    </a>
                  )}
                  <button
                    onClick={() => resume(p)}
                    className="inline-flex items-center gap-1 rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800"
                  >
                    Folytatás: {PAGE_LABEL[page]} <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
