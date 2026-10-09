import { EMPTY_INTAKE, intakeKey, loadIntake } from '@/lib/intake/state';
import { SAVED_EVENT } from '@/lib/localSave';
import { deleteProject } from '@/lib/projects';
import { loadSnapshots, snapshotsKey } from '@/lib/risk/followup';
import {
  activeProjectId,
  createProject,
  listProjects,
  loadProject,
  PROJECT_EVENT,
  registerServerProject,
  reloadProject,
  saveWorkspace,
  setActiveProject,
  type Workspace,
} from '@/lib/risk/store';
import type { EngagementKind } from '@/lib/engagement/kinds';
import type { ProjectSummary, ServerProject } from '@/lib/server/projects';
import { readJson, removeKey, writeJson } from '@/lib/storage';

/**
 * Szerveres projekttárolás a felületen (0015). A szerver az igazság forrása; a
 * böngésző gyorsítótár, hogy a felület azonnal, hálózat nélkül is működjön.
 *
 *  - Megnyitáskor a projekt a szerverről töltődik (ha helyben nincs feltöltetlen munka).
 *  - Minden helyi mentés után, rövid várakozással, a projekt feltöltődik
 *    (`/api/engagements/[id]/save`, egy tranzakció). A kérés a legutóbb látott
 *    verziót viszi: ha közben más mentett, a szerver 409-cel elutasítja, és a
 *    felület ütközést jelez – semmi nem íródik felül csendben.
 *  - Hálózati hiba esetén a munka helyben megmarad, és újrapróbálja.
 *
 * Bemutató és helyi (szerver nélküli) projektet nem érint. Az interjúk és az
 * óraszámok ebben a lépésben még helyben maradnak (docs/12).
 */

export type SyncStatus = 'idle' | 'loading' | 'saving' | 'saved' | 'pending' | 'offline' | 'conflict' | 'error';

export interface SyncState {
  status: SyncStatus;
  message?: string;
  syncedAt: number | null;
}

interface SyncRecord {
  revision: number;
  /** A legutóbb a szerverrel egyező tartalom lenyomata (null: még nem egyeztetett). */
  hash: string | null;
  syncedAt: number | null;
}

export const SYNC_EVENT = 'ict-hc:sync';
const recKey = (id: string) => `ict-hc:sync:v1:${id}`;
const DEBOUNCE_MS = 1500;
const RETRY_MS = 30_000;

type Fetch = typeof fetch;
const states = new Map<string, SyncState>();

export function syncState(id: string): SyncState {
  return states.get(id) ?? { status: 'idle', syncedAt: record(id)?.syncedAt ?? null };
}

function setState(id: string, status: SyncStatus, message?: string): void {
  states.set(id, { status, message, syncedAt: record(id)?.syncedAt ?? null });
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(SYNC_EVENT, { detail: id }));
}

function record(id: string): SyncRecord | null {
  return readJson<SyncRecord>(recKey(id));
}

export function isServerProject(id: string): boolean {
  return listProjects().some((p) => p.id === id && p.server);
}

// ── Tartalom ↔ kérés ────────────────────────────────────────────────

/** Rövid, determinisztikus lenyomat (nem biztonsági célú: a változás észlelésére). */
export function digest(text: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193);
    h2 = (Math.imul(h2, 31) + c) | 0;
  }
  return `${(h1 >>> 0).toString(36)}${(h2 >>> 0).toString(36)}${text.length.toString(36)}`;
}

export interface SaveBody {
  expectedRevision: number;
  items: Workspace['items'];
  answers: Record<string, unknown>;
  requestStatus: Record<string, unknown>;
  company: Workspace['company'];
  coverageOverrides?: Workspace['coverageOverrides'];
  coverageLog?: Workspace['coverageLog'];
  modules: { intake: Record<string, unknown>; snapshots: unknown[] };
}

