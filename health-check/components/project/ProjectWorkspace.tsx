'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import ModuleOff from '../ModuleOff';
import { useModules } from '../useModules';
import { useIdentity } from '../Identity';
import { PROJECT_MODULES } from '@/lib/modules';
import { BookOpen, Clock, Plus, Trash2 } from 'lucide-react';
import { adjustmentsFor } from '@/lib/engagement/adjustments';
import { ENGAGEMENT_KIND_LIST, ENGAGEMENT_KINDS, type EngagementKind } from '@/lib/engagement/kinds';
import { SECTOR_LABEL, type Sector } from '@/lib/intake/requests';
import { loadIntake } from '@/lib/intake/state';
import {
  anonymize,
  calibrations,
  commonButMissing,
  demoRecords,
  filterRecords,
  loadBenchmark,
  REVENUE_BAND_LABEL,
  revenueBand,
  saveBenchmark,
  stats,
  upsertRecord,
  type BenchmarkRecord,
  type RevenueBand,
} from '@/lib/learning/benchmark';
import { PILLAR_LABEL } from '@/lib/risk/catalog';
import { assess, formatHufShort } from '@/lib/risk/engine';
import { DEFAULT_WORKSPACE, loadWorkspace, type Workspace } from '@/lib/risk/store';
import { getScenario } from '@/lib/scenarios';
import {
  addEntry,
  BUCKET_LABEL_PM,
  budgetFor,
  EMPTY_TIMESHEET,
  loadTimesheet,
  removeEntry,
  ROLE_LABEL,
  saveTimesheet,
  summarize,
  validateEntry,
  type Bucket,
  type BurnLevel,
  type Role,
  type TimesheetState,
} from '@/lib/timesheet/timesheet';

const BUCKET_LABEL: Record<Bucket, string> = { ...PILLAR_LABEL, PM: BUCKET_LABEL_PM };
const BAR: Record<BurnLevel, string> = { OK: 'bg-emerald-500', WARN: 'bg-amber-500', OVER: 'bg-red-600' };
const today = () => new Date().toISOString().slice(0, 10);

/**
 * Projekt oldal: időkeret (óraszám-követés, költség, fedezet) és tudástár
 * (anonim tapasztalatok a lezárt projektekből).
 */
export default function ProjectWorkspace() {
  const [ws, setWs] = useState<Workspace>(DEFAULT_WORKSPACE);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const { isOn } = useModules();
  useEffect(() => {
    const w = loadWorkspace();
    setWs(w);
    setSectors([...new Set([...loadIntake(w.projectId).profile.sectors, ...(getScenario(w.scenarioId).sectors ?? [])])]);
    setHydrated(true);
  }, []);

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <header>
        <h1 className="text-xl font-semibold text-slate-900">Projekt</h1>
        <p className="mt-1 text-sm text-slate-600">
          {ws.companyName} · {ENGAGEMENT_KINDS[ws.kind].label}. Az időkeret és a tudástár a Red Flag mátrixban kiválasztott projekthez tartozik.
        </p>
      </header>
      {hydrated && isOn('TIMESHEET') && <TimesheetSection key={ws.projectId} projectId={ws.projectId} kind={ws.kind} />}
      {!PROJECT_MODULES.some(isOn) && <ModuleOff ids={PROJECT_MODULES} />}
      {hydrated && isOn('KNOWLEDGE') && <KnowledgeSection ws={ws} sectors={sectors} />}
    </div>
  );
}

