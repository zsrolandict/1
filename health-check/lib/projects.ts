import {
  activeProjectId,
  DEFAULT_WORKSPACE,
  listProjects,
  byRecent,
  loadProject,
  newProjectId,
  reloadProject,
  removeProjectWorkspace,
  saveWorkspace,
  setActiveProject,
  workspaceFromScenario,
  type ProjectMeta,
  type Workspace,
} from '@/lib/risk/store';
import { getScenario } from '@/lib/scenarios';
import { intakeKey, loadIntake, saveIntake } from '@/lib/intake/state';
import { interviewsKey, loadRecords } from '@/lib/interview/records';
import { loadSnapshots, snapshotsKey } from '@/lib/risk/followup';
import { loadTimesheet, timesheetKey } from '@/lib/timesheet/timesheet';
import { readJson, removeKey, writeJson } from '@/lib/storage';
import { SAMPLE_PROFILES } from '@/lib/intake/samples/profiles';
import { missingSectorRisks } from '@/lib/risk/sectorRisks';

/**
 * Projektszintű műveletek a böngészős tárolón: törlés, bemutató
 * visszaállítása, mentés fájlba és visszatöltés. Egy projekt adatai a
 * modulok saját kulcsai alatt vannak; ez a lista fogja össze őket.
 */

/** A projekthez tartozó modul-kulcsok (a munkaállapoton kívül) – a modulok saját kulcsfüggvényei. */
export const MODULE_KEYS = {
  intake: intakeKey,
  interviews: interviewsKey,
  snapshots: snapshotsKey,
  timesheet: timesheetKey,
} as const;

type ModuleKey = keyof typeof MODULE_KEYS;

function removeModuleData(id: string): void {
  for (const k of Object.values(MODULE_KEYS)) removeKey(k(id));
}

/** Projekt végleges törlése minden moduladatával. Az aktív projekt helyére a legutóbbi másik kerül. */
export function deleteProject(id: string): void {
  const wasActive = activeProjectId() === id; // törlés előtt: utána már nem létező projektre mutatna
  removeModuleData(id);
  removeProjectWorkspace(id);
  if (wasActive) {
    const next = [...listProjects()].sort(byRecent)[0];
    setActiveProject(next?.id ?? DEFAULT_WORKSPACE.projectId);
  }
}

/** Bemutató projekt visszaállítása a minta kiinduló állapotára (minden módosítás elvész). */
export function resetDemo(id: string): void {
  removeModuleData(id);
  saveWorkspace(workspaceFromScenario(getScenario(id), id));
  setActiveProject(id);
  // Ha éppen ez a projekt van nyitva, a projektazonosító nem változik: a nyitott oldal töltse újra.
  reloadProject();
}

/**
 * A bemutató minta-tényállásának betöltése (a kalauzból): a tényállás és az
 * ágazati kockázati tételek (pipálatlanul) bekerülnek. Visszaadja, hány
 * ágazati tétel került a mátrixba; null, ha a projekthez nincs minta.
 */
export function applySampleProfile(ws: Workspace): number | null {
  const profile = SAMPLE_PROFILES[ws.scenarioId];
  if (!profile) return null;
  saveIntake(ws.projectId, { ...loadIntake(ws.projectId), profile });
  const add = missingSectorRisks(profile.sectors, ws.items);
  if (add.length) saveWorkspace({ ...ws, items: [...ws.items, ...add] });
  reloadProject();
  return add.length;
}

// ── Mentés fájlba / visszatöltés ────────────────────────────────────

export const BACKUP_FORMAT = 'ict-hc-projekt';

export interface ProjectBackup {
  format: typeof BACKUP_FORMAT;
  version: 1;
  exportedAt: string;
  meta: ProjectMeta | null;
  workspace: Workspace;
  modules: Partial<Record<ModuleKey, unknown>>;
}

const backupKey = (id: string) => `ict-hc:backup:v1:${id}`;

