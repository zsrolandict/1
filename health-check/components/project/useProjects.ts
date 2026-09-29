'use client';

import { useSyncExternalStore } from 'react';
import { SAVED_EVENT } from '@/lib/localSave';
import { activeProjectId, listProjects, PROJECT_EVENT, type ProjectMeta } from '@/lib/risk/store';

/** Projektlista és aktív projekt – változáskor (mentés, váltás, másik lap) frissül. */

function subscribe(cb: () => void): () => void {
  const onStorage = (e: StorageEvent) => {
    if (!e.key || e.key.startsWith('ict-hc:')) cb();
  };
  window.addEventListener(PROJECT_EVENT, cb);
  window.addEventListener(SAVED_EVENT, cb);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(PROJECT_EVENT, cb);
    window.removeEventListener(SAVED_EVENT, cb);
    window.removeEventListener('storage', onStorage);
  };
}

let cacheRaw = '';
let cache: { activeId: string; projects: ProjectMeta[] } = { activeId: '', projects: [] };
const SERVER = { activeId: '', projects: [] as ProjectMeta[] };

function snapshot() {
  const projects = listProjects();
  const activeId = activeProjectId();
  const raw = activeId + JSON.stringify(projects);
  if (raw !== cacheRaw) {
    cacheRaw = raw;
    cache = { activeId, projects };
  }
  return cache;
}

export function useProjects() {
  return useSyncExternalStore(subscribe, snapshot, () => SERVER);
}

export function useActiveProjectId(): string {
  return useSyncExternalStore(subscribe, () => activeProjectId(), () => '');
}
