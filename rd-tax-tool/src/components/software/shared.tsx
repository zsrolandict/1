/** Small building blocks shared by the software step and the royalty calculator. */
import { CalendarClock, CircleCheck, CircleX } from 'lucide-react';
import { useState } from 'react';
import { IP_RULES } from '../../domain/constants';
import { formatNumber, parseHufInput } from '../../domain/format';
import type { NotificationDeadline, SoftwareQualification } from '../../domain/types';

/** Label-less forint input for table cells; the caller supplies an aria-label. */
export function MoneyCell({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <input
      aria-label={label}
      inputMode="numeric"
      className="tabular w-full min-w-28 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-right text-sm focus:border-navy-600 focus:ring-2 focus:ring-navy-100 focus:outline-none disabled:bg-slate-50"
      value={draft ?? (value === 0 ? '' : formatNumber(value))}
      placeholder="0"
      onFocus={() => setDraft(value === 0 ? '' : formatNumber(value))}
      onChange={(e) => {
        setDraft(e.target.value);
        onChange(Math.max(0, parseHufInput(e.target.value)));
      }}
      onBlur={() => setDraft(null)}
    />
  );
}

export function DateField({ id, label, value, onChange, hint }: { id: string; label: string; value: string; onChange: (v: string) => void; hint?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[13px] font-medium text-slate-700">
        {label}
      </label>
      <input
        id={id}
        type="date"
        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-navy-600 focus:ring-2 focus:ring-navy-100 focus:outline-none disabled:bg-slate-50"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {hint && <p className="text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

const STATUS_STYLE: Record<NotificationDeadline['status'], { cls: string; icon: typeof CircleCheck }> = {
  NO_DATE: { cls: 'bg-slate-100 text-slate-600', icon: CalendarClock },
  OPEN: { cls: 'bg-risk-yellow-soft text-risk-yellow', icon: CalendarClock },
  MISSED: { cls: 'bg-risk-red-soft text-risk-red', icon: CircleX },
  REPORTED_ON_TIME: { cls: 'bg-risk-green-soft text-risk-green', icon: CircleCheck },
  REPORTED_LATE: { cls: 'bg-risk-red-soft text-risk-red', icon: CircleX },
};

export function deadlineText(d: NotificationDeadline): string {
  switch (d.status) {
    case 'NO_DATE':
      return 'Aktiválási dátum hiányzik';
    case 'OPEN':
      return `Bejelentendő ${d.dueDate}-ig · még ${d.daysLeft} nap`;
    case 'MISSED':
      return `${IP_RULES.NOTIFICATION_DAYS} napos határidő lejárt (${d.dueDate})`;
    case 'REPORTED_ON_TIME':
      return 'Határidőben bejelentve';
    case 'REPORTED_LATE':
      return `Késve bejelentve (határidő: ${d.dueDate})`;
  }
}

export function DeadlineBadge({ deadline }: { deadline: NotificationDeadline }) {
  const urgent = deadline.status === 'OPEN' && deadline.daysLeft <= 14;
  const style = urgent ? STATUS_STYLE.MISSED : STATUS_STYLE[deadline.status];
  const Icon = style.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-semibold ${style.cls}`}>
      <Icon className="size-3.5" aria-hidden />
      {deadlineText(deadline)}
    </span>
  );
}

const VERDICT: Record<SoftwareQualification['level'], { title: string; text: string; cls: string; icon: typeof CircleCheck }> = {
  FULL: {
    title: 'Teljesül',
    text: 'Minden szoftveres kedvezmény teljes összegben érvényesíthető.',
    cls: 'border-risk-green/30 bg-risk-green-soft text-risk-green',
    icon: CircleCheck,
  },
  PARTIAL: {
    title: 'Részben teljesül',
    text: 'A kedvezmény egy része érvényesíthető – az alábbiak csökkentik vagy veszélyeztetik.',
    cls: 'border-risk-yellow/40 bg-risk-yellow-soft text-risk-yellow',
    icon: CalendarClock,
  },
  NONE: {
    title: 'Nem teljesül',
    text: 'Szoftveres (jogdíj / eladási) kedvezmény nem érvényesíthető; a K+F-költségkedvezmények ettől még járhatnak.',
    cls: 'border-risk-red/30 bg-risk-red-soft text-risk-red',
    icon: CircleX,
  },
};

/** Overall software verdict with the reasons behind it. */
export function QualificationBanner({ qualification, compact = false }: { qualification: SoftwareQualification; compact?: boolean }) {
  const v = VERDICT[qualification.level];
  const Icon = v.icon;
  return (
    <section className={`rounded-xl border px-5 py-4 ${v.cls}`} aria-label={`Szoftver-minősítés: ${v.title}`}>
      <p className="flex items-center gap-2 text-sm font-bold">
        <Icon className="size-4" aria-hidden />
        Szoftver-minősítés: {v.title}
      </p>
      {!compact && <p className="mt-1 text-sm text-slate-700">{v.text}</p>}
      {qualification.issues.length > 0 && (
        <ul className="mt-2 list-disc space-y-0.5 pl-5 text-sm text-slate-700">
          {qualification.issues.map((i) => (
            <li key={i}>{i}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
