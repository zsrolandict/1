/**
 * Sticky side panel shown on the input steps: the headline total updates on
 * every keystroke so the advisor sees the impact of each figure immediately.
 */
import { formatHuf, formatPercent } from '../../domain/format';
import type { AuditResult, SavingsResult } from '../../domain/types';
import { RiskGauge } from '../charts/RiskGauge';
import { SavingsBreakdown } from '../charts/SavingsBreakdown';

interface LiveSummaryProps {
  savings: SavingsResult;
  audit: AuditResult;
}

export function LiveSummary({ savings, audit }: LiveSummaryProps) {
  return (
    <aside className="flex flex-col gap-4 lg:sticky lg:top-6">
      <div className="overflow-hidden rounded-xl bg-navy-900 text-white shadow-lg shadow-navy-900/20">
        <div className="px-6 pt-5 pb-4">
          <p className="text-[11px] font-medium tracking-[0.14em] text-navy-100/70 uppercase">
            Összesített tiszta adómegtakarítás / év
          </p>
          <p className="tabular mt-2 font-serif text-3xl font-bold" aria-live="polite">
            {formatHuf(savings.totalAnnualSaving)}
          </p>
          <p className="mt-1 text-xs text-navy-100/70">
            Közvetlen K+F költség: <span className="tabular text-white">{formatHuf(savings.directRdCost)}</span>
            {savings.directRdCost > 0 && <> · hatékony támogatás {formatPercent(savings.effectiveSubsidyRate)}</>}
          </p>
        </div>
        <div className="border-t border-white/10 bg-white px-6 py-4 text-slate-800">
          <SavingsBreakdown savings={savings} compact />
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white px-6 py-4 shadow-sm">
        <p className="mb-2 text-[11px] font-medium tracking-[0.14em] text-slate-500 uppercase">SZTNH készültség</p>
        <RiskGauge score={audit.score} level={audit.level} size="sm" />
      </div>
    </aside>
  );
}