export function exportProject(id: string, now = new Date()): ProjectBackup {
  const modules: ProjectBackup['modules'] = {};
  for (const [name, k] of Object.entries(MODULE_KEYS) as [ModuleKey, (id: string) => string][]) {
    const value = readJson<unknown>(k(id)); // sérült modul-adat: kimarad
    if (value != null) modules[name] = value;
  }
  return {
    format: BACKUP_FORMAT,
    version: 1,
    exportedAt: now.toISOString(),
    meta: listProjects().find((p) => p.id === id) ?? null,
    workspace: loadProject(id),
    modules,
  };
}

/** A fájlba mentés időpontja projektenként (a „nincs friss mentés” jelzéshez). */
export function markBackedUp(id: string, now = Date.now()): void {
  try {
    localStorage.setItem(backupKey(id), String(now));
  } catch {
    /* ignore */
  }
}

export function lastBackup(id: string): number | null {
  try {
    const v = Number(localStorage.getItem(backupKey(id)));
    return v > 0 ? v : null;
  } catch {
    return null;
  }
}

/** Van-e a projektben olyan munka, amit kár lenne elveszíteni. */
export function projectHasContent(id: string): boolean {
  if (loadProject(id).items.some((r) => r.identified)) return true;
  const intake = loadIntake(id);
  if (Object.keys(intake.answers).length || intake.documents.length || Object.keys(intake.tables).length || intake.profile.narrative.trim()) return true;
  return Object.keys(loadRecords(id)).length > 0 || loadTimesheet(id).entries.length > 0 || loadSnapshots(id).length > 0;
}

const DAY = 86_400_000;

/**
 * Figyelmeztessünk-e a fájlba mentésre. Csak saját projektnél, ha már van
 * benne munka, és: még nem volt mentés, de a projekt egy napnál régebbi;
 * vagy az utolsó mentés 7 napnál régebbi, és azóta módosult.
 */
export function backupDue(meta: ProjectMeta | undefined, backupAt: number | null, now = Date.now(), hasContent: boolean | (() => boolean) = true): boolean {
  if (!meta || meta.isDemo) return false;
  const byTime = backupAt == null ? now - Date.parse(meta.createdAt) > DAY : Date.parse(meta.updatedAt) > backupAt && now - backupAt > 7 * DAY;
  // A tartalom-ellenőrzés a drága rész (a projekt adatait olvassa): csak akkor fut, ha az idő alapján figyelmeztetnénk.
  return byTime && (typeof hasContent === 'function' ? hasContent() : hasContent);
}

export class BackupError extends Error {}

export function parseBackup(text: string): ProjectBackup {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new BackupError('A fájl nem olvasható (nem projektmentés).');
  }
  const b = data as Partial<ProjectBackup>;
  if (!b || b.format !== BACKUP_FORMAT || b.version !== 1 || !b.workspace || !Array.isArray(b.workspace.items)) {
    throw new BackupError('Ez nem az ICT Health Check projektmentése.');
  }
  return b as ProjectBackup;
}

/**
 * Visszatöltés új projektként: a meglévőt sosem írja felül. Ha az azonosító
 * még szabad, megtartja (ugyanaz a gép, törlés után); különben újat kap.
 */
export function importProject(backup: ProjectBackup, now = Date.now()): string {
  const taken = new Set(listProjects().map((p) => p.id));
  const original = backup.workspace.projectId;
  const id = original && !taken.has(original) ? original : newProjectId(now);
  const suffix = id === original ? '' : ' (visszatöltve)';
  for (const [name, value] of Object.entries(backup.modules ?? {}) as [ModuleKey, unknown][]) {
    if (name in MODULE_KEYS) writeJson(MODULE_KEYS[name](id), value);
  }
  saveWorkspace({ ...backup.workspace, projectId: id, companyName: `${backup.workspace.companyName}${suffix}` });
  markBackedUp(id, now);
  setActiveProject(id);
  return id;
}
