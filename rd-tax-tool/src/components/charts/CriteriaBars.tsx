/** Per-criterion points vs. maximum weight for the Frascati audit. */
import { FRASCATI_CRITERIA } from '../../domain/constants';
import type { AuditResult } from '../../domain/types';

const MAX_WEIGHT = Math.max(...FRASCATI_CRITERIA.map((c) => c.weight));

export function CriteriaBars({ audit }: { audit: AuditResult }) {
  return (
    <div className="flex flex-col gap-2.5" role="list" aria-label="Frascati-kritériumok pontszámai">
      {FRASCATI_CRITERIA.map((criterion) => {
        const score = audit.criterionScores.find((s) => s.id === criterion.id);
        const points = score?.points ?? 0;
        const pointsLabel = points.toLocaleString('hu-HU', { maximumFractionDigits: 1 });
        const weak = (score?.rating ?? 0) < 3;
        return (
          <div key={criterion.id} role="listitem" title={`${criterion.label}: ${pointsLabel} / ${criterion.weight} pont`}>
            <div className="mb-1 flex justify-between text-[13px]">
              <span className="text-slate-700">{criterion.label}</span>
              <span className="tabular text-slate-500">
                <span className={`font-semibold ${weak ? 'text-risk-yellow' : 'text-navy-900'}`}>{pointsLabel}</span> / {criterion.weight}
              </span>
            </div>
            {/* The track length is the criterion's weight, so heavier criteria read as longer. */}
            <div className="h-2 rounded-full bg-slate-100" style={{ width: `${(criterion.weight / MAX_WEIGHT) * 100}%` }}>
              <div className="h-full rounded-full bg-navy-700" style={{ width: `${(points / criterion.weight) * 100}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
