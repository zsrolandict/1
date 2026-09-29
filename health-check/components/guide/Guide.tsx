'use client';

import { useEffect, useState } from 'react';
import { Check, ChevronRight, Compass, Lightbulb, SlidersHorizontal, X } from 'lucide-react';
import { guideSteps, nextStep, PAGE_TIPS, requestIntakeTab, type GuideStep, type PageId } from '@/lib/guide';
import { loadIntake } from '@/lib/intake/state';
import { loadRecords } from '@/lib/interview/records';
import { loadBenchmark } from '@/lib/learning/benchmark';
import { MODULES, type ModuleArea } from '@/lib/modules';
import { loadSnapshots } from '@/lib/risk/followup';
import { SAMPLE_PROFILES } from '@/lib/intake/samples/profiles';
import { SAVED_EVENT } from '@/lib/localSave';
import { applySampleProfile } from '@/lib/projects';
import { loadWorkspace, PROJECT_EVENT } from '@/lib/risk/store';
import { loadTimesheet } from '@/lib/timesheet/timesheet';
import { useModules } from '../useModules';

const SEEN_KEY = 'ict-hc:guide-seen';
const AREAS: ModuleArea[] = ['Adatgyűjtés', 'Interjúk', 'Red Flag mátrix', 'Projekt'];

function readSteps(disabled: Parameters<typeof guideSteps>[0]['disabled']): GuideStep[] {
  const ws = loadWorkspace();
  const id = ws.projectId;
  return guideSteps({
    intake: loadIntake(id),
    interviews: loadRecords(id),
    identified: ws.items.filter((r) => r.identified).length,
    snapshots: loadSnapshots(id).length,
    hoursLogged: loadTimesheet(id).entries.reduce((a, e) => a + e.hours, 0),
    benchmarked: loadBenchmark().some((r) => r.ref === id),
    disabled,
  });
}

/**
 * Kalauz: lebegő segítő a jobb alsó sarokban. Megmutatja, hol tart a
 * projekt, mi a következő lépés, ad tippeket az adott oldalhoz, és itt
 * lehet a modulokat ki-be kapcsolni.
 */
