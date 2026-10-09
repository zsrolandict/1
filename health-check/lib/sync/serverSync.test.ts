import { beforeEach, describe, expect, it } from 'vitest';
import { loadIntake, saveIntake } from '@/lib/intake/state';
import { createProject, listProjects, loadProject, saveWorkspace } from '@/lib/risk/store';
import { DEFAULT_CATALOG } from '@/lib/risk/catalog';
import type { ServerProject } from '@/lib/server/projects';
import { DEFAULT_COMPANY } from '@/lib/risk/valuation';
import {
  buildSaveBody,
  createServerProject,
  hasLocalChanges,
  pullProject,
  pullProjectList,
  pushProject,
  resolveConflict,
  syncState,
  uploadLocalProject,
} from './serverSync';

/**
 * Szerveres projekttárolás a felületen: a szerver az igazság forrása,
 * ütközésnél semmi nem íródik felül csendben, hálózati hibánál a munka megmarad.
 */

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
}
const storage = new MemoryStorage();
(globalThis as { localStorage?: unknown }).localStorage = storage;

const ID = '11111111-1111-4111-8111-111111111111';

/** Kitalált szerver: egy projekt, verzióval; a mentés verzióellenőrzéssel. */
function fakeServer(initial?: Partial<ServerProject>) {
  const project: ServerProject = {
    id: ID,
    code: 'HC-2026-X',
    companyName: 'Kitalált Minta Kft.',
    kind: 'HEALTH_CHECK',
    revision: 0,
    updatedAt: '2026-10-01T10:00:00.000Z',
    materialityHuf: 50_000_000,
    company: DEFAULT_COMPANY,
    items: [],
    answers: {},
    requestStatus: {},
    intake: null,
    snapshots: [],
    ...initial,
  };
  const calls: { method: string; url: string; body?: unknown }[] = [];
  let offline = false;
  const f = (async (url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET';
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ method, url, body });
    if (offline) throw new TypeError('fetch failed');
    const json = (status: number, data: unknown) => new Response(JSON.stringify(data), { status });
    if (url === '/api/engagements' && method === 'GET') {
      return json(200, {
        projects: [
          {
            id: project.id,
            code: project.code,
            companyName: project.companyName,
            kind: project.kind,
            revision: project.revision,
            updatedAt: project.updatedAt,
          },
        ],
      });
    }
    if (url === '/api/engagements' && method === 'POST') return json(201, { id: ID, revision: 0 });
    if (url === `/api/engagements/${ID}` && method === 'GET') return json(200, { project });
    if (url === `/api/engagements/${ID}/save`) {
      if (body.expectedRevision !== project.revision) return json(409, { error: 'Közben valaki más mentett.' });
      project.revision++;
      project.items = body.items;
      project.answers = body.answers;
      project.requestStatus = body.requestStatus;
      project.intake = body.modules.intake;
      project.snapshots = body.modules.snapshots;
      return json(200, { revision: project.revision });
    }
    return json(404, { error: 'nincs' });
  }) as typeof fetch;
  return {
    project,
    calls,
    f,
    setOffline: (v: boolean) => (offline = v),
    /** Egy kolléga ment közben. */
    otherSaves: (patch: Partial<ServerProject>) => Object.assign(project, patch, { revision: project.revision + 1 }),
  };
}

const item = (code: string, l: 1 | 2 | 3 | 4 | 5) => ({ ...DEFAULT_CATALOG.find((r) => r.code === code)!, identified: true, likelihood: l });

beforeEach(() => storage.clear());

