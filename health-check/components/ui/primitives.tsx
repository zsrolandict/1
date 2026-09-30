import type { ReactNode } from 'react';

/**
 * Közös felületi elemek (kártya, címke, jelvény, KPI-csempe, figyelmeztető doboz)
 * és gombstílusok. Egy helyen, hogy az oldalak egyformán nézzenek ki.
 */

export const BTN_PRIMARY =
  'inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:opacity-50';
export const BTN_SECONDARY =
  'inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 shadow-xs hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50';
/** Eszköztár-gomb: kisbetűs ikon + nagybetűs, ritkított felirat. */
export const BTN_TOOL =
  'inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-700 shadow-xs hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50';

export function Card({ className = '', children, ...rest }: { className?: string; children: ReactNode } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`rounded-xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] ${className}`} {...rest}>
      {children}
    </div>
  );
}

/** Kis, nagybetűs, ritkított szakaszcím (pl. „KOCKÁZATI TÉTELEK”). */
export function SectionLabel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <p className={`text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 ${className}`}>{children}</p>;
}

export type Tone = 'brand' | 'red' | 'amber' | 'green' | 'violet' | 'slate' | 'dark';

const BADGE: Record<Tone, string> = {
  brand: 'bg-brand-50 text-brand-700 ring-brand-600/20',
  red: 'bg-red-50 text-red-700 ring-red-600/20',
  amber: 'bg-amber-50 text-amber-800 ring-amber-600/25',
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  violet: 'bg-violet-50 text-violet-700 ring-violet-600/20',
  slate: 'bg-slate-50 text-slate-600 ring-slate-500/20',
  dark: 'bg-navy-900 text-white ring-navy-900',
};

/** Nagybetűs kis jelvény (pl. „KIEMELT”, „AI · INTERJÚ”). */
export function Badge({ tone = 'slate', icon, title, children }: { tone?: Tone; icon?: ReactNode; title?: string; children: ReactNode }) {
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-md px-1.5 py-0.5 text-[10.5px] font-bold uppercase tracking-wide ring-1 ring-inset ${BADGE[tone]}`}
    >
      {icon}
      {children}
    </span>
  );
}

const ICON_BOX: Record<Tone, string> = {
  brand: 'bg-brand-50 text-brand-600',
  red: 'bg-red-50 text-red-600',
  amber: 'bg-amber-50 text-amber-600',
  green: 'bg-emerald-50 text-emerald-600',
  violet: 'bg-violet-50 text-violet-600',
  slate: 'bg-slate-100 text-slate-600',
  dark: 'bg-navy-900 text-white',
};

/** Színes ikonnégyzet (KPI-csempék, szakaszcímek). */
export function IconBox({ tone = 'brand', size = 'md', children }: { tone?: Tone; size?: 'sm' | 'md'; children: ReactNode }) {
  return (
    <span className={`flex shrink-0 items-center justify-center rounded-lg ${ICON_BOX[tone]} ${size === 'sm' ? 'h-7 w-7' : 'h-10 w-10'}`} aria-hidden>
      {children}
    </span>
  );
}

/** KPI-csempe: színes ikonnégyzet, nagy szám, alatta kis felirat. */
export function KpiTile({
  label,
  icon,
  tone = 'brand',
  hint,
  extra,
  className = '',
  children,
}: {
  label: ReactNode;
  icon: ReactNode;
  tone?: Tone;
  hint?: string;
  /** A felirat melletti elem (pl. magyarázó ikon). */
  extra?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Card className={`flex items-center gap-3.5 p-4 ${className}`} title={hint}>
      <IconBox tone={tone}>{icon}</IconBox>
      <div className="min-w-0">
        <div className="text-2xl font-bold leading-tight tracking-tight tabular-nums text-slate-900">{children}</div>
        <div className="mt-0.5 flex items-center gap-1 text-xs font-medium text-slate-500">
          {label}
          {extra}
        </div>
      </div>
    </Card>
  );
}

const CALLOUT: Record<'amber' | 'brand' | 'red', string> = {
  amber: 'border-amber-200 bg-amber-50 text-amber-900',
  brand: 'border-brand-100 bg-brand-50/70 text-brand-900',
  red: 'border-red-200 bg-red-50 text-red-900',
};

export function Callout({
  tone = 'amber',
  icon,
  children,
  className = '',
}: {
  tone?: 'amber' | 'brand' | 'red';
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex items-start gap-2.5 rounded-xl border px-4 py-3 text-sm ${CALLOUT[tone]} ${className}`}>
      {icon && <span className="mt-0.5 shrink-0">{icon}</span>}
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

/** Oldalfejléc: típus-jelvény + nagybetűs oldalnév, nagy cím, alcím, jobbra a műveletek. */
export function PageHeader({
  kind,
  section,
  title,
  subtitle,
  actions,
}: {
  kind?: ReactNode;
  section: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="flex items-center gap-2">
          {kind && <Badge tone="brand">{kind}</Badge>}
          <span className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{section}</span>
        </p>
        <h1 className="mt-2 flex items-center gap-2 text-[28px] font-bold leading-tight tracking-tight text-slate-900">{title}</h1>
        {subtitle && <p className="mt-1 max-w-2xl text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 print:hidden">{actions}</div>}
    </header>
  );
}

/** Legördülő a fejléc eszköztárában. */
export const SELECT = 'rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-xs';

/** Fülsor: fehér kártyában, az aktív fül kék aláhúzással. */
export function TabBar({ children, label }: { children: ReactNode; label: string }) {
  return (
    <nav
      aria-label={label}
      className="flex gap-1 overflow-x-auto rounded-xl border border-slate-200/80 bg-white px-2 shadow-[0_1px_2px_rgba(15,23,42,0.04)] print:hidden"
    >
      {children}
    </nav>
  );
}

export function TabButton({
  active,
  onClick,
  icon,
  disabled,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-current={active ? 'true' : undefined}
      className={`inline-flex shrink-0 items-center gap-2 border-b-2 px-3 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${
        active ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500 hover:text-slate-800'
      }`}
    >
      {icon}
      {children}
    </button>
  );
}

export function TabCount({ children }: { children: ReactNode }) {
  return <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold tabular-nums text-slate-600">{children}</span>;
}
