import { beforeEach, describe, expect, it } from 'vitest';
import { lastSaved, saveFailedAt } from './localSave';
import { backupDue, BackupError, deleteProject, exportProject, importProject, MODULE_KEYS, parseBackup, projectHasContent, resetDemo } from './projects';
import { saveIntake, loadIntake, EMPTY_INTAKE } from './intake/state';
import { saveTimesheet, loadTimesheet, EMPTY_TIMESHEET } from './timesheet/timesheet';
import {
  activeProjectId,
  lastPageOf,
  rememberPage,
  setActiveProject,
  createProject,
  listProjects,
  loadProject,
  loadWorkspace,
  openDemo,
  saveWorkspace,
  STORAGE_KEY,
} from './risk/store';

// Böngésző nélküli tesztkörnyezet: egyszerű memóriabeli localStorage.
class MemoryStorage {
  private m = new Map<string, string>();
  getItem(k: string) {
    return this.m.has(k) ? this.m.get(k)! : null;
  }
  setItem(k: string, v: string) {
    this.m.set(k, String(v));
  }
  removeItem(k: string) {
    this.m.delete(k);
  }
  clear() {
    this.m.clear();
  }
  keys() {
    return [...this.m.keys()];
  }
}
const store = new MemoryStorage();
(globalThis as { localStorage?: unknown }).localStorage = store;

beforeEach(() => store.clear());

