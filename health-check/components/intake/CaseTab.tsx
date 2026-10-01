'use client';

import { DiscardedList } from '@/components/DiscardedList';
import { useMemo, useRef, useState } from 'react';
import { ClipboardCopy, Loader2, Plus, Sparkles, Trash2 } from 'lucide-react';
import type { EngagementKind } from '@/lib/engagement/kinds';
import type { CaseSuggestion } from '@/lib/intake/casePrompts';
import {
  FLAG_LABEL,
  requestListText,
  SECTOR_LABEL,
  SOURCE_LABEL,
  STATUS_LABEL,
  type CaseFlag,
  type CaseProfile,
  type DocRequest,
  type RequestStatus,
  type Sector,
} from '@/lib/intake/requests';
import { SAMPLE_PROFILES } from '@/lib/intake/samples/profiles';
import { requestList, type IntakeState } from '@/lib/intake/state';
import { TABLE_SPECS } from '@/lib/intake/tables/spec';
import { PILLAR_LABEL } from '@/lib/risk/catalog';
import { PILLARS } from '@/lib/risk/engine';
import type { Pillar } from '@/lib/risk/types';
import { useAiBackend } from '@/components/AiBackendContext';
import RegistryCard from './RegistryCard';
import { useModules } from '../useModules';

const FLAGS = Object.keys(FLAG_LABEL) as CaseFlag[];
const SECTORS = Object.keys(SECTOR_LABEL) as Sector[];
const STATUSES: RequestStatus[] = ['REQUESTED', 'RECEIVED', 'MISSING', 'NA'];
const STATUS_STYLE: Record<RequestStatus, string> = {
  REQUESTED: 'bg-brand-600 text-white ring-brand-600',
  RECEIVED: 'bg-emerald-600 text-white ring-emerald-600',
  MISSING: 'bg-red-600 text-white ring-red-600',
  NA: 'bg-slate-400 text-white ring-slate-400',
};

