import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

interface CardProps {
  title?: string;
  subtitle?: string;
  icon?: LucideIcon;
  /** Right-aligned header slot, e.g. a legal reference badge. */
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function Card({ title, subtitle, icon: Icon, aside, children, className = '' }: CardProps) {
  return (
    <section
      className={`rounded-xl border border-slate-200 bg-white shadow-sm shadow-slate-900/[0.03] ${className}`}
    >
      {title && (
        <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 border-b border-slate-100 px-6 py-4">
          <div className="flex min-w-0 flex-1 basis-64 items-start gap-3">
            {Icon && (
              <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-navy-50 text-navy-700">
                <Icon className="size-4" aria-hidden />
              </span>
            )}
            <div>
              <h2 className="text-[15px] font-semibold text-navy-900">{title}</h2>
              {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
            </div>
          </div>
          {aside}
        </header>
      )}
      <div className="px-6 py-5">{children}</div>
    </section>
  );
}

/** Small monospace badge citing the statute a figure comes from. */
export function LegalBadge({ children }: { children: ReactNode }) {
  return (
    <span className="shrink-0 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 font-mono text-[11px] text-slate-500">
      {children}
    </span>
  );
}
