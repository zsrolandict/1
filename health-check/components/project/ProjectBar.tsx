'use client';

import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Check, ChevronDown, Cloud, CloudUpload, FolderOpen, HardDrive, LayoutList, Plus, RotateCcw, Trash2, Upload } from 'lucide-react';
import { ENGAGEMENT_KIND_LIST, ENGAGEMENT_KINDS, type EngagementKind } from '@/lib/engagement/kinds';
import { ago, lastSaved, SAVE_FAILED_EVENT, saveFailedAt, SAVED_EVENT } from '@/lib/localSave';
import {
  backupDue,
  BackupError,
  projectHasContent,
  deleteProject,
  exportProject,
  importProject,
  lastBackup,
  markBackedUp,
  parseBackup,
  resetDemo,
} from '@/lib/projects';
import { byRecent, openDemo, type ProjectMeta } from '@/lib/risk/store';
import { createAnyProject } from '@/lib/sync/serverMode';
import { deleteServerProject, uploadLocalProject } from '@/lib/sync/serverSync';
import { useServerMode, useSyncState } from './useSync';
import type { SyncState } from '@/lib/sync/serverSync';
import { SCENARIOS } from '@/lib/scenarios';
import { useConfirm } from '../ConfirmDialog';
import { useOutside } from '../useDismiss';
import { browserDownload, slug, type SaveFile } from '../report/ExportPdfButton';
import { useNav } from '../Nav';
import { openProject } from './openProject';
import ProjectsOverview from './ProjectsOverview';
import { useProjects } from './useProjects';

/**
 * A felső sáv projektkezelője: projektváltás, új projekt, bemutató minták,
 * és a helyi mentés állapota (mentés fájlba, visszatöltés).
 */