/** A helyi munkaállapotból a mentési kérés (a szerver ebből számol és ír). */
export function buildSaveBody(id: string, expectedRevision: number): { body: SaveBody; hash: string } {
  const ws = loadProject(id);
  const intake = loadIntake(id);
  const { answers, requestStatus, invalidAnswers: _invalid, ...rest } = intake;
  void _invalid;
  const content = {
    items: ws.items,
    answers: answers as Record<string, unknown>,
    requestStatus: requestStatus as Record<string, unknown>,
    company: ws.company,
    ...(ws.coverageOverrides ? { coverageOverrides: ws.coverageOverrides } : {}),
    ...(ws.coverageLog ? { coverageLog: ws.coverageLog } : {}),
    modules: { intake: rest as unknown as Record<string, unknown>, snapshots: loadSnapshots(id) as unknown[] },
  };
  return { body: { expectedRevision, ...content }, hash: digest(JSON.stringify(content)) };
}

/** A szerverről betöltött projekt beírása a helyi tárolóba (munkaállapot, adatgyűjtés, pillanatképek). */
export function applyServerProject(p: ServerProject): void {
  const prev = loadProject(p.id);
  saveWorkspace({
    projectId: p.id,
    scenarioId: prev.scenarioId,
    companyName: p.companyName,
    company: p.company,
    kind: p.kind,
    materialityHuf: p.materialityHuf,
    items: p.items,
    ...(p.coverageOverrides ? { coverageOverrides: p.coverageOverrides } : {}),
    ...(p.coverageLog ? { coverageLog: p.coverageLog } : {}),
  });
  writeJson(intakeKey(p.id), { ...EMPTY_INTAKE, ...(p.intake ?? {}), answers: p.answers, requestStatus: p.requestStatus });
  if (p.snapshots.length) writeJson(snapshotsKey(p.id), p.snapshots);
  else removeKey(snapshotsKey(p.id));
  // A betöltött állapot a szerverrel egyező: ennek a lenyomata az alap.
  const { hash } = buildSaveBody(p.id, p.revision);
  writeJson(recKey(p.id), { revision: p.revision, hash, syncedAt: Date.now() } satisfies SyncRecord);
}

/** Van-e helyben feltöltetlen módosítás. */
export function hasLocalChanges(id: string): boolean {
  const rec = record(id);
  if (!rec) return false; // ez a böngésző még nem egyeztetett: a szerver a forrás
  if (rec.hash === null) return true; // itt létrehozva / feltöltve, de még nem ért fel
  return buildSaveBody(id, rec.revision).hash !== rec.hash;
}

// ── Hálózat ─────────────────────────────────────────────────────────

async function readError(res: Response): Promise<string> {
  const body = (await res.json().catch(() => ({}))) as { error?: string };
  return body.error ?? `Hiba (${res.status})`;
}

/** A projektlista a szerverről; a helyi lista szerveres bejegyzései frissülnek. */
export async function pullProjectList(f: Fetch = fetch): Promise<ProjectSummary[] | null> {
  let res: Response;
  try {
    res = await f('/api/engagements', { cache: 'no-store' });
  } catch {
    return null;
  }
  if (!res.ok) return null;
  const { projects } = (await res.json()) as { projects: ProjectSummary[] };
  for (const p of projects) registerServerProject({ id: p.id, companyName: p.companyName, kind: p.kind, updatedAt: p.updatedAt });
  // Amihez már nincs hozzáférés (pl. kivették a projektből), az ebből a böngészőből is eltűnik – kivéve a feltöltetlen munkát.
  const ids = new Set(projects.map((p) => p.id));
  for (const m of listProjects()) if (m.server && !ids.has(m.id) && !hasLocalChanges(m.id)) forget(m.id);
  return projects;
}

/**
 * Projekt betöltése a szerverről. Ha helyben feltöltetlen munka van, és a
 * szerveren közben újabb verzió készült, nem írja felül: ütközést jelez.
 */
