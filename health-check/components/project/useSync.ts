'use client';

import { useEffect, useState } from 'react';
import { SERVER_MODE_EVENT, serverModeOn } from '@/lib/sync/serverMode';
import { SYNC_EVENT, syncState, type SyncState } from '@/lib/sync/serverSync';

/** Be van-e kapcsolva a szerveres mód (bejelentkezett belső felhasználó). */
export function useServerMode(): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const update = () => setOn(serverModeOn());
    update();
    window.addEventListener(SERVER_MODE_EVENT, update);
    return () => window.removeEventListener(SERVER_MODE_EVENT, update);
  }, []);
  return on;
}

/** Egy projekt szinkronállapota (mentés, ütközés, kapcsolat). */
export function useSyncState(id: string): SyncState {
  const [state, setState] = useState<SyncState>({ status: 'idle', syncedAt: null });
  useEffect(() => {
    const update = () => setState(syncState(id));
    update();
    window.addEventListener(SYNC_EVENT, update);
    return () => window.removeEventListener(SYNC_EVENT, update);
  }, [id]);
  return state;
}
