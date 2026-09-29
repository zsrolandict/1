import { markSaved } from '@/lib/localSave';
import {
  activeProjectId,
  DEFAULT_WORKSPACE,
  listProjects,
  loadProject,
  projectStorageKey,
  reloadProject,
  removeProjectWorkspace,
  saveWorkspace,
  setActiveProject,
  workspaceFromScenario,
  type ProjectMeta,
  type Workspace,
} from '@/lib/risk/store';
import { getScenario } from '@/lib/scenarios';
import { loadIntake, saveIntake } from '@/lib/intake/state';
import { SAMPLE_PROFILES } from '@/lib/intake/samples/profiles';
import { missingSectorRisks } from '@/lib/risk/sectorRisks';

/**
 * Projektszintű műveletek a böngészős tárolón: törlés, bemutató
 * visszaállítása, mentés fájlba és visszatöltés. Egy projekt adatai a
 * modulok saját kulcsai alatt vannak; ez a lista fogja össze őket.
 */

/** A projekthez tartozó modul-kulcsok (a munkaállapoton kívül). */
export const MODULE_KEYS = {
  intake: (id: string) => `ict-hc:intake:v1:${id}`,
  interviews: (id: string) => `ict-hc:interviews:v1:${id}`,
  snapshots: (id: string) => `ict-hc:snapshots:v1:${id}`,
  timesheet: (id: string) => `ict-hc:timesheet:v1:${id}`,
} as const;

type ModuleKey = keyof typeof MODULE_KEYS;

function removeModuleData(id: string): void {
  for (const k of Object.values(MODULE_KEYS)) {
    try {
      localStorage.removeItem(k(id));
    } catch {
      /* ignore */
    }
  }
}

/** Projekt végleges törlése minden moduladatával. Az aktív projekt helyére a legutóbbi másik kerül. */
export function deleteProject(id: string): void {
  removeModuleData(id);
  removeProjectWorkspace(id);
  if (activeProjectId() === id) {
    const next = [...listProjects()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
    setActiveProject(next?.id ?? DEFAULT_WORKSPACE.projectId);
  }
}

/** Bemutató projekt visszaállítása a minta kiinduló állapotára (minden módosítás elvész). */
export function resetDemo(id: string): void {
  removeModuleData(id);
  saveWorkspace(workspaceFromScenario(getScenario(id), id));
  setActiveProject(id);
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
    try {
      const raw = localStorage.getItem(k(id));
      if (raw) modules[name] = JSON.parse(raw);
    } catch {
      /* sérült modul-adat: kimarad */
    }
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

/** Figyelmeztessünk-e: volt módosítás a legutóbbi fájlba mentés óta, és az 7 napnál régebbi (vagy nem volt). */
export function backupDue(meta: ProjectMeta | undefined, backupAt: number | null, now = Date.now()): boolean {
  if (!meta || meta.isDemo) return false;
  const updated = Date.parse(meta.updatedAt);
  if (backupAt == null) return true;
  return updated > backupAt && now - backupAt > 7 * 86_400_000;
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
  const id = original && !taken.has(original) ? original : `p-${now.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const suffix = id === original ? '' : ' (visszatöltve)';
  for (const [name, value] of Object.entries(backup.modules ?? {}) as [ModuleKey, unknown][]) {
    if (!(name in MODULE_KEYS)) continue;
    try {
      localStorage.setItem(MODULE_KEYS[name](id), JSON.stringify(value));
    } catch {
      /* betelt tárhely */
    }
  }
  saveWorkspace({ ...backup.workspace, projectId: id, companyName: `${backup.workspace.companyName}${suffix}` });
  markSaved();
  markBackedUp(id, now);
  setActiveProject(id);
  return id;
}

export { projectStorageKey };
