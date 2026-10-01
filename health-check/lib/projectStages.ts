import type { GuideStep, PageId } from '@/lib/guide';

/**
 * A projekt négy nagy szakasza a kalauz lépéseiből (a mátrix tetején a
 * folyamatsáv): adatgyűjtés → interjúk → értékelés → lezárás.
 */
export type StageState = 'done' | 'current' | 'todo';

export interface Stage {
  id: string;
  label: string;
  page: PageId;
  done: number;
  total: number;
  state: StageState;
}

const STAGES: { id: string; label: string; page: PageId; steps: string[] }[] = [
  { id: 'intake', label: 'Adatgyűjtés', page: 'adatok', steps: ['case', 'registry', 'financials', 'checklist', 'tables', 'documents', 'overview'] },
  { id: 'interviews', label: 'Interjúk', page: 'interjuk', steps: ['interviews'] },
  { id: 'assess', label: 'Értékelés', page: 'matrix', steps: ['matrix'] },
  { id: 'close', label: 'Lezárás', page: 'projekt', steps: ['timesheet', 'followup', 'knowledge'] },
];

/** A kikapcsolt modulok lépései nincsenek a listában; üres szakasz kimarad. */
export function projectStages(steps: GuideStep[]): Stage[] {
  const byId = new Map(steps.map((s) => [s.id, s]));
  let currentSet = false;
  return STAGES.flatMap((st) => {
    const own = st.steps.map((id) => byId.get(id)).filter((s): s is GuideStep => Boolean(s));
    if (own.length === 0) return [];
    const done = own.filter((s) => s.done).length;
    let state: StageState = done === own.length ? 'done' : 'todo';
    if (state === 'todo' && !currentSet) {
      state = 'current';
      currentSet = true;
    }
    return [{ id: st.id, label: st.label, page: st.page, done, total: own.length, state }];
  });
}
