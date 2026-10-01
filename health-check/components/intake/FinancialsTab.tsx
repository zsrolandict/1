'use client';

import { useState } from 'react';
import { Check, FileText, Info, Pencil, Plus, Quote, Trash2, Upload } from 'lucide-react';
import { openSource } from '@/lib/focus';
import { acceptPending, pendingExtractions, pendingLabel, rejectPending, type Pending } from '@/lib/intake/financials/approve';
import {
  AUDIT_OPINION_LABEL,
  FACT_GROUPS,
  FIN_FIELDS,
  FIN_SOURCE_LABEL,
  setFact,
  setYearValue,
  yearRatios,
  type AuditOpinion,
  type FactSpec,
  type FinancialProfile,
  type FinFacts,
  type FinSource,
  type FinSourceKind,
  type YearRatios,
} from '@/lib/intake/financials/model';
import { FIN_THRESHOLDS, FIN_THRESHOLDS_APPROVED } from '@/lib/intake/financials/thresholds';
import type { DocumentRecord } from '@/lib/intake/documents/types';
import { parseNumber } from '@/lib/intake/tables/parse';
import { formatHufShort } from '@/lib/risk/engine';
import type { RiskItem } from '@/lib/risk/types';
import { useNav } from '../Nav';
import UsedBy from '../risk/UsedBy';
import { BTN_PRIMARY, BTN_SECONDARY } from '../ui/primitives';

/**
 * Pénzügyi alapadatok: a dokumentumokból kiolvasott értékek jóváhagyása,
 * a beszámoló kulcsszámai legfeljebb 3 évre, mutatók a küszöbökkel, és a
 * beírható tények. Minden érték mellett látszik a forrása.
 */
