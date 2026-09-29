'use client';

import { useCallback, useSyncExternalStore } from 'react';
import { loadDisabled, saveDisabled, subscribeModules, toggleModule, type ModuleId } from '@/lib/modules';

// A tömb azonosságát a nyers tárolt szöveg alapján tartjuk meg (useSyncExternalStore).
let cacheRaw = '';
let cache: ModuleId[] = [];
const EMPTY: ModuleId[] = [];

function snapshot(): ModuleId[] {
  const list = loadDisabled();
  const raw = list.join(',');
  if (raw !== cacheRaw) {
    cacheRaw = raw;
    cache = list;
  }
  return cache;
}

export function useModules() {
  const disabled = useSyncExternalStore(subscribeModules, snapshot, () => EMPTY);
  const isOn = useCallback((id: ModuleId) => !disabled.includes(id), [disabled]);
  const toggle = useCallback((id: ModuleId) => saveDisabled(toggleModule(loadDisabled(), id)), []);
  return { disabled, isOn, toggle };
}
