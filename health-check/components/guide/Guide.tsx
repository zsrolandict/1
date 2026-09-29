'use client';

import { useEffect, useState } from 'react';
import { Check, ChevronRight, Compass, Lightbulb, SlidersHorizontal, X } from 'lucide-react';
import { nextStep, PAGE_TIPS, requestIntakeTab, type GuideStep, type PageId } from '@/lib/guide';
import { MODULES, type ModuleArea } from '@/lib/modules';
import { SAMPLE_PROFILES } from '@/lib/intake/samples/profiles';
import { SAVED_EVENT } from '@/lib/localSave';
import { applySampleProfile } from '@/lib/projects';
import { loadWorkspace, PROJECT_EVENT } from '@/lib/risk/store';
import { useModules } from '../useModules';
import { projectSteps } from '@/lib/projectProgress';
import { createProject } from '@/lib/risk/store';
import { ago } from '@/lib/localSave';
import { NewProjectForm } from '../project/ProjectBar';
import { openProject } from '../project/openProject';
import { useProjects } from '../project/useProjects';
import type { Nav } from '../Nav';

const SEEN_KEY = 'ict-hc:guide-seen';
const AREAS: ModuleArea[] = ['Adatgyűjtés', 'Interjúk', 'Red Flag mátrix', 'Projekt'];

function readSteps(disabled: Parameters<typeof projectSteps>[1]): GuideStep[] {
  return projectSteps(loadWorkspace().projectId, disabled);
}

/**
 * Kalauz: lebegő segítő a jobb alsó sarokban. Megmutatja, hol tart a
 * projekt, mi a következő lépés, ad tippeket az adott oldalhoz, és itt
 * lehet a modulokat ki-be kapcsolni.
 */
export default function Guide({ page, go }: { page: PageId; go: (page: PageId) => void }) {
  const { disabled, isOn, toggle } = useModules();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<'start' | 'steps' | 'modules'>('steps');
  const [steps, setSteps] = useState<GuideStep[]>([]);
  const [seen, setSeen] = useState(true);

  // Első látogatás: a kalauz magától nyílik, üdvözlő nézettel.
  useEffect(() => {
    let first = false;
    try {
      first = localStorage.getItem(SEEN_KEY) !== '1';
      if (first) localStorage.setItem(SEEN_KEY, '1');
    } catch {
      /* ignore */
    }
    if (first) {
      setView('start');
      setOpen(true);
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
          <button onClick={() => setView('start')} className={`rounded px-2 py-1 ${view === 'start' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
            Kezdés
          </button>
          <button onClick={() => setView('steps')} className={`rounded px-2 py-1 ${view === 'steps' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
            Merre tovább
          </button>
          <button onClick={() => setView('modules')} className={`inline-flex items-center gap-1 rounded px-2 py-1 ${view === 'modules' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
            <SlidersHorizontal className="h-3 w-3" /> Modulok
          </button>
        </div>
        <button onClick={() => setOpen(false)} aria-label="Kalauz bezárása" className="text-slate-500 hover:text-slate-700">
          <X className="h-4 w-4" />
        </button>
      </header>

      <div className="overflow-auto p-4 text-sm">
        {view === 'start' && (
          <StartView
            onDone={() => setView('steps')}
            nav={{ page, go }}
          />
        )}

        {view === 'steps' && (
          <>
            {next ? (
              <div className="rounded-lg bg-slate-900 p-3 text-white">
                <p className="text-xs uppercase tracking-wide text-slate-300">Következő lépés</p>
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
                  <p className="mt-1.5 text-xs text-slate-300">Ez egy kitalált bemutató cég: a minta-tényállással rögtön továbbléphetsz.</p>
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
                      <span className="block text-xs text-slate-500">{s.detail}</span>
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
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{area}</p>
                <ul className="mt-1 space-y-1">
                  {MODULES.filter((m) => m.area === area).map((m) => (
                    <li key={m.id}>
                      <label className="flex cursor-pointer items-start gap-2 rounded px-1.5 py-1 hover:bg-slate-50">
                        <input type="checkbox" checked={isOn(m.id)} onChange={() => toggle(m.id)} className="mt-1" />
                        <span>
                          <span className="text-slate-900">{m.label}</span>
                          {m.ai && <span className="ml-1 rounded bg-violet-100 px-1 text-xs text-violet-800">AI</span>}
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

/** Üdvözlő nézet: új ügyfél indítása, bemutató, vagy folytatás ott, ahol abbahagytad. */
function StartView({ onDone, nav }: { onDone: () => void; nav: Nav }) {
  const { projects } = useProjects();
  const [creating, setCreating] = useState(false);
  const recent = projects
    .filter((p) => !p.isDemo)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 3);
  return (
    <div className="space-y-3">
      <div>
        <p className="font-semibold text-slate-900">Üdv az ICT Health Checkben!</p>
        <p className="mt-1 text-xs text-slate-600">
          Egy átvilágítás menete: <b>Adatgyűjtés</b> (tényállás, kérdőív, táblák, dokumentumok) → <b>Interjúk</b> → <b>Red Flag mátrix</b> (a
          kockázatok értékelése) → PDF- és Excel-riport. A kalauz minden lépésnél megmutatja, mi jön.
        </p>
      </div>

      {creating ? (
        <NewProjectForm
          onCancel={() => setCreating(false)}
          onCreate={(input) => {
            createProject(input);
            if (nav.page !== 'adatok') nav.go('adatok');
            onDone();
          }}
        />
      ) : (
        <button onClick={() => setCreating(true)} className="w-full rounded-lg bg-slate-900 px-3 py-2.5 text-left text-white hover:bg-slate-800">
          <span className="block font-medium">Új ügyfél indítása</span>
          <span className="block text-xs text-slate-300">Cégnév és átvilágítás-típus, utána az Adatgyűjtéssel kezdünk.</span>
        </button>
      )}

      {recent.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Folytatás, ahol abbahagytad</p>
          <ul className="mt-1 space-y-1">
            {recent.map((p) => (
              <li key={p.id}>
                <button
                  onClick={() => {
                    openProject(p.id, nav);
                    onDone();
                  }}
                  className="flex w-full items-center justify-between gap-2 rounded-md border border-slate-200 px-3 py-2 text-left hover:bg-slate-50"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-slate-900">{p.companyName || 'Névtelen projekt'}</span>
                    <span className="block text-xs text-slate-600">módosítva {ago(Date.parse(p.updatedAt))}</span>
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-slate-500" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <button onClick={onDone} className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-left hover:bg-slate-50">
        <span className="block font-medium text-slate-900">Körbenézek a bemutatóban</span>
        <span className="block text-xs text-slate-600">Négy kitalált cég kész adatokkal – a projektválasztóban (jobb fent) váltható.</span>
      </button>

      <p className="text-xs text-slate-600">
        Az adatok ebben a böngészőben tárolódnak; a jobb felső „Helyben mentve” gombbal a projekt fájlba menthető.
      </p>
    </div>
  );
}
