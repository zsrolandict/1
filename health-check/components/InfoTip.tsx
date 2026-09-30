'use client';

import { useId, useState } from 'react';
import { Info } from 'lucide-react';
import { GLOSSARY, type GlossaryKey } from '@/lib/glossary';

/**
 * Kis ⓘ ikon egymondatos magyarázattal. Egérrel rámutatva, billentyűzettel
 * fókuszálva vagy kattintásra jelenik meg; képernyőolvasó is felolvassa.
 */
export default function InfoTip({ term, label }: { term: GlossaryKey; label?: string }) {
  const id = useId();
  const [pinned, setPinned] = useState(false);
  return (
    <span className="group relative inline-flex align-middle print:hidden">
      <button
        type="button"
        aria-label={`Mi ez${label ? `: ${label}` : ''}?`}
        aria-describedby={id}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setPinned((v) => !v);
        }}
        onBlur={() => setPinned(false)}
        className="rounded-full p-0.5 text-slate-500 hover:text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
      >
        <Info className="h-3.5 w-3.5" />
      </button>
      <span
        id={id}
        role="tooltip"
        className={`absolute left-1/2 top-full z-30 mt-1 w-64 -translate-x-1/2 rounded-lg bg-navy-900 px-2.5 py-2 text-left text-xs font-normal normal-case leading-snug tracking-normal text-white shadow-lg ${
          pinned ? 'visible' : 'invisible group-hover:visible group-focus-within:visible'
        }`}
      >
        {GLOSSARY[term]}
      </span>
    </span>
  );
}