function TimesheetSection({ projectId, kind }: { projectId: string; kind: EngagementKind }) {
  const [state, setState] = useState<TimesheetState>(EMPTY_TIMESHEET);
  const [loaded, setLoaded] = useState(false);
  const [draft, setDraft] = useState({ date: today(), bucket: 'FINANCE' as Bucket, role: 'SENIOR' as Role, hours: '1', note: '' });
  // A rögzítő mindig az aktuális felhasználó (bejelentkezve a profilja, különben az egyszer megadott név).
  const me = useIdentity();
  const [nameDraft, setNameDraft] = useState('');
  const [editingName, setEditingName] = useState(false);
  useEffect(() => {
    if (me.role) setDraft((d) => ({ ...d, role: me.role! }));
  }, [me.role]);
  const [error, setError] = useState<string | null>(null);
  const [showRates, setShowRates] = useState(false);
  useEffect(() => {
    setState(loadTimesheet(projectId));
    setLoaded(true);
  }, [projectId]);
  useEffect(() => {
    if (loaded) saveTimesheet(projectId, state);
  }, [state, projectId, loaded]);

  const sum = useMemo(() => summarize(state, kind, BUCKET_LABEL), [state, kind]);

  const add = () => {
    if (!me.name) {
      setError('Előbb add meg a neved (egyszer kell).');
      return;
    }
    const entry = { ...draft, hours: Number(draft.hours.replace(',', '.')), person: me.name, note: draft.note.trim() };
    const err = validateEntry(entry);
    setError(err);
    if (err) return;
    setState((s) => addEntry(s, entry));
    setDraft((d) => ({ ...d, hours: '1', note: '' }));
  };

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
        <Clock className="h-4 w-4" /> Időkeret – ráfordított órák, költség, fedezet
      </h2>
      <dl className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
        <Stat label="Felhasznált / keret" value={`${fmt(sum.used)} / ${sum.budget} óra`} tone={sum.level} />
        <Stat label="Belső költség" value={formatHufShort(sum.costHuf)} />
        <Stat label="Díj" value={formatHufShort(sum.feeHuf)} />
        <Stat label="Fedezet" value={`${formatHufShort(sum.marginHuf)} (${Math.round(sum.marginPct * 100)}%)`} tone={sum.marginHuf < 0 ? 'OVER' : 'OK'} />
      </dl>

      <div className="mt-4 grid gap-2 sm:grid-cols-5">
        {sum.buckets.map((b) => (
          <div key={b.bucket} className="rounded-md bg-slate-50 p-2 text-xs">
            <div className="flex justify-between text-slate-600">
              <span>{BUCKET_LABEL[b.bucket]}</span>
              <span className="tabular-nums">
                {fmt(b.used)} / {b.budget} ó
              </span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded bg-slate-200">
              <div className={`h-full ${BAR[b.level]}`} style={{ width: `${Math.min(100, b.ratio * 100)}%` }} />
            </div>
            {b.level !== 'OK' && (
              <p className={`mt-0.5 text-xs font-medium ${b.level === 'OVER' ? 'text-red-700' : 'text-amber-700'}`}>{b.level === 'OVER' ? 'Túllépés' : '80% felett'}</p>
            )}
          </div>
        ))}
      </div>
      {sum.warnings.length > 0 && (
        <ul className="mt-3 space-y-1 rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
          {sum.warnings.map((w) => <li key={w}>{w}</li>)}
        </ul>
      )}

      <div className="mt-4 flex flex-wrap items-end gap-2 text-xs">
        <Labeled label="Dátum">
          <input type="date" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} className="rounded border border-slate-200 px-2 py-1" />
        </Labeled>
        <Labeled label="Terület">
          <select value={draft.bucket} onChange={(e) => setDraft({ ...draft, bucket: e.target.value as Bucket })} className="rounded border border-slate-200 px-2 py-1">
            {budgetFor(kind).map((b) => <option key={b.bucket} value={b.bucket}>{BUCKET_LABEL[b.bucket]}</option>)}
          </select>
        </Labeled>
        <Labeled label="Szerepkör">
          <select value={draft.role} onChange={(e) => setDraft({ ...draft, role: e.target.value as Role })} className="rounded border border-slate-200 px-2 py-1">
            {(Object.keys(ROLE_LABEL) as Role[]).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
          </select>
        </Labeled>
        <Labeled label="Rögzítő">
          {me.name && !editingName ? (
            <span className="flex items-center gap-1 py-1 text-slate-800">
              {me.name}
              {me.source === 'login' ? (
                <span className="text-xs text-slate-500">(bejelentkezve)</span>
              ) : (
                <button
                  onClick={() => {
                    setNameDraft(me.name ?? '');
                    setEditingName(true);
                  }}
                  className="text-xs text-slate-500 underline hover:text-slate-700"
                >
                  módosít
                </button>
              )}
            </span>
          ) : me.source === 'local' ? (
            <span className="flex gap-1">
              <input
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                placeholder="a neved"
                aria-label="A neved"
                className="w-32 rounded border border-amber-300 bg-amber-50 px-2 py-1"
              />
              <button
                onClick={() => {
                  if (nameDraft.trim().length < 2) return;
                  me.setLocalName?.(nameDraft);
                  setEditingName(false);
                  setError(null);
                }}
                className="rounded border border-slate-200 px-2 text-slate-700 hover:bg-slate-50"
              >
                OK
              </button>
            </span>
          ) : (
            <span className="py-1 text-slate-500">…</span>
          )}
        </Labeled>
        <Labeled label="Óra">
          <input value={draft.hours} onChange={(e) => setDraft({ ...draft, hours: e.target.value })} inputMode="decimal" className="w-16 rounded border border-slate-200 px-2 py-1" />
        </Labeled>
        <Labeled label="Tevékenység">
          <input value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} placeholder="pl. interjú a pénzügyi vezetővel" className="w-64 rounded border border-slate-200 px-2 py-1" />
        </Labeled>
        <button onClick={add} className="inline-flex items-center gap-1 rounded-md bg-slate-900 px-3 py-1.5 font-medium text-white hover:bg-slate-800">
          <Plus className="h-3.5 w-3.5" /> Rögzítés
        </button>
        <button onClick={() => setShowRates((v) => !v)} className="ml-auto text-slate-500 underline hover:text-slate-800">
          Óraköltségek és díj
        </button>
      </div>
      {error && <p className="mt-1 text-xs text-red-700">{error}</p>}
      {showRates && (
        <div className="mt-3 flex flex-wrap items-end gap-3 rounded-md bg-slate-50 p-3 text-xs">
          {(Object.keys(ROLE_LABEL) as Role[]).map((r) => (
            <Labeled key={r} label={`${ROLE_LABEL[r]} (Ft/óra)`}>
              <input
                value={state.rates[r]}
                onChange={(e) => setState((s) => ({ ...s, rates: { ...s.rates, [r]: Number(e.target.value.replace(/\D/g, '')) || 0 } }))}
                inputMode="numeric"
                className="w-24 rounded border border-slate-200 px-2 py-1"
              />
            </Labeled>
          ))}
          <Labeled label="Projekt díja (Ft)">
            <input
              value={state.feeHuf}
              onChange={(e) => setState((s) => ({ ...s, feeHuf: Number(e.target.value.replace(/\D/g, '')) || 0 }))}
              inputMode="numeric"
              className="w-28 rounded border border-slate-200 px-2 py-1"
            />
          </Labeled>
          <p className="w-full text-slate-500">Az óraköltségek TERVEZET értékek; a vezetés véglegesíti őket.</p>
        </div>
      )}

      {state.entries.length > 0 && (
        <table className="mt-4 w-full text-left text-xs">
          <thead className="text-slate-500">
            <tr>
              <th className="py-1">Dátum</th>
              <th>Terület</th>
              <th>Rögzítő</th>
              <th>Szerepkör</th>
              <th className="text-right">Óra</th>
              <th className="pl-3">Tevékenység</th>
              <th />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {state.entries.map((e) => (
              <tr key={e.id}>
                <td className="py-1 tabular-nums">{e.date}</td>
                <td>{BUCKET_LABEL[e.bucket]}</td>
                <td>{e.person || '—'}</td>
                <td>{ROLE_LABEL[e.role]}</td>
                <td className="text-right tabular-nums">{fmt(e.hours)}</td>
                <td className="pl-3 text-slate-600">{e.note}</td>
                <td className="text-right">
                  <button onClick={() => setState((s) => removeEntry(s, e.id))} aria-label="Bejegyzés törlése" className="text-slate-500 hover:text-red-600">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

function KnowledgeSection({ ws, sectors }: { ws: Workspace; sectors: Sector[] }) {
  const [own, setOwn] = useState<BenchmarkRecord[]>([]);
  const [withDemo, setWithDemo] = useState(true);
  const [kind, setKind] = useState<EngagementKind | ''>('');
  const [sector, setSector] = useState<Sector | ''>(sectors[0] ?? '');
  const [band, setBand] = useState<RevenueBand | ''>('');
  const [note, setNote] = useState<string | null>(null);
  useEffect(() => setOwn(loadBenchmark()), []);

  const demo = useMemo(() => demoRecords(), []);
  const all = useMemo(() => [...own, ...(withDemo ? demo : [])], [own, demo, withDemo]);
  const records = useMemo(() => filterRecords(all, { kind: kind || null, sector: sector || null, revenueBand: band || null }), [all, kind, sector, band]);
  const s = useMemo(() => stats(records), [records]);
  const cal = calibrations(s);
  const current = useMemo(
    () => assess(ws.items, { company: ws.company, materialityHuf: ws.materialityHuf, adjustments: adjustmentsFor(ws.kind), pillarWeights: ENGAGEMENT_KINDS[ws.kind].weights }),
    [ws],
  );
  const missing = commonButMissing(s, current.risks.map((r) => r.code));

  const record = () => {
    const rec = anonymize(current, { ref: ws.projectId, kind: ws.kind, sectors, revenueHuf: ws.company.revenueHuf });
    const list = upsertRecord(own, rec);
    setOwn(list);
    saveBenchmark(list);
    setNote(`Felvéve anonimizálva: ${ENGAGEMENT_KINDS[ws.kind].label}, ${sectors.map((x) => SECTOR_LABEL[x]).join(', ') || 'ágazat nélkül'}, ${REVENUE_BAND_LABEL[revenueBand(ws.company.revenueHuf)]}, ${rec.items.length} tétel.`);
  };
  const remove = (id: string) => {
    const list = own.filter((r) => r.id !== id);
    setOwn(list);
    saveBenchmark(list);
  };

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <BookOpen className="h-4 w-4" /> Tudástár – tapasztalatok a lezárt projektekből
        </h2>
        <button onClick={record} className="ml-auto inline-flex items-center gap-1 rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800">
          <Plus className="h-3.5 w-3.5" /> Aktuális projekt felvétele (anonimizálva)
        </button>
      </div>
      <p className="mt-1 text-xs text-slate-500">
        A projekt zárásakor vedd fel. Csak a típus, az ágazat, az árbevétel-sáv és a katalógustételek besorolása kerül be; cégnév, bizonyíték, összeg és az
        egyedi tételek címe nem.
      </p>
      {note && <p className="mt-2 rounded bg-emerald-50 px-2 py-1 text-xs text-emerald-800">{note}</p>}

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        <select value={kind} onChange={(e) => setKind(e.target.value as EngagementKind | '')} aria-label="Típus" className="rounded border border-slate-200 px-2 py-1">
          <option value="">Minden típus</option>
          {ENGAGEMENT_KIND_LIST.map((k) => <option key={k.kind} value={k.kind}>{k.label}</option>)}
        </select>
        <select value={sector} onChange={(e) => setSector(e.target.value as Sector | '')} aria-label="Ágazat" className="rounded border border-slate-200 px-2 py-1">
          <option value="">Minden ágazat</option>
          {(Object.keys(SECTOR_LABEL) as Sector[]).map((x) => <option key={x} value={x}>{SECTOR_LABEL[x]}</option>)}
        </select>
        <select value={band} onChange={(e) => setBand(e.target.value as RevenueBand | '')} aria-label="Árbevétel" className="rounded border border-slate-200 px-2 py-1">
          <option value="">Minden méret</option>
          {(Object.keys(REVENUE_BAND_LABEL) as RevenueBand[]).map((b) => <option key={b} value={b}>{REVENUE_BAND_LABEL[b]}</option>)}
        </select>
        <label className="inline-flex items-center gap-1 text-slate-600">
          <input type="checkbox" checked={withDemo} onChange={(e) => setWithDemo(e.target.checked)} /> bemutató (kitalált) rekordokkal
        </label>
        <span className="ml-auto text-slate-500">
          {s.n} projekt{s.avgHealth != null && ` · átlagos Health Score ${s.avgHealth} (ez a projekt: ${current.totals.healthScore})`}
          {s.avgRed != null && ` · átlag ${s.avgRed} piros tétel`}
        </span>
      </div>

      {s.n === 0 ? (
        <p className="mt-3 text-sm text-slate-500">Nincs a szűrésnek megfelelő projekt. Lazíts a szűrésen, vagy vegyél fel lezárt projektet.</p>
      ) : (
        <div className="mt-3 grid gap-4 lg:grid-cols-2">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Leggyakoribb tételek</h3>
            <table className="mt-2 w-full text-left text-xs">
              <thead className="text-slate-500">
                <tr>
                  <th className="py-1">Tétel</th>
                  <th className="text-right">Gyakoriság</th>
                  <th className="text-right">Átl. V×H</th>
                  <th className="text-right">Piros</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {s.codes.slice(0, 15).map((c) => (
                  <tr key={c.code}>
                    <td className="py-1">
                      <span className="font-mono text-slate-500">{c.code}</span> {c.title}
                    </td>
                    <td className="text-right tabular-nums">
                      {c.count}/{s.n} ({Math.round(c.frequency * 100)}%)
                    </td>
                    <td className="text-right tabular-nums">
                      {fmt(c.avgLikelihood)}×{fmt(c.avgImpact)}
                    </td>
                    <td className="text-right tabular-nums">{Math.round(c.redShare * 100)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {s.customCount > 0 && <p className="mt-1 text-xs text-slate-500">Ezen felül {s.customCount} egyedi (katalóguson kívüli) tétel.</p>}
          </div>
          <div className="space-y-4">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Hasonló projektekben gyakori, itt nincs jelölve</h3>
              {missing.length === 0 ? (
                <p className="mt-2 text-xs text-slate-500">Nincs ilyen tétel (vagy kevés a hasonló projekt).</p>
              ) : (
                <ul className="mt-2 space-y-1 text-xs">
                  {missing.map((c) => (
                    <li key={c.code} className="rounded bg-amber-50 px-2 py-1 text-amber-900">
                      <b>{c.code}</b> {c.title} – {Math.round(c.frequency * 100)}%-ban előfordult. Érdemes rákérdezni.
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Katalógus-kalibrálási javaslat</h3>
              {cal.length === 0 ? (
                <p className="mt-2 text-xs text-slate-500">Legalább 3 projekt kell tételenként, és 1 pontos eltérés a katalógus alapértékétől.</p>
              ) : (
                <ul className="mt-2 space-y-1 text-xs">
                  {cal.map((c) => (
                    <li key={c.code} className="rounded bg-slate-50 px-2 py-1">
                      <b>{c.code}</b> {c.title}: katalógus V{c.catalogLikelihood}×H{c.catalogImpact}, a tapasztalat ({c.n} projekt) V{fmt(c.observedLikelihood)}×H
                      {fmt(c.observedImpact)}.
                    </li>
                  ))}
                  <li className="text-slate-500">A katalógust a szakértő módosítja; a program csak jelzi az eltérést.</li>
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      {own.length > 0 && (
        <details className="mt-4 text-xs">
          <summary className="cursor-pointer text-slate-600">Felvett projektek ({own.length})</summary>
          <ul className="mt-2 divide-y divide-slate-100">
            {own.map((r) => (
              <li key={r.id} className="flex items-center gap-2 py-1">
                <span className="tabular-nums text-slate-500">{r.closedAt}</span>
                <span className="flex-1">
                  {ENGAGEMENT_KINDS[r.kind].label} · {r.sectors.map((x) => SECTOR_LABEL[x]).join(', ') || '—'} · {REVENUE_BAND_LABEL[r.revenueBand]} · Health Score {r.healthScore}
                </span>
                <button onClick={() => remove(r.id)} aria-label="Rekord törlése" className="text-slate-500 hover:text-red-600">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

const fmt = (n: number) => n.toLocaleString('hu-HU', { maximumFractionDigits: 2 });

function Stat({ label, value, tone }: { label: string; value: string; tone?: BurnLevel }) {
  const color = tone === 'OVER' ? 'text-red-700' : tone === 'WARN' ? 'text-amber-700' : 'text-slate-900';
  return (
    <div className="rounded-md bg-slate-50 p-2">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className={`mt-0.5 font-semibold tabular-nums ${color}`}>{value}</dd>
    </div>
  );
}

function Labeled({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-0.5 text-slate-500">
      {label}
      {children}
    </label>
  );
}
