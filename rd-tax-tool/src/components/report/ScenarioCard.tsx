/** "Mi lenne, ha" – side-by-side what-if scenarios with an apply button. */
import { ArrowRightLeft, Check } from 'lucide-react';
import { useMemo } from 'react';
import { formatHuf } from '../../domain/format';
import { compareScenarios } from '../../domain/scenarios';
import type { Assessment } from '../../domain/types';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';

function Delta({ value, suffix = '' }: { value: number; suffix?: string }) {
  if (Math.round(value) === 0) return <span className="text-slate-400">–</span>;
  const positive = value > 0;
  return (
    <span className={`tabular font-semibold ${positive ? 'text-risk-green' : 'text-risk-red'}`}>
      {positive ? '+' : '−'}
      {formatHuf(Math.abs(value))}
      {suffix}
    </span>
  );
}

interface ScenarioCardProps {
  assessment: Assessment;
  locked: boolean;
  onApply: (variant: Assessment) => void;
}

export function ScenarioCard({ assessment, locked, onApply }: ScenarioCardProps) {
  const { base, rows } = useMemo(() => compareScenarios(assessment), [assessment]);
  if (rows.length === 0) return null;

  return (
    <Card
      title="Mi lenne, ha…"
      subtitle={`Egy döntés megváltoztatása a mostani ${formatHuf(base.totalAnnualSaving)} éves megtakarításhoz képest`}
      icon={ArrowRightLeft}
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs tracking-wide text-slate-500 uppercase">
              <th className="py-2 pr-4 font-medium">Forgatókönyv</th>
              <th className="py-2 pr-4 text-right font-medium">Éves eltérés</th>
              <th className="py-2 pr-4 text-right font-medium">Idén pénzben</th>
              <th className="py-2 pr-4 text-right font-medium">Eladáskor (egyszeri)</th>
              <th className="py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-slate-100 align-top last:border-0">
                <td className="py-3 pr-4">
                  <p className="font-medium text-navy-900">{r.title}</p>
                  <p className="text-xs text-slate-500">{r.description}</p>
                </td>
                <td className="py-3 pr-4 text-right">
                  <Delta value={r.annualDelta} />
                </td>
                <td className="py-3 pr-4 text-right">
                  <Delta value={r.thisYearDelta} />
                </td>
                <td className="py-3 pr-4 text-right">
                  <Delta value={r.saleDelta} />
                </td>
                <td className="py-3 text-right">
                  {r.applicable ? (
                    <Button icon={Check} disabled={locked} onClick={() => onApply(r.variant)} title={locked ? 'Lezárt ügyben nem módosítható' : 'A változat átvétele az ügybe'}>
                      Átvétel
                    </Button>
                  ) : (
                    <span className="text-xs text-slate-400">csak összevetés</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-slate-500">
        Az „Idén pénzben” oszlop a tárgyévben ténylegesen realizálható hatást mutatja (az eredmény által nem fedezett Tao-rész nélkül).
      </p>
    </Card>
  );
}
