'use client';

import { Fragment } from 'react';
import { Check, ChevronRight } from 'lucide-react';
import type { PageId } from '@/lib/guide';
import type { Stage } from '@/lib/projectStages';

/** Folyamatsáv: a projekt szakaszai, a kész zöld pipa, az aktuális kék. */
export default function StepBar({ stages, current, onGo }: { stages: Stage[]; current?: PageId; onGo?: (page: PageId) => void }) {
  return (
    <ol aria-label="A projekt szakaszai" className="flex flex-wrap items-center gap-x-1 gap-y-2">
      {stages.map((s, i) => {
        const here = s.page === current;
        const dot =
          s.state === 'done' ? (
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-white">
              <Check className="h-3.5 w-3.5" strokeWidth={3} />
            </span>
          ) : (
            <span
              className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                s.state === 'current' ? 'bg-brand-600 text-white ring-4 ring-brand-100' : 'bg-slate-100 text-slate-500'
              }`}
            >
              {i + 1}
            </span>
          );
        const body = (
          <>
            {dot}
            <span className="text-left leading-tight">
              <span className={`block text-sm font-semibold ${s.state === 'todo' ? 'text-slate-500' : 'text-slate-900'}`}>{s.label}</span>
              <span className="block text-[11px] text-slate-500">
                {s.state === 'done' ? 'kész' : `${s.done}/${s.total} lépés`}
                {here && ' · itt vagy'}
              </span>
            </span>
          </>
        );
        return (
          <Fragment key={s.id}>
            {i > 0 && <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" aria-hidden />}
            <li aria-current={here ? 'step' : undefined}>
              {onGo && !here ? (
                <button onClick={() => onGo(s.page)} className="flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-slate-50">
                  {body}
                </button>
              ) : (
                <span className={`flex items-center gap-2 rounded-lg px-2 py-1 ${here ? 'bg-brand-50/70' : ''}`}>{body}</span>
              )}
            </li>
          </Fragment>
        );
      })}
    </ol>
  );
}
