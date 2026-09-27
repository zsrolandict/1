'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Banknote,
  BriefcaseBusiness,
  CalendarClock,
  CheckSquare,
  Download,
  Filter,
  Gauge,
  Plus,
  Printer,
  RotateCcw,
  Search,
  ShieldAlert,
  Square,
  Trash2,
  TrendingDown,
  Zap,
} from 'lucide-react';
import { assess, AUDIT_FEE_HUF, DIVISIONS, formatHuf, formatHufShort, PILLARS, ragFromScore, WINDOWS } from '@/lib/risk/engine';
import { DEFAULT_CATALOG, DIVISION_LABEL, PILLAR_LABEL, RAG_LABEL, WINDOW_LABEL } from '@/lib/risk/catalog';
import type { Division, Pillar, Rag, RiskItem, RiskSource, Scale5, ScoredRisk } from '@/lib/risk/types';
import { DEFAULT_WORKSPACE, loadWorkspace, saveWorkspace } from '@/lib/risk/store';
import { ENGAGEMENT_KIND_LIST, ENGAGEMENT_KINDS, type EngagementKind } from '@/lib/engagement/kinds';

const SOURCE_LABEL: Partial<Record<RiskSource, string>> = {
  CHECKLIST: 'Csekklista',
  AI_DOCUMENT: 'AI · dokumentum',
  AI_INTERVIEW: 'AI · interjú',
};
const SCALE: Scale5[] = [1, 2, 3, 4, 5];

const RAG_STYLE: Record<Rag, { dot: string; badge: string; cell: string; ring: string }> = {
  GREEN: {
    dot: 'bg-emerald-500',
    badge: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
    cell: 'bg-emerald-100/70',
    ring: 'ring-emerald-500',
  },
  AMBER: {
    dot: 'bg-amber-400',
    badge: 'bg-amber-50 text-amber-800 ring-amber-600/20',
    cell: 'bg-amber-100/80',
    ring: 'ring-amber-500',
  },
  RED: {
    dot: 'bg-red-500',
    badge: 'bg-red-50 text-red-700 ring-red-600/20',
    cell: 'bg-red-100/80',
    ring: 'ring-red-500',
  },
};

interface Props {
  /** Kezdő kockázatlista (élesben a `red_flags` táblából). */
  initialItems?: RiskItem[];
  companyName?: string;
  /** Mentés hook – élesben Supabase upsert / server action. */
  onChange?: (items: RiskItem[]) => void;
}

