/**
 * Horizontal bar breakdown of the four savings components. One hue (navy):
 * the rows are labelled, so magnitude is the only thing colour encodes.
 */
import { LEGAL_REFERENCES } from '../../domain/constants';
import { formatHuf, formatHufCompact, formatPercent } from '../../domain/format';
import type { SavingsResult } from '../../domain/types';

export interface BreakdownRow {
  key: string;
  label: string;
  reference: string;
  value: number;
}

export function savingsRows(savings: SavingsResult): BreakdownRow[] {
  return [
    { key: 'cit', label: 'Tao – K+F kétszeres levonás', reference: LEGAL_REFERENCES.CIT, value: savings.corporateTax.nominalSaving },
    { key: 'szocho', label: 'Szocho – kutatói kedvezmény', reference: LEGAL_REFERENCES.SZOCHO, value: savings.szocho.totalSaving },
    { key: 'hipa', label: 'HIPA – adóalap-csökkentés', reference: LEGAL_REFERENCES.HIPA, value: savings.hipaSaving },
    { key: 'inno', label: 'Innovációs járulék', reference: LEGAL_REFERENCES.INNOVATION, value: savings.innovationContributionSaving },
  ];
}

interface SavingsBreakdownProps {
  savings: SavingsResult;
  compact?: boolean;
}

export function SavingsBreakdown({ savings, compact = false }: SavingsBreakdownProps) {
  const rows = savingsRows(savings);
  const max = Math.max(...rows.map((r) => r.value), 1);
  const total = savings.totalAnnualSaving;

  return (
    <div className="flex flex-col gap-3" role="list" aria-label="Megtakarítás jogcímenként">
      {rows.map((row) => {
        const share = total > 0 ? row.value / total : 0;
        return (
          <div
            key={row.key}
            role="listitem"
            className="group"
            title={`${row.label}: ${formatHuf(row.value)} (${formatPercent(share)} az összesből)`}
          >
            <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
              <span className="text-slate-700">
                {row.label}
                {!compact && <span className="ml-2 font-mono text-[11px] text-slate-400">{row.reference}</span>}
              </span>
              <span className="tabular shrink-0 font-semibold text-navy-900">
                {compact ? formatHufCompact(row.value) : formatHuf(row.value)}
              </span>
            </div>
            <div className="h-2.5 w-full rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-navy-700 transition-[width] duration-300 group-hover:bg-navy-600"
                style={{ width: `${(row.value / max) * 100}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
