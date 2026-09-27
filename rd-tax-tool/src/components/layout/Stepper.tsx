import { Building2, Calculator, Check, ClipboardCheck, Copyright, FileText, type LucideIcon } from 'lucide-react';

export type StepId = 'client' | 'costs' | 'audit' | 'ip' | 'results';

export const STEPS: { id: StepId; label: string; description: string; icon: LucideIcon }[] = [
  { id: 'client', label: 'Ügyféladatok', description: 'Cég és projekt', icon: Building2 },
  { id: 'costs', label: 'Költség & bér', description: 'Megtakarítási kalkulátor', icon: Calculator },
  { id: 'audit', label: 'SZTNH audit', description: 'Frascati-kockázat', icon: ClipboardCheck },
  { id: 'ip', label: 'Szellemi termék', description: 'IP-box, jogdíj', icon: Copyright },
  { id: 'results', label: 'Eredménytábla', description: 'Vezetői riport', icon: FileText },
];

interface StepperProps {
  current: StepId;
  onSelect: (step: StepId) => void;
  /** Steps with missing mandatory data get a warning marker. */
  incomplete: Partial<Record<StepId, boolean>>;
}

export function Stepper({ current, onSelect, incomplete }: StepperProps) {
  const currentIndex = STEPS.findIndex((s) => s.id === current);

  return (
    <nav aria-label="Folyamat lépései" className="no-print border-b border-slate-200 bg-white">
      <ol className="mx-auto grid max-w-7xl grid-cols-5 px-2 sm:px-6">
        {STEPS.map((step, index) => {
          const active = step.id === current;
          const done = index < currentIndex;
          const Icon = done ? Check : step.icon;
          return (
            <li key={step.id}>
              <button
                type="button"
                onClick={() => onSelect(step.id)}
                aria-current={active ? 'step' : undefined}
                aria-label={`${index + 1}. lépés: ${step.label}${incomplete[step.id] ? ' (figyelmet igényel)' : ''}`}
                className={`group flex w-full items-center gap-3 border-b-2 px-2 py-3.5 text-left transition-colors ${
                  active ? 'border-navy-700' : 'border-transparent hover:border-slate-300'
                }`}
              >
                <span
                  className={`relative flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                    active
                      ? 'bg-navy-800 text-white'
                      : done
                        ? 'bg-navy-100 text-navy-800'
                        : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  <Icon className="size-4" aria-hidden />
                  {incomplete[step.id] && (
                    <span className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full border-2 border-white bg-risk-yellow" title="Hiányos adatok" />
                  )}
                </span>
                <span className="hidden min-w-0 sm:block">
                  <span className="block text-[11px] tracking-wider text-slate-400 uppercase">{index + 1}. lépés</span>
                  <span className={`block truncate text-sm font-medium ${active ? 'text-navy-900' : 'text-slate-600'}`}>
                    {step.label}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
