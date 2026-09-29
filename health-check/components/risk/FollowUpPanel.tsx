'use client';

import { useEffect, useMemo, useState } from 'react';
import { Camera, History, Trash2 } from 'lucide-react';
import { RAG_LABEL } from '@/lib/risk/catalog';
import { formatHufShort, type EngineOptions } from '@/lib/risk/engine';
import {
  CHANGE_LABEL,
  compare,
  loadSnapshots,
  REMEDIATION_LABEL,
  saveSnapshots,
  takeSnapshot,
  type ChangeKind,
  type Snapshot,
} from '@/lib/risk/followup';
import type { RemediationStatus, RiskAssessment, RiskItem } from '@/lib/risk/types';

const STATUSES: RemediationStatus[] = ['OPEN', 'IN_PROGRESS', 'DONE', 'ACCEPTED_RISK'];
const CHANGE_STYLE: Record<ChangeKind, string> = {
  RESOLVED: 'bg-emerald-100 text-emerald-800',
  IMPROVED: 'bg-emerald-50 text-emerald-700',
  UNCHANGED: 'bg-slate-100 text-slate-600',
  WORSENED: 'bg-red-100 text-red-800',
  NEW: 'bg-amber-100 text-amber-800',
  ACCEPTED: 'bg-sky-100 text-sky-800',
};

/**
 * Utókövetés: tételenkénti javítási állapot, kiinduló pillanatkép, és
 * 3–6 hónap múlva összevetés (mi oldódott meg, mi romlott, mi új).
 */