export default function Guide({ page, go }: { page: PageId; go: (page: PageId) => void }) {
  const { disabled, isOn, toggle } = useModules();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<'steps' | 'modules'>('steps');
  const [steps, setSteps] = useState<GuideStep[]>([]);
  const [seen, setSeen] = useState(true);

  useEffect(() => {
    try {
      setSeen(localStorage.getItem(SEEN_KEY) === '1');
    } catch {
      /* ignore */
    }
  }, []);
  const [note, setNote] = useState<string | null>(null);
  const [hasSample, setHasSample] = useState(false);
  useEffect(() => {
    if (!open) return;
    const refresh = () => {
      setSteps(readSteps(disabled));
      setHasSample(Boolean(SAMPLE_PROFILES[loadWorkspace().scenarioId]));
    };
    refresh();
    // Mentéskor és projektváltáskor frissül (pl. kitöltötted a tényállást).
    window.addEventListener(SAVED_EVENT, refresh);
    window.addEventListener(PROJECT_EVENT, refresh);
    return () => {
      window.removeEventListener(SAVED_EVENT, refresh);
      window.removeEventListener(PROJECT_EVENT, refresh);
    };
  }, [open, disabled, page]);

  /** Bemutatónál a minta-tényállás egy kattintással (a tényállás lépés így nem akad el). */
  const loadSampleProfile = () => {
    const added = applySampleProfile(loadWorkspace());
    if (added == null) return;
    setNote(`Minta tényállás betöltve${added ? `, ${added} ágazati tétel a mátrixba került (pipálatlanul)` : ''}.`);
    requestIntakeTab('case');
    if (page !== 'adatok') go('adatok');
  };

  const openPanel = () => {
    setOpen(true);
    setSeen(true);
    try {
      localStorage.setItem(SEEN_KEY, '1');
    } catch {
      /* ignore */
    }
  };
  const jump = (s: GuideStep) => {
    if (s.target.tab) requestIntakeTab(s.target.tab);
    if (s.target.page !== page) go(s.target.page);
  };

  const next = nextStep(steps);
  const doneCount = steps.filter((s) => s.done).length;

  if (!open) {
    return (
      <button
        onClick={openPanel}
        className="fixed bottom-4 right-4 z-40 inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2.5 text-sm font-medium text-white shadow-lg hover:bg-slate-800 print:hidden"
      >
        <Compass className="h-4 w-4" /> Kalauz
        {!seen && <span className="h-2 w-2 animate-pulse rounded-full bg-amber-400" aria-label="új" />}
      </button>
    );
  }

  return (
    <aside
      aria-label="Kalauz"
      className="fixed bottom-4 right-4 z-40 flex max-h-[80vh] w-[min(24rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl print:hidden"
    >
      <header className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
        <Compass className="h-4 w-4 text-slate-700" />
        <span className="text-sm font-semibold text-slate-900">Kalauz</span>
        <div className="ml-auto flex gap-1 text-xs">
          <button onClick={() => setView('steps')} className={`rounded px-2 py-1 ${view === 'steps' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
            Merre tovább
          </button>
          <button onClick={() => setView('modules')} className={`inline-flex items-center gap-1 rounded px-2 py-1 ${view === 'modules' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
            <SlidersHorizontal className="h-3 w-3" /> Modulok
          </button>
        </div>
        <button onClick={() => setOpen(false)} aria-label="Kalauz bezárása" className="text-slate-400 hover:text-slate-700">
          <X className="h-4 w-4" />
        </button>
      </header>

      <div className="overflow-auto p-4 text-sm">
        {view === 'steps' && (
          <>
            {next ? (
              <div className="rounded-lg bg-slate-900 p-3 text-white">
                <p className="text-[11px] uppercase tracking-wide text-slate-300">Következő lépés</p>
                <p className="mt-0.5 font-semibold">{next.title}</p>
                <p className="mt-1 text-xs text-slate-200">{next.how}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button onClick={() => jump(next)} className="inline-flex items-center gap-1 rounded bg-white px-2.5 py-1 text-xs font-medium text-slate-900 hover:bg-slate-100">
                    Odaviszlek <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                  {next.id === 'case' && hasSample && (
                    <button onClick={loadSampleProfile} className="rounded border border-white/40 px-2.5 py-1 text-xs font-medium text-white hover:bg-white/10">
                      Minta tényállás betöltése
                    </button>
                  )}
                </div>
                {next.id === 'case' && hasSample && (
                  <p className="mt-1.5 text-[11px] text-slate-300">Ez egy kitalált bemutató cég: a minta-tényállással rögtön továbbléphetsz.</p>
                )}
              </div>
            ) : (
              <p className="rounded-lg bg-emerald-50 p-3 text-emerald-800">Minden lépés kész. Szép munka!</p>
            )}
            {note && <p className="mt-2 rounded bg-emerald-50 px-2 py-1 text-xs text-emerald-800">{note}</p>}

            <p className="mt-4 text-xs text-slate-500">
              Haladás: {doneCount}/{steps.length} lépés
            </p>
            <ol className="mt-1 space-y-1">
              {steps.map((s) => (
                <li key={s.id}>
                  <button onClick={() => jump(s)} className="flex w-full items-start gap-2 rounded px-1.5 py-1 text-left hover:bg-slate-50">
                    <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${s.done ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-300'}`}>
                      {s.done && <Check className="h-3 w-3" />}
                    </span>
                    <span className="min-w-0">
                      <span className={s.done ? 'text-slate-500' : 'text-slate-900'}>{s.title}</span>
                      <span className="block text-xs text-slate-400">{s.detail}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ol>

            <div className="mt-4 rounded-lg bg-amber-50 p-3">
              <p className="flex items-center gap-1 text-xs font-semibold text-amber-900">
                <Lightbulb className="h-3.5 w-3.5" /> Tippek ehhez az oldalhoz
              </p>
              <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-amber-900">
                {PAGE_TIPS[page].map((t) => <li key={t}>{t}</li>)}
              </ul>
            </div>
          </>
        )}

        {view === 'modules' && (
          <>
            <p className="text-xs text-slate-500">
              A kikapcsolt modul kimarad a felületről és a lépések közül; az adatai megmaradnak, visszakapcsolva újra látszanak. A Red Flag mátrix mindig bekapcsolt.
            </p>
            {AREAS.map((area) => (
              <div key={area} className="mt-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{area}</p>
                <ul className="mt-1 space-y-1">
                  {MODULES.filter((m) => m.area === area).map((m) => (
                    <li key={m.id}>
                      <label className="flex cursor-pointer items-start gap-2 rounded px-1.5 py-1 hover:bg-slate-50">
                        <input type="checkbox" checked={isOn(m.id)} onChange={() => toggle(m.id)} className="mt-1" />
                        <span>
                          <span className="text-slate-900">{m.label}</span>
                          {m.ai && <span className="ml-1 rounded bg-violet-100 px-1 text-[10px] text-violet-800">AI</span>}
                          <span className="block text-xs text-slate-500">{m.description}</span>
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </>
        )}
      </div>
    </aside>
  );
}
