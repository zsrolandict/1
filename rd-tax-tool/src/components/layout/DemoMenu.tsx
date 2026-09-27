/** Header menu listing the demo cases, grouped, with their expected outcome. */
import { ChevronDown, FlaskConical } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { DEMOS, type DemoDefinition } from '../../domain/demos';
import type { QualificationLevel } from '../../domain/types';

const OUTCOME: Record<QualificationLevel, { label: string; cls: string }> = {
  FULL: { label: 'Teljesül', cls: 'bg-risk-green-soft text-risk-green' },
  PARTIAL: { label: 'Részben', cls: 'bg-risk-yellow-soft text-risk-yellow' },
  NONE: { label: 'Nem teljesül', cls: 'bg-risk-red-soft text-risk-red' },
};

const GROUPS: { id: DemoDefinition['group']; title: string }[] = [
  { id: 'software', title: 'Csak szoftver (IP-box)' },
  { id: 'general', title: 'Teljes K+F-átvilágítás' },
];

export function DemoMenu({ onSelect }: { onSelect: (demo: DemoDefinition) => void }) {
  const [open, setOpen] = useState(false);
  const [alignRight, setAlignRight] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Open towards the side with more room, so the menu never leaves the screen.
  const toggle = () => {
    const rect = ref.current?.getBoundingClientRect();
    if (rect) setAlignRight(rect.left + rect.width / 2 > window.innerWidth / 2);
    setOpen((o) => !o);
  };

  // Close on outside click or Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Demó esetek"
        title="Demó esetek"
        onClick={toggle}
        className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-navy-100 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
      >
        <FlaskConical className="size-4" aria-hidden />
        <span className="hidden md:inline">Demó esetek</span>
        <ChevronDown className="size-3.5" aria-hidden />
      </button>
      {open && (
        <div
          role="menu"
          aria-label="Demó esetek"
          className={`absolute z-30 mt-2 w-[min(26rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-slate-200 bg-white text-slate-800 shadow-xl shadow-navy-900/20 ${
            alignRight ? 'right-0' : 'left-0'
          }`}
        >
          {GROUPS.map((group) => (
            <div key={group.id} className="border-b border-slate-100 last:border-0">
              <p className="bg-slate-50 px-4 py-2 text-[11px] font-semibold tracking-wider text-slate-500 uppercase">{group.title}</p>
              {DEMOS.filter((d) => d.group === group.id).map((demo) => (
                <button
                  key={demo.id}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setOpen(false);
                    onSelect(demo);
                  }}
                  className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-navy-50 focus-visible:bg-navy-50 focus-visible:outline-none"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-navy-900">{demo.title}</span>
                    <span className="mt-0.5 block text-xs text-slate-500">{demo.description}</span>
                  </span>
                  <span className={`shrink-0 rounded-md px-2 py-0.5 text-[11px] font-semibold ${OUTCOME[demo.outcome].cls}`}>
                    {OUTCOME[demo.outcome].label}
                  </span>
                </button>
              ))}
            </div>
          ))}
          <p className="px-4 py-2 text-[11px] text-slate-400">Kitalált cégek és számok – a jelenlegi adatok felülíródnak.</p>
        </div>
      )}
    </div>
  );
}

export const OUTCOME_LABELS = OUTCOME;
