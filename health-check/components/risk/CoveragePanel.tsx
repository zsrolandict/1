'use client';

import { useState } from 'react';
import { ClipboardCheck } from 'lucide-react';
import { PILLAR_LABEL } from '@/lib/risk/catalog';
import {
  COVERAGE_GATE,
  COVERAGE_PILLAR_MIN,
  COVERAGE_STATE_LABEL,
  setCoverageOverride,
  type Coverage,
  type CoverageLogEntry,
  type CoverageOverrides,
  type CoverageState,
} from '@/lib/risk/coverage';
import { pct, PILLAR_STATE_LABEL } from '@/lib/risk/coverageText';
import { formatWhen } from '@/lib/risk/trail';
import type { Pillar, RiskAssessment } from '@/lib/risk/types';

const PILLARS: Pillar[] = ['FINANCE', 'LEGAL', 'OPERATIONS', 'HR'];

/**
 * Vizsgálati lefedettség pillérenként: miből jön (kérdőív, kötelező iratok),
 * hogyan hat a pontszámra, és a szakértői felülbírálás indoklással, naplózva.
 */
export default function CoveragePanel({
  coverage,
  assessment,
  overrides,
  log,
  by,
  onChange,
}: {
  coverage: Coverage;
  assessment: RiskAssessment;
  overrides: CoverageOverrides;
  log: CoverageLogEntry[];
  by: string | null;
  onChange: (next: { overrides: CoverageOverrides; log: CoverageLogEntry[] }) => void;
}) {
  const total = assessment.totals.coverage;
  return (
    <details className="group rounded-xl border border-slate-200/80 bg-white text-sm shadow-[0_1px_2px_rgba(15,23,42,0.04)] print:hidden">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 font-semibold text-slate-800 [&::-webkit-details-marker]:hidden">
        <ClipboardCheck className="h-4 w-4 text-brand-600" /> Vizsgálati lefedettség{total != null ? `: ${pct(total)}` : ''}
        <span className="ml-auto text-xs font-normal text-slate-500 group-open:hidden">Lenyitás</span>
      </summary>
      <div className="space-y-3 border-t border-slate-100 px-4 pb-4 pt-3 text-xs text-slate-600">
        <p>
          Pillérenként a megválaszolt kérdőív-kérdések és a beérkezett kötelező iratok arányának átlaga. {pct(COVERAGE_PILLAR_MIN)} alatt, azonosított tétel
          nélkül a pillér „Nem vizsgált”: kimarad a Health Score számításából. {pct(COVERAGE_GATE)} összesített lefedettség alatt a felmérés részleges, és nem
          kaphat „Zöld” minősítést. Ha egy területet más forrás (pl. interjú) lefedett, felülbírálhatod – indoklással, naplózva.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] tabular-nums">
            <thead className="text-left text-[11px] uppercase tracking-wide text-slate-500">
              <tr>
                <th className="py-1">Pillér</th>
                <th className="py-1 text-right">Kérdőív</th>
                <th className="py-1 text-right">Kötelező iratok</th>
                <th className="py-1 text-right">Lefedettség</th>
                <th className="py-1 pl-3">Állapot</th>
                <th className="py-1 pl-3">Felülbírálás</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 align-top">
              {PILLARS.map((p) => (
                <PillarRow
                  key={p}
                  pillar={p}
                  coverage={coverage}
                  state={assessment.pillars[p].state}
                  overrides={overrides}
                  onApply={(state, reason) => onChange(setCoverageOverride(overrides, log, p, state, reason, by))}
                />
              ))}
            </tbody>
          </table>
        </div>
        {log.length > 0 && (
          <div>
            <p className="font-semibold text-slate-700">Lefedettségi napló</p>
            <ul className="mt-1 space-y-1">
              {[...log].reverse().map((e, i) => (
                <li key={i}>
                  {formatWhen(e.at)} · {e.by ?? 'név nélkül'} · {PILLAR_LABEL[e.pillar]}: {COVERAGE_STATE_LABEL[e.from]} → {COVERAGE_STATE_LABEL[e.to]} – „
                  {e.reason}”
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </details>
  );
}

function PillarRow({
  pillar,
  coverage,
  state,
  overrides,
  onApply,
}: {
  pillar: Pillar;
  coverage: Coverage;
  state: RiskAssessment['pillars'][Pillar]['state'];
  overrides: CoverageOverrides;
  onApply: (state: CoverageState | null, reason: string) => void;
}) {
  const c = coverage[pillar];
  const current = overrides[pillar]?.state ?? 'AUTO';
  const [choice, setChoice] = useState<CoverageState | 'AUTO'>(current);
  const [reason, setReason] = useState('');
  const dirty = choice !== current;
  return (
    <tr>
      <td className="py-1.5 font-medium text-slate-800">{PILLAR_LABEL[pillar]}</td>
      <td className="py-1.5 text-right">{c.questions.total ? `${c.questions.answered}/${c.questions.total}` : '–'}</td>
      <td className="py-1.5 text-right">{c.documents.total ? `${c.documents.received}/${c.documents.total}` : '–'}</td>
      <td className="py-1.5 text-right font-semibold text-slate-900">
        {pct(c.value)}
        {c.override && <span className="block text-[10px] font-normal text-violet-700">mért: {pct(c.measured)}</span>}
      </td>
      <td className="py-1.5 pl-3">{PILLAR_STATE_LABEL[state]}</td>
      <td className="py-1.5 pl-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <select
            aria-label={`${PILLAR_LABEL[pillar]}: lefedettség felülbírálása`}
            value={choice}
            onChange={(e) => setChoice(e.target.value as CoverageState | 'AUTO')}
            className="rounded border border-slate-200 bg-white px-1.5 py-0.5"
          >
            <option value="AUTO">automatikus</option>
            <option value="EXAMINED">vizsgált</option>
            <option value="NOT_EXAMINED">nem vizsgált</option>
          </select>
          {dirty && (
            <>
              <input
                aria-label={`${PILLAR_LABEL[pillar]}: a felülbírálás indoklása`}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Indoklás (kötelező), pl. a HR-vezetővel készült interjú lefedte"
                className="min-w-[220px] flex-1 rounded border border-slate-200 px-1.5 py-0.5"
              />
              <button
                disabled={!reason.trim()}
                onClick={() => {
                  onApply(choice === 'AUTO' ? null : choice, reason);
                  setReason('');
                }}
                className="rounded bg-brand-600 px-2 py-0.5 font-medium text-white disabled:opacity-40"
              >
                Rögzítés
              </button>
            </>
          )}
        </div>
        {c.override && <p className="mt-0.5 text-[10px] text-slate-500">„{c.override.reason}”</p>}
      </td>
    </tr>
  );
}
