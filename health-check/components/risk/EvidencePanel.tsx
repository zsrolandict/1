'use client';

import { useState } from 'react';
import { AlertTriangle, ArrowUpRight, Bot, Calculator, Cog, History, Link2, Quote, UserCheck } from 'lucide-react';
import { openSource } from '@/lib/focus';
import { deriveRisk } from '@/lib/risk/derivation';
import { ACTOR_LABEL, formatChange, formatWhen, historyOf, setReason, TRAIL_KIND_LABEL, trailOf, type EvidenceEntry, type TrailActor } from '@/lib/risk/trail';
import type { RiskItem, ScoredRisk } from '@/lib/risk/types';
import { useNav } from '../Nav';

const ACTOR_STYLE: Record<TrailActor, { icon: typeof Bot; dot: string; chip: string }> = {
  AI: { icon: Bot, dot: 'bg-violet-500', chip: 'bg-violet-50 text-violet-700 ring-violet-600/20' },
  RULE: { icon: Cog, dot: 'bg-brand-600', chip: 'bg-brand-50 text-brand-700 ring-brand-600/20' },
  EXPERT: { icon: UserCheck, dot: 'bg-emerald-600', chip: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20' },
};

/**
 * „Miért?” – a tétel bizonyíték-lánca (forrásonként: hely, idézet, indoklás,
 * hatás, elfogadó), a pontszám levezetése és a szakértői módosítások naplója.
 * Csökkentésnél itt kell megírni az indoklást.
 */
export function EvidencePanel({
  risk,
  eff,
  materialityHuf,
  onChange,
}: {
  risk: RiskItem;
  eff: Omit<ScoredRisk, 'priority'>;
  materialityHuf: number;
  onChange: (patch: Partial<RiskItem>) => void;
}) {
  const trail = trailOf(risk);
  const history = historyOf(risk);
  return (
    <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
      <section aria-label="Bizonyíték-lánc">
        <h4 className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
          <Link2 className="h-3.5 w-3.5" /> Miért van a listában? · {trail.length ? `${trail.length} bejegyzés` : 'nincs forrás'}
        </h4>
        {trail.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-300 bg-white p-3 text-xs text-slate-500">
            A tétel a katalógusból jön, még egyetlen forrás sem erősítette meg. Ha bepipálod, a döntésed kerül ide; ha az adatgyűjtés vagy egy interjú
            javasolja, a forrás idézettel együtt jelenik meg.
          </p>
        ) : (
          <ol className="relative space-y-3 border-l border-slate-200 pl-4">
            {trail.map((e) => (
              <TrailEntry key={e.id} e={e} />
            ))}
          </ol>
        )}
      </section>

      <div className="space-y-4">
        <section aria-label="Levezetés" className="rounded-lg border border-slate-200 bg-white p-3">
          <h4 className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
            <Calculator className="h-3.5 w-3.5" /> Levezetés
          </h4>
          <dl className="space-y-1.5 text-xs">
            {deriveRisk(eff, materialityHuf).map((s) => (
              <div key={s.label}>
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500">{s.label}</dt>
                  <dd className="text-right font-semibold tabular-nums text-slate-900">{s.value}</dd>
                </div>
                {s.note && <p className="mt-0.5 text-[11px] leading-snug text-slate-500">{s.note}</p>}
              </div>
            ))}
          </dl>
        </section>

        <section aria-label="Változásnapló" className="rounded-lg border border-slate-200 bg-white p-3">
          <h4 className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
            <History className="h-3.5 w-3.5" /> Szakértői módosítások
          </h4>
          {history.length === 0 ? (
            <p className="text-xs text-slate-500">Még nem módosította senki.</p>
          ) : (
            <ul className="space-y-2 text-xs">
              {history.map((h, i) => (
                <li key={i} className={h.reduces && !h.reason?.trim() ? 'rounded-lg bg-amber-50 p-2 ring-1 ring-inset ring-amber-200' : ''}>
                  <div className="flex flex-wrap justify-between gap-x-3">
                    <span className="font-medium text-slate-800">{formatChange(h)}</span>
                    <span className="text-slate-500">
                      {h.by ?? 'név nélkül'} · {formatWhen(h.at)}
                    </span>
                  </div>
                  {h.reduces && <ReasonField value={h.reason ?? ''} onSave={(reason) => onChange({ history: setReason(risk, i, reason).history })} />}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function TrailEntry({ e }: { e: EvidenceEntry }) {
  const nav = useNav();
  const st = ACTOR_STYLE[e.actor] ?? ACTOR_STYLE.RULE;
  const Icon = st.icon;
  return (
    <li className="relative">
      <span className={`absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full ring-2 ring-white ${st.dot}`} aria-hidden />
      <div className="rounded-lg border border-slate-200 bg-white p-3 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10.5px] font-bold uppercase tracking-wide ring-1 ring-inset ${st.chip}`}
          >
            <Icon className="h-3 w-3" /> {ACTOR_LABEL[e.actor]}
          </span>
          <span className="font-semibold text-slate-900">{TRAIL_KIND_LABEL[e.kind] ?? e.kind}</span>
          {e.confidence != null && <span className="text-slate-500">bizonyosság {Math.round(e.confidence * 100)}%</span>}
          {e.link && nav && (
            <button
              onClick={() => openSource(e.link!, nav.go, nav.page)}
              className="ml-auto inline-flex items-center gap-0.5 font-semibold text-brand-700 hover:underline"
            >
              Megnyitás <ArrowUpRight className="h-3 w-3" />
            </button>
          )}
        </div>
        <p className="mt-1.5 text-slate-700">{e.ref}</p>
        {e.quote && (
          <blockquote className="mt-1.5 flex gap-1.5 rounded-md bg-slate-50 px-2 py-1.5 italic text-slate-700">
            <Quote className="mt-0.5 h-3 w-3 shrink-0 text-slate-400" aria-hidden />„{e.quote}”
          </blockquote>
        )}
        {e.rationale && <p className="mt-1.5 text-slate-600">{e.rationale}</p>}
        <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-slate-500">
          {e.effect && <span>Hatás: {e.effect}</span>}
          {(e.acceptedBy !== undefined || e.at) && (
            <span>
              {e.actor === 'EXPERT' ? 'Döntött' : 'Elfogadta'}: {e.acceptedBy ?? 'név nélkül'}
              {e.at && ` · ${formatWhen(e.at)}`}
            </span>
          )}
        </div>
      </div>
    </li>
  );
}

function ReasonField({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [draft, setDraft] = useState(value);
  const missing = !value.trim();
  return (
    <div className="mt-1.5">
      <label className="block">
        <span className={`flex items-center gap-1 font-medium ${missing ? 'text-amber-800' : 'text-slate-600'}`}>
          {missing && <AlertTriangle className="h-3 w-3" />} Indoklás (csökkentésnél kötelező)
        </span>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => draft !== value && onSave(draft)}
          rows={2}
          placeholder="Miért enyhébb? Pl. az ügyfél bemutatta az aláírt átruházási szerződéseket."
          className="mt-1 w-full rounded-md border border-slate-200 bg-white p-1.5 text-xs text-slate-800 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
        />
      </label>
    </div>
  );
}

/** „Hogyan számoltuk?” – a Health Score pillérenként és súlyozva. */
export function HealthExplain({
  pillars,
  total,
  labels,
}: {
  pillars: { pillar: string; score: number; weight: number; items: number }[];
  total: number;
  labels: Record<string, string>;
}) {
  const weightSum = pillars.reduce((a, p) => a + p.weight, 0) || 1;
  return (
    <details className="group rounded-xl border border-slate-200/80 bg-white text-sm shadow-[0_1px_2px_rgba(15,23,42,0.04)] print:hidden">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 font-semibold text-slate-800 [&::-webkit-details-marker]:hidden">
        <Calculator className="h-4 w-4 text-brand-600" /> Hogyan számoltuk a Health Score-t?
        <span className="ml-auto text-xs font-normal text-slate-500 group-open:hidden">Lenyitás</span>
      </summary>
      <div className="space-y-3 border-t border-slate-100 px-4 pb-4 pt-3 text-xs text-slate-600">
        <p>
          Pillérenként 100-ról indulunk. Minden azonosított tétel a pontszámával arányosan csökkenti a maradékot: a szorzó 1 − (pont / 25) × 0,6. Így egy 25
          pontos tétel 40%-ra, egy 8 pontos 81%-ra viszi le a pillért. Egy-egy kritikus tétel erősebben hat, mint sok apró. Az összesített érték a pillérek
          súlyozott átlaga; a súlyokat az átvilágítás típusa adja.
        </p>
        <table className="w-full max-w-xl tabular-nums">
          <thead className="text-left text-[11px] uppercase tracking-wide text-slate-500">
            <tr>
              <th className="py-1 font-semibold">Pillér</th>
              <th className="py-1 text-right font-semibold">Tételek</th>
              <th className="py-1 text-right font-semibold">Pont</th>
              <th className="py-1 text-right font-semibold">Súly</th>
              <th className="py-1 text-right font-semibold">Hozzájárulás</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {pillars.map((p) => (
              <tr key={p.pillar}>
                <td className="py-1 text-slate-800">{labels[p.pillar] ?? p.pillar}</td>
                <td className="py-1 text-right">{p.items}</td>
                <td className="py-1 text-right">{p.score}</td>
                <td className="py-1 text-right">{Math.round((p.weight / weightSum) * 100)}%</td>
                <td className="py-1 text-right">{((p.score * p.weight) / weightSum).toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="font-semibold text-slate-900">
              <td className="pt-2" colSpan={4}>
                Health Score (kerekítve)
              </td>
              <td className="pt-2 text-right">{total}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </details>
  );
}