export default function ProjectBar({ saveFile = browserDownload, allowNewTab = true }: { saveFile?: SaveFile; allowNewTab?: boolean }) {
  const { activeId, projects } = useProjects();
  const nav = useNav();
  const [overview, setOverview] = useState(false);
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const serverMode = useServerMode();
  const [confirmDialog, ask] = useConfirm();
  const ref = useRef<HTMLDivElement>(null);
  useOutside(ref, () => setOpen(false), open);

  const own = projects.filter((p) => !p.isDemo).sort(byRecent);
  const demos = projects.filter((p) => p.isDemo);
  const active = projects.find((p) => p.id === activeId);
  const activeDemo = SCENARIOS.find((s) => s.id === activeId);
  const label = active?.companyName || activeDemo?.companyName || 'Névtelen projekt';
  const isDemo = active?.isDemo ?? Boolean(activeDemo);

  const choose = (fn: () => void) => {
    fn();
    setOpen(false);
    setCreating(false);
  };

  const confirmDelete = async (p: ProjectMeta) => {
    if (p.server) {
      const yes = await ask({
        title: 'Törlöd a projektet a szerverről?',
        confirmLabel: 'Végleges törlés',
        danger: true,
        body: `A(z) „${p.companyName || 'Névtelen projekt'}” projekt minden adata a szerverről is törlődik, minden kollégánál. Projektet csak partner törölhet.`,
      });
      if (!yes) return;
      setNotice(null);
      await deleteServerProject(p.id).catch((e: unknown) => setNotice(e instanceof Error ? e.message : 'A törlés nem sikerült.'));
      return;
    }
    const ok = await ask({
      title: 'Törlöd a projektet?',
      confirmLabel: 'Végleges törlés',
      danger: true,
      body: `A(z) „${p.companyName || 'Névtelen projekt'}” projekt minden adata (mátrix, adatgyűjtés, interjúk, időkeret) törlődik ebből a böngészőből. Ha kellhet még, előbb mentsd fájlba.`,
    });
    if (ok) deleteProject(p.id);
  };

  const confirmUpload = async (p: ProjectMeta) => {
    const ok = await ask({
      title: 'Feltöltöd a projektet a szerverre?',
      confirmLabel: 'Feltöltés',
      body: `A(z) „${p.companyName || 'Névtelen projekt'}” mátrixa, adatgyűjtése és utókövetése a szerverre kerül, és onnan minden jogosult kolléga eléri; a böngészős példány törlődik. Az interjúk és az óraszámok ebben a lépésben még nem kerülnek fel – ha vannak, előbb mentsd a projektet fájlba.`,
    });
    if (!ok) return;
    setNotice(null);
    await uploadLocalProject(p.id).catch((e: unknown) => setNotice(e instanceof Error ? e.message : 'A feltöltés nem sikerült.'));
  };

  const confirmReset = async (p: ProjectMeta) => {
    const ok = await ask({
      title: 'Visszaállítod a bemutatót?',
      confirmLabel: 'Igen, visszaállítom',
      danger: true,
      body: `Biztosan? A(z) „${p.companyName}” bemutatón végzett minden módosítás elvész (mátrix, adatgyűjtés, interjúk, időkeret), és a minta kiinduló állapota tér vissza.`,
    });
    if (ok) choose(() => resetDemo(p.id));
  };

  return (
    <div className="flex items-center gap-2">
      <div ref={ref} className="relative">
        <button
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-haspopup="true"
          className="inline-flex max-w-[26rem] items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-800 hover:bg-slate-50"
        >
          <FolderOpen className="h-4 w-4 shrink-0 text-slate-500" />
          <span className="truncate">{label}</span>
          {isDemo && <span className="shrink-0 rounded bg-brand-100 px-1 text-xs font-medium text-brand-800">bemutató</span>}
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-500" />
        </button>

        {open && (
          <div className="absolute right-0 z-40 mt-1 w-[min(22rem,calc(100vw-2rem))] rounded-xl border border-slate-200/80 bg-white p-2 text-sm shadow-xl">
            {creating ? (
              <NewProjectForm
                onCancel={() => setCreating(false)}
                onCreate={(input) =>
                  choose(() => {
                    setNotice(null);
                    createAnyProject(input)
                      .then(() => {
                        // Saját projekt az Adatgyűjtéssel indul.
                        if (nav && nav.page !== 'adatok') nav.go('adatok');
                      })
                      .catch((e: unknown) => setNotice(e instanceof Error ? e.message : 'A projekt nem hozható létre.'));
                  })
                }
              />
            ) : (
              <button
                onClick={() => setCreating(true)}
                className="flex w-full items-center gap-2 rounded-lg bg-brand-600 px-3 py-2 text-left font-medium text-white hover:bg-brand-700"
              >
                <Plus className="h-4 w-4" /> Új projekt
              </button>
            )}

            <p className="mt-3 px-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Saját projektek</p>
            {own.length === 0 ? (
              <p className="px-2 py-1 text-xs text-slate-500">Még nincs saját projekt. Valódi ügyfélhez hozz létre újat.</p>
            ) : (
              <ul className="max-h-56 overflow-auto">
                {own.map((p) => (
                  <ProjectRow
                    key={p.id}
                    p={p}
                    active={p.id === activeId}
                    onOpen={() => choose(() => openProject(p.id, nav))}
                    onDelete={() => confirmDelete(p)}
                    onUpload={serverMode && !p.server ? () => confirmUpload(p) : undefined}
                  />
                ))}
              </ul>
            )}

            <p className="mt-3 px-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Bemutató (kitalált cégek)</p>
            <ul>
              {SCENARIOS.map((s) => {
                const opened = demos.find((d) => d.id === s.id);
                return (
                  <li key={s.id} className="group flex items-center gap-1">
                    <button
                      onClick={() =>
                        choose(() => {
                          openDemo(s.id);
                          openProject(s.id, nav);
                        })
                      }
                      className="flex min-w-0 flex-1 items-center gap-2 rounded px-2 py-1.5 text-left hover:bg-slate-50"
                    >
                      {s.id === activeId ? <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600" /> : <span className="w-3.5" />}
                      <span className="truncate">{s.label}</span>
                    </button>
                    {opened && (
                      <button
                        onClick={() => confirmReset(opened)}
                        title="Visszaállítás a minta kiinduló állapotára"
                        aria-label={`${s.label} visszaállítása`}
                        className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>

            <button
              onClick={() => {
                setOpen(false);
                setOverview(true);
              }}
              className="mt-2 flex w-full items-center gap-2 rounded border-t border-slate-100 px-2 pb-1.5 pt-2.5 text-left text-slate-700 hover:bg-slate-50"
            >
              <LayoutList className="h-3.5 w-3.5" /> Projektjeim – hol tartok, folytatás…
            </button>
            <ImportButton onDone={() => setOpen(false)} />
          </div>
        )}
      </div>

      {overview && <ProjectsOverview onClose={() => setOverview(false)} allowNewTab={allowNewTab} />}
      <SaveStatus projectId={activeId} meta={active} companyName={label} saveFile={saveFile} />
      {notice && (
        <p role="alert" className="max-w-xs text-xs text-red-700">
          {notice}
        </p>
      )}

      {confirmDialog}
    </div>
  );
}

function ProjectRow({
  p,
  active,
  onOpen,
  onDelete,
  onUpload,
}: {
  p: ProjectMeta;
  active: boolean;
  onOpen: () => void;
  onDelete: () => void;
  onUpload?: () => void;
}) {
  return (
    <li className="flex items-center gap-1">
      <button onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-2 rounded px-2 py-1.5 text-left hover:bg-slate-50">
        {active ? <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600" /> : <span className="w-3.5" />}
        <span className="min-w-0">
          <span className="block truncate text-slate-900">{p.companyName || 'Névtelen projekt'}</span>
          <span className="block truncate text-xs text-slate-500">
            {ENGAGEMENT_KINDS[p.kind]?.label} · {p.server ? 'szerveren · ' : ''}módosítva {ago(Date.parse(p.updatedAt))}
          </span>
        </span>
      </button>
      {onUpload && (
        <button
          onClick={onUpload}
          title="Feltöltés a szerverre"
          aria-label={`${p.companyName || 'Projekt'} feltöltése a szerverre`}
          className="rounded p-1 text-slate-500 hover:bg-brand-50 hover:text-brand-700"
        >
          <CloudUpload className="h-3.5 w-3.5" />
        </button>
      )}
      <button onClick={onDelete} aria-label={`${p.companyName || 'Projekt'} törlése`} className="rounded p-1 text-slate-500 hover:bg-red-50 hover:text-red-600">
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </li>
  );
}

export function NewProjectForm({ onCreate, onCancel }: { onCreate: (input: { companyName: string; kind: EngagementKind }) => void; onCancel: () => void }) {
  const [name, setName] = useState('');
  const [kind, setKind] = useState<EngagementKind>('HEALTH_CHECK');
  const [touched, setTouched] = useState(false);
  const invalid = name.trim().length < 2;
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setTouched(true);
        if (!invalid) onCreate({ companyName: name, kind });
      }}
      className="space-y-2 rounded-lg bg-slate-50 p-3"
    >
      <p className="font-medium text-slate-900">Új projekt</p>
      <label className="block text-xs text-slate-600">
        Cégnév
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="pl. Példa Kft."
          className="mt-0.5 w-full rounded border border-slate-200 bg-white px-2 py-1.5 text-sm"
        />
      </label>
      {touched && invalid && <p className="text-xs text-red-700">Add meg a cég nevét.</p>}
      <label className="block text-xs text-slate-600">
        Átvilágítás típusa
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value as EngagementKind)}
          className="mt-0.5 w-full rounded border border-slate-200 bg-white px-2 py-1.5 text-sm"
        >
          {ENGAGEMENT_KIND_LIST.map((k) => (
            <option key={k.kind} value={k.kind}>
              {k.label}
            </option>
          ))}
        </select>
      </label>
      <p className="text-xs text-slate-500">Üres katalógussal indul: semmi nincs bejelölve, mintaadat nincs benne. A kalauz végigvezet.</p>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="rounded-lg px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100">
          Mégse
        </button>
        <button type="submit" className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700">
          Létrehozás
        </button>
      </div>
    </form>
  );
}

function ImportButton({ onDone }: { onDone: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    try {
      importProject(parseBackup(await file.text()));
      onDone();
    } catch (e) {
      setError(e instanceof BackupError ? e.message : 'A visszatöltés nem sikerült.');
    } finally {
      if (input.current) input.current.value = '';
    }
  };
  return (
    <div className="mt-2 border-t border-slate-100 pt-2">
      <button onClick={() => input.current?.click()} className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-slate-700 hover:bg-slate-50">
        <Upload className="h-3.5 w-3.5" /> Projekt visszatöltése fájlból…
      </button>
      <input ref={input} type="file" accept=".json,application/json" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
      {error && <p className="px-2 text-xs text-red-700">{error}</p>}
    </div>
  );
}

/** „Helyben mentve – 2 perce”, és figyelmeztetés, ha régóta nincs mentés fájlba. */
function SaveStatus({ projectId, meta, companyName, saveFile }: { projectId: string; meta: ProjectMeta | undefined; companyName: string; saveFile: SaveFile }) {
  const [open, setOpen] = useState(false);
  const [, tick] = useState(0);
  const [note, setNote] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  useOutside(ref, () => setOpen(false), open);
  const sync = useSyncState(projectId);
  useEffect(() => {
    const t = window.setInterval(() => tick((n) => n + 1), 30_000);
    const onSave = () => tick((n) => n + 1);
    // Sikertelen mentésnél azonnal kinyílik a magyarázat (nem elég egy halvány jelzés).
    const onFail = () => {
      tick((n) => n + 1);
      setOpen(true);
    };
    window.addEventListener(SAVED_EVENT, onSave);
    window.addEventListener(SAVE_FAILED_EVENT, onFail);
    return () => {
      window.clearInterval(t);
      window.removeEventListener(SAVED_EVENT, onSave);
      window.removeEventListener(SAVE_FAILED_EVENT, onFail);
    };
  }, []);
  // A böngésző tárolóját csak betöltés után olvassuk: a szerveren renderelt HTML-lel egyeznie kell (hidratálás).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const failed = mounted ? saveFailedAt() : null;
  const saved = mounted ? lastSaved() : null;
  const backupAt = mounted && projectId ? lastBackup(projectId) : null;
  const due = mounted && projectId ? backupDue(meta, backupAt, Date.now(), () => projectHasContent(projectId)) : false;

  const backup = async () => {
    setNote(null);
    try {
      const data = exportProject(projectId);
      const name = `projekt-${slug(companyName) || 'nevtelen'}-${new Date().toISOString().slice(0, 10)}.json`;
      await saveFile(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), name);
      markBackedUp(projectId);
      tick((n) => n + 1);
      setNote('Elmentve. Tedd a céges meghajtóra, ne e-mailbe.');
    } catch (e) {
      setNote(e instanceof Error ? e.message : 'A mentés nem sikerült.');
    }
  };

  if (meta?.server) return <ServerSaveStatus state={sync} failed={failed} />;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs ${
          failed
            ? 'bg-red-600 font-medium text-white hover:bg-red-700'
            : due
              ? 'bg-amber-50 text-amber-800 hover:bg-amber-100'
              : 'text-slate-500 hover:bg-slate-100'
        }`}
      >
        {failed || due ? <AlertTriangle className="h-3.5 w-3.5" /> : <HardDrive className="h-3.5 w-3.5" />}
        <span className="hidden sm:inline">{failed ? 'A mentés nem sikerült!' : saved ? `Helyben mentve – ${ago(saved)}` : 'Helyi mentés'}</span>
        {!failed && due && <span className="hidden md:inline">· nincs mentés fájlba</span>}
      </button>
      {open && (
        <div
          role="dialog"
          aria-label="Mentés"
          className="absolute right-0 z-40 mt-1 w-[min(20rem,calc(100vw-2rem))] rounded-xl border border-slate-200/80 bg-white p-3 text-sm shadow-xl"
        >
          {failed && (
            <div role="alert" className="mb-3 rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-900">
              <p className="font-semibold">A legutóbbi módosítás nem mentődött el.</p>
              <p className="mt-1">
                Valószínűleg betelt a böngésző tárhelye (vagy privát ablakban dolgozol). A képernyőn lévő munka megvan, de bezárás vagy frissítés után elveszne.
                Szabadíts fel helyet: a Projektjeimben töröld a nem használt projekteket (előtte mentsd őket fájlba), aztán módosíts bármit, és a mentés újra
                megtörténik.
              </p>
            </div>
          )}
          <p className="font-medium text-slate-900">Az adatok csak ebben a böngészőben vannak</p>
          <p className="mt-1 text-xs text-slate-600">
            Minden módosítás azonnal mentődik ide{saved ? ` (utoljára ${ago(saved)})` : ''}. Ha törlöd a böngészési adatokat, másik gépre vagy böngészőre
            váltasz, az adatok itt nem lesznek meg. Rendszeresen mentsd a projektet fájlba.
          </p>
          <p className={`mt-2 text-xs ${due ? 'font-medium text-amber-800' : 'text-slate-500'}`}>
            Utolsó mentés fájlba: {backupAt ? ago(backupAt) : 'még nem volt'}
          </p>
          <button
            onClick={backup}
            className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700"
          >
            Projekt mentése fájlba
          </button>
          <p className="mt-2 text-xs text-slate-500">Visszatölteni a projektválasztóban lehet („Projekt visszatöltése fájlból…”).</p>
          {note && <p className="mt-1 text-xs text-slate-700">{note}</p>}
        </div>
      )}
    </div>
  );
}

const SYNC_LABEL: Record<SyncState['status'], string> = {
  idle: 'Szerveres projekt',
  loading: 'Betöltés a szerverről…',
  pending: 'Mentés hamarosan…',
  saving: 'Mentés a szerverre…',
  saved: 'Szerveren mentve',
  offline: 'Nincs kapcsolat – helyben megvan',
  conflict: 'Mentési ütközés!',
  error: 'A szerveres mentés nem sikerült',
};

/** Szerveres projekt mentési állapota: a munka a szerveren van, a böngésző csak gyorsítótár. */
function ServerSaveStatus({ state, failed }: { state: SyncState; failed: number | null }) {
  const bad = state.status === 'conflict' || state.status === 'error' || failed != null;
  const warn = state.status === 'offline';
  const label = failed != null ? 'A helyi mentés nem sikerült!' : SYNC_LABEL[state.status];
  return (
    <span
      role={bad ? 'alert' : 'status'}
      title={state.message ?? 'A projekt a szerveren van; minden módosítás automatikusan, verzióellenőrzéssel mentődik.'}
      className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs ${
        bad ? 'bg-red-600 font-medium text-white' : warn ? 'bg-amber-50 text-amber-800' : 'text-slate-500'
      }`}
    >
      {bad || warn ? <AlertTriangle className="h-3.5 w-3.5" /> : <Cloud className="h-3.5 w-3.5" />}
      <span className="hidden sm:inline">
        {label}
        {state.status === 'saved' && state.syncedAt ? ` – ${ago(state.syncedAt)}` : ''}
        {state.status === 'error' && state.message ? `: ${state.message}` : ''}
      </span>
    </span>
  );
}