export default function FollowUpPanel({
  scenarioId,
  kind,
  items,
  opts,
  result,
  onStatus,
}: {
  scenarioId: string;
  kind: string;
  items: RiskItem[];
  opts: Partial<EngineOptions>;
  result: RiskAssessment;
  onStatus: (id: string, status: RemediationStatus) => void;
}) {
  const [open, setOpen] = useState(false);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  useEffect(() => {
    const list = loadSnapshots(scenarioId);
    setSnapshots(list);
    setSelected(list[0]?.id ?? null);
  }, [scenarioId]);

  const snap = snapshots.find((s) => s.id === selected) ?? null;
  const cmp = useMemo(() => (snap ? compare(snap, items, opts) : null), [snap, items, opts]);
  const identified = items.filter((r) => r.identified);
  const statusCount = STATUSES.map((s) => [s, identified.filter((r) => (r.remediationStatus ?? 'OPEN') === s).length] as const);

  const save = () => {
    const label = `Pillanatkép ${new Date().toLocaleDateString('hu-HU')}`;
    const list = [takeSnapshot(result, label, kind), ...snapshots];
    setSnapshots(list);
    setSelected(list[0].id);
    saveSnapshots(scenarioId, list);
  };
  const remove = (id: string) => {
    const list = snapshots.filter((s) => s.id !== id);
    setSnapshots(list);
    setSelected(list[0]?.id ?? null);
    saveSnapshots(scenarioId, list);
  };

  return (
    <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <button onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left">
        <span className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <History className="h-4 w-4" /> Utókövetés – javítások állapota és összevetés
        </span>
        <span className="text-xs text-slate-500">
          {open ? 'Bezár' : statusCount.map(([s, n]) => `${REMEDIATION_LABEL[s]}: ${n}`).join(' · ')}
        </span>
      </button>
      {open && (
        <div className="grid gap-4 border-t border-slate-100 p-4 lg:grid-cols-2">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Javítások állapota</h3>
            <ul className="mt-2 max-h-96 divide-y divide-slate-100 overflow-auto rounded-md border border-slate-100 text-sm">
              {identified.map((r) => (
                <li key={r.id} className="flex items-center gap-2 px-3 py-1.5">
                  <span className="w-14 font-mono text-[11px] text-slate-400">{r.code}</span>
                  <span className="min-w-0 flex-1 truncate text-slate-800">{r.title}</span>
                  <select
                    value={r.remediationStatus ?? 'OPEN'}
                    onChange={(e) => onStatus(r.id, e.target.value as RemediationStatus)}
                    aria-label={`Javítás állapota: ${r.title}`}
                    className="rounded border border-slate-200 bg-white px-1 py-0.5 text-xs"
                  >
                    {STATUSES.map((s) => <option key={s} value={s}>{REMEDIATION_LABEL[s]}</option>)}
                  </select>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-slate-500">
              „Kész”: a tétel az összevetésben megoldottnak számít. „Elfogadott kockázat”: a vezetés tudatosan vállalja, a tétel marad, de külön jelöljük.
            </p>
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-2">
              <button onClick={save} className="inline-flex items-center gap-1.5 rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800">
                <Camera className="h-3.5 w-3.5" /> Pillanatkép a mostani állapotról
              </button>
              {snapshots.length > 0 && (
                <select value={selected ?? ''} onChange={(e) => setSelected(e.target.value)} aria-label="Összevetés ezzel" className="rounded-md border border-slate-200 px-2 py-1 text-xs">
                  {snapshots.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
              )}
              {snap && (
                <button onClick={() => remove(snap.id)} aria-label="Pillanatkép törlése" className="text-slate-400 hover:text-red-600">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            {!cmp && (
              <p className="mt-3 text-sm text-slate-500">
                Az átvilágítás zárásakor ments pillanatképet. A visszanéző Health Checknél (3–6 hónap múlva) ehhez méri a program, mi oldódott meg, mi
                romlott és mi új.
              </p>
            )}
            {cmp && (
              <>
                <dl className="mt-3 grid grid-cols-3 gap-2 text-center text-sm">
                  <Kpi label="Health Score" before={cmp.snapshot.totals.healthScore} after={cmp.now.healthScore} />
                  <Kpi label="Piros tétel" before={cmp.snapshot.totals.red} after={cmp.now.red} lowerIsBetter />
                  <Kpi label="Várható veszteség" before={cmp.snapshot.totals.expectedLossHuf} after={cmp.now.expectedLossHuf} lowerIsBetter money />
                </dl>
                <p className="mt-2 text-xs text-slate-500">
                  {(Object.keys(CHANGE_LABEL) as ChangeKind[]).filter((k) => cmp.counts[k]).map((k) => `${CHANGE_LABEL[k]}: ${cmp.counts[k]}`).join(' · ')}
                </p>
                <ul className="mt-2 max-h-72 divide-y divide-slate-100 overflow-auto rounded-md border border-slate-100 text-sm">
                  {cmp.changes.map((c) => (
                    <li key={c.id} className="flex items-center gap-2 px-3 py-1.5">
                      <span className={`w-28 shrink-0 rounded px-1.5 text-center text-[11px] font-medium ${CHANGE_STYLE[c.change]}`}>{CHANGE_LABEL[c.change]}</span>
                      <span className="min-w-0 flex-1 truncate text-slate-800">{c.code} {c.title}</span>
                      <span className="text-xs tabular-nums text-slate-500">
                        {c.before ? `${RAG_LABEL[c.before.rag]} ${c.before.score}` : '—'} → {c.after ? `${RAG_LABEL[c.after.rag]} ${c.after.score}` : 'megoldva'}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function Kpi({ label, before, after, lowerIsBetter, money }: { label: string; before: number; after: number; lowerIsBetter?: boolean; money?: boolean }) {
  const better = lowerIsBetter ? after < before : after > before;
  const worse = lowerIsBetter ? after > before : after < before;
  const f = (n: number) => (money ? formatHufShort(n) : String(n));
  return (
    <div className="rounded-md bg-slate-50 p-2">
      <dt className="text-[11px] text-slate-500">{label}</dt>
      <dd className="mt-0.5 tabular-nums">
        <span className="text-slate-500">{f(before)}</span> →{' '}
        <b className={better ? 'text-emerald-700' : worse ? 'text-red-700' : 'text-slate-900'}>{f(after)}</b>
      </dd>
    </div>
  );
}
