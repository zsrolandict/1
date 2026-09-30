'use client';

import { useMemo, useState } from 'react';
import { FlaskConical } from 'lucide-react';
import type { EngineOptions } from '@/lib/risk/engine';
import { formatHufShort } from '@/lib/risk/engine';
import { RAG_LABEL } from '@/lib/risk/catalog';
import { presetFixes, simulate, type FixMode } from '@/lib/risk/simulate';
import type { RiskAssessment, RiskItem } from '@/lib/risk/types';

const PRESETS = [
  ['QUICK_WINS', 'Quick win-ek'],
  ['D0_30', '0–30 napos terv'],
  ['RED', 'Összes piros'],
  ['ALL_NON_GREEN', 'Minden piros és sárga'],
] as const;

/**
 * „Mi lenne, ha…?” – mennyit javul a kép, ha a kiválasztott tételeket
 * megoldják. Értékesítési érv az ajánlat mellé: díj ↔ várható veszteség-csökkenés.
 */
export default function WhatIfPanel({ items, opts, result }: { items: RiskItem[]; opts: Partial<EngineOptions>; result: RiskAssessment }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<FixMode>('RESOLVE');
  const [selected, setSelected] = useState<Set<string>>(() => presetFixes(result, 'QUICK_WINS'));
  const candidates = result.risks.filter((r) => r.rag !== 'GREEN');
  const sim = useMemo(() => simulate(items, opts, selected, mode), [items, opts, selected, mode]);
  const b = sim.before.totals;
  const a = sim.after.totals;

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <section className="rounded-xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 rounded-xl px-4 py-3.5 text-left hover:bg-slate-50/60"
      >
        <span className="flex items-center gap-2.5 text-sm font-bold text-slate-900">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-50 text-brand-600" aria-hidden>
            <FlaskConical className="h-4 w-4" />
          </span>{' '}
          Mi lenne, ha…? – javítási szimuláció
        </span>
        <span className="text-xs text-slate-500">
          {open
            ? 'Bezár'
            : `${sim.fixedCount} tétel javítása: Health Score ${b.healthScore} → ${a.healthScore}, várható veszteség −${formatHufShort(sim.expectedLossReductionHuf)}`}
        </span>
      </button>
      {open && (
        <div className="grid gap-4 border-t border-slate-100 p-4 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-slate-500">Gyors választás:</span>
              {PRESETS.map(([k, label]) => (
                <button
                  key={k}
                  onClick={() => setSelected(presetFixes(result, k))}
                  className="rounded-full border border-slate-200 px-2.5 py-0.5 text-slate-700 hover:bg-slate-50"
                >
                  {label}
                </button>
              ))}
              <button onClick={() => setSelected(new Set())} className="rounded-full border border-slate-200 px-2.5 py-0.5 text-slate-500 hover:bg-slate-50">
                Egyik sem
              </button>
              <span className="ml-auto inline-flex" role="group" aria-label="Javítás módja">
                {(
                  [
                    ['RESOLVE', 'Teljes megoldás'],
                    ['MITIGATE', 'Csökkentés (V=1)'],
                  ] as const
                ).map(([k, label]) => (
                  <button
                    key={k}
                    onClick={() => setMode(k)}
                    aria-pressed={mode === k}
                    className={`px-2.5 py-0.5 ring-1 ring-inset first:rounded-l-md last:rounded-r-md ${
                      mode === k ? 'bg-brand-600 text-white ring-brand-600' : 'bg-white text-slate-600 ring-slate-200'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </span>
            </div>
            <ul className="mt-3 max-h-80 divide-y divide-slate-100 overflow-auto rounded-lg border border-slate-200/80 text-sm">
              {candidates.map((r) => (
                <li key={r.id}>
                  <label className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-slate-50">
                    <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggle(r.id)} className="accent-brand-600" />
                    <span className="w-14 font-mono text-xs text-slate-500">{r.code}</span>
                    <span className="min-w-0 flex-1 truncate text-slate-800">{r.title}</span>
                    <span className={`text-xs ${r.rag === 'RED' ? 'text-red-700' : 'text-amber-700'}`}>{RAG_LABEL[r.rag]}</span>
                    <span className="w-20 text-right text-xs tabular-nums text-slate-500">{formatHufShort(r.serviceFeeHuf)}</span>
                    <span className="w-12 text-right text-xs tabular-nums text-slate-500">{r.remediationDays} nap</span>
                  </label>
                </li>
              ))}
              {candidates.length === 0 && <li className="px-3 py-2 text-slate-500">Nincs piros vagy sárga tétel.</li>}
            </ul>
          </div>
          <dl className="space-y-2 rounded-lg bg-canvas p-3 text-sm">
            <Row label="Health Score" before={String(b.healthScore)} after={String(a.healthScore)} good={a.healthScore > b.healthScore} />
            <Row label="Összesített besorolás" before={RAG_LABEL[b.rag]} after={RAG_LABEL[a.rag]} good={a.rag !== b.rag} />
            <Row label="Piros / sárga tételek" before={`${b.red} / ${b.amber}`} after={`${a.red} / ${a.amber}`} good={a.red + a.amber < b.red + b.amber} />
            <Row
              label="Várható veszteség"
              before={formatHufShort(b.expectedLossHuf)}
              after={formatHufShort(a.expectedLossHuf)}
              good={a.expectedLossHuf < b.expectedLossHuf}
            />
            <Row
              label="Bruttó kitettség"
              before={formatHufShort(b.grossExposureHuf)}
              after={formatHufShort(a.grossExposureHuf)}
              good={a.grossExposureHuf < b.grossExposureHuf}
            />
            <div className="border-t border-slate-200 pt-2">
              <p className="flex justify-between">
                <span className="text-slate-500">A javítás becsült díja</span>
                <b className="tabular-nums">{formatHufShort(sim.costHuf)}</b>
              </p>
              <p className="flex justify-between">
                <span className="text-slate-500">Leghosszabb javítás</span>
                <b className="tabular-nums">{sim.maxDays} munkanap</b>
              </p>
              <p className="flex justify-between">
                <span className="text-slate-500">Várható veszteség-csökkenés / díj</span>
                <b className="tabular-nums text-emerald-700">
                  {sim.returnMultiple != null ? `${sim.returnMultiple.toLocaleString('hu-HU', { maximumFractionDigits: 1 })}×` : '—'}
                </b>
              </p>
            </div>
            <p className="text-xs text-slate-500">
              Becslés: a várható veszteség a kitettség × valószínűség; a díj az ICT remediációs díja. A szimuláció a mátrixot nem módosítja.
            </p>
          </dl>
        </div>
      )}
    </section>
  );
}

function Row({ label, before, after, good }: { label: string; before: string; after: string; good: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="text-slate-500">{label}</dt>
      <dd className="tabular-nums">
        <span className="text-slate-500">{before}</span> → <b className={good ? 'text-emerald-700' : 'text-slate-900'}>{after}</b>
      </dd>
    </div>
  );
}