export async function pullProject(id: string, f: Fetch = fetch, opts: { discardLocal?: boolean } = {}): Promise<SyncStatus> {
  if (!isServerProject(id)) return 'idle';
  setState(id, 'loading');
  let res: Response;
  try {
    res = await f(`/api/engagements/${id}`, { cache: 'no-store' });
  } catch {
    setState(id, 'offline', 'Nincs kapcsolat a szerverrel – a helyi másolaton dolgozol.');
    return 'offline';
  }
  if (!res.ok) {
    setState(id, 'error', await readError(res));
    return 'error';
  }
  const { project } = (await res.json()) as { project: ServerProject };
  const rec = record(id);
  if (!opts.discardLocal && hasLocalChanges(id)) {
    if (rec && rec.revision === project.revision) return pushProject(id, f); // csak mi módosítottunk: feltöltjük
    setState(id, 'conflict', 'Közben más is mentett ebbe a projektbe, és itt is van feltöltetlen módosítás.');
    return 'conflict';
  }
  if (!rec || rec.revision !== project.revision || opts.discardLocal) {
    applyServerProject(project);
    if (id === activeProjectId()) reloadProject();
  }
  setState(id, 'saved');
  return 'saved';
}

const inflight = new Set<string>();
const again = new Set<string>();

/** A helyi állapot feltöltése a szerverre (egy tranzakció, verzióval). */
export async function pushProject(id: string, f: Fetch = fetch): Promise<SyncStatus> {
  if (!isServerProject(id)) return 'idle';
  if (syncState(id).status === 'conflict') return 'conflict'; // ütközésnél a felhasználó dönt
  if (inflight.has(id)) {
    again.add(id);
    return 'saving';
  }
  const rec = record(id) ?? { revision: 0, hash: null, syncedAt: null };
  const { body, hash } = buildSaveBody(id, rec.revision);
  if (hash === rec.hash) {
    setState(id, 'saved');
    return 'saved';
  }
  inflight.add(id);
  setState(id, 'saving');
  try {
    let res: Response;
    try {
      res = await f(`/api/engagements/${id}/save`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    } catch {
      setState(id, 'offline', 'Nincs kapcsolat a szerverrel – a munka helyben megvan, újrapróbáljuk.');
      scheduleRetry(id, f);
      return 'offline';
    }
    if (res.status === 409) {
      setState(id, 'conflict', 'Közben más is mentett ebbe a projektbe. Válaszd ki, melyik változat maradjon.');
      return 'conflict';
    }
    if (!res.ok) {
      setState(id, 'error', await readError(res));
      return 'error';
    }
    const { revision } = (await res.json()) as { revision: number };
    writeJson(recKey(id), { revision, hash, syncedAt: Date.now() } satisfies SyncRecord);
    setState(id, 'saved');
    return 'saved';
  } finally {
    inflight.delete(id);
    if (again.delete(id)) void pushProject(id, f);
  }
}

const retries = new Map<string, ReturnType<typeof setTimeout>>();
function scheduleRetry(id: string, f: Fetch): void {
  if (retries.has(id) || typeof window === 'undefined') return;
  retries.set(
    id,
    setTimeout(() => {
      retries.delete(id);
      void pushProject(id, f);
    }, RETRY_MS),
  );
}

/** Feltöltés most (pl. AI-felülvizsgálat előtt: a szerver az adatbázisból olvas). */
export async function flushProject(id: string, f: Fetch = fetch): Promise<void> {
  if (!isServerProject(id)) return;
  const status = await pushProject(id, f);
  if (status === 'conflict' || status === 'error' || status === 'offline') {
    throw new Error(syncState(id).message ?? 'A projekt nincs a szerverre mentve.');
  }
}

/** Ütközés feloldása. 'server': a helyi módosítás elvetése; 'local': a helyi változat felülírja a szerverét. */
export async function resolveConflict(id: string, keep: 'server' | 'local', f: Fetch = fetch): Promise<SyncStatus> {
  states.delete(id);
  if (keep === 'server') return pullProject(id, f, { discardLocal: true });
  let res: Response;
  try {
    res = await f(`/api/engagements/${id}`, { cache: 'no-store' });
  } catch {
    setState(id, 'offline', 'Nincs kapcsolat a szerverrel.');
    return 'offline';
  }
  if (!res.ok) {
    setState(id, 'error', await readError(res));
    return 'error';
  }
  const { project } = (await res.json()) as { project: ServerProject };
  const rec = record(id);
  writeJson(recKey(id), { revision: project.revision, hash: null, syncedAt: rec?.syncedAt ?? null } satisfies SyncRecord);
  return pushProject(id, f);
}

// ── Létrehozás, törlés, feltöltés ───────────────────────────────────

export interface NewProjectInput {
  companyName: string;
  kind: EngagementKind;
  materialityHuf?: number;
}

/** Új projekt a szerveren; utána helyben is megnyílik. */
export async function createServerProject(input: NewProjectInput, f: Fetch = fetch): Promise<Workspace> {
  const res = await f('/api/engagements', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
  if (!res.ok) throw new Error(await readError(res));
  const { id } = (await res.json()) as { id: string };
  writeJson(recKey(id), { revision: 0, hash: null, syncedAt: null } satisfies SyncRecord);
  const ws = createProject(input, Date.now(), id);
  await pushProject(id, f);
  return ws;
}

/** Projekt törlése a szerverről (csak partner), utána helyben is. */
export async function deleteServerProject(id: string, f: Fetch = fetch): Promise<void> {
  const res = await f(`/api/engagements/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(await readError(res));
  forget(id);
}

/**
 * Helyi (böngészős) projekt feltöltése a szerverre: új szerveres projekt
 * készül, a munka átkerül, a helyi példány törlődik. Az interjúk és az
 * óraszámok egyelőre helyben maradnak, ezért ezeknél a felület megerősítést kér.
 */
export async function uploadLocalProject(localId: string, f: Fetch = fetch): Promise<string> {
  const ws = loadProject(localId);
  const res = await f('/api/engagements', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ companyName: ws.companyName || 'Névtelen projekt', kind: ws.kind, materialityHuf: ws.materialityHuf }),
  });
  if (!res.ok) throw new Error(await readError(res));
  const { id } = (await res.json()) as { id: string };
  registerServerProject({ id, companyName: ws.companyName, kind: ws.kind, updatedAt: new Date().toISOString() });
  writeJson(recKey(id), { revision: 0, hash: null, syncedAt: null } satisfies SyncRecord);
  saveWorkspace({ ...ws, projectId: id });
  writeJson(intakeKey(id), readJson(intakeKey(localId)) ?? EMPTY_INTAKE);
  const snaps = readJson(snapshotsKey(localId));
  if (snaps) writeJson(snapshotsKey(id), snaps);
  const status = await pushProject(id, f);
  if (status !== 'saved') throw new Error(syncState(id).message ?? 'A feltöltés nem fejeződött be; a helyi példány megmaradt.');
  setActiveProject(id);
  deleteProject(localId);
  return id;
}

function forget(id: string): void {
  deleteProject(id); // helyi munkaállapot, moduladatok, listabejegyzés
  removeKey(recKey(id));
  states.delete(id);
}

// ── Automatikus szinkron ────────────────────────────────────────────

/**
 * A szinkron indítása bejelentkezett felhasználónál: lista és aktív projekt
 * betöltése, majd minden helyi mentés után feltöltés. Visszaadja a leállítót.
 */
export function startServerSync(f: Fetch = fetch): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const onSaved = () => {
    const id = activeProjectId();
    if (!isServerProject(id)) return;
    if (syncState(id).status !== 'conflict') setState(id, 'pending');
    clearTimeout(timer);
    timer = setTimeout(() => void pushProject(id, f), DEBOUNCE_MS);
  };
  const onProject = () => void pullProject(activeProjectId(), f);
  const onOnline = () => void pushProject(activeProjectId(), f);
  const onUnload = (e: BeforeUnloadEvent) => {
    const id = activeProjectId();
    const s = syncState(id).status;
    if (isServerProject(id) && (s === 'pending' || s === 'saving' || hasLocalChanges(id))) e.preventDefault();
  };
  window.addEventListener(SAVED_EVENT, onSaved);
  window.addEventListener(PROJECT_EVENT, onProject);
  window.addEventListener('online', onOnline);
  window.addEventListener('beforeunload', onUnload);
  void pullProjectList(f).then(() => pullProject(activeProjectId(), f));
  return () => {
    clearTimeout(timer);
    window.removeEventListener(SAVED_EVENT, onSaved);
    window.removeEventListener(PROJECT_EVENT, onProject);
    window.removeEventListener('online', onOnline);
    window.removeEventListener('beforeunload', onUnload);
  };
}
