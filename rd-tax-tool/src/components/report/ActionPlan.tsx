/** ICT Európa 3-step roadmap – used on the dashboard and in the printed report. */
import type { ActionStep } from '../../domain/actionPlan';

export function ActionPlan({ steps }: { steps: ActionStep[] }) {
  return (
    <ol className="grid gap-4 md:grid-cols-3 print:grid-cols-3">
      {steps.map((step) => (
        <li
          key={step.order}
          className={`avoid-break relative rounded-xl border bg-white p-5 print:p-3.5 ${
            step.priority === 'high' ? 'border-navy-700 ring-1 ring-navy-700' : 'border-slate-200'
          }`}
        >
          <div className="mb-3 flex items-center justify-between">
            <span className="flex size-8 items-center justify-center rounded-full bg-navy-900 font-serif text-sm font-bold text-white">
              {step.order}
            </span>
            <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">{step.duration}</span>
          </div>
          <h3 className="text-[15px] font-semibold text-navy-900">
            {step.title}
            {step.priority === 'high' && (
              <span className="ml-2 align-middle text-[10px] font-semibold tracking-wide text-navy-600 uppercase">Prioritás</span>
            )}
          </h3>
          <p className="mt-1.5 text-sm text-slate-600 print:text-xs">{step.summary}</p>
          <ul className="mt-3 space-y-1.5 text-sm text-slate-700 print:space-y-1 print:text-xs">
            {step.tasks.map((task) => (
              <li key={task} className="flex gap-2">
                <span aria-hidden className="mt-2 size-1 shrink-0 rounded-full bg-navy-600" />
                {task}
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ol>
  );
}