export default function RedFlagMatrix({ initialItems = DEFAULT_CATALOG, companyName = 'Minta Gyártó Kft.', onChange }: Props) {
  const [items, setItems] = useState<RiskItem[]>(initialItems);
  const [materialityHuf, setMaterialityHuf] = useState(DEFAULT_WORKSPACE.materialityHuf);
  const [kind, setKind] = useState<EngagementKind>(DEFAULT_WORKSPACE.kind);
  const [pillarFilter, setPillarFilter] = useState<Pillar | 'ALL'>('ALL');
  const [onlyIdentified, setOnlyIdentified] = useState(false);
  const [query, setQuery] = useState('');
  const [cell, setCell] = useState<{ l: Scale5; i: Scale5 } | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Munkapéldány visszatöltése (csak kényelmi funkció – a forrás az adatbázis).
  useEffect(() => {
    const ws = loadWorkspace();
    setItems(ws.items);
    setMaterialityHuf(ws.materialityHuf);
    setKind(ws.kind);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    saveWorkspace({ kind, materialityHuf, items });
    onChangeRef.current?.(items);
  }, [items, materialityHuf, kind, hydrated]);

  const result = useMemo(() => assess(items, { materialityHuf }), [items, materialityHuf]);
  const scoredById = useMemo(() => new Map(result.risks.map((r) => [r.id, r])), [result]);

  const visible = items.filter((r) => {
    if (pillarFilter !== 'ALL' && r.pillar !== pillarFilter) return false;
    if (onlyIdentified && !r.identified) return false;
    if (cell && (r.likelihood !== cell.l || r.impact !== cell.i || !r.identified)) return false;
    if (query) {
      const q = query.toLowerCase();
      if (!`${r.code} ${r.title} ${r.description}`.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const update = (id: string, patch: Partial<RiskItem>) =>
    setItems((xs) => xs.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const addCustom = () => {
    const pillar: Pillar = pillarFilter === 'ALL' ? 'FINANCE' : pillarFilter;
    const n = items.filter((r) => r.id.startsWith('CUS-')).length + 1;
    const id = `CUS-${String(n).padStart(2, '0')}-${Date.now().toString(36)}`;
    setItems((xs) => [
      {
        id, code: `CUS-${String(n).padStart(2, '0')}`, pillar,
        title: 'Egyedi kockázat', description: '',
        identified: true, likelihood: 3, impact: 3, exposureHuf: 0, remediationDays: 5,
        remediation: '', division: 'ADVISORY', serviceFeeHuf: 0,
      },
      ...xs,
    ]);
  };

  const reset = () => {
    setItems(initialItems);
    setMaterialityHuf(DEFAULT_WORKSPACE.materialityHuf);
    setCell(null);
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify({ companyName, kind, generatedAt: new Date().toISOString(), materialityHuf, ...result }, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `red-flag-${companyName.replace(/\W+/g, '-').toLowerCase()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const { totals, pillars, actionPlan, pipeline } = result;

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      {/* ── Fejléc ─────────────────────────────────────────────── */}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
            {ENGAGEMENT_KINDS[kind].label} · Red Flag Mátrix
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900">{companyName}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as EngagementKind)}
            aria-label="Átvilágítás típusa"
            className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700"
          >
            {ENGAGEMENT_KIND_LIST.map((k) => <option key={k.kind} value={k.kind}>{k.label}</option>)}
          </select>
          <label className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-600">
            Lényegességi küszöb
            <HufInput value={materialityHuf} onChange={setMaterialityHuf} className="w-32 text-right font-medium text-slate-900" />
          </label>
          <ToolbarButton onClick={reset} icon={<RotateCcw className="h-4 w-4" />}>Alaphelyzet</ToolbarButton>
          <ToolbarButton onClick={exportJson} icon={<Download className="h-4 w-4" />}>JSON</ToolbarButton>
          <ToolbarButton onClick={() => window.print()} icon={<Printer className="h-4 w-4" />} primary>
            Riport nyomtatása
          </ToolbarButton>
        </div>
      </header>

      {/* ── KPI sáv ─────────────────────────────────────────────── */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Kpi label="Összesített státusz" icon={<ShieldAlert className="h-4 w-4" />}>
          <span className="flex items-center gap-2">
            <span className={`h-3 w-3 rounded-full ${RAG_STYLE[totals.rag].dot}`} />
            {RAG_LABEL[totals.rag]}
          </span>
        </Kpi>
        <Kpi label="Health Score" icon={<Gauge className="h-4 w-4" />}>
          {totals.healthScore}
          <span className="text-base font-normal text-slate-400"> / 100</span>
        </Kpi>
        <Kpi label="Bruttó kitettség" icon={<Banknote className="h-4 w-4" />} hint={formatHuf(totals.grossExposureHuf)}>
          {formatHufShort(totals.grossExposureHuf)}
        </Kpi>
        <Kpi label="Várható veszteség" icon={<TrendingDown className="h-4 w-4" />} hint="kitettség × valószínűség">
          {formatHufShort(totals.expectedLossHuf)}
        </Kpi>
        <Kpi label="Azonosított tételek" icon={<Filter className="h-4 w-4" />} className="col-span-2 lg:col-span-1">
          <span className="flex items-baseline gap-3">
            {totals.identified}
            <span className="flex gap-2 text-sm font-medium">
              <span className="text-red-600">{totals.red}●</span>
              <span className="text-amber-500">{totals.amber}●</span>
              <span className="text-emerald-600">{totals.green}●</span>
            </span>
          </span>
        </Kpi>
      </section>

      {/* ── Pillérek + hőtérkép ─────────────────────────────────── */}
      <section className="grid gap-4 lg:grid-cols-[1fr_380px]">
        <div className="grid grid-cols-2 content-start gap-3 md:grid-cols-4">
          {PILLARS.map((p) => {
            const s = pillars[p];
            const active = pillarFilter === p;
            return (
              <button
                key={p}
                onClick={() => setPillarFilter(active ? 'ALL' : p)}
                className={`rounded-lg border bg-white p-4 text-left shadow-sm transition hover:border-slate-300 ${
                  active ? `ring-2 ${RAG_STYLE[s.rag].ring} border-transparent` : 'border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-600">{PILLAR_LABEL[p]}</span>
                  <span className={`h-2.5 w-2.5 rounded-full ${RAG_STYLE[s.rag].dot}`} />
                </div>
                <div className="mt-3 text-3xl font-semibold tabular-nums text-slate-900">{s.healthScore}</div>
                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                  <div className={`h-full ${RAG_STYLE[s.rag].dot}`} style={{ width: `${s.healthScore}%` }} />
                </div>
                <dl className="mt-3 space-y-1 text-xs text-slate-500">
                  <div className="flex justify-between"><dt>Tételek</dt><dd className="tabular-nums text-slate-700">{s.identified}</dd></div>
                  <div className="flex justify-between"><dt>Kitettség</dt><dd className="tabular-nums text-slate-700">{formatHufShort(s.grossExposureHuf)}</dd></div>
                  <div className="flex justify-between"><dt>Várható</dt><dd className="tabular-nums text-slate-700">{formatHufShort(s.expectedLossHuf)}</dd></div>
                </dl>
              </button>
            );
          })}
        </div>

        <HeatMap risks={result.risks} selected={cell} onSelect={setCell} />
      </section>

      {/* ── Kockázati tételek ───────────────────────────────────── */}
      <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 p-3 print:hidden">
          <div className="flex rounded-md bg-slate-100 p-0.5 text-sm">
            {(['ALL', ...PILLARS] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPillarFilter(p)}
                className={`rounded px-3 py-1 ${pillarFilter === p ? 'bg-white font-medium text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
              >
                {p === 'ALL' ? 'Mind' : PILLAR_LABEL[p]}
              </button>
            ))}
          </div>
          <label className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-2 h-4 w-4 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Keresés…"
              className="w-48 rounded-md border border-slate-200 py-1.5 pl-8 pr-2 text-sm outline-none focus:border-slate-400"
            />
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={onlyIdentified} onChange={(e) => setOnlyIdentified(e.target.checked)} className="accent-slate-900" />
            Csak azonosítottak
          </label>
          {cell && (
            <button onClick={() => setCell(null)} className="rounded-full bg-slate-900 px-3 py-1 text-xs text-white">
              Mátrix szűrő: V{cell.l} × H{cell.i} ✕
            </button>
          )}
          <button
            onClick={addCustom}
            className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <Plus className="h-4 w-4" /> Egyedi kockázat
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="w-10 px-3 py-2" />
                <th className="px-3 py-2">Kockázat</th>
                <th className="px-2 py-2 text-center" title="Valószínűség 1–5">Valósz.</th>
                <th className="px-2 py-2 text-center" title="Hatás 1–5">Hatás</th>
                <th className="px-2 py-2 text-center">Pont</th>
                <th className="px-2 py-2 text-right">Kitettség (Ft)</th>
                <th className="px-2 py-2 text-right">Várható</th>
                <th className="px-2 py-2 text-center">Munkanap</th>
                <th className="px-2 py-2">Divízió / díj</th>
                <th className="w-10 px-2 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visible.map((r) => (
                <RiskRow
                  key={r.id}
                  risk={r}
                  scored={scoredById.get(r.id)}
                  onChange={(patch) => update(r.id, patch)}
                  onDelete={r.id.startsWith('CUS-') ? () => setItems((xs) => xs.filter((x) => x.id !== r.id)) : undefined}
                />
              ))}
              {visible.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-3 py-10 text-center text-slate-400">Nincs a szűrésnek megfelelő tétel.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── 90 napos akcióterv ──────────────────────────────────── */}
      <section>
        <SectionTitle icon={<CalendarClock className="h-5 w-5" />} title="90 napos Prioritási Akcióterv" />
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {WINDOWS.map((w) => (
            <div key={w} className={`rounded-lg border border-slate-200 p-3 ${w === 'BACKLOG' ? 'bg-slate-50' : 'bg-white'}`}>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-800">{WINDOW_LABEL[w]}</h3>
                <span className="rounded-full bg-slate-100 px-2 text-xs tabular-nums text-slate-600">{actionPlan[w].length}</span>
              </div>
              <ol className="space-y-2">
                {actionPlan[w].map((r, idx) => (
                  <li key={r.id} className="rounded-md border border-slate-100 bg-white p-2.5 shadow-xs">
                    <div className="flex items-start gap-2">
                      <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${RAG_STYLE[r.rag].dot}`} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium leading-snug text-slate-900">
                          {idx + 1}. {r.title}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-500">{r.remediation || 'Javaslat kitöltendő.'}</p>
                        <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-500">
                          {r.quickWin && (
                            <span className="inline-flex items-center gap-0.5 font-medium text-indigo-600">
                              <Zap className="h-3 w-3" /> Quick win
                            </span>
                          )}
                          <span>{PILLAR_LABEL[r.pillar]}</span>
                          <span>{r.remediationDays} nap</span>
                          <span>{formatHufShort(r.expectedLossHuf)} várható</span>
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
                {actionPlan[w].length === 0 && <li className="py-4 text-center text-xs text-slate-400">—</li>}
              </ol>
            </div>
          ))}
        </div>
      </section>

      {/* ── Keresztértékesítés + kredit ─────────────────────────── */}
      <section className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <SectionTitle icon={<BriefcaseBusiness className="h-5 w-5" />} title="Remediation pipeline divíziónként" compact />
          <div className="space-y-2">
            {DIVISIONS.map((d) => {
              const v = pipeline.byDivision[d];
              const pct = pipeline.totalFeeHuf ? (v.feeHuf / pipeline.totalFeeHuf) * 100 : 0;
              return (
                <div key={d} className="grid grid-cols-[120px_1fr_110px] items-center gap-3 text-sm">
                  <span className="text-slate-600">{DIVISION_LABEL[d]}</span>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-slate-800" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-right tabular-nums text-slate-900">
                    {formatHufShort(v.feeHuf)} <span className="text-xs text-slate-400">({v.count})</span>
                  </span>
                </div>
              );
            })}
          </div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-900 p-4 text-white shadow-sm">
          <h3 className="text-sm font-medium text-slate-300">Beszámítási egyenleg</h3>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-slate-400">Javasolt remediáció</dt><dd className="tabular-nums">{formatHuf(pipeline.totalFeeHuf)}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-400">Audit díj kredit (100%)</dt><dd className="tabular-nums text-emerald-400">− {formatHuf(pipeline.creditHuf)}</dd></div>
            <div className="flex justify-between border-t border-slate-700 pt-2 text-base font-semibold"><dt>Nettó ügyfélnek</dt><dd className="tabular-nums">{formatHuf(pipeline.netAfterCreditHuf)}</dd></div>
          </dl>
          <p className="mt-3 text-xs text-slate-400">
            Csak sárga és piros tételekből képződik lead. A kredit a befizetett {formatHufShort(AUDIT_FEE_HUF)} audit díjig számolható el.
          </p>
        </div>
      </section>
    </div>
  );
}

// ── Részkomponensek ───────────────────────────────────────────────

function RiskRow({
  risk: r,
  scored,
  onChange,
  onDelete,
}: {
  risk: RiskItem;
  scored?: ScoredRisk;
  onChange: (patch: Partial<RiskItem>) => void;
  onDelete?: () => void;
}) {
  const score = r.likelihood * r.impact;
  // A nem azonosított sorokon is mutatjuk, milyen besorolást kapna – halványan.
  const rag: Rag = scored?.rag ?? ragFromScore(score);
  const isCustom = r.id.startsWith('CUS-');

  return (
    <tr className={r.identified ? 'bg-white' : 'bg-white text-slate-400'}>
      <td className="px-3 py-2 align-top">
        <button
          onClick={() => onChange({ identified: !r.identified })}
          aria-label={r.identified ? 'Kockázat kivétele' : 'Kockázat azonosítva'}
          className="mt-0.5 text-slate-700 hover:text-slate-900"
        >
          {r.identified ? <CheckSquare className="h-5 w-5" /> : <Square className="h-5 w-5 text-slate-300" />}
        </button>
      </td>
      <td className="max-w-[420px] px-3 py-2 align-top">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[11px] text-slate-400">{r.code}</span>
          {isCustom ? (
            <select
              value={r.pillar}
              onChange={(e) => onChange({ pillar: e.target.value as Pillar })}
              className="rounded border border-slate-200 bg-transparent text-[11px]"
            >
              {PILLARS.map((p) => <option key={p} value={p}>{PILLAR_LABEL[p]}</option>)}
            </select>
          ) : (
            <span className="text-[11px] text-slate-400">{PILLAR_LABEL[r.pillar]}</span>
          )}
          {r.source && SOURCE_LABEL[r.source] && (
            <span
              className="rounded bg-indigo-50 px-1.5 text-[10px] font-medium text-indigo-700 ring-1 ring-inset ring-indigo-600/20"
              title={r.evidence}
            >
              {SOURCE_LABEL[r.source]}
            </span>
          )}
        </div>
        {isCustom ? (
          <>
            <input value={r.title} onChange={(e) => onChange({ title: e.target.value })} className="mt-0.5 w-full rounded border border-slate-200 px-1.5 py-0.5 font-medium text-slate-900" />
            <input value={r.remediation} onChange={(e) => onChange({ remediation: e.target.value })} placeholder="Javasolt intézkedés…" className="mt-1 w-full rounded border border-slate-200 px-1.5 py-0.5 text-xs" />
            {r.evidence && <p className="mt-1 text-xs italic text-slate-500">{r.evidence}</p>}
          </>
        ) : (
          <>
            <p className={`font-medium ${r.identified ? 'text-slate-900' : ''}`}>{r.title}</p>
            <p className="text-xs text-slate-500">{r.description}</p>
            {r.evidence && <p className="mt-1 text-xs italic text-indigo-700">{r.evidence}</p>}
          </>
        )}
      </td>
      <td className="px-2 py-2 text-center align-top">
        <ScaleSelect value={r.likelihood} onChange={(v) => onChange({ likelihood: v })} />
      </td>
      <td className="px-2 py-2 text-center align-top">
        <ScaleSelect value={r.impact} onChange={(v) => onChange({ impact: v })} />
      </td>
      <td className="px-2 py-2 text-center align-top">
        <span
          className={`inline-flex min-w-[64px] items-center justify-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${
            r.identified ? RAG_STYLE[rag].badge : 'bg-slate-50 text-slate-400 ring-slate-200'
          }`}
          title={scored && scored.score < 15 && rag === 'RED' ? 'Lényegességi küszöb feletti kitettség' : undefined}
        >
          {score} · {RAG_LABEL[rag]}
        </span>
      </td>
      <td className="px-2 py-2 text-right align-top">
        <HufInput value={r.exposureHuf} onChange={(v) => onChange({ exposureHuf: v })} className="w-36 rounded border border-slate-200 px-2 py-1 text-right tabular-nums" />
      </td>
      <td className="px-2 py-2 text-right align-top tabular-nums">{scored ? formatHufShort(scored.expectedLossHuf) : '—'}</td>
      <td className="px-2 py-2 text-center align-top">
        <input
          type="number"
          min={0}
          value={r.remediationDays}
          onChange={(e) => onChange({ remediationDays: Math.max(0, Number(e.target.value) || 0) })}
          className="w-16 rounded border border-slate-200 px-1.5 py-1 text-center tabular-nums"
        />
        {scored?.quickWin && <Zap className="mx-auto mt-1 h-3.5 w-3.5 text-indigo-600" aria-label="Quick win" />}
      </td>
      <td className="px-2 py-2 align-top">
        <select
          value={r.division}
          onChange={(e) => onChange({ division: e.target.value as Division })}
          className="w-full rounded border border-slate-200 bg-white px-1.5 py-1 text-xs"
        >
          {DIVISIONS.map((d) => <option key={d} value={d}>{DIVISION_LABEL[d]}</option>)}
        </select>
        <HufInput value={r.serviceFeeHuf} onChange={(v) => onChange({ serviceFeeHuf: v })} className="mt-1 w-full rounded border border-slate-200 px-1.5 py-0.5 text-right text-xs tabular-nums" />
      </td>
      <td className="px-2 py-2 align-top">
        {onDelete && (
          <button onClick={onDelete} aria-label="Törlés" className="text-slate-300 hover:text-red-600">
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </td>
    </tr>
  );
}

function HeatMap({
  risks,
  selected,
  onSelect,
}: {
  risks: ScoredRisk[];
  selected: { l: Scale5; i: Scale5 } | null;
  onSelect: (c: { l: Scale5; i: Scale5 } | null) => void;
}) {
  const byCell = new Map<string, ScoredRisk[]>();
  for (const r of risks) {
    const k = `${r.likelihood}-${r.impact}`;
    byCell.set(k, [...(byCell.get(k) ?? []), r]);
  }
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-medium text-slate-600">Kockázati mátrix (valószínűség × hatás)</h3>
      <div className="flex gap-1.5">
        <span className="rotate-180 self-center text-[11px] text-slate-400 [writing-mode:vertical-rl]">Valószínűség →</span>
        <div className="grid grid-rows-5 gap-1 pb-9 text-[11px] text-slate-400">
          {[...SCALE].reverse().map((l) => (
            <span key={l} className="flex items-center">{l}</span>
          ))}
        </div>
        <div className="flex-1">
          <div className="grid grid-cols-5 gap-1">
            {[...SCALE].reverse().map((l) =>
              SCALE.map((i) => {
                const list = byCell.get(`${l}-${i}`) ?? [];
                const rag = ragFromScore(l * i);
                const isSel = selected?.l === l && selected?.i === i;
                return (
                  <button
                    key={`${l}-${i}`}
                    onClick={() => onSelect(isSel || list.length === 0 ? null : { l, i })}
                    title={list.map((r) => `${r.code} ${r.title}`).join('\n') || `V${l} × H${i}`}
                    className={`relative flex aspect-square items-center justify-center rounded text-xs font-semibold transition ${RAG_STYLE[rag].cell} ${
                      isSel ? 'ring-2 ring-slate-900' : ''
                    } ${list.length ? 'cursor-pointer text-slate-900 hover:brightness-95' : 'cursor-default text-transparent'}`}
                  >
                    {list.length || '·'}
                  </button>
                );
              }),
            )}
          </div>
          <div className="mt-1 grid grid-cols-5 text-center text-[11px] text-slate-400">
            {SCALE.map((i) => <span key={i}>{i}</span>)}
          </div>
          <p className="text-center text-[11px] text-slate-400">Hatás →</p>
        </div>
      </div>
    </div>
  );
}

function ScaleSelect({ value, onChange }: { value: Scale5; onChange: (v: Scale5) => void }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(Number(e.target.value) as Scale5)}
      className="rounded border border-slate-200 bg-white px-1.5 py-1 tabular-nums"
    >
      {SCALE.map((n) => <option key={n} value={n}>{n}</option>)}
    </select>
  );
}