export default function FinancialsTab({
  financials: f,
  documents,
  items,
  me,
  onChange,
  onGoDocuments,
}: {
  financials: FinancialProfile;
  documents: DocumentRecord[];
  items: RiskItem[];
  me: string | null;
  onChange: (f: FinancialProfile) => void;
  onGoDocuments: () => void;
}) {
  const pending = pendingExtractions(documents, f);
  const manual = (ref = 'Kézi bevitel'): FinSource => ({ kind: 'MANUAL', ref, by: me, at: new Date().toISOString() });
  const years = f.years.map((y) => y.year);
  // Új év: az eddigi legrégebbi előtti év, üres listánál az utolsó lezárt év.
  const nextYear = (years[years.length - 1] ?? new Date().getFullYear()) - 1;

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-start gap-3 rounded-xl border border-slate-200/80 bg-white p-4 text-sm text-slate-600 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <p className="min-w-0 flex-1 basis-80">
          A beszámoló, a kiegészítő melléklet és a könyvvizsgálói jelentés számai és tényei. Töltsd fel az iratot a <b>Dokumentumok</b> fülön (válaszd ki az
          irattípust): a kiolvasott értékek ide érkeznek jóváhagyásra, oldalszámmal és idézettel. Ami nincs iratban, beírható; mindegyik mellé forrás tartozik.
          A szabályok ebből javasolnak tételeket a mátrixba (jobb oldalt).
        </p>
        <button onClick={onGoDocuments} className={BTN_SECONDARY}>
          <Upload className="h-4 w-4" /> Irat feltöltése
        </button>
      </div>

      {pending.length > 0 && (
        <PendingCard
          pending={pending}
          onAccept={(p) => onChange(acceptPending(f, p, me))}
          onReject={(p) => onChange(rejectPending(f, p))}
          onAcceptAll={() => onChange(pending.reduce((acc, p) => acceptPending(acc, p, me), f))}
        />
      )}

      {/* ── Kulcsszámok ───────────────────────────────────────── */}
      <div id="fin-figures" className="scroll-mt-32 overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-3">
          <h2 className="text-base font-bold tracking-tight text-slate-900">Beszámoló kulcsszámai</h2>
          <span className="text-xs text-slate-500">forintban; a beszámoló ezer Ft-os adatait a kiolvasás átváltja</span>
          {years.length < 3 && (
            <button
              onClick={() => onChange({ ...f, years: [...f.years, { year: nextYear, values: {}, sources: {} }].sort((a, b) => b.year - a.year) })}
              className="ml-auto inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              <Plus className="h-3.5 w-3.5" /> Év hozzáadása
            </button>
          )}
        </div>
        {years.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-slate-500">Még nincs beszámoló-adat. Tölts fel beszámolót, vagy adj hozzá egy évet és írd be.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-slate-50/80 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                <tr>
                  <th className="px-4 py-2">Sor</th>
                  {f.years.map((y) => (
                    <th key={y.year} className="px-3 py-2 text-right">
                      <span className="inline-flex items-center gap-1">
                        <YearInput
                          value={y.year}
                          onChange={(year) =>
                            !years.includes(year) &&
                            onChange({ ...f, years: f.years.map((x) => (x.year === y.year ? { ...x, year } : x)).sort((a, b) => b.year - a.year) })
                          }
                        />
                        <button
                          onClick={() => onChange({ ...f, years: f.years.filter((x) => x.year !== y.year) })}
                          aria-label={`${y.year}. év törlése`}
                          className="text-slate-300 hover:text-red-600"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {FIN_FIELDS.map(({ field, label, group }, i) => (
                  <tr key={field} className={i > 0 && FIN_FIELDS[i - 1].group !== group ? 'border-t-2 border-slate-200' : ''}>
                    <td className="px-4 py-1.5 text-slate-700">{label}</td>
                    {f.years.map((y) => (
                      <td key={y.year} className="px-3 py-1.5 text-right">
                        <span className="inline-flex items-center justify-end gap-1.5">
                          <SourceMark src={y.sources[field]} />
                          <MoneyInput value={y.values[field]} onChange={(v) => onChange(setYearValue(f, y.year, field, v, manual()))} />
                        </span>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="px-4 pb-3">
          <UsedBy items={items} anchor="fin-figures" />
        </div>
      </div>

      {years.length > 0 && <RatiosCard ratios={yearRatios(f)} items={items} />}

      {/* ── Tények ─────────────────────────────────────────────── */}
      {FACT_GROUPS.map((g) => (
        <div key={g.title} id={g.anchor} className="scroll-mt-32 rounded-xl border border-slate-200/80 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <h2 className="mb-3 text-base font-bold tracking-tight text-slate-900">{g.title}</h2>
          <div className="divide-y divide-slate-100">
            {g.facts.map((spec) => (
              <FactRow
                key={spec.key}
                spec={spec}
                value={f.facts[spec.key]}
                src={f.factSources[spec.key]}
                onChange={(v, src) => onChange(setFact(f, spec.key, v, src ?? f.factSources[spec.key] ?? manual()))}
                onSource={(kind, ref) => f.facts[spec.key] != null && onChange(setFact(f, spec.key, f.facts[spec.key]!, { ...manual(ref), kind }))}
              />
            ))}
          </div>
          <UsedBy items={items} anchor={g.anchor} />
        </div>
      ))}
    </section>
  );
}

function PendingCard({
  pending,
  onAccept,
  onReject,
  onAcceptAll,
}: {
  pending: Pending[];
  onAccept: (p: Pending) => void;
  onReject: (p: Pending) => void;
  onAcceptAll: () => void;
}) {
  const nav = useNav();
  return (
    <div className="rounded-xl border border-brand-200 bg-brand-50/50 p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 className="text-base font-bold tracking-tight text-slate-900">Iratokból kiolvasott értékek – jóváhagyásra várnak ({pending.length})</h2>
        <button onClick={onAcceptAll} className={`ml-auto ${BTN_PRIMARY}`}>
          <Check className="h-4 w-4" /> Mind átvétele
        </button>
      </div>
      <p className="mb-3 text-xs text-slate-600">
        Az AI csak olyan értéket ad, amelynek idézete szó szerint megtalálható az iratban, és a szám benne van az idézetben. Átvétel előtt nézd meg az idézetet.
      </p>
      <ul className="space-y-2">
        {pending.map((p) => (
          <li key={p.key} className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="font-semibold text-slate-900">{pendingLabel(p)}</span>
              <span className="font-bold tabular-nums text-brand-700">{formatValue(p)}</span>
              {p.current != null && p.current !== p.value && <span className="text-xs text-amber-800">most: {formatAny(p.current)}</span>}
              <span className="ml-auto flex gap-1.5">
                <button onClick={() => onAccept(p)} className="rounded-lg bg-brand-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-brand-700">
                  Átvétel
                </button>
                <button onClick={() => onReject(p)} className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50">
                  Elvet
                </button>
              </span>
            </div>
            <p className="mt-1 flex gap-1.5 text-xs italic text-slate-600">
              <Quote className="mt-0.5 h-3 w-3 shrink-0 text-slate-400" />„{p.quote}”
            </p>
            <button
              onClick={() => nav && openSource({ page: 'adatok', tab: 'documents', anchor: `doc-${p.doc.id}` }, nav.go, nav.page)}
              className="mt-1 inline-flex items-center gap-1 text-xs text-brand-700 hover:underline"
            >
              <FileText className="h-3 w-3" /> {p.doc.fileName}
              {p.page && `, ${p.page}`}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function RatiosCard({ ratios, items }: { ratios: YearRatios[]; items: RiskItem[] }) {
  const T = FIN_THRESHOLDS;
  const rows: { label: string; get: (r: YearRatios) => number | null; fmt: (n: number) => string; bad?: (n: number) => boolean; note?: string }[] = [
    { label: 'EBITDA (üzemi eredmény + értékcsökkenés)', get: (r) => r.ebitda, fmt: formatHufShort, bad: (n) => n < 0 },
    { label: 'EBITDA-ráta', get: (r) => r.ebitdaMargin, fmt: pctFmt },
    {
      label: 'Árbevétel-változás',
      get: (r) => r.revenueChange,
      fmt: pctFmt,
      bad: (n) => n <= -T.REVENUE_DROP.value,
      note: `küszöb −${pctFmt(T.REVENUE_DROP.value)}`,
    },
    {
      label: 'Nettó adósság / EBITDA',
      get: (r) => r.netDebtToEbitda,
      fmt: (n) => `${n.toFixed(1)}×`,
      bad: (n) => n > T.NET_DEBT_EBITDA.value,
      note: `küszöb ${T.NET_DEBT_EBITDA.value}×`,
    },
    {
      label: 'Likviditási ráta',
      get: (r) => r.currentRatio,
      fmt: (n) => n.toFixed(2),
      bad: (n) => n < T.CURRENT_RATIO.value,
      note: `küszöb ${T.CURRENT_RATIO.value}`,
    },
    { label: 'Saját tőke / jegyzett tőke', get: (r) => r.equityToShareCapital, fmt: (n) => `${n.toFixed(1)}×`, bad: (n) => n < 1, note: '1 alatt tőkevesztés' },
    { label: 'Vevői fizetési idő (nap)', get: (r) => r.dso, fmt: (n) => `${Math.round(n)}` },
    { label: 'Szállítói fizetési idő (nap)', get: (r) => r.dpo, fmt: (n) => `${Math.round(n)}` },
    { label: 'Fedezeti hányad (közelítés)', get: (r) => r.grossMargin, fmt: pctFmt },
  ];
  return (
    <div id="fin-ratios" className="scroll-mt-32 overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="border-b border-slate-100 px-4 py-3">
        <h2 className="text-base font-bold tracking-tight text-slate-900">Mutatók</h2>
        <p className="text-xs text-slate-500">
          A kulcsszámokból számolva. A pirossal jelölt érték a küszöbön túl van.
          {!FIN_THRESHOLDS_APPROVED && ' A küszöbök kezdő javaslatok, szakértői jóváhagyásra várnak.'}
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="bg-slate-50/80 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
            <tr>
              <th className="px-4 py-2">Mutató</th>
              {ratios.map((r) => (
                <th key={r.year} className="px-3 py-2 text-right">
                  {r.year}
                </th>
              ))}
              <th className="px-3 py-2">Megjegyzés</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => (
              <tr key={row.label}>
                <td className="px-4 py-1.5 text-slate-700">{row.label}</td>
                {ratios.map((r) => {
                  const v = row.get(r);
                  const bad = v != null && row.bad?.(v);
                  return (
                    <td key={r.year} className={`px-3 py-1.5 text-right tabular-nums ${bad ? 'font-bold text-red-700' : 'text-slate-900'}`}>
                      {v == null ? '—' : row.fmt(v)}
                    </td>
                  );
                })}
                <td className="px-3 py-1.5 text-xs text-slate-500">{row.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="px-4 pb-3">
        <UsedBy items={items} anchor="fin-ratios" />
      </div>
    </div>
  );
}

function FactRow({
  spec,
  value,
  src,
  onChange,
  onSource,
}: {
  spec: FactSpec;
  value: FinFacts[keyof FinFacts] | undefined;
  src: FinSource | undefined;
  onChange: (v: FinFacts[keyof FinFacts] | null, src?: FinSource) => void;
  onSource: (kind: FinSourceKind, ref: string) => void;
}) {
  return (
    <div className="grid items-center gap-x-4 gap-y-1 py-2 text-sm md:grid-cols-[minmax(0,1fr)_200px_minmax(0,220px)]">
      <span className="text-slate-700">
        {spec.label}
        {spec.hint && (
          <span className="ml-1 inline-flex align-middle text-slate-400" title={spec.hint}>
            <Info className="h-3.5 w-3.5" />
          </span>
        )}
      </span>
      <FactInput spec={spec} value={value} onChange={onChange} />
      <SourceEditor src={src} disabled={value == null} onSource={onSource} />
    </div>
  );
}

function FactInput({
  spec,
  value,
  onChange,
}: {
  spec: FactSpec;
  value: FinFacts[keyof FinFacts] | undefined;
  onChange: (v: FinFacts[keyof FinFacts] | null) => void;
}) {
  const cls = 'w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm';
  switch (spec.kind) {
    case 'bool':
      return (
        <div className="flex rounded-lg bg-slate-100 p-0.5 text-xs" role="group" aria-label={spec.label}>
          {([true, false, null] as const).map((b) => (
            <button
              key={String(b)}
              onClick={() => onChange(b)}
              aria-pressed={value === b || (b === null && value == null)}
              className={`flex-1 rounded-md px-2 py-1 ${
                value === b || (b === null && value == null) ? 'bg-white font-semibold text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {b === true ? 'Igen' : b === false ? 'Nem' : 'Nem tudjuk'}
            </button>
          ))}
        </div>
      );
    case 'opinion':
      return (
        <select
          aria-label={spec.label}
          value={(value as string) ?? ''}
          onChange={(e) => onChange((e.target.value || null) as AuditOpinion | null)}
          className={cls}
        >
          <option value="">Nem tudjuk</option>
          {(Object.keys(AUDIT_OPINION_LABEL) as AuditOpinion[]).map((o) => (
            <option key={o} value={o}>
              {AUDIT_OPINION_LABEL[o]}
            </option>
          ))}
        </select>
      );
    case 'date':
      return <input aria-label={spec.label} type="date" value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value || null)} className={cls} />;
    case 'money':
      return <MoneyInput label={spec.label} value={value as number | undefined} onChange={onChange} wide />;
    case 'percent':
      return (
        <span className="flex items-center gap-1">
          <NumberInput
            label={spec.label}
            value={value != null ? Math.round((value as number) * 1000) / 10 : undefined}
            onChange={(v) => onChange(v == null ? null : v / 100)}
          />
          <span className="text-slate-500">%</span>
        </span>
      );
    default:
      return <NumberInput label={spec.label} value={value as number | undefined} onChange={onChange} />;
  }
}

const SOURCE_KINDS: FinSourceKind[] = ['MANUAL', 'CLIENT_ORAL', 'INTERVIEW', 'PUBLIC'];

function SourceEditor({ src, disabled, onSource }: { src: FinSource | undefined; disabled: boolean; onSource: (kind: FinSourceKind, ref: string) => void }) {
  const nav = useNav();
  if (src?.kind === 'DOCUMENT') {
    return (
      <button
        onClick={() => nav && src.docId && openSource({ page: 'adatok', tab: 'documents', anchor: `doc-${src.docId}` }, nav.go, nav.page)}
        title={src.quote ? `„${src.quote}”` : src.ref}
        className="inline-flex min-w-0 items-center gap-1 text-left text-xs text-brand-700 hover:underline"
      >
        <FileText className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{src.ref}</span>
      </button>
    );
  }
  return (
    <span className="flex min-w-0 items-center gap-1 text-xs">
      <select
        aria-label="Honnan tudjuk"
        disabled={disabled}
        value={src?.kind ?? 'MANUAL'}
        onChange={(e) =>
          onSource(e.target.value as FinSourceKind, src?.ref && src.ref !== 'Kézi bevitel' ? src.ref : FIN_SOURCE_LABEL[e.target.value as FinSourceKind])
        }
        className="rounded-md border border-slate-200 bg-white px-1.5 py-1 text-xs text-slate-600 disabled:opacity-40"
      >
        {SOURCE_KINDS.map((k) => (
          <option key={k} value={k}>
            {FIN_SOURCE_LABEL[k]}
          </option>
        ))}
      </select>
      {src && <SourceNote value={src.ref} onSave={(ref) => onSource(src.kind, ref)} title={`${FIN_SOURCE_LABEL[src.kind]}${src.by ? ` · ${src.by}` : ''}`} />}
    </span>
  );
}

function SourceNote({ value, onSave, title }: { value: string; onSave: (v: string) => void; title: string }) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <input
      aria-label="Forrás megjegyzés"
      title={title}
      value={draft ?? value}
      onFocus={() => setDraft(value)}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        if (draft != null && draft !== value) onSave(draft.trim() || value);
        setDraft(null);
      }}
      placeholder="pl. NAV-igazolás 2026.09."
      className="min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-1.5 py-1 text-xs text-slate-600"
    />
  );
}

function SourceMark({ src }: { src: FinSource | undefined }) {
  const nav = useNav();
  if (!src) return null;
  if (src.kind === 'DOCUMENT') {
    return (
      <button
        onClick={() => nav && src.docId && openSource({ page: 'adatok', tab: 'documents', anchor: `doc-${src.docId}` }, nav.go, nav.page)}
        title={`${src.ref}${src.quote ? ` – „${src.quote}”` : ''}`}
        aria-label={`Forrás: ${src.ref}`}
        className="text-brand-600 hover:text-brand-800"
      >
        <FileText className="h-3.5 w-3.5" />
      </button>
    );
  }
  return (
    <span title={`${FIN_SOURCE_LABEL[src.kind]}${src.by ? ` · ${src.by}` : ''}`} className="text-slate-400">
      <Pencil className="h-3 w-3" />
    </span>
  );
}

/** Forint mező: negatív is lehet (pl. veszteség, negatív saját tőke); üres = nincs adat. */
function MoneyInput({ value, onChange, label, wide }: { value: number | undefined; onChange: (v: number | null) => void; label?: string; wide?: boolean }) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = value == null ? '' : value.toLocaleString('hu-HU');
  return (
    <input
      aria-label={label}
      inputMode="numeric"
      value={draft ?? shown}
      placeholder="—"
      onFocus={() => setDraft(value == null ? '' : String(value))}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        if (draft != null) {
          const n = draft.trim() ? parseNumber(draft) : null;
          if (draft.trim() === '' || n != null) onChange(n == null ? null : Math.round(n));
        }
        setDraft(null);
      }}
      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      className={`${wide ? 'w-full' : 'w-36'} rounded-md border border-slate-200 bg-white px-2 py-1 text-right text-sm tabular-nums outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100`}
    />
  );
}

function NumberInput({ value, onChange, label }: { value: number | undefined; onChange: (v: number | null) => void; label?: string }) {
  return (
    <input
      aria-label={label}
      type="number"
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
      className="w-28 rounded-lg border border-slate-200 bg-white px-2 py-1 text-right text-sm tabular-nums"
    />
  );
}

function YearInput({ value, onChange }: { value: number; onChange: (y: number) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <input
      aria-label="Üzleti év"
      inputMode="numeric"
      value={draft ?? String(value)}
      onFocus={() => setDraft(String(value))}
      onChange={(e) => setDraft(e.target.value.replace(/\D/g, '').slice(0, 4))}
      onBlur={() => {
        const y = Number(draft);
        if (draft && y >= 1990 && y <= 2100) onChange(y);
        setDraft(null);
      }}
      className="w-14 rounded border border-transparent bg-transparent text-right font-semibold hover:border-slate-200 focus:border-brand-400 focus:bg-white"
    />
  );
}

const pctFmt = (n: number) => `${(n * 100).toLocaleString('hu-HU', { maximumFractionDigits: 1 })}%`;

function formatAny(v: unknown): string {
  if (typeof v === 'number') return Math.abs(v) >= 10_000 ? formatHufShort(v) : v.toLocaleString('hu-HU');
  if (typeof v === 'boolean') return v ? 'igen' : 'nem';
  if (typeof v === 'string' && v in AUDIT_OPINION_LABEL) return AUDIT_OPINION_LABEL[v as AuditOpinion];
  return String(v ?? '—');
}

function formatValue(p: Pending): string {
  return p.kind === 'value' ? `${p.value.toLocaleString('hu-HU')} Ft` : formatAny(p.value);
}
