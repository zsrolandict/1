'use client';

import { Fragment, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  Check,
  ClipboardList,
  FolderInput,
  EyeOff,
  FileSearch,
  FileText,
  Loader2,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Table2,
  Trash2,
  Undo2,
  Upload,
  X,
} from 'lucide-react';
import { ENGAGEMENT_KIND_LIST, ENGAGEMENT_KINDS, type EngagementKind } from '@/lib/engagement/kinds';
import { applyCompanySuggestion, applyIntakeSuggestion, isCompanySuggestionApplied } from '@/lib/intake/apply';
import { CHECKLIST, checklistProgress, isVisible, type Answer, type ChecklistQuestion } from '@/lib/intake/checklist';
import { documentChars, extractPlain, SUPPORTED_DOCUMENTS } from '@/lib/intake/documents/extract';
import type { DocumentAnalysis, DocumentFormat, DocumentRecord } from '@/lib/intake/documents/types';
import { SAMPLE_ANSWERS } from '@/lib/intake/samples/checklist';
import { SAMPLE_DOCUMENTS, sampleDocumentRecord, samplePagesRedacted } from '@/lib/intake/samples/documents';
import { hasSampleTables, SAMPLE_REF_DATE, sampleTableCsv } from '@/lib/intake/samples/tables';
import { EMPTY_INTAKE, intakeResults, loadIntake, requestList, saveIntake, type IntakeState } from '@/lib/intake/state';
import CaseTab from './CaseTab';
import ModuleOff from '../ModuleOff';
import { useModules } from '../useModules';
import { INTAKE_TAB_EVENT, takeRequestedIntakeTab } from '@/lib/guide';
import { INTAKE_MODULES, type ModuleId } from '@/lib/modules';
import OverviewTab from './OverviewTab';
import { crossChecks } from '@/lib/intake/crossChecks';
import { buildSources } from '@/lib/intake/synthesis';
import { loadRecords } from '@/lib/interview/records';
import { SECTOR_LABEL, type Sector } from '@/lib/intake/requests';
import { missingSectorRisks } from '@/lib/risk/sectorRisks';
import { analyzeTable, type TableAnalysis } from '@/lib/intake/tables/metrics';
import { dayToIso, isoToDay, parseCsv, parseTableFile, type Grid } from '@/lib/intake/tables/parse';
import { detectColumns, missingColumns, TABLE_KINDS, TABLE_SPECS, type ColumnKey, type ColumnMapping, type TableKind } from '@/lib/intake/tables/spec';
import { ORIGIN_LABEL, type CompanySuggestion, type IntakeResult, type IntakeSuggestion } from '@/lib/intake/types';
import { PILLAR_LABEL } from '@/lib/risk/catalog';
import { formatHufShort, PILLARS, ragFromScore } from '@/lib/risk/engine';
import { DEFAULT_WORKSPACE, loadWorkspace, saveWorkspace, type Workspace } from '@/lib/risk/store';
import type { Rag } from '@/lib/risk/types';
import { getScenario } from '@/lib/scenarios';
import { useAiBackend } from '@/components/AiBackendContext';

type Tab = 'case' | 'checklist' | 'tables' | 'documents' | 'overview';
type SourceTab = Exclude<Tab, 'case'>;
const TAB_MODULE: Record<Tab, ModuleId> = { case: 'CASE', checklist: 'CHECKLIST', tables: 'TABLES', documents: 'DOCUMENTS', overview: 'OVERVIEW' };

/** A feltöltött tábla nyers rácsa csak memóriában él (oszlop-javításhoz, újraszámoláshoz). */
interface RawTable {
  fileName: string;
  grid: Grid;
  headerRow: number;
  mapping: ColumnMapping;
  refDay: number | null;
}

const RAG_BADGE: Record<Rag, string> = {
  RED: 'bg-red-50 text-red-700 ring-red-600/20',
  AMBER: 'bg-amber-50 text-amber-800 ring-amber-600/20',
  GREEN: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
};