/** Forint mező: fókuszban nyers szám, egyébként ezres tagolással. */
function HufInput({ value, onChange, className = '' }: { value: number; onChange: (v: number) => void; className?: string }) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <input
      inputMode="numeric"
      value={draft ?? value.toLocaleString('hu-HU')}
      onFocus={() => setDraft(String(value))}
      onChange={(e) => {
        const digits = e.target.value.replace(/[^\d]/g, '');
        setDraft(digits);
        onChange(digits ? Number(digits) : 0);
      }}
      onBlur={() => setDraft(null)}
      className={`bg-white outline-none focus:border-slate-400 ${className}`}
    />
  );
}

function Kpi({
  label,
  icon,
  hint,
  className = '',
  children,
}: {
  label: string;
  icon: ReactNode;
  hint?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`rounded-lg border border-slate-200 bg-white p-4 shadow-sm ${className}`} title={hint}>
      <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
        {icon}
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold tabular-nums text-slate-900">{children}</div>
    </div>
  );
}

function ToolbarButton({
  onClick,
  icon,
  primary,
  children,
}: {
  onClick: () => void;
  icon: ReactNode;
  primary?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium ${
        primary ? 'bg-slate-900 text-white hover:bg-slate-800' : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
      }`}
    >
      {icon}
      {children}
    </button>
  );
}

function SectionTitle({ icon, title, compact }: { icon: ReactNode; title: string; compact?: boolean }) {
  return (
    <h2 className={`flex items-center gap-2 font-semibold text-slate-900 ${compact ? 'mb-3 text-sm' : 'mb-3 text-lg'}`}>
      {icon}
      {title}
    </h2>
  );
}