describe('szerveres projekttárolás', () => {
  it('új projekt a szerveren készül; a módosítás egy kérésben, verzióval kerül fel', async () => {
    const srv = fakeServer();
    await createServerProject({ companyName: 'Kitalált Minta Kft.', kind: 'HEALTH_CHECK' }, srv.f);
    expect(listProjects().find((p) => p.id === ID)).toMatchObject({ server: true, isDemo: false });
    expect(srv.project.revision).toBe(1);

    const ws = loadProject(ID);
    saveWorkspace({ ...ws, items: [item('LEG-01', 4)] });
    saveIntake(ID, { ...loadIntake(ID), answers: { Q22: 45 }, requestStatus: { d1: 'RECEIVED' } });
    expect(hasLocalChanges(ID)).toBe(true);
    expect(await pushProject(ID, srv.f)).toBe('saved');
    const save = srv.calls.filter((c) => c.url.endsWith('/save')).at(-1)!.body as ReturnType<typeof buildSaveBody>['body'];
    expect(save.expectedRevision).toBe(1);
    expect(save.items.map((r) => r.code)).toEqual(['LEG-01']);
    expect(save.answers).toEqual({ Q22: 45 });
    expect(save.modules.intake).not.toHaveProperty('answers'); // külön, ellenőrzött helyen tárolódik
    expect(srv.project.revision).toBe(2);
    expect(hasLocalChanges(ID)).toBe(false);
    // Változatlan állapot: nincs újabb kérés.
    const n = srv.calls.length;
    expect(await pushProject(ID, srv.f)).toBe('saved');
    expect(srv.calls.length).toBe(n);
  });

  it('megnyitáskor a szerver állapota töltődik be (másik gépen mentett munka)', async () => {
    const srv = fakeServer({ revision: 5, items: [item('HR-01', 5)], answers: { Q22: 30, QXX: 1 }, intake: { accepted: ['a'] } });
    await pullProjectList(srv.f);
    expect(await pullProject(ID, srv.f)).toBe('saved');
    expect(loadProject(ID).items.map((r) => r.code)).toEqual(['HR-01']);
    expect(loadIntake(ID)).toMatchObject({ answers: { Q22: 30 }, accepted: ['a'] });
    expect(hasLocalChanges(ID)).toBe(false);
  });

  it('ütközés: ha közben más mentett, a mentés elutasul, és semmi nem íródik felül; a felhasználó dönt', async () => {
    const srv = fakeServer({ revision: 1 });
    await pullProjectList(srv.f);
    await pullProject(ID, srv.f);
    saveWorkspace({ ...loadProject(ID), items: [item('LEG-01', 2)] }); // én
    srv.otherSaves({ items: [item('FIN-01', 5)] }); // kolléga
    expect(await pushProject(ID, srv.f)).toBe('conflict');
    expect(srv.project.items.map((r) => r.code)).toEqual(['FIN-01']); // a kollégáé megmaradt
    expect(loadProject(ID).items.map((r) => r.code)).toEqual(['LEG-01']); // az enyém is
    // Ütközés alatt nincs újabb feltöltési kísérlet, és a betöltés sem írja felül a helyit.
    expect(await pushProject(ID, srv.f)).toBe('conflict');
    expect(await pullProject(ID, srv.f)).toBe('conflict');
    expect(loadProject(ID).items.map((r) => r.code)).toEqual(['LEG-01']);

    expect(await resolveConflict(ID, 'server', srv.f)).toBe('saved');
    expect(loadProject(ID).items.map((r) => r.code)).toEqual(['FIN-01']);
  });

  it('ütközés feloldása a saját változattal: a legfrissebb verzióra épülve kerül fel', async () => {
    const srv = fakeServer({ revision: 1 });
    await pullProjectList(srv.f);
    await pullProject(ID, srv.f);
    saveWorkspace({ ...loadProject(ID), items: [item('LEG-01', 2)] });
    srv.otherSaves({ items: [item('FIN-01', 5)] });
    expect(await pushProject(ID, srv.f)).toBe('conflict');
    expect(await resolveConflict(ID, 'local', srv.f)).toBe('saved');
    expect(srv.project.items.map((r) => r.code)).toEqual(['LEG-01']);
  });

  it('hálózati hiba: a munka helyben megmarad, és visszatéréskor felkerül', async () => {
    const srv = fakeServer({ revision: 1 });
    await pullProjectList(srv.f);
    await pullProject(ID, srv.f);
    saveWorkspace({ ...loadProject(ID), items: [item('OPS-05', 3)] });
    srv.setOffline(true);
    expect(await pushProject(ID, srv.f)).toBe('offline');
    expect(syncState(ID).message).toContain('helyben megvan');
    expect(loadProject(ID).items.map((r) => r.code)).toEqual(['OPS-05']);
    // Offline betöltés nem írja felül a helyi munkát.
    expect(await pullProject(ID, srv.f)).toBe('offline');
    srv.setOffline(false);
    expect(await pushProject(ID, srv.f)).toBe('saved');
    expect(srv.project.items.map((r) => r.code)).toEqual(['OPS-05']);
  });

  it('feltöltetlen helyi munka azonos verzión: a betöltés feltölti, nem írja felül', async () => {
    const srv = fakeServer({ revision: 1 });
    await pullProjectList(srv.f);
    await pullProject(ID, srv.f);
    saveWorkspace({ ...loadProject(ID), items: [item('LEG-02', 3)] });
    expect(await pullProject(ID, srv.f)).toBe('saved');
    expect(srv.project.items.map((r) => r.code)).toEqual(['LEG-02']);
  });

  it('megszűnt hozzáférés: a projekt eltűnik ebből a böngészőből (feltöltetlen munka kivételével)', async () => {
    const srv = fakeServer({ revision: 1 });
    await pullProjectList(srv.f);
    await pullProject(ID, srv.f);
    const none = (async () => new Response(JSON.stringify({ projects: [] }), { status: 200 })) as unknown as typeof fetch;
    await pullProjectList(none);
    expect(listProjects().some((p) => p.id === ID)).toBe(false);
    expect(storage.getItem(`ict-hc:workspace:v3:${ID}`)).toBeNull();
  });

  it('helyi projekt feltöltése: új szerveres projekt a teljes munkával, a helyi példány törlődik', async () => {
    const srv = fakeServer();
    const local = createProject({ companyName: 'Helyi Minta Bt.', kind: 'HEALTH_CHECK' });
    saveWorkspace({ ...local, items: [item('FIN-02', 4)] });
    saveIntake(local.projectId, { ...loadIntake(local.projectId), answers: { Q23: true } });
    expect(await uploadLocalProject(local.projectId, srv.f)).toBe(ID);
    expect(srv.project.items.map((r) => r.code)).toEqual(['FIN-02']);
    expect(srv.project.answers).toEqual({ Q23: true });
    expect(listProjects().map((p) => p.id)).toEqual([ID]);
  });

  it('sikertelen feltöltésnél a helyi példány megmarad', async () => {
    const srv = fakeServer();
    const local = createProject({ companyName: 'Helyi Minta Bt.', kind: 'HEALTH_CHECK' });
    srv.setOffline(true);
    await expect(uploadLocalProject(local.projectId, srv.f)).rejects.toThrow();
    expect(listProjects().some((p) => p.id === local.projectId)).toBe(true);
  });
});

describe('kilépés', () => {
  it('a szerveres projektek helyi másolata törlődik; a helyi és a feltöltetlen munka (kérésre) marad', async () => {
    const { clearServerCache, unsyncedServerProjects } = await import('./serverSync');
    const srv = fakeServer({ revision: 1 });
    await pullProjectList(srv.f);
    await pullProject(ID, srv.f);
    const local = createProject({ companyName: 'Helyi Minta Bt.', kind: 'HEALTH_CHECK' });
    expect(unsyncedServerProjects()).toEqual([]);
    saveWorkspace({ ...loadProject(ID), items: [item('LEG-01', 2)] });
    expect(unsyncedServerProjects()).toEqual(['Kitalált Minta Kft.']);
    clearServerCache({ keepUnsynced: true });
    expect(listProjects().some((p) => p.id === ID)).toBe(true);
    clearServerCache();
    expect(listProjects().map((p) => p.id)).toEqual([local.projectId]);
    expect(storage.getItem(`ict-hc:intake:v1:${ID}`)).toBeNull();
  });
});