export default function IntakeWorkspace({ onOpenMatrix }: { onOpenMatrix?: () => void } = {}) {
  const [ws, setWs] = useState<Workspace>(DEFAULT_WORKSPACE);
  const [intake, setIntake] = useState<IntakeState>(EMPTY_INTAKE);
  const [hydrated, setHydrated] = useState(false);
  const [tab, setTab] = useState<Tab>('case');
  const [raw, setRaw] = useState<Partial<Record<TableKind, RawTable>>>({});
  const [aiReady, setAiReady] = useState<boolean | null>(null);
  const backend = useAiBackend();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { isOn } = useModules();
  const enabledTabs = (Object.keys(TAB_MODULE) as Tab[]).filter((t) => isOn(TAB_MODULE[t]));
  const activeTab: Tab | null = enabledTabs.includes(tab) ? tab : (enabledTabs[0] ?? null);

  // A kalauz egy adott fülre küldhet (oldalváltáson át is).
  useEffect(() => {
    const requested = takeRequestedIntakeTab();
    if (requested) setTab(requested);
    const onRequest = (e: Event) => {
      takeRequestedIntakeTab();
      setTab((e as CustomEvent<Tab>).detail);
    };
    window.addEventListener(INTAKE_TAB_EVENT, onRequest);
    return () => window.removeEventListener(INTAKE_TAB_EVENT, onRequest);
  }, []);

  useEffect(() => {
    const loaded = loadWorkspace();
    setWs(loaded);
    setIntake(loadIntake(loaded.projectId));
    setHydrated(true);
    backend.status().then((s) => setAiReady(s.documents));
  }, []);

  const scenario = getScenario(ws.scenarioId);
  const updateWs = (next: Workspace) => {
    setWs(next);
    saveWorkspace(next);
  };
  const updateIntake = (patch: Partial<IntakeState>) =>
    setIntake((prev) => {
      const next = { ...prev, ...patch };
      saveIntake(ws.projectId, next);
      return next;
    });

  const baseResults = useMemo(() => intakeResults(intake, ws.kind), [intake, ws.kind]);
  // Összkép: keresztellenőrzés + AI-szintézis (az interjúk is forrásai)
  const records = useMemo(() => (hydrated ? loadRecords(ws.projectId) : {}), [hydrated, ws.projectId, tab]);
  const allFacts = useMemo(
    () => [...scenario.facts, ...baseResults.documents.facts, ...baseResults.tables.facts, ...baseResults.checklist.facts],
    [scenario, baseResults],
  );
  const cross = useMemo(() => crossChecks(intake, ws.kind, records, allFacts), [intake, ws.kind, records, allFacts]);
  const sources = useMemo(() => buildSources(intake, records, allFacts), [intake, records, allFacts]);
  const results = {
    ...baseResults,
    overview: {
      suggestions: [...cross.suggestions, ...(intake.synthesis?.suggestions ?? [])],
      companySuggestions: [],
      facts: [],
    },
  };
  const synthesize = async () => {
    const pending = [baseResults.checklist, baseResults.tables, baseResults.documents].flatMap((r) =>
      r.suggestions.filter((x) => !accepted.has(x.key)).map((x) => x.title),
    );
    const synthesis = await backend.synthesize({ kind: ws.kind, companyName: ws.companyName, sources, existing: ws.items, pending });
    updateIntake({ synthesis });
  };
  const accepted = useMemo(() => new Set(intake.accepted), [intake.accepted]);
  const dismissed = useMemo(() => new Set(intake.dismissed), [intake.dismissed]);

  const allSuggestions = [...results.checklist.suggestions, ...results.tables.suggestions, ...results.documents.suggestions, ...results.overview.suggestions];
  const pendingCount = allSuggestions.filter((s) => !accepted.has(s.key) && !dismissed.has(s.key)).length;

  const accept = (s: IntakeSuggestion) => {
    updateWs({ ...ws, items: applyIntakeSuggestion(ws.items, s, ws.company) });
    updateIntake({ accepted: [...intake.accepted, s.key], dismissed: intake.dismissed.filter((k) => k !== s.key) });
  };
  const acceptMany = (list: IntakeSuggestion[]) => {
    const todo = list.filter((s) => !accepted.has(s.key) && !dismissed.has(s.key));
    if (!todo.length) return;
    updateWs({ ...ws, items: todo.reduce((items, s) => applyIntakeSuggestion(items, s, ws.company), ws.items) });
    updateIntake({ accepted: [...intake.accepted, ...todo.map((s) => s.key)] });
  };
  const dismiss = (key: string) => updateIntake({ dismissed: [...intake.dismissed, key] });
  const undismiss = (key: string) => updateIntake({ dismissed: intake.dismissed.filter((k) => k !== key) });
  const acceptCompany = (s: CompanySuggestion) => {
    updateWs({ ...ws, company: applyCompanySuggestion(ws.company, s) });
    updateIntake({ accepted: [...intake.accepted, s.key] });
  };

  // ── Táblák ──────────────────────────────────────────────────────
  const salesTotal = intake.tables.SALES_BY_CUSTOMER?.totalHuf ?? null;
  const runTable = (kind: TableKind, r: RawTable, tables = intake.tables, rawAll = raw): Partial<Record<TableKind, TableAnalysis>> => {
    const sales = kind === 'SALES_BY_CUSTOMER' ? null : (tables.SALES_BY_CUSTOMER?.totalHuf ?? salesTotal);
    const next = { ...tables, [kind]: analyzeTable({ kind, ...r }, { company: ws.company, salesTotalHuf: sales }) };
    // Ha a vevőnkénti árbevétel változott, a korosítás DSO-ja is újraszámol.
    if (kind === 'SALES_BY_CUSTOMER' && rawAll.AR_AGING) {
      next.AR_AGING = analyzeTable({ kind: 'AR_AGING', ...rawAll.AR_AGING }, { company: ws.company, salesTotalHuf: next.SALES_BY_CUSTOMER!.totalHuf });
    }
    return next;
  };
  const setTable = (kind: TableKind, r: RawTable) => {
    const rawAll = { ...raw, [kind]: r };
    setRaw(rawAll);
    const missing = missingColumns(kind, r.mapping);
    if (missing.length) {
      const { [kind]: _, ...rest } = intake.tables;
      updateIntake({ tables: rest });
      return;
    }
    updateIntake({ tables: runTable(kind, r, intake.tables, rawAll) });
  };
  const loadGrid = (kind: TableKind, fileName: string, grid: Grid, refDay: number | null) => {
    const d = detectColumns(kind, grid);
    setTable(kind, { fileName, grid, headerRow: d.headerRow, mapping: d.mapping, refDay });
  };
  const uploadTable = async (kind: TableKind, file: File) => {
    setError(null);
    try {
      const grid = parseTableFile(file.name, new Uint8Array(await file.arrayBuffer()));
      if (grid.length < 2) throw new Error('A táblában nincs adat.');
      loadGrid(kind, file.name, grid, raw[kind]?.refDay ?? isoToDay(new Date().toISOString().slice(0, 10)));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'A tábla nem olvasható.');
    }
  };
  const loadSampleTable = (kind: TableKind) => {
    const { fileName, csv } = sampleTableCsv(kind, scenario);
    loadGrid(kind, fileName, parseCsv(csv), isoToDay(SAMPLE_REF_DATE));
  };
  const removeTable = (kind: TableKind) => {
    const { [kind]: _, ...rest } = intake.tables;
    const { [kind]: __, ...rawRest } = raw;
    setRaw(rawRest);
    updateIntake({ tables: rest });
  };

  // ── Dokumentumok ────────────────────────────────────────────────
  const addDocument = (d: DocumentRecord) => updateIntake({ documents: [d, ...intake.documents.filter((x) => x.fileName !== d.fileName)] });
  const uploadDocument = async (file: File) => {
    setError(null);
    setBusy(true);
    try {
      if (!file.name.toLowerCase().endsWith('.pdf')) {
        // Word/szöveg: előellenőrzés a böngészőben, hogy üres fájl ne menjen fel.
        const pre = extractPlain(file.name, new Uint8Array(await file.arrayBuffer()));
        if (documentChars(pre.pages) < 20) throw new Error('A dokumentumban nincs feldolgozható szöveg.');
      }
      const body = await backend.analyzeDocument(file, ws.kind);
      addDocument({
        id: `D${Date.now().toString(36)}`,
        fileName: file.name,
        ...body,
        analyzedAt: new Date().toISOString(),
        isSample: false,
        kind: ws.kind,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'A dokumentum elemzése nem sikerült.');
    } finally {
      setBusy(false);
    }
  };

  if (!hydrated) return null;

  const progress = checklistProgress(intake.answers, intake.profile.sectors);
  const tableCount = Object.keys(intake.tables).length;

  return (
    <div className="mx-auto max-w-[1300px] space-y-5 px-4 py-6 sm:px-6 lg:px-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">{ENGAGEMENT_KINDS[ws.kind].label} · Adatgyűjtés</p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900">Adatgyűjtés és előjelölés</h1>
          <p className="mt-1 text-sm text-slate-500">
            {ws.companyName || 'Névtelen projekt'}
            {scenario.situation ? ` · ${scenario.situation}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={ws.kind}
            onChange={(e) => updateWs({ ...ws, kind: e.target.value as EngagementKind })}
            aria-label="Átvilágítás típusa"
            className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm"
          >
            {ENGAGEMENT_KIND_LIST.map((k) => (
              <option key={k.kind} value={k.kind}>
                {k.label}
              </option>
            ))}
          </select>
        </div>
      </header>

      <div className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 text-sm shadow-sm md:grid-cols-[1fr_auto] md:items-center">
        <p className="text-slate-600">
          A kérdőív, a táblázatok és a dokumentumok <b>javaslatokat</b> adnak. A Red Flag mátrixba csak az kerül, amit elfogad. Már azonosított tételnél a
          súlyosság nem csökken; a képlet paraméterét (arány, darabszám) a tényadat pontosítja.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
            {pendingCount} döntésre vár · {intake.accepted.length} átvéve
          </span>
          {onOpenMatrix && (
            <button
              onClick={onOpenMatrix}
              className="inline-flex items-center gap-1 rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800"
            >
              Red Flag mátrix <ArrowRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      <nav className="flex gap-1 overflow-x-auto border-b border-slate-200">
        {isOn('CASE') && (
          <TabButton active={activeTab === 'case'} onClick={() => setTab('case')} icon={<FolderInput className="h-4 w-4" />}>
            0. Tényállás, iratbekérés <Count>{requestList(intake, ws.kind).length}</Count>
          </TabButton>
        )}
        {isOn('CHECKLIST') && (
          <TabButton active={activeTab === 'checklist'} onClick={() => setTab('checklist')} icon={<ClipboardList className="h-4 w-4" />}>
            1. Kérdőív{' '}
            <Count>
              {progress.answered}/{progress.total}
            </Count>
          </TabButton>
        )}
        {isOn('TABLES') && (
          <TabButton active={activeTab === 'tables'} onClick={() => setTab('tables')} icon={<Table2 className="h-4 w-4" />}>
            2. Adattáblák <Count>{tableCount}/4</Count>
          </TabButton>
        )}
        {isOn('DOCUMENTS') && (
          <TabButton active={activeTab === 'documents'} onClick={() => setTab('documents')} icon={<FileText className="h-4 w-4" />}>
            3. Dokumentumok <Count>{intake.documents.length}</Count>
          </TabButton>
        )}
        {isOn('OVERVIEW') && (
          <TabButton active={activeTab === 'overview'} onClick={() => setTab('overview')} icon={<Sparkles className="h-4 w-4" />}>
            4. Összkép <Count>{cross.conflicts.length} ellentmondás</Count>
          </TabButton>
        )}
      </nav>

      {!activeTab && <ModuleOff ids={INTAKE_MODULES} />}

      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
          <button onClick={() => setError(null)} className="ml-auto" aria-label="Bezárás">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {activeTab === 'case' && (
        <CaseTab
          intake={intake}
          update={updateIntake}
          kind={ws.kind}
          companyName={ws.companyName}
          scenarioId={ws.scenarioId}
          aiReady={aiReady}
          onSectorsChange={(sectors) => {
            const add = missingSectorRisks(sectors, ws.items);
            if (add.length) updateWs({ ...ws, items: [...ws.items, ...add] });
            return add.length;
          }}
        />
      )}

      {activeTab && activeTab !== 'case' && (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_400px]">
          <div className="min-w-0">
            {activeTab === 'checklist' && (
              <ChecklistTab
                answers={intake.answers}
                sectors={intake.profile.sectors}
                onAnswer={(id, a) => {
                  const answers = { ...intake.answers };
                  if (a === undefined) delete answers[id];
                  else answers[id] = a;
                  updateIntake({ answers });
                }}
                onSample={SAMPLE_ANSWERS[ws.scenarioId] ? () => updateIntake({ answers: SAMPLE_ANSWERS[ws.scenarioId] }) : undefined}
                onClear={() => updateIntake({ answers: {} })}
                flagged={new Set(results.checklist.suggestions.flatMap((s) => s.evidence.match(/Q\d\d/g) ?? []))}
              />
            )}
            {activeTab === 'tables' && (
              <TablesTab
                tables={intake.tables}
                raw={raw}
                canSample={hasSampleTables(ws.scenarioId)}
                onUpload={uploadTable}
                onSample={loadSampleTable}
                onRemove={removeTable}
                onChangeRaw={setTable}
              />
            )}
            {activeTab === 'overview' && (
              <OverviewTab
                conflicts={cross.conflicts}
                crossCount={cross.suggestions.length}
                synthesis={intake.synthesis}
                sourceCount={sources.length}
                aiReady={aiReady}
                onSynthesize={synthesize}
              />
            )}
            {activeTab === 'documents' && (
              <DocumentsTab
                documents={intake.documents}
                kind={ws.kind}
                aiReady={aiReady}
                busy={busy}
                samples={SAMPLE_DOCUMENTS[ws.scenarioId] ?? []}
                onUpload={uploadDocument}
                onSample={(i) => addDocument(sampleDocumentRecord(SAMPLE_DOCUMENTS[ws.scenarioId][i], `S${ws.scenarioId}-${i}`))}
                onRemove={(id) => updateIntake({ documents: intake.documents.filter((d) => d.id !== id) })}
              />
            )}
          </div>

          <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
            <SuggestionPanel
              result={results[activeTab as SourceTab]}
              ws={ws}
              accepted={accepted}
              dismissed={dismissed}
              onAccept={accept}
              onAcceptAll={() => acceptMany(results[activeTab as SourceTab].suggestions)}
              onDismiss={dismiss}
              onUndismiss={undismiss}
              onAcceptCompany={acceptCompany}
              empty={
                activeTab === 'checklist'
                  ? 'Válaszoljon a kérdésekre – a jelző válaszokból itt jelennek meg a javaslatok.'
                  : activeTab === 'tables'
                    ? 'Töltsön be egy táblát – a küszöb feletti mutatókból itt lesznek javaslatok.'
                    : activeTab === 'overview'
                      ? 'Készítsen összképet, vagy töltsön be több táblát – a források összevetéséből itt lesznek javaslatok.'
                      : 'Elemezzen egy dokumentumot – az ellenőrzött idézetű találatok itt jelennek meg.'
              }
            />
            <FactsNote result={results[activeTab as SourceTab]} />
          </aside>
        </div>
      )}
    </div>
  );
}

// ── Kérdőív ───────────────────────────────────────────────────────

function ChecklistTab({
  answers,
  sectors,
  onAnswer,
  onSample,
  onClear,
  flagged,
}: {
  answers: Record<string, Answer>;
  sectors: Sector[];
  onAnswer: (id: string, a: Answer | undefined) => void;
  onSample?: () => void;
  onClear: () => void;
  flagged: Set<string>;
}) {
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-600">
          Az ügyfél tölti ki az ügyfélportálon (~20 perc), vagy a tanácsadó az első megbeszélésen. Ugyanarra a válaszra mindig ugyanaz a javaslat (rögzített
          szabályok, AI nélkül).
        </p>
        <div className="flex gap-2">
          {onSample && (
            <button
              onClick={onSample}
              className="rounded-md border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100"
            >
              Minta-válaszok betöltése
            </button>
          )}
          <button
            onClick={onClear}
            className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Törlés
          </button>
        </div>
      </div>
      {PILLARS.map((p) => (
        <div key={p} className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <h2 className="border-b border-slate-100 px-4 py-2 text-sm font-semibold text-slate-900">{PILLAR_LABEL[p]}</h2>
          <ol className="divide-y divide-slate-100">
            {CHECKLIST.filter((q) => q.pillar === p && isVisible(q, answers, sectors)).map((q) => (
              <li key={q.id} className={`px-4 py-3 ${q.showIf ? 'bg-slate-50/60 pl-8' : ''}`}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1 basis-72">
                    <p className="text-sm text-slate-900">
                      <span className="mr-1.5 font-mono text-xs text-slate-500">{q.id}</span>
                      {q.sectors && (
                        <span className="mr-1.5 rounded bg-indigo-50 px-1.5 text-xs font-medium text-indigo-700">
                          {q.sectors
                            .filter((x) => sectors.includes(x))
                            .map((x) => SECTOR_LABEL[x])
                            .join(', ')}
                        </span>
                      )}
                      {q.text}
                    </p>
                    {q.help && <p className="mt-0.5 text-xs text-slate-500">{q.help}</p>}
                    {q.document && <p className="mt-0.5 text-xs text-slate-500">Kért dokumentum: {q.document}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <AnswerInput q={q} value={answers[q.id]} onChange={(a) => onAnswer(q.id, a)} />
                    <span
                      className={`h-2 w-2 shrink-0 rounded-full ${flagged.has(q.id) ? 'bg-red-500' : 'bg-transparent'}`}
                      title={flagged.has(q.id) ? 'A válasz kockázatot jelez' : undefined}
                    />
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </div>
      ))}
    </section>
  );
}

function AnswerInput({ q, value, onChange }: { q: ChecklistQuestion; value: Answer | undefined; onChange: (a: Answer | undefined) => void }) {
  const seg = (active: boolean) =>
    `px-2.5 py-1 text-xs font-medium first:rounded-l-md last:rounded-r-md ring-1 ring-inset ${
      active ? 'bg-slate-900 text-white ring-slate-900' : 'bg-white text-slate-700 ring-slate-200 hover:bg-slate-50'
    }`;
  if (q.type === 'YES_NO') {
    return (
      <div className="inline-flex" role="group" aria-label={q.id}>
        {([true, false] as const).map((v) => (
          <button key={String(v)} onClick={() => onChange(value === v ? undefined : v)} className={seg(value === v)} aria-pressed={value === v}>
            {v ? 'Igen' : 'Nem'}
          </button>
        ))}
      </div>
    );
  }
  if (q.type === 'CHOICE') {
    return (
      <div className="inline-flex flex-wrap" role="group" aria-label={q.id}>
        {q.choices!.map((c) => (
          <button
            key={c.value}
            onClick={() => onChange(value === c.value ? undefined : c.value)}
            className={seg(value === c.value)}
            aria-pressed={value === c.value}
          >
            {c.label}
          </button>
        ))}
      </div>
    );
  }
  return (
    <label className="inline-flex items-center gap-1 text-xs text-slate-500">
      <input
        type="number"
        min={0}
        max={q.type === 'PERCENT' ? 100 : undefined}
        value={typeof value === 'number' ? value : ''}
        onChange={(e) => onChange(e.target.value === '' ? undefined : Math.max(0, Number(e.target.value)))}
        aria-label={q.id}
        className="w-20 rounded-md border border-slate-200 px-2 py-1 text-right text-sm text-slate-900"
      />
      {q.unit}
    </label>
  );
}

// ── Adattáblák ────────────────────────────────────────────────────

function TablesTab({
  tables,
  raw,
  canSample,
  onUpload,
  onSample,
  onRemove,
  onChangeRaw,
}: {
  tables: Partial<Record<TableKind, TableAnalysis>>;
  raw: Partial<Record<TableKind, RawTable>>;
  canSample: boolean;
  onUpload: (k: TableKind, f: File) => void;
  onSample: (k: TableKind) => void;
  onRemove: (k: TableKind) => void;
  onChangeRaw: (k: TableKind, r: RawTable) => void;
}) {
  return (
    <section className="space-y-4">
      <p className="flex items-start gap-2 text-sm text-slate-600">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />A táblák a böngészőben dolgozódnak fel, a fájl nem kerül fel a szerverre. CSV
        (magyar Excel-mentés is) és XLSX; a fejlécet és az oszlopokat a program felismeri, szükség esetén átállíthatók. Minden szám a sorokból számolódik, AI
        nélkül.
      </p>
      {TABLE_KINDS.map((kind) => {
        const spec = TABLE_SPECS[kind];
        const t = tables[kind];
        const r = raw[kind];
        const missing = r ? missingColumns(kind, r.mapping) : [];
        return (
          <div key={kind} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1 basis-64">
                <h2 className="text-sm font-semibold text-slate-900">{spec.label}</h2>
                <p className="mt-0.5 text-xs text-slate-500">{spec.request}</p>
                <p className="mt-0.5 text-xs text-slate-500">Oszlopok: {spec.columns.map((c) => c.label + (c.required ? '' : ' (opc.)')).join(' · ')}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">
                  <Upload className="h-3.5 w-3.5" /> Fájl
                  <input
                    type="file"
                    accept=".csv,.txt,.xlsx"
                    className="sr-only"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) onUpload(kind, f);
                      e.target.value = '';
                    }}
                  />
                </label>
                {canSample && (
                  <button
                    onClick={() => onSample(kind)}
                    className="rounded-md border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100"
                  >
                    Mintatábla
                  </button>
                )}
                {(t || r) && (
                  <button
                    onClick={() => onRemove(kind)}
                    aria-label="Tábla eltávolítása"
                    className="rounded-md border border-slate-200 px-2 text-slate-500 hover:text-red-600"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>

            {r && (
              <div className="mt-3 space-y-2 rounded-md bg-slate-50 p-3 text-xs">
                <p className="text-slate-500">
                  <b className="text-slate-700">{r.fileName}</b> · fejléc: {r.headerRow + 1}. sor
                </p>
                <div className="flex flex-wrap gap-x-4 gap-y-2">
                  {spec.columns.map((c) => (
                    <label key={c.key} className="flex items-center gap-1 text-slate-600">
                      {c.label}:
                      <select
                        value={r.mapping[c.key] ?? ''}
                        onChange={(e) => {
                          const mapping = { ...r.mapping };
                          if (e.target.value === '') delete mapping[c.key as ColumnKey];
                          else mapping[c.key as ColumnKey] = Number(e.target.value);
                          onChangeRaw(kind, { ...r, mapping });
                        }}
                        className="max-w-[160px] rounded border border-slate-200 bg-white px-1 py-0.5"
                      >
                        <option value="">—</option>
                        {r.grid[r.headerRow]?.map((h, i) => (
                          <option key={i} value={i}>
                            {String(h ?? `${i + 1}. oszlop`)}
                          </option>
                        ))}
                      </select>
                    </label>
                  ))}
                  {kind === 'AR_AGING' && (
                    <label className="flex items-center gap-1 text-slate-600">
                      Fordulónap:
                      <input
                        type="date"
                        value={r.refDay != null ? dayToIso(r.refDay) : ''}
                        onChange={(e) => onChangeRaw(kind, { ...r, refDay: e.target.value ? isoToDay(e.target.value) : null })}
                        className="rounded border border-slate-200 bg-white px-1 py-0.5"
                      />
                    </label>
                  )}
                </div>
                {missing.length > 0 && <p className="text-red-700">Hiányzó oszlop: {missing.join(', ')}</p>}
              </div>
            )}

            {t && (
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <dl className="space-y-1 text-sm">
                  {t.metrics.map((m) => (
                    <div key={m.label} className="flex justify-between gap-3">
                      <dt className="text-slate-500">{m.label}</dt>
                      <dd className={`text-right font-medium tabular-nums ${m.alert ? 'text-red-700' : 'text-slate-900'}`}>{m.value}</dd>
                    </div>
                  ))}
                  <div className="pt-1 text-xs text-slate-500">
                    {t.rows} sor feldolgozva{t.skipped ? `, ${t.skipped} kihagyva (összesítő / üres / nem szám)` : ''} · {t.fileName}
                  </div>
                  {t.warnings.map((w) => (
                    <p key={w} className="text-xs text-amber-700">
                      ⚠ {w}
                    </p>
                  ))}
                </dl>
                {t.topPartners.length > 0 && (
                  <div className="text-xs">
                    <p className="mb-1 font-medium text-slate-500">Legnagyobb tételek (csak itt látszik, a riportba név nem kerül)</p>
                    <ul className="space-y-1">
                      {t.topPartners.map((p) => (
                        <li key={p.name}>
                          <div className="flex justify-between gap-2">
                            <span className="truncate text-slate-700">{p.name}</span>
                            <span className="tabular-nums text-slate-500">{formatHufShort(p.amountHuf)}</span>
                          </div>
                          <div className="mt-0.5 h-1.5 rounded bg-slate-100">
                            <div className="h-1.5 rounded bg-slate-500" style={{ width: `${Math.min(100, p.share * 100)}%` }} />
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}

// ── Dokumentumok ──────────────────────────────────────────────────

function DocumentsTab({
  documents,
  kind,
  aiReady,
  busy,
  samples,
  onUpload,
  onSample,
  onRemove,
}: {
  documents: DocumentRecord[];
  kind: EngagementKind;
  aiReady: boolean | null;
  busy: boolean;
  samples: (typeof SAMPLE_DOCUMENTS)[string];
  onUpload: (f: File) => void;
  onSample: (i: number) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <section className="space-y-4">
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1 basis-72 text-sm text-slate-600">
            <p>
              Szerződés, szabályzat, létesítő okirat (PDF, DOCX, TXT). Az AI tételenként javasol, <b>szó szerinti idézettel és oldalszámmal</b>; amit nem talál
              meg a szövegben, azt a rendszer eldobja.
            </p>
            <p className="mt-2 flex items-start gap-2 text-xs text-slate-500">
              <EyeOff className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Feldolgozás előtt maszkoljuk az e-mail-címet, telefonszámot, bankszámlát, adóazonosító jelet, TAJ- és igazolványszámot. A fájlt nem tároljuk, csak
              az ellenőrzött eredményt. Szkennelt PDF-hez OCR kell.
            </p>
          </div>
          <label
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium ${
              aiReady && !busy ? 'cursor-pointer bg-slate-900 text-white hover:bg-slate-800' : 'cursor-not-allowed bg-slate-100 text-slate-500'
            }`}
            title={aiReady ? undefined : 'Az AI-elemzés ebben a környezetben nincs beállítva'}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {busy ? 'Elemzés…' : 'Dokumentum elemzése'}
            <input
              type="file"
              accept={SUPPORTED_DOCUMENTS}
              disabled={!aiReady || busy}
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onUpload(f);
                e.target.value = '';
              }}
            />
          </label>
        </div>
        {samples.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3 text-xs">
            <span className="text-slate-500">Kitalált mintadokumentum:</span>
            {samples.map((s, i) => (
              <button
                key={s.fileName}
                onClick={() => onSample(i)}
                className="rounded-md border border-indigo-200 bg-indigo-50 px-2.5 py-1 font-medium text-indigo-700 hover:bg-indigo-100"
              >
                {s.fileName}
              </button>
            ))}
          </div>
        )}
      </div>

      {documents.map((d) => (
        <DocumentCard
          key={d.id}
          d={d}
          kind={kind}
          sample={d.isSample ? samples.find((s) => s.fileName === d.fileName) : undefined}
          onRemove={() => onRemove(d.id)}
        />
      ))}
    </section>
  );
}

