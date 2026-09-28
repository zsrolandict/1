'use client';

import type { ReactNode } from 'react';
import { CheckCircle2, CircleDot, Clock, FileAudio, Lightbulb, ListChecks, Sparkles, Users } from 'lucide-react';
import { ENGAGEMENT_KINDS, type EngagementKind } from '@/lib/engagement/kinds';
import { CLOSING_TIP, planMinutes, type PlannedInterview } from '@/lib/interview/plan';
import { isAnalysisStale, recordStatus, STATUS_LABEL, type InterviewRecords, type InterviewStatus } from '@/lib/interview/records';
import type { IntervieweeRole } from '@/lib/interview/types';
import { PILLAR_LABEL } from '@/lib/risk/catalog';

const STATUS_STYLE: Record<InterviewStatus, string> = {
  PLANNED: 'bg-slate-100 text-slate-600',
  IN_PROGRESS: 'bg-sky-50 text-sky-700',
  TRANSCRIBED: 'bg-indigo-50 text-indigo-700',
  ANALYZED: 'bg-emerald-50 text-emerald-700',
};

const hours = (min: number) => `${(min / 60).toLocaleString('hu-HU', { maximumFractionDigits: 1 })} óra`;

export default function InterviewPlanPanel({
  plan,
  records,
  kind,
  sampleRole,
  onOpen,
}: {
  plan: PlannedInterview[];
  records: InterviewRecords;
  kind: EngagementKind;
  /** Melyik interjúalanyhoz van minta-interjú a mintaesetben. */
  sampleRole: IntervieweeRole;
  onOpen: (role: IntervieweeRole, tab: 'guide' | 'process' | 'analysis') => void;
}) {
  const profile = ENGAGEMENT_KINDS[kind];
  const mins = planMinutes(plan);
  const done = plan.filter((p) => recordStatus(records[p.role]) === 'ANALYZED').length;

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border border-slate-200 bg-white p-4 text-sm shadow-sm">
        <span className="flex items-center gap-2 font-semibold text-slate-900">
          <Users className="h-4 w-4" /> Kivel beszéljünk?
        </span>
        <span className="text-slate-600">
          {plan.length} interjú · {plan.filter((p) => p.priority === 'REQUIRED').length} kötelező
        </span>
        <span className="text-slate-600">
          Kötelezők: ~{hours(mins.required)} · mind: ~{hours(mins.all)} a {profile.hourBudget} órás keretből
        </span>
        <span className="text-slate-600">Elemezve: {done} / {plan.length}</span>
        <p className="w-full text-xs text-slate-500">
          A tervet az átvilágítás típusa ({profile.label}) és a Red Flag mátrixban bejelölt kockázatok határozzák meg.
          A sorrend a javasolt interjúsorrend.
        </p>
      </div>

      <ol className="grid gap-3 lg:grid-cols-2">
        {plan.map((p) => {
          const rec = records[p.role];
          const status = recordStatus(rec);
          const contradictions = rec?.analysis?.contradictions.length ?? 0;
          return (
            <li key={p.role} className="flex flex-col rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white">
                  {p.order}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-slate-900">{p.label}</h3>
                    <span
                      className={`rounded px-1.5 text-[11px] font-medium ${
                        p.priority === 'REQUIRED' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {p.priority === 'REQUIRED' ? 'Kötelező' : 'Ajánlott'}
                    </span>
                    <span className={`rounded px-1.5 text-[11px] font-medium ${STATUS_STYLE[status]}`}>
                      {status === 'ANALYZED' ? <CheckCircle2 className="mr-0.5 inline h-3 w-3" /> : <CircleDot className="mr-0.5 inline h-3 w-3" />}
                      {STATUS_LABEL[status]}
                    </span>
                    {isAnalysisStale(rec, kind) && (
                      <span
                        className="rounded bg-amber-100 px-1.5 text-[11px] font-medium text-amber-800"
                        title={`Az elemzés más célra készült (${ENGAGEMENT_KINDS[rec!.analysisKind!].label}); futtasd újra.`}
                      >
                        Újraelemzés kell
                      </span>
                    )}
                    <span className="ml-auto inline-flex items-center gap-1 text-xs text-slate-500">
                      <Clock className="h-3.5 w-3.5" /> ~{p.minutes} perc
                    </span>
                  </div>
                  {rec?.alias && <p className="text-xs text-slate-500">Álnév: {rec.alias}{rec.heldAt ? ` · ${rec.heldAt}` : ''}</p>}
                  {status === 'ANALYZED' && (
                    <p className="mt-1 text-xs text-slate-600">
                      {contradictions} ellentmondás · {rec?.analysis?.suggestedRedFlags.length ?? 0} javaslat, ebből{' '}
                      {rec?.accepted.length ?? 0} átvéve a mátrixba
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Miért vele?</p>
                  <ul className="mt-1 space-y-1 text-slate-700">
                    {p.why.map((w) => <li key={w}>• {w}</li>)}
                  </ul>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Miről kérdezzük?</p>
                  <ul className="mt-1 space-y-1 text-slate-700">
                    {p.topics.map((q) => (
                      <li key={q.id}>
                        <span className="text-[11px] text-slate-400">{PILLAR_LABEL[q.pillar]} · </span>
                        {q.text}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {p.tip && (
                <p className="mt-3 flex gap-1.5 rounded bg-amber-50 p-2 text-xs text-amber-900">
                  <Lightbulb className="h-3.5 w-3.5 shrink-0" /> {p.tip}
                </p>
              )}

              <div className="mt-auto flex flex-wrap gap-2 pt-3">
                <PlanButton onClick={() => onOpen(p.role, 'guide')} icon={<ListChecks className="h-3.5 w-3.5" />}>
                  Kérdések ({p.questionCount})
                </PlanButton>
                <PlanButton onClick={() => onOpen(p.role, 'process')} icon={<FileAudio className="h-3.5 w-3.5" />}>
                  {status === 'PLANNED' || status === 'IN_PROGRESS' ? 'Interjú rögzítése' : 'Leirat'}
                </PlanButton>
                {status === 'ANALYZED' && (
                  <PlanButton onClick={() => onOpen(p.role, 'analysis')} icon={<Sparkles className="h-3.5 w-3.5" />} primary>
                    Elemzés
                  </PlanButton>
                )}
                {p.role === sampleRole && status === 'PLANNED' && (
                  <span className="self-center text-xs text-indigo-700">Minta-interjú elérhető</span>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      <p className="flex gap-2 rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-600">
        <Lightbulb className="h-4 w-4 shrink-0 text-amber-600" /> {CLOSING_TIP}
      </p>
    </section>
  );
}

function PlanButton({
  onClick,
  icon,
  primary,
  children,
}: {
  onClick: () => void;
  icon: ReactNode;
  primary?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium ${
        primary ? 'bg-indigo-600 text-white hover:bg-indigo-500' : 'border border-slate-200 text-slate-700 hover:bg-slate-50'
      }`}
    >
      {icon}
      {children}
    </button>
  );
}