describe('projektek', () => {
  it('új projekt: üres katalógus, saját azonosító, ez lesz az aktív', () => {
    const ws = createProject({ companyName: '  Példa Kft. ', kind: 'SUCCESSION' });
    expect(ws.projectId).toMatch(/^p-/);
    expect(ws.scenarioId).toBe('ures');
    expect(ws.companyName).toBe('Példa Kft.');
    expect(ws.items.some((r) => r.identified)).toBe(false);
    expect(activeProjectId()).toBe(ws.projectId);
    expect(loadWorkspace().companyName).toBe('Példa Kft.');
    const meta = listProjects().find((p) => p.id === ws.projectId)!;
    expect(meta.isDemo).toBe(false);
    expect(meta.kind).toBe('SUCCESSION');
    expect(lastSaved()).not.toBeNull();
  });

  it('projektváltás nem írja felül a másik projekt adatait', () => {
    const a = createProject({ companyName: 'A Kft.', kind: 'HEALTH_CHECK' });
    saveIntake(a.projectId, { ...EMPTY_INTAKE, answers: { Q01: true } });
    saveWorkspace({ ...a, items: a.items.map((r, i) => (i === 0 ? { ...r, identified: true } : r)) });
    const b = createProject({ companyName: 'B Kft.', kind: 'VENDOR_DD' });
    expect(loadIntake(b.projectId).answers).toEqual({});
    openDemo('gyarto');
    expect(loadWorkspace().scenarioId).toBe('gyarto');
    expect(loadProject(a.projectId).items[0].identified).toBe(true);
    expect(loadIntake(a.projectId).answers).toEqual({ Q01: true });
  });

  it('a korábbi, egyprojektes mentés bemutató projektként megmarad', () => {
    store.setItem(STORAGE_KEY, JSON.stringify({ scenarioId: 'konyvelo', companyName: 'Átírt név', kind: 'SUCCESSION', items: [] }));
    const list = listProjects();
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ id: 'konyvelo', isDemo: true, companyName: 'Átírt név' });
    expect(loadWorkspace().companyName).toBe('Átírt név');
  });

  it('törlés minden moduladatot visz, az aktív projekt átkerül', () => {
    const a = createProject({ companyName: 'A Kft.', kind: 'HEALTH_CHECK' });
    const b = createProject({ companyName: 'B Kft.', kind: 'HEALTH_CHECK' });
    saveTimesheet(b.projectId, { ...EMPTY_TIMESHEET, feeHuf: 1 });
    deleteProject(b.projectId);
    expect(listProjects().map((p) => p.id)).toEqual([a.projectId]);
    expect(activeProjectId()).toBe(a.projectId);
    expect(store.keys().some((k) => k.includes(b.projectId))).toBe(false);
  });

  it('bemutató visszaállítása a minta kiinduló állapotára', () => {
    openDemo('gyarto');
    saveWorkspace({ ...loadWorkspace(), companyName: 'Módosított' });
    saveIntake('gyarto', { ...EMPTY_INTAKE, answers: { Q01: true } });
    resetDemo('gyarto');
    expect(loadWorkspace().companyName).toBe('Minta Gyártó Kft.');
    expect(loadIntake('gyarto').answers).toEqual({});
  });

  it('mentés fájlba és visszatöltés új projektként, a meglévő felülírása nélkül', () => {
    const a = createProject({ companyName: 'A Kft.', kind: 'HEALTH_CHECK' });
    saveIntake(a.projectId, { ...EMPTY_INTAKE, answers: { Q02: false } });
    saveTimesheet(a.projectId, { ...EMPTY_TIMESHEET, feeHuf: 999 });
    const backup = parseBackup(JSON.stringify(exportProject(a.projectId)));
    expect(Object.keys(backup.modules).sort()).toEqual(['intake', 'timesheet']);

    const id = importProject(backup);
    expect(id).not.toBe(a.projectId);
    expect(loadProject(id).companyName).toBe('A Kft. (visszatöltve)');
    expect(loadIntake(id).answers).toEqual({ Q02: false });
    expect(loadTimesheet(id).feeHuf).toBe(999);
    expect(activeProjectId()).toBe(id);

    // Törlés után ugyanazzal az azonosítóval jön vissza.
    deleteProject(a.projectId);
    expect(importProject(backup)).toBe(a.projectId);
    expect(Object.keys(MODULE_KEYS)).toHaveLength(4);
  });

  it('tartalom felismerése a figyelmeztetéshez', () => {
    const a = createProject({ companyName: 'Üres Kft.', kind: 'HEALTH_CHECK' });
    expect(projectHasContent(a.projectId)).toBe(false);
    saveIntake(a.projectId, { ...EMPTY_INTAKE, answers: { Q01: true } });
    expect(projectHasContent(a.projectId)).toBe(true);
    const b = createProject({ companyName: 'Órás Kft.', kind: 'HEALTH_CHECK' });
    saveTimesheet(b.projectId, EMPTY_TIMESHEET);
    expect(projectHasContent(b.projectId)).toBe(false);
  });

  it('sikertelen mentés jelzése (betelt tárhely), sikeres mentés törli', () => {
    const a = createProject({ companyName: 'A Kft.', kind: 'HEALTH_CHECK' });
    expect(saveFailedAt()).toBeNull();
    const orig = store.setItem.bind(store);
    store.setItem = () => {
      throw new Error('QuotaExceededError');
    };
    saveWorkspace({ ...loadProject(a.projectId), companyName: 'B' });
    saveTimesheet(a.projectId, EMPTY_TIMESHEET);
    expect(saveFailedAt()).not.toBeNull();
    store.setItem = orig;
    saveWorkspace({ ...loadProject(a.projectId), companyName: 'C' });
    expect(saveFailedAt()).toBeNull();
  });

  it('laponként külön aktív projekt; új lap a legutóbbival indul', () => {
    const g = globalThis as { sessionStorage?: unknown };
    const tab1 = new MemoryStorage();
    const tab2 = new MemoryStorage();
    g.sessionStorage = tab1;
    const a = createProject({ companyName: 'A Kft.', kind: 'HEALTH_CHECK' });
    g.sessionStorage = tab2; // második lap
    expect(activeProjectId()).toBe(a.projectId);
    const b = createProject({ companyName: 'B Kft.', kind: 'HEALTH_CHECK' });
    expect(activeProjectId()).toBe(b.projectId);
    g.sessionStorage = tab1; // az első lapon továbbra is A
    expect(activeProjectId()).toBe(a.projectId);
    setActiveProject(a.projectId);
    delete g.sessionStorage;
  });

  it('hol tartottál: projektenként az utolsó oldal', () => {
    const a = createProject({ companyName: 'A Kft.', kind: 'HEALTH_CHECK' });
    expect(lastPageOf(a.projectId)).toBe('adatok'); // saját projekt: Adatgyűjtés
    expect(lastPageOf('gyarto')).toBe('matrix'); // bemutató: mátrix
    rememberPage(a.projectId, 'interjuk');
    expect(lastPageOf(a.projectId)).toBe('interjuk');
  });

  it('a projektlista változatlan tárolónál ugyanaz a tömb (a felület változásfigyelése erre épül)', () => {
    expect(listProjects()).toBe(listProjects()); // üres tároló
    const a = createProject({ companyName: 'A Kft.', kind: 'HEALTH_CHECK' });
    const first = listProjects();
    expect(listProjects()).toBe(first);
    saveWorkspace({ ...loadProject(a.projectId), companyName: 'A Kft. új név' });
    expect(listProjects()).not.toBe(first);
  });

  it('hibás fájl visszautasítása', () => {
    expect(() => parseBackup('nem json')).toThrow(BackupError);
    expect(() => parseBackup('{"format":"mas"}')).toThrow('Ez nem');
    // Formailag projektmentés, de sérült tétellel: nem kerülhet a tárolóba.
    const a = createProject({ companyName: 'A Kft.', kind: 'HEALTH_CHECK' });
    const good = exportProject(a.projectId);
    const bad = { ...good, workspace: { ...good.workspace, items: [{ ...good.workspace.items[0], likelihood: 9 }] } };
    expect(() => parseBackup(JSON.stringify(bad))).toThrow(/sérült.*items\.0\.likelihood/);
    expect(() => parseBackup(JSON.stringify({ ...good, workspace: { ...good.workspace, company: undefined } }))).toThrow(/company/);
    // Ismeretlen (újabb verzióbeli) mező megmarad.
    const extra = { ...good, workspace: { ...good.workspace, items: [{ ...good.workspace.items[0], jovobeliMezo: 1 }] } };
    expect((parseBackup(JSON.stringify(extra)).workspace.items[0] as unknown as Record<string, unknown>).jovobeliMezo).toBe(1);
  });

  it('figyelmeztetés, ha régóta nincs mentés fájlba', () => {
    const meta = {
      id: 'p',
      companyName: 'x',
      kind: 'HEALTH_CHECK' as const,
      scenarioId: 'ures',
      isDemo: false,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-03-01T00:00:00Z',
    };
    const now = Date.parse('2026-03-02T00:00:00Z');
    expect(backupDue(meta, null, now)).toBe(true);
    expect(backupDue(meta, null, now, false)).toBe(false); // üres projekt: nincs mit menteni
    expect(backupDue({ ...meta, createdAt: '2026-03-01T20:00:00Z' }, null, now)).toBe(false); // friss projekt
    expect(backupDue(meta, Date.parse('2026-02-28T00:00:00Z'), now)).toBe(false); // 2 napos
    expect(backupDue(meta, Date.parse('2026-02-01T00:00:00Z'), now)).toBe(true);
    expect(backupDue({ ...meta, isDemo: true }, null, now)).toBe(false);
  });
});