function DocumentCard({
  d,
  kind,
  sample,
  onRemove,
}: {
  d: DocumentRecord;
  kind: EngagementKind;
  sample?: (typeof SAMPLE_DOCUMENTS)[string][number];
  onRemove: () => void;
}) {
  const [showText, setShowText] = useState(false);
  const a = d.analysis;
  const redacted = Object.entries(d.redactions);
  const where = (i: number | null) => (i != null ? d.pageLabels[i] : '');
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <FileSearch className="h-3.5 w-3.5" /> {d.format} · {d.pageLabels.length} {d.format === 'PDF' ? 'oldal' : 'szakasz'}
            {d.isSample && <span className="rounded bg-amber-100 px-1.5 font-medium text-amber-800">Minta-elemzés</span>}
          </p>
          <h3 className="mt-0.5 truncate font-medium text-slate-900">{d.fileName}</h3>
          <p className="text-xs text-slate-500">{a.documentType}</p>
        </div>
        <button onClick={onRemove} aria-label="Dokumentum eltávolítása" className="text-slate-500 hover:text-red-600">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      {d.kind && d.kind !== kind && (
        <p className="mt-2 flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-2.5 text-xs text-amber-900">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            <b>Más célra készült:</b> {ENGAGEMENT_KINDS[d.kind].label} (most: {ENGAGEMENT_KINDS[kind].label}). A súlyosságot az AI a célhoz méri; az új célhoz
            töltsd fel újra a dokumentumot (a fájlt nem tároljuk, ezért újra kell választani).
          </span>
        </p>
      )}
      <p className="mt-2 text-sm leading-relaxed text-slate-700">{a.summary}</p>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
        <span className="inline-flex items-center gap-1">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" /> minden tétel mögött ellenőrzött idézet
        </span>
        {a.discardedUnverified > 0 && <span className="text-amber-700">{a.discardedUnverified} nem igazolható tételt kiszűrt</span>}
        <span>maszkolva: {redacted.length ? redacted.map(([k, n]) => `${n} ${k}`).join(', ') : 'nem volt azonosító'}</span>
      </div>

      {a.facts.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-medium text-slate-500">Tények (az interjúkon ellenőrizzük)</p>
          <ul className="mt-1 space-y-1 text-sm">
            {a.facts.map((f, i) => (
              <li key={i} className="text-slate-700">
                • {f.statement} <span className="text-xs text-slate-500">({where(f.pageIndex)})</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {a.missingProvisions.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-medium text-slate-500">Hiányzó szokásos rendelkezések</p>
          <p className="mt-1 text-sm text-slate-700">{a.missingProvisions.join(' · ')}</p>
        </div>
      )}
      {sample && (
        <div className="mt-3">
          <button onClick={() => setShowText((v) => !v)} className="text-xs font-medium text-indigo-700 hover:underline">
            {showText ? 'Szöveg elrejtése' : 'Mit kapott az AI? (maszkolt szöveg)'}
          </button>
          {showText && (
            <div className="mt-2 max-h-72 space-y-2 overflow-auto rounded-md bg-slate-50 p-3 text-xs text-slate-700">
              {samplePagesRedacted(sample).map((p) => (
                <Fragment key={p.label}>
                  <p className="font-medium text-slate-500">— {p.label} —</p>
                  <p className="whitespace-pre-wrap">{p.text}</p>
                </Fragment>
              ))}
            </div>
          )}
        </div>
      )}
    </article>
  );
}

// ── Javaslatok ────────────────────────────────────────────────────

function SuggestionPanel({
  result,
  ws,
  accepted,
  dismissed,
  onAccept,
  onAcceptAll,
  onDismiss,
  onUndismiss,
  onAcceptCompany,
  empty,
}: {
  result: IntakeResult;
  ws: Workspace;
  accepted: Set<string>;
  dismissed: Set<string>;
  onAccept: (s: IntakeSuggestion) => void;
  onAcceptAll: () => void;
  onDismiss: (key: string) => void;
  onUndismiss: (key: string) => void;
  onAcceptCompany: (s: CompanySuggestion) => void;
  empty: string;
}) {
  const pending = result.suggestions.filter((s) => !accepted.has(s.key) && !dismissed.has(s.key)).length;
  return (
    <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-2.5">
        <h2 className="text-sm font-semibold text-slate-900">Javaslatok a mátrixba ({result.suggestions.length})</h2>
        {pending > 1 && (
          <button onClick={onAcceptAll} className="rounded-md bg-slate-900 px-2.5 py-1 text-xs font-medium text-white hover:bg-slate-800">
            Mind ({pending}) elfogad
          </button>
        )}
      </div>
      {result.companySuggestions.length > 0 && (
        <ul className="space-y-2 border-b border-slate-100 p-3">
          {result.companySuggestions.map((c) => {
            const done = accepted.has(c.key) || isCompanySuggestionApplied(ws.company, c);
            return (
              <li key={c.key} className="rounded-md bg-sky-50 p-2.5 text-xs">
                <p className="flex items-center gap-1.5 font-medium text-sky-900">
                  <Building2 className="h-3.5 w-3.5" /> Cégadat: {c.label}
                </p>
                <p className="mt-0.5 text-sky-800/80">{c.evidence}</p>
                <button
                  onClick={() => onAcceptCompany(c)}
                  disabled={done}
                  className={`mt-1.5 rounded px-2 py-0.5 font-medium ${done ? 'text-emerald-700' : 'bg-sky-700 text-white hover:bg-sky-800'}`}
                >
                  {done ? '✓ Érvényben' : 'Cégadat frissítése'}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {result.suggestions.length === 0 ? (
        <p className="p-4 text-sm text-slate-500">{empty}</p>
      ) : (
        <ul className="max-h-[70vh] divide-y divide-slate-100 overflow-auto">
          {result.suggestions.map((s) => (
            <SuggestionRow
              key={s.key}
              s={s}
              ws={ws}
              state={accepted.has(s.key) ? 'accepted' : dismissed.has(s.key) ? 'dismissed' : 'pending'}
              onAccept={() => onAccept(s)}
              onDismiss={() => onDismiss(s.key)}
              onUndismiss={() => onUndismiss(s.key)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function SuggestionRow({
  s,
  ws,
  state,
  onAccept,
  onDismiss,
  onUndismiss,
}: {
  s: IntakeSuggestion;
  ws: Workspace;
  state: 'pending' | 'accepted' | 'dismissed';
  onAccept: () => void;
  onDismiss: () => void;
  onUndismiss: () => void;
}) {
  const score = s.likelihood * s.impact;
  const rag = ragFromScore(score);
  const current = s.code ? ws.items.find((r) => r.code === s.code) : undefined;
  const status = !s.code
    ? 'Új egyedi tétel lesz'
    : !current
      ? 'Még nincs a listában – felvesszük'
      : current.identified
        ? `A mátrixban: V${current.likelihood}×H${current.impact} (nem csökken)`
        : 'A mátrixban nem azonosított – bepipáljuk';
  const patch =
    s.valuationPatch?.type === 'REVENUE_SHARE'
      ? `Képlet: érintett arány ${(s.valuationPatch.share * 100).toLocaleString('hu-HU', { maximumFractionDigits: 1 })}%`
      : s.valuationPatch?.type === 'PER_ITEM'
        ? `Képlet: ${s.valuationPatch.count} db`
        : s.exposureHufEstimate
          ? `A forrásban szereplő összeg: ${formatHufShort(s.exposureHufEstimate)}`
          : null;
  return (
    <li className={`p-3 text-sm ${state === 'dismissed' ? 'opacity-50' : ''}`}>
      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        <span className="font-mono text-slate-500">{s.code ?? 'Új'}</span>
        <span className="text-slate-500">{PILLAR_LABEL[s.pillar]}</span>
        <span className={`rounded px-1.5 font-medium ring-1 ring-inset ${RAG_BADGE[rag]}`}>
          V{s.likelihood}×H{s.impact} = {score}
        </span>
        {s.confidence != null && <span className="text-slate-500">biztosság {Math.round(s.confidence * 100)}%</span>}
        <span className="ml-auto rounded bg-indigo-50 px-1.5 font-medium text-indigo-700">{ORIGIN_LABEL[s.origin]}</span>
      </div>
      <p className="mt-1 font-medium text-slate-900">{s.title}</p>
      <p className="mt-0.5 text-xs text-slate-600">{s.rationale}</p>
      <p className="mt-1 text-xs italic text-slate-500">{s.evidence}</p>
      {patch && <p className="mt-1 text-xs text-slate-600">{patch}</p>}
      <p className="mt-1 text-xs text-slate-500">{status}</p>
      <div className="mt-2 flex gap-2">
        {state === 'accepted' ? (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
            <Check className="h-3.5 w-3.5" /> Átvéve a mátrixba
          </span>
        ) : state === 'dismissed' ? (
          <button onClick={onUndismiss} className="inline-flex items-center gap-1 text-xs text-slate-600 hover:underline">
            <Undo2 className="h-3.5 w-3.5" /> Elvetve · visszaállít
          </button>
        ) : (
          <>
            <button onClick={onAccept} className="rounded-md bg-slate-900 px-2.5 py-1 text-xs font-medium text-white hover:bg-slate-800">
              Elfogad
            </button>
            <button onClick={onDismiss} className="rounded-md border border-slate-200 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50">
              Elvet
            </button>
          </>
        )}
      </div>
    </li>
  );
}

function FactsNote({ result }: { result: IntakeResult }) {
  if (!result.facts.length) return null;
  const toAsk = result.facts.filter((f) => f.askInInterview !== false).length;
  return (
    <p className="rounded-md bg-slate-100 px-3 py-2 text-xs text-slate-600">
      {result.facts.length} tény megy tovább az interjúkhoz: ezekkel veti össze az elemzés az elhangzottakat
      {toAsk > 0 ? `, és ${toAsk}-ra külön rákérdezünk` : ''}.
    </p>
  );
}

// ── Apró elemek ───────────────────────────────────────────────────

function TabButton({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: ReactNode; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`-mb-px inline-flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium ${
        active ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-800'
      }`}
    >
      {icon}
      {children}
    </button>
  );
}

function Count({ children }: { children: ReactNode }) {
  return <span className="rounded-full bg-slate-100 px-1.5 text-xs font-medium text-slate-600">{children}</span>;
}