export default function CaseTab({
  intake,
  update,
  kind,
  companyName,
  scenarioId,
  aiReady,
  onSectorsChange,
}: {
  intake: IntakeState;
  update: (patch: Partial<IntakeState>) => void;
  kind: EngagementKind;
  companyName: string;
  scenarioId: string;
  aiReady: boolean | null;
  /** Visszaadja, hány ágazati tétel került a mátrixba. */
  onSectorsChange: (sectors: Sector[]) => number;
}) {
  const backend = useAiBackend();
  const profile = intake.profile;
  const modules = useModules();
  const profileRef = useRef(profile);
  profileRef.current = profile;
  const list = useMemo(() => requestList(intake, kind), [intake, kind]);
  const [suggestion, setSuggestion] = useState<CaseSuggestion | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showText, setShowText] = useState(false);
  const [copied, setCopied] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newPillar, setNewPillar] = useState<Pillar>('LEGAL');

  const setProfile = (patch: Partial<CaseProfile>) => update({ profile: { ...profileRef.current, ...patch } });
  const [sectorNote, setSectorNote] = useState<string | null>(null);
  /** Ágazatváltáskor az ágazati kockázatok pipálható sorként a mátrixba kerülnek. */
  const setSectors = (sectors: Sector[]) => {
    setProfile({ sectors });
    const added = onSectorsChange(sectors);
    setSectorNote(added > 0 ? `${added} ágazati kockázati tétel került a Red Flag mátrixba (pipálatlanul).` : null);
  };
  const toggleFlag = (f: CaseFlag) => setProfile({ flags: profile.flags.includes(f) ? profile.flags.filter((x) => x !== f) : [...profile.flags, f] });
  const setStatus = (id: string, s: RequestStatus) => update({ requestStatus: { ...intake.requestStatus, [id]: s } });
  const addExtra = (d: Omit<DocRequest, 'id'>) =>
    update({ extraRequests: [...intake.extraRequests, { ...d, id: `X${Date.now().toString(36)}${intake.extraRequests.length}` }] });

  const askAi = async () => {
    setBusy(true);
    setError(null);
    try {
      setSuggestion(await backend.suggestCase({ profile, kind, companyName, current: list }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Az AI-javaslat nem sikerült.');
    } finally {
      setBusy(false);
    }
  };

  const counts = STATUSES.map((s) => [s, list.filter((d) => (intake.requestStatus[d.id] ?? 'REQUESTED') === s).length] as const);
  const text = requestListText(companyName, list, intake.requestStatus);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setShowText(true);
    }
  };

  return (
    <section className="grid gap-5 lg:grid-cols-[420px_minmax(0,1fr)]">
      {/* ── Tényállás ─────────────────────────────────────── */}
      <div className="space-y-4">
        <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-bold tracking-tight text-slate-900">Előzetes tényállás</h2>
            {SAMPLE_PROFILES[scenarioId] && (
              <button
                onClick={() => {
                  update({ profile: SAMPLE_PROFILES[scenarioId] });
                  onSectorsChange(SAMPLE_PROFILES[scenarioId].sectors);
                }}
                className="rounded-lg border border-brand-200 bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700 hover:bg-brand-100"
              >
                Minta tényállás
              </button>
            )}
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Az első egyeztetés után rögzítsd. Ebből áll össze az iratlista: az alap iratkör mindig benne van, a többit a cél, az ágazat, a létszám és a
            jellemzők adják.
          </p>
          <p className="mt-3 text-xs font-medium text-slate-600">Ágazat (több is lehet)</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {SECTORS.map((sec) => {
              const on = profile.sectors.includes(sec);
              return (
                <button
                  key={sec}
                  onClick={() => setSectors(on ? profile.sectors.filter((x) => x !== sec) : [...profile.sectors, sec])}
                  aria-pressed={on}
                  className={`rounded-full px-2.5 py-1 text-xs ring-1 ring-inset ${
                    on ? 'bg-brand-600 text-white ring-brand-600' : 'bg-white text-slate-600 ring-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {SECTOR_LABEL[sec]}
                </button>
              );
            })}
          </div>
          {sectorNote && <p className="mt-1 text-xs text-brand-800">{sectorNote}</p>}
          <label className="mt-3 flex items-center justify-between gap-2 text-xs text-slate-600">
            Létszám (fő)
            <input
              type="number"
              min={0}
              value={profile.headcount ?? ''}
              onChange={(e) => setProfile({ headcount: e.target.value === '' ? null : Math.max(0, Math.round(Number(e.target.value))) })}
              className="w-28 rounded-lg border border-slate-200 px-2 py-1.5 text-right text-sm"
            />
          </label>
          <p className="mt-3 text-xs font-medium text-slate-600">Jellemzők</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {FLAGS.map((f) => {
              const on = profile.flags.includes(f);
              return (
                <button
                  key={f}
                  onClick={() => toggleFlag(f)}
                  aria-pressed={on}
                  className={`rounded-full px-2.5 py-1 text-xs ring-1 ring-inset ${
                    on ? 'bg-brand-600 text-white ring-brand-600' : 'bg-white text-slate-600 ring-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {FLAG_LABEL[f]}
                </button>
              );
            })}
          </div>
          <label className="mt-3 block text-xs text-slate-600">
            Tényállás szövegesen
            <textarea
              value={profile.narrative}
              onChange={(e) => setProfile({ narrative: e.target.value })}
              rows={7}
              placeholder="Pl.: Tanácsadó cég 30 munkavállalóval, generációváltás előtt. Az alapító két éven belül átadná a vezetést a fiának…"
              className="mt-0.5 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
            />
          </label>
          <button
            onClick={askAi}
            disabled={!aiReady || busy || profile.narrative.trim().length < 20}
            title={aiReady ? undefined : 'Az AI ebben a környezetben nem érhető el'}
            className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-brand-200 bg-brand-50 px-3 py-1.5 text-xs font-medium text-brand-700 hover:bg-brand-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            AI-javaslat a tényállásból
          </button>
          {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
        </div>

        {modules.isOn('REGISTRY') && (
          <RegistryCard
            intake={intake}
            update={update}
            scenarioId={scenarioId}
            aiReady={aiReady}
            onAddSector={(sec) => setSectors([...new Set([...profileRef.current.sectors, sec])])}
          />
        )}

        {suggestion && (
          <div className="rounded-xl border border-brand-200 bg-brand-50/50 p-4 text-sm shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            <h3 className="font-semibold text-brand-900">AI-javaslat</h3>
            <p className="mt-0.5 text-xs text-brand-900/70">
              Csak a tényállásból szó szerint alátámasztott javaslatok maradtak meg. Te döntöd el, mit veszel fel.
            </p>
            <DiscardedList count={suggestion.discardedUnverified} items={suggestion.discarded} noun="javaslatot" />
            {suggestion.sectors.some((x) => !profile.sectors.includes(x)) || (suggestion.headcount && suggestion.headcount !== profile.headcount) ? (
              <button
                onClick={() => {
                  setSectors([...new Set([...profile.sectors, ...suggestion.sectors])]);
                  if (suggestion.headcount) setProfile({ headcount: suggestion.headcount });
                }}
                className="mt-2 rounded-lg bg-white px-2.5 py-1 text-xs text-brand-800 ring-1 ring-brand-200 hover:bg-brand-100"
              >
                Átvesz: {suggestion.sectors.map((x) => SECTOR_LABEL[x]).join(', ')}
                {suggestion.headcount ? ` · ${suggestion.headcount} fő` : ''}
              </button>
            ) : null}
            {suggestion.flags.length > 0 && (
              <ul className="mt-2 space-y-1">
                {suggestion.flags.map((f) => (
                  <li key={f.flag} className="flex items-start justify-between gap-2 text-xs">
                    <span>
                      <b>{FLAG_LABEL[f.flag]}</b> <i className="text-brand-900/70">„{f.quote}”</i>
                    </span>
                    <button
                      onClick={() => !profile.flags.includes(f.flag) && toggleFlag(f.flag)}
                      disabled={profile.flags.includes(f.flag)}
                      className="shrink-0 rounded bg-brand-600 px-2 py-0.5 font-medium text-white disabled:bg-emerald-600"
                    >
                      {profile.flags.includes(f.flag) ? '✓' : 'Bejelöl'}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {suggestion.documents.length > 0 && (
              <ul className="mt-3 space-y-2">
                {suggestion.documents.map((d) => {
                  const added = intake.extraRequests.some((x) => x.title === d.title);
                  return (
                    <li key={d.title} className="rounded-lg bg-white p-2 text-xs ring-1 ring-brand-100">
                      <div className="flex items-start justify-between gap-2">
                        <b className="text-slate-900">{d.title}</b>
                        <button
                          onClick={() => !added && addExtra({ title: d.title, pillar: d.pillar, why: [d.why], source: 'AI', priority: 'RECOMMENDED' })}
                          disabled={added}
                          className="shrink-0 rounded bg-brand-600 px-2 py-0.5 font-medium text-white disabled:bg-emerald-600"
                        >
                          {added ? '✓ Felvéve' : 'Felvesz'}
                        </button>
                      </div>
                      <p className="mt-0.5 text-slate-600">{d.why}</p>
                      <p className="mt-0.5 italic text-slate-500">„{d.quote}”</p>
                    </li>
                  );
                })}
              </ul>
            )}
            {!suggestion.flags.length && !suggestion.documents.length && <p className="mt-2 text-xs text-brand-900/70">Nincs további javaslat.</p>}
          </div>
        )}
      </div>

      {/* ── Iratlista ─────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200/80 bg-white p-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <div className="text-sm">
            <b className="text-slate-900">Iratbekérési lista: {list.length} tétel</b>
            <span className="ml-2 text-xs text-slate-500">{counts.map(([s, n]) => `${STATUS_LABEL[s]}: ${n}`).join(' · ')}</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={copy}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700"
            >
              <ClipboardCopy className="h-3.5 w-3.5" /> {copied ? 'Másolva' : 'Lista az ügyfélnek (másolás)'}
            </button>
            <button onClick={() => setShowText((v) => !v)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50">
              {showText ? 'Szöveg elrejtése' : 'Szöveg mutatása'}
            </button>
          </div>
          {showText && (
            <textarea
              readOnly
              value={text}
              rows={12}
              onFocus={(e) => e.target.select()}
              className="w-full rounded-lg border border-slate-200 p-2 font-mono text-xs"
            />
          )}
        </div>

        {PILLARS.map((p) => {
          const items = list.filter((d) => d.pillar === p);
          if (!items.length) return null;
          return (
            <div key={p} className="rounded-xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
              <h3 className="border-b border-slate-100 px-4 py-2 text-sm font-semibold text-slate-900">{PILLAR_LABEL[p]}</h3>
              <ul className="divide-y divide-slate-100">
                {items.map((d) => {
                  const st = intake.requestStatus[d.id] ?? 'REQUESTED';
                  const extra = intake.extraRequests.some((x) => x.id === d.id);
                  return (
                    <li key={d.id} className={`flex flex-wrap items-start gap-3 px-4 py-2.5 ${st === 'NA' ? 'opacity-50' : ''}`}>
                      <div className="min-w-0 flex-1 basis-72">
                        <p className="text-sm text-slate-900">
                          {d.title}
                          {d.priority === 'REQUIRED' && (
                            <span className="ml-1.5 rounded-lg bg-navy-900 px-1.5 py-0.5 text-[10.5px] font-bold uppercase tracking-wide text-white">
                              Kötelező
                            </span>
                          )}
                          <span className="ml-1.5 rounded bg-slate-100 px-1.5 text-xs font-medium text-slate-600">{SOURCE_LABEL[d.source]}</span>
                        </p>
                        <p className="mt-0.5 text-xs text-slate-500">{d.why.join(' · ')}</p>
                        {d.table && <p className="mt-0.5 text-xs text-brand-700">Beérkezés után: Adattáblák → {TABLE_SPECS[d.table].label}</p>}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="inline-flex" role="group" aria-label={`Állapot: ${d.title}`}>
                          {STATUSES.map((s) => (
                            <button
                              key={s}
                              onClick={() => setStatus(d.id, s)}
                              aria-pressed={st === s}
                              className={`px-2 py-0.5 text-xs ring-1 ring-inset first:rounded-l-md last:rounded-r-md ${
                                st === s ? STATUS_STYLE[s] : 'bg-white text-slate-600 ring-slate-200 hover:bg-slate-50'
                              }`}
                            >
                              {STATUS_LABEL[s]}
                            </button>
                          ))}
                        </div>
                        {extra && (
                          <button
                            onClick={() => update({ extraRequests: intake.extraRequests.filter((x) => x.id !== d.id) })}
                            aria-label="Tétel törlése"
                            className="text-slate-500 hover:text-red-600"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}

        <div className="flex flex-wrap gap-2 rounded-lg border border-dashed border-slate-300 p-3">
          <input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Egyedi irat hozzáadása…"
            className="min-w-0 flex-1 rounded-lg border border-slate-200 px-2 py-1 text-sm"
          />
          <select value={newPillar} onChange={(e) => setNewPillar(e.target.value as Pillar)} className="rounded-lg border border-slate-200 px-2 text-sm">
            {PILLARS.map((p) => (
              <option key={p} value={p}>
                {PILLAR_LABEL[p]}
              </option>
            ))}
          </select>
          <button
            onClick={() => {
              if (!newTitle.trim()) return;
              addExtra({ title: newTitle.trim(), pillar: newPillar, why: ['tanácsadói döntés'], source: 'MANUAL', priority: 'RECOMMENDED' });
              setNewTitle('');
            }}
            className="inline-flex items-center gap-1 rounded-lg bg-brand-600 px-3 py-1 text-xs font-medium text-white"
          >
            <Plus className="h-3.5 w-3.5" /> Hozzáad
          </button>
        </div>
        <p className="text-xs text-slate-500">
          A „Hiányzik” állapotú iratokra az interjúkon a program külön rákérdez. A beérkezett szerződéseket a Dokumentumok fülön elemezheted, a táblázatokat az
          Adattábláknál.
        </p>
      </div>
    </section>
  );
}
