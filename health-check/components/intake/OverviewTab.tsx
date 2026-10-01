'use client';

import { DiscardedList } from '@/components/DiscardedList';
import { useState } from 'react';
import { AlertTriangle, ArrowLeftRight, Loader2, ShieldCheck, Sparkles } from 'lucide-react';
import type { Conflict, Severity } from '@/lib/intake/crossChecks';
import type { SynthesisResult } from '@/lib/intake/synthesis';
import { PILLAR_LABEL } from '@/lib/risk/catalog';

const SEV: Record<Severity, { label: string; cls: string }> = {
  HIGH: { label: 'Súlyos', cls: 'border-red-200 bg-red-50/60 text-red-700' },
  MEDIUM: { label: 'Közepes', cls: 'border-amber-200 bg-amber-50/60 text-amber-800' },
  LOW: { label: 'Enyhe', cls: 'border-slate-200 bg-white text-slate-500' },
};

export default function OverviewTab({
  conflicts,
  crossCount,
  synthesis,
  sourceCount,
  aiReady,
  onSynthesize,
}: {
  conflicts: Conflict[];
  crossCount: number;
  synthesis: SynthesisResult | null | undefined;
  sourceCount: number;
  aiReady: boolean | null;
  onSynthesize: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'ALL' | 'RULE' | 'AI_INTERVIEW'>('ALL');
  const shown = conflicts.filter((c) => filter === 'ALL' || c.origin === filter);

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      await onSynthesize();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Az összkép-elemzés nem sikerült.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="space-y-4">
      <div id="synthesis" className="scroll-mt-32 rounded-xl border border-brand-200 bg-brand-50/50 p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1 basis-72">
            <h2 className="flex items-center gap-2.5 text-base font-bold tracking-tight text-slate-900">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600" aria-hidden>
                <Sparkles className="h-4 w-4" />
              </span>{' '}
              Mit nem fed le a katalógus? (AI-összkép)
            </h2>
            <p className="mt-1 text-xs text-brand-900/80">
              Az AI egyszerre olvassa a tényállást, a kérdőívet, a táblákat, a dokumentumokat és az interjúkat ({sourceCount} forrás), és olyan kockázatokat
              keres, amelyek csak ezek összevetéséből derülnek ki. Minden javaslat mellett ott a forrás és a szó szerinti idézet; amit nem talál meg a
              forrásban, azt a rendszer eldobja. A javaslatok jobb oldalt jelennek meg.
            </p>
            {synthesis && (
              <p className="mt-1 text-xs text-brand-900/70">
                Utolsó futtatás: {new Date(synthesis.createdAt).toLocaleString('hu-HU')} · {synthesis.suggestions.length} javaslat
              </p>
            )}
            {synthesis && <DiscardedList count={synthesis.discardedUnverified} items={synthesis.discarded} noun="javaslatot" />}
          </div>
          <button
            onClick={run}
            disabled={!aiReady || busy || sourceCount === 0}
            title={aiReady ? undefined : 'Az AI ebben a környezetben nem érhető el'}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {synthesis ? 'Összkép újra' : 'Összkép készítése'}
          </button>
        </div>
        {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
        {sourceCount === 0 && (
          <p className="mt-2 text-xs text-brand-900/70">Előbb tölts be legalább egy forrást (tényállás, kérdőív, tábla, dokumentum vagy interjú).</p>
        )}
      </div>

      <div id="cross-checks" className="scroll-mt-32 rounded-xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-2.5">
          <h2 className="flex items-center gap-2.5 text-base font-bold tracking-tight text-slate-900">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600" aria-hidden>
              <ArrowLeftRight className="h-4 w-4" />
            </span>{' '}
            Ellentmondások a források között ({conflicts.length})
          </h2>
          <div className="inline-flex text-xs" role="group" aria-label="Szűrő">
            {(
              [
                ['ALL', 'Mind'],
                ['RULE', 'Szabály'],
                ['AI_INTERVIEW', 'AI · interjú'],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                onClick={() => setFilter(k)}
                aria-pressed={filter === k}
                className={`px-2.5 py-1 ring-1 ring-inset first:rounded-l-md last:rounded-r-md ${
                  filter === k ? 'bg-brand-600 text-white ring-brand-600' : 'bg-white text-slate-600 ring-slate-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        {shown.length === 0 ? (
          <p className="flex items-center gap-2 p-4 text-sm text-slate-500">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            {conflicts.length === 0
              ? 'Nincs talált ellentmondás. (Minél több forrás van betöltve, annál többet tud összevetni.)'
              : 'Ebben a szűrésben nincs tétel.'}
          </p>
        ) : (
          <ul className="space-y-3 p-3">
            {shown.map((c) => (
              <li key={c.key} className={`rounded-lg border p-3 text-sm ${SEV[c.severity].cls}`}>
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-medium">
                  <span className="text-slate-500">
                    {PILLAR_LABEL[c.pillar]} · {c.topic}
                  </span>
                  <span>
                    {SEV[c.severity].label} · {c.origin === 'RULE' ? 'szabály' : 'AI · interjú'}
                  </span>
                </div>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <div className="rounded bg-white/70 p-2 text-slate-800 ring-1 ring-inset ring-slate-200">
                    <p className="text-xs font-medium text-slate-500">{c.a.source}</p>
                    <p className="mt-0.5">{c.a.statement}</p>
                  </div>
                  <div className="rounded bg-white/70 p-2 text-slate-800 ring-1 ring-inset ring-slate-200">
                    <p className="text-xs font-medium text-slate-500">{c.b.source}</p>
                    <p className="mt-0.5">{c.b.statement}</p>
                  </div>
                </div>
                <p className="mt-2 flex items-start gap-1.5 text-slate-700">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {c.explanation}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
      <p className="text-xs text-slate-500">
        Keresztellenőrzés: {crossCount} szabályalapú javaslat a táblák együttes olvasásából (pl. kapcsolt fél a vevők között, 180 napon túli követelés). Ezek
        jobb oldalt, „Keresztellenőrzés” jelöléssel jelennek meg.
      </p>
    </section>
  );
}
