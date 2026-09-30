'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import ModuleOff from '../ModuleOff';
import { useModules } from '../useModules';
import {
  AlertTriangle,
  Bot,
  Check,
  CheckCircle2,
  Clock,
  FileAudio,
  FileText,
  ListChecks,
  Loader2,
  MessageSquareQuote,
  Plus,
  Printer,
  ShieldCheck,
  Sparkles,
  Upload,
  Users,
} from 'lucide-react';
import { ENGAGEMENT_KIND_LIST, ENGAGEMENT_KINDS, type EngagementKind } from '@/lib/engagement/kinds';
import { buildInterviewGuide, estimateMinutes } from '@/lib/interview/guide';
import { ROLE_LABEL } from '@/lib/interview/questionBank';
import { getScenario } from '@/lib/scenarios';
import { buildInterviewPlan } from '@/lib/interview/plan';
import { emptyRecord, isAnalysisStale, loadRecords, saveRecords, type InterviewRecord, type InterviewRecords } from '@/lib/interview/records';
import InterviewPlanPanel from './InterviewPlanPanel';
import { PageHeader, SELECT, TabBar, TabButton } from '../ui/primitives';
import ProjectStagesCard from '../ui/ProjectStagesCard';
import { formatMs, notesToTranscript, verifyAnalysis } from '@/lib/interview/transcript';
import type { InterviewAnalysis, InterviewQuestion, IntervieweeRole, KnownFact, QuestionSource, SuggestedRedFlag, Transcript } from '@/lib/interview/types';
import { PILLAR_LABEL } from '@/lib/risk/catalog';
import type { AiStatus } from '@/lib/ai/backend';
import { useAiBackend } from '@/components/AiBackendContext';
import { PILLARS } from '@/lib/risk/engine';
import { applySuggestion, DEFAULT_WORKSPACE, loadWorkspace, saveWorkspace, type Workspace } from '@/lib/risk/store';
import type { Pillar } from '@/lib/risk/types';
import { intakeFacts, loadIntake, missingRequests } from '@/lib/intake/state';

/** A mintaeset tényei + az adatgyűjtésből (kérdőív, táblák, dokumentumok) jövő tények. */
function factsFor(ws: Pick<Workspace, 'projectId' | 'scenarioId'>, kind: EngagementKind): KnownFact[] {
  return [...getScenario(ws.scenarioId).facts, ...intakeFacts(loadIntake(ws.projectId), kind)];
}

/** Hiányzó iratok: a mintaeset listája + az Adatgyűjtésben „Hiányzik”-ra állítottak. */
function missingFor(ws: Pick<Workspace, 'projectId' | 'scenarioId'>, kind: EngagementKind): { title: string; pillar: Pillar }[] {
  const seen = new Set<string>();
  return [...getScenario(ws.scenarioId).missingDocuments, ...missingRequests(loadIntake(ws.projectId), kind)].filter((d) =>
    seen.has(d.title) ? false : (seen.add(d.title), true),
  );
}

type Tab = 'plan' | 'guide' | 'process' | 'analysis';
const ROLES = Object.keys(ROLE_LABEL) as IntervieweeRole[];

const PRIORITY_LABEL = { 1: 'Kötelező', 2: 'Ha van idő', 3: 'Opcionális' } as const;

function sourceBadge(s: QuestionSource): { label: string; cls: string } {
  switch (s.type) {
    case 'RED_FLAG':
      return { label: `Red Flag · ${s.code}`, cls: 'bg-red-50 text-red-700 ring-red-600/20' };
    case 'MISSING_DOCUMENT':
      return { label: 'Hiányzó dokumentum', cls: 'bg-amber-50 text-amber-800 ring-amber-600/20' };
    case 'DOCUMENT_FINDING':
      return { label: 'Dokumentum-tény ellenőrzése', cls: 'bg-brand-50 text-brand-700 ring-brand-600/20' };
    case 'KIND':
      return { label: ENGAGEMENT_KINDS[s.kind].label, cls: 'bg-slate-100 text-slate-700 ring-slate-500/20' };
    case 'AI':
      return { label: 'AI-javaslat', cls: 'bg-brand-50 text-brand-700 ring-brand-600/20' };
    default:
      return { label: 'Alapkérdés', cls: 'bg-slate-50 text-slate-600 ring-slate-400/20' };
  }
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function InterviewWorkspace({ showPrint = true }: { showPrint?: boolean } = {}) {
  const [ws, setWs] = useState<Workspace>(DEFAULT_WORKSPACE);
  const [hydrated, setHydrated] = useState(false);
  const [role, setRole] = useState<IntervieweeRole>('OWNER_CEO');
  const [tab, setTab] = useState<Tab>('plan');
  const [status, setStatus] = useState<AiStatus | null>(null);
  const backend = useAiBackend();

  const [facts, setFacts] = useState<KnownFact[]>(getScenario(DEFAULT_WORKSPACE.scenarioId).facts);
  const scenario = getScenario(ws.scenarioId);
  const sample = scenario.interview ?? null;
  const missingDocuments = useMemo(() => (hydrated ? missingFor(ws, ws.kind) : scenario.missingDocuments), [hydrated, ws, scenario]);
  const [aiQuestions, setAiQuestions] = useState<InterviewQuestion[]>([]);
  const [consent, setConsent] = useState(false);
  const [speakers, setSpeakers] = useState(2);

  // Interjúalanyonkénti rekordok: az interjúterv sorai ezekhez kötődnek.
  const [records, setRecords] = useState<InterviewRecords>({});
  const rec: InterviewRecord = records[role] ?? emptyRecord(role);
  const { notes, transcript, speakerNames, analysis, analysisIsSample } = rec;
  const asked = useMemo(() => new Set(rec.asked), [rec.asked]);
  const accepted = useMemo(() => new Set(rec.accepted), [rec.accepted]);

  const updateRec = (patch: Partial<InterviewRecord>, forRole: IntervieweeRole = role) =>
    setRecords((prev) => {
      const cur = prev[forRole] ?? emptyRecord(forRole);
      const next = { ...prev, [forRole]: { ...cur, ...patch } };
      saveRecords(ws.projectId, next);
      return next;
    });
  const [busy, setBusy] = useState<null | 'ai-questions' | 'transcribe' | 'analyze'>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loaded = loadWorkspace();
    setWs(loaded);
    setFacts(factsFor(loaded, loaded.kind));
    setRecords(loadRecords(loaded.projectId));
    setHydrated(true);
    backend.status().then(setStatus);
  }, []);

  const updateWs = (next: Workspace) => {
    setWs(next);
    saveWorkspace(next);
  };

  const context = useMemo(() => ({ kind: ws.kind, role, risks: ws.items, missingDocuments, facts }), [ws.kind, ws.items, role, facts, missingDocuments]);
  const questions = useMemo(() => [...buildInterviewGuide(context), ...aiQuestions], [context, aiQuestions]);
  const plan = useMemo(() => buildInterviewPlan({ kind: ws.kind, risks: ws.items, missingDocuments, facts }), [ws.kind, ws.items, missingDocuments, facts]);
  const planItem = plan.find((p) => p.role === role);
  const staleRoles = ROLES.filter((r) => isAnalysisStale(records[r], ws.kind));
  const roleLabel = planItem?.label ?? ROLE_LABEL[role];

  const openFromPlan = (r: IntervieweeRole, target: Tab) => {
    setRole(r);
    setTab(target);
  };

  // Szerepkör- vagy típusváltáskor az AI-kérdések már nem aktuálisak.
  useEffect(() => setAiQuestions([]), [role, ws.kind]);

  const namedTranscript = useMemo<Transcript | null>(
    () =>
      transcript && {
        ...transcript,
        segments: transcript.segments.map((s) => ({ ...s, speaker: speakerNames[s.speaker]?.trim() || s.speaker })),
      },
    [transcript, speakerNames],
  );

  const run = async (kind: typeof busy, fn: () => Promise<void>) => {
    setBusy(kind);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ismeretlen hiba.');
    } finally {
      setBusy(null);
    }
  };

  const extendWithAi = () =>
    run('ai-questions', async () => {
      setAiQuestions(await backend.suggestQuestions(context));
    });

  const transcribe = (file: File) =>
    run('transcribe', async () => {
      const t = await backend.transcribe(file, { consent, speakers });
      updateRec({ transcript: t, speakerNames: {}, analysis: null, heldAt: rec.heldAt ?? today() });
    });

  const useNotes = () => {
    const t = notesToTranscript(notes);
    if (!t.segments.length) {
      setError('A jegyzet üres.');
      return;
    }
    setError(null);
    updateRec({ transcript: t, speakerNames: {}, analysis: null, heldAt: rec.heldAt ?? today() });
  };

  /** A mintaeset interjúja mindig a hozzá tartozó interjúalanyhoz kötődik. */
  const loadSample = () => {
    if (!sample) return;
    const sampleRole = sample.role;
    updateRec(
      {
        notes: sample.notes,
        transcript: notesToTranscript(sample.notes),
        speakerNames: {},
        analysis: null,
        heldAt: today(),
      },
      sampleRole,
    );
    setRole(sampleRole);
  };

  const analyze = () =>
    run('analyze', async () => {
      if (!namedTranscript) return;
      const analysis = await backend.analyzeInterview({ transcript: namedTranscript, role, kind: ws.kind, facts });
      updateRec({ analysis, analysisIsSample: false, analysisKind: ws.kind, accepted: [] });
      setTab('analysis');
    });

  const showSampleAnalysis = () => {
    if (!namedTranscript || !sample) return;
    updateRec({ analysis: verifyAnalysis(sample.analysis, namedTranscript, facts), analysisIsSample: true, analysisKind: null, accepted: [] });
    setTab('analysis');
  };

  const acceptFlag = (f: SuggestedRedFlag, key: string) => {
    const when = f.startMs != null ? `, ${formatMs(f.startMs)}` : '';
    const evidence = `„${f.quote}” – ${roleLabel} interjú${when}`;
    updateWs({ ...ws, items: applySuggestion(ws.items, f, evidence, ws.company) });
    updateRec({ accepted: [...rec.accepted, key] });
  };

  const isSampleTranscript = Boolean(sample) && notes === sample?.notes && transcript?.origin === 'NOTES' && role === sample?.role;

  const speakerLabels = transcript ? [...new Set(transcript.segments.map((s) => s.speaker))] : [];

  const modules = useModules();
  if (!hydrated) return null;
  if (!modules.isOn('INTERVIEWS')) return <ModuleOff ids={['INTERVIEWS']} />;

  return (
    <div className="mx-auto max-w-[1400px] space-y-5 px-6 py-7 lg:px-8">
      <PageHeader
        kind={ENGAGEMENT_KINDS[ws.kind].label}
        section="Interjúk"
        title="Interjú-előkészítés és elemzés"
        subtitle={`${ws.companyName || 'Névtelen projekt'}${scenario.situation ? ` · ${scenario.situation}` : ''}`}
        actions={
          <>
            <select
              value={ws.kind}
              onChange={(e) => updateWs({ ...ws, kind: e.target.value as EngagementKind })}
              aria-label="Átvilágítás típusa"
              className={SELECT}
            >
              {ENGAGEMENT_KIND_LIST.map((k) => (
                <option key={k.kind} value={k.kind}>
                  {k.label}
                </option>
              ))}
            </select>
            <select value={role} onChange={(e) => setRole(e.target.value as IntervieweeRole)} aria-label="Interjúalany" className={SELECT}>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {plan.find((p) => p.role === r)?.label ?? ROLE_LABEL[r]}
                  {plan.some((p) => p.role === r) ? '' : ' (nincs a tervben)'}
                </option>
              ))}
            </select>
            <ServiceBadge ok={status?.ai} label="AI-elemzés" />
            <ServiceBadge ok={status?.transcription} label="Hang → leirat" />
          </>
        }
      />

      <ProjectStagesCard projectId={ws.projectId} identified={ws.items.filter((r) => r.identified).length} current="interjuk" />

      <TabBar label="Interjú lépései">
        <TabButton active={tab === 'plan'} onClick={() => setTab('plan')} icon={<Users className="h-4 w-4" />}>
          Interjúterv
        </TabButton>
        <TabButton active={tab === 'guide'} onClick={() => setTab('guide')} icon={<ListChecks className="h-4 w-4" />}>
          1. Kérdések
        </TabButton>
        <TabButton active={tab === 'process'} onClick={() => setTab('process')} icon={<FileAudio className="h-4 w-4" />}>
          2. Interjú feldolgozása
        </TabButton>
        <TabButton active={tab === 'analysis'} onClick={() => setTab('analysis')} icon={<Sparkles className="h-4 w-4" />} disabled={!analysis}>
          3. Elemzés
        </TabButton>
      </TabBar>

      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      {staleRoles.length > 0 && (
        <div role="status" className="flex flex-wrap items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 print:hidden">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="min-w-0 flex-1">
            <b>A cél megváltozott ({ENGAGEMENT_KINDS[ws.kind].label}).</b> {staleRoles.length} interjú elemzése más célra készült, ezért a javaslatai és a
            súlyosság-becslései a régi célhoz igazodnak:{' '}
            {staleRoles
              .map((r) => `${plan.find((p) => p.role === r)?.label ?? ROLE_LABEL[r]} (${ENGAGEMENT_KINDS[records[r]!.analysisKind!].label})`)
              .join(', ')}
            . A Red Flag mátrixba már átvett tételek pontszáma a típusfüggő korrekcióval automatikusan az új célhoz igazodik; az interjú-elemzést futtasd újra.
          </div>
          <div className="flex flex-wrap gap-2">
            {staleRoles.map((r) => (
              <button
                key={r}
                onClick={() => openFromPlan(r, 'analysis')}
                className="rounded-lg border border-amber-300 bg-white px-2.5 py-1 text-xs font-medium text-amber-900 hover:bg-amber-100"
              >
                {plan.find((p) => p.role === r)?.label ?? ROLE_LABEL[r]} →
              </button>
            ))}
          </div>
        </div>
      )}

      {tab !== 'plan' && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg bg-slate-100 px-3 py-2 text-sm print:hidden">
          <span className="text-slate-500">Interjú:</span>
          <b className="text-slate-900">{roleLabel}</b>
          {planItem ? (
            <span className="text-slate-500">
              · a terv {planItem.order}. interjúja · ~{planItem.minutes} perc
            </span>
          ) : (
            <span className="text-amber-700">· nincs az interjútervben</span>
          )}
          <label className="ml-auto flex items-center gap-1 text-xs text-slate-500">
            Álnév
            <input
              value={rec.alias}
              onChange={(e) => updateRec({ alias: e.target.value })}
              placeholder="pl. Ügyvezető, KP-1"
              className="w-32 rounded border border-slate-200 bg-white px-2 py-0.5 text-xs"
            />
          </label>
          <label className="flex items-center gap-1 text-xs text-slate-500">
            Dátum
            <input
              type="date"
              value={rec.heldAt ?? ''}
              onChange={(e) => updateRec({ heldAt: e.target.value || null })}
              className="rounded border border-slate-200 bg-white px-2 py-0.5 text-xs"
            />
          </label>
        </div>
      )}

      {tab === 'plan' && <InterviewPlanPanel plan={plan} records={records} kind={ws.kind} sampleRole={sample?.role ?? null} onOpen={openFromPlan} />}

      {tab === 'guide' && (
        <GuideTab
          showPrint={showPrint}
          role={role}
          roleLabel={roleLabel}
          questions={questions}
          asked={asked}
          onToggle={(id) => updateRec({ asked: rec.asked.includes(id) ? rec.asked.filter((x) => x !== id) : [...rec.asked, id] })}
          facts={facts}
          missingCount={missingDocuments.length}
          onFactsChange={setFacts}
          aiAvailable={Boolean(status?.ai)}
          aiBusy={busy === 'ai-questions'}
          onExtendWithAi={extendWithAi}
          identifiedCount={ws.items.filter((r) => r.identified).length}
        />
      )}

      {tab === 'process' && (
        <section className="grid gap-4 lg:grid-cols-[380px_1fr]">
          <div className="space-y-4">
            <Card title="Hangfelvétel" icon={<FileAudio className="h-4 w-4" />}>
              <label className="flex items-start gap-2 rounded-lg bg-amber-50 p-2.5 text-sm text-amber-900">
                <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 accent-brand-600" />
                <span>
                  Az interjúalany <b>tájékoztatást kapott</b> az adatkezelésről, és <b>hozzájárult</b> a felvételhez és annak AI-alapú feldolgozásához.
                </span>
              </label>
              <label className="mt-3 flex items-center justify-between text-sm text-slate-600">
                Beszélők száma
                <select value={speakers} onChange={(e) => setSpeakers(Number(e.target.value))} className="rounded border border-slate-200 px-2 py-1">
                  {[2, 3, 4, 5, 6].map((n) => (
                    <option key={n}>{n}</option>
                  ))}
                </select>
              </label>
              <label
                className={`mt-3 flex cursor-pointer flex-col items-center gap-1 rounded-lg border-2 border-dashed p-4 text-center text-sm ${
                  consent && status?.transcription ? 'border-slate-300 text-slate-600 hover:bg-slate-50' : 'cursor-not-allowed border-slate-200 text-slate-500'
                }`}
              >
                {busy === 'transcribe' ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
                {busy === 'transcribe'
                  ? 'Leirat készül… (néhány perc is lehet)'
                  : status?.transcriptionAccept?.includes('video')
                    ? 'Hang- vagy videófájl kiválasztása (wav, mp3, m4a, mp4)'
                    : 'Hangfájl kiválasztása (mp3, m4a, wav)'}
                <input
                  type="file"
                  accept={status?.transcriptionAccept ?? 'audio/*'}
                  className="hidden"
                  disabled={!consent || !status?.transcription || busy !== null}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) transcribe(f);
                    e.target.value = '';
                  }}
                />
              </label>
              <p className="mt-2 text-xs text-slate-500">
                {status?.transcription
                  ? `A felvételt nem tároljuk: a leirat elkészülte után csak a szöveg marad meg.${status.transcriptionProvider === 'gemini' ? ' Leirat: Google Gemini.' : ''}`
                  : (status?.transcriptionNote ??
                    'A leiratkészítő szolgáltatás nincs beállítva a szerveren (GEMINI_API_KEY vagy Azure Speech kulcs a .env.local fájlban). Addig használja a jegyzet-beillesztést.')}
              </p>
            </Card>

            <Card title="…vagy jegyzet / diktált szöveg" icon={<FileText className="h-4 w-4" />}>
              <textarea
                value={notes}
                onChange={(e) => updateRec({ notes: e.target.value })}
                rows={8}
                placeholder={'[00:01:10] Ügyvezető: …\nKérdező: …\nvagy szabad szöveg'}
                className="w-full rounded-lg border border-slate-200 p-2 font-mono text-xs outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
              />
              <div className="mt-2 flex flex-wrap gap-2">
                <button onClick={useNotes} className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700">
                  Jegyzet feldolgozása
                </button>
                {sample && (
                  <button onClick={loadSample} className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50">
                    Minta interjú betöltése
                  </button>
                )}
              </div>
            </Card>
          </div>

          <Card title="Leirat" icon={<MessageSquareQuote className="h-4 w-4" />}>
            {!transcript ? (
              <p className="py-10 text-center text-sm text-slate-500">Töltsön fel hangfájlt vagy illesszen be jegyzetet.</p>
            ) : (
              <>
                <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <span className="rounded bg-slate-100 px-2 py-0.5">{transcript.origin === 'AUDIO' ? 'Hangfelvétel-leirat' : 'Jegyzet'}</span>
                  <span>{transcript.segments.length} szakasz</span>
                  {transcript.timed && transcript.durationMs > 0 && <span>{formatMs(transcript.durationMs)}</span>}
                  {isSampleTranscript && <span className="rounded bg-amber-100 px-2 py-0.5 text-amber-800">Kitalált minta</span>}
                </div>
                {speakerLabels.length > 1 && speakerLabels.length <= 6 && (
                  <div className="mb-3 grid gap-2 sm:grid-cols-2">
                    {speakerLabels.map((s) => (
                      <label key={s} className="flex items-center gap-2 text-xs text-slate-600">
                        <span className="w-24 truncate">{s} →</span>
                        <input
                          value={speakerNames[s] ?? ''}
                          onChange={(e) => updateRec({ speakerNames: { ...speakerNames, [s]: e.target.value } })}
                          placeholder="szerep (pl. CFO)"
                          className="flex-1 rounded border border-slate-200 px-2 py-1"
                        />
                      </label>
                    ))}
                  </div>
                )}
                <ol className="max-h-[420px] space-y-2 overflow-y-auto pr-1 text-sm">
                  {namedTranscript!.segments.map((s, i) => (
                    <li key={i} className="grid grid-cols-[56px_1fr] gap-2">
                      <span className="pt-0.5 font-mono text-xs text-slate-500">{transcript.timed ? formatMs(s.startMs) : ''}</span>
                      <p>
                        <b className="font-medium text-slate-900">{s.speaker}:</b> <span className="text-slate-700">{s.text}</span>
                      </p>
                    </li>
                  ))}
                </ol>
                <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
                  <button
                    onClick={analyze}
                    disabled={!status?.ai || busy !== null}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                  >
                    {busy === 'analyze' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bot className="h-4 w-4" />}
                    {busy === 'analyze' ? 'Elemzés folyamatban…' : 'AI-elemzés indítása'}
                  </button>
                  {!status?.ai && isSampleTranscript && (
                    <button onClick={showSampleAnalysis} className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50">
                      Minta-elemzés megtekintése
                    </button>
                  )}
                  {!status?.ai && <span className="text-xs text-slate-500">Az AI-kulcs nincs beállítva a szerveren.</span>}
                </div>
              </>
            )}
          </Card>
        </section>
      )}

      {tab === 'analysis' && analysis && (
        <AnalysisTab
          analysis={analysis}
          isSample={analysisIsSample}
          staleFrom={isAnalysisStale(rec, ws.kind) ? ENGAGEMENT_KINDS[rec.analysisKind!].label : null}
          currentKind={ENGAGEMENT_KINDS[ws.kind].label}
          canReanalyze={Boolean(status?.ai) && Boolean(namedTranscript) && busy === null}
          reanalyzing={busy === 'analyze'}
          onReanalyze={analyze}
          accepted={accepted}
          onAccept={acceptFlag}
          facts={facts}
        />
      )}
    </div>
  );
}

// ── Kérdések fül ──────────────────────────────────────────────────

function GuideTab(props: {
  showPrint: boolean;
  role: IntervieweeRole;
  roleLabel: string;
  questions: InterviewQuestion[];
  asked: Set<string>;
  onToggle: (id: string) => void;
  facts: KnownFact[];
  missingCount: number;
  onFactsChange: (f: KnownFact[]) => void;
  aiAvailable: boolean;
  aiBusy: boolean;
  onExtendWithAi: () => void;
  identifiedCount: number;
}) {
  const { questions, asked } = props;
  const mandatory = questions.filter((q) => q.priority === 1).length;
  return (
    <section className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200/80 bg-white p-3 text-sm shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <span className="font-medium text-slate-900">{props.roleLabel}</span>
          <span className="text-slate-500">
            {questions.length} kérdés · {mandatory} kötelező
          </span>
          <span className="inline-flex items-center gap-1 text-slate-500">
            <Clock className="h-4 w-4" /> ~{estimateMinutes(questions)} perc
          </span>
          <span className="text-slate-500">Elhangzott: {questions.filter((q) => asked.has(q.id)).length}</span>
          <div className="ml-auto flex gap-2 print:hidden">
            <button
              onClick={props.onExtendWithAi}
              disabled={!props.aiAvailable || props.aiBusy}
              title={props.aiAvailable ? undefined : 'Az AI-kulcs nincs beállítva a szerveren.'}
              className="inline-flex items-center gap-1.5 rounded-lg border border-brand-200 bg-brand-50 px-3 py-1.5 font-medium text-brand-700 hover:bg-brand-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {props.aiBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} AI-bővítés
            </button>
            {props.showPrint && (
              <button
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-slate-700 hover:bg-slate-50"
              >
                <Printer className="h-4 w-4" /> Nyomtatás
              </button>
            )}
          </div>
        </div>

        <ol className="space-y-2">
          {questions.map((q, i) => {
            const badge = sourceBadge(q.source);
            const done = asked.has(q.id);
            return (
              <li
                key={q.id}
                className={`rounded-xl border bg-white p-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)] ${done ? 'border-emerald-200' : 'border-slate-200'}`}
              >
                <div className="flex items-start gap-3">
                  <button onClick={() => props.onToggle(q.id)} aria-label="Elhangzott" className="mt-0.5 print:hidden">
                    {done ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : <span className="block h-5 w-5 rounded-full border-2 border-slate-300" />}
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5 text-xs">
                      <span className="font-mono text-slate-500">{i + 1}.</span>
                      <span className="text-slate-500">{PILLAR_LABEL[q.pillar]}</span>
                      <span className={`rounded px-1.5 font-medium ring-1 ring-inset ${badge.cls}`}>{badge.label}</span>
                      {q.priority === 1 && (
                        <span className="rounded-lg bg-navy-900 px-1.5 py-0.5 text-[10.5px] font-bold uppercase tracking-wide text-white">
                          {PRIORITY_LABEL[1]}
                        </span>
                      )}
                    </div>
                    <p className={`mt-1 ${done ? 'text-slate-500' : 'text-slate-900'}`}>{q.text}</p>
                    {q.listenFor && (
                      <p className="mt-1 text-xs text-slate-500">
                        <b>Figyelj:</b> {q.listenFor}
                      </p>
                    )}
                    {q.followUps.length > 0 && (
                      <ul className="mt-1 list-inside list-disc text-xs text-slate-500">
                        {q.followUps.map((f) => (
                          <li key={f}>{f}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      </div>

      <aside className="space-y-4 print:hidden">
        <Card title="Mire épül a kérdéslista?" icon={<ListChecks className="h-4 w-4" />}>
          <ul className="space-y-1 text-sm text-slate-600">
            <li>• {props.identifiedCount} azonosított red flag (Red Flag mátrix)</li>
            <li>• {props.missingCount} hiányzó dokumentum</li>
            <li>• {props.facts.length} ismert tény (dokumentumok, kérdőív, adattáblák)</li>
            <li>• az interjúalany szerepköre és az átvilágítás típusa</li>
          </ul>
        </Card>
        <FactsEditor facts={props.facts} onChange={props.onFactsChange} />
      </aside>
    </section>
  );
}

function FactsEditor({ facts, onChange }: { facts: KnownFact[]; onChange: (f: KnownFact[]) => void }) {
  const [text, setText] = useState('');
  const [pillar, setPillar] = useState<Pillar>('FINANCE');
  const add = () => {
    if (!text.trim()) return;
    onChange([...facts, { id: `K${facts.length + 1}-${Date.now().toString(36)}`, pillar, statement: text.trim(), source: 'Tanácsadói rögzítés' }]);
    setText('');
  };
  return (
    <Card title="Ismert tények" icon={<FileText className="h-4 w-4" />}>
      <p className="mb-2 text-xs text-slate-500">
        Ezekkel veti össze az elemzés az interjúban elhangzottakat. Az Adatgyűjtés oldalról (kérdőív, táblák, dokumentumok) automatikusan bekerülnek.
      </p>
      <ul className="space-y-2 text-xs">
        {facts
          .filter((f) => f.askInInterview !== false)
          .map((f) => (
            <li key={f.id} className="rounded border border-slate-100 bg-slate-50 p-2">
              <div className="flex justify-between gap-2">
                <span className="font-medium text-slate-500">
                  {f.id} · {PILLAR_LABEL[f.pillar]}
                </span>
                <button onClick={() => onChange(facts.filter((x) => x.id !== f.id))} className="text-slate-500 hover:text-red-600" aria-label="Törlés">
                  ✕
                </button>
              </div>
              <p className="mt-0.5 text-slate-700">{f.statement}</p>
              <p className="mt-0.5 text-slate-500">{f.source}</p>
            </li>
          ))}
      </ul>
      {facts.some((f) => f.askInInterview === false) && (
        <p className="mt-2 text-xs text-slate-500">
          + {facts.filter((f) => f.askInInterview === false).length} kérdőív- és táblaadat, csak az ellentmondás-kereséshez (külön kérdés nem lesz belőlük).
        </p>
      )}
      <div className="mt-2 flex gap-1">
        <select value={pillar} onChange={(e) => setPillar(e.target.value as Pillar)} className="rounded border border-slate-200 text-xs">
          {PILLARS.map((p) => (
            <option key={p} value={p}>
              {PILLAR_LABEL[p]}
            </option>
          ))}
        </select>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Új tény…"
          className="min-w-0 flex-1 rounded border border-slate-200 px-2 py-1 text-xs"
        />
        <button onClick={add} aria-label="Hozzáadás" className="rounded bg-brand-600 px-2 text-white">
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
    </Card>
  );
}

// ── Elemzés fül ───────────────────────────────────────────────────

function AnalysisTab({
  analysis,
  isSample,
  staleFrom,
  currentKind,
  canReanalyze,
  reanalyzing,
  onReanalyze,
  accepted,
  onAccept,
  facts,
}: {
  analysis: InterviewAnalysis;
  isSample: boolean;
  staleFrom: string | null;
  currentKind: string;
  canReanalyze: boolean;
  reanalyzing: boolean;
  onReanalyze: () => void;
  accepted: Set<string>;
  onAccept: (f: SuggestedRedFlag, key: string) => void;
  facts: KnownFact[];
}) {
  const factById = new Map(facts.map((f) => [f.id, f]));
  return (
    <section className="space-y-4">
      {staleFrom && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <p className="min-w-0 flex-1">
            <b>Ez az elemzés más célra készült:</b> {staleFrom}. A mostani cél: {currentKind}. Az AI a súlyosságot és a kiemeléseket a célhoz méri, ezért az új
            célhoz futtasd újra.
          </p>
          <button
            onClick={onReanalyze}
            disabled={!canReanalyze}
            className="inline-flex items-center gap-1.5 rounded-lg bg-amber-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {reanalyzing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />} Újraelemzés az új célra
          </button>
        </div>
      )}
      {isSample && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <b>Minta-elemzés:</b> előre elkészített eredmény a kitalált mintainterjúhoz, nem élő AI-hívás. Így néz ki a kimenet, ha az AI-kulcs be van állítva. Az
          idézet-ellenőrzés ezen is lefutott.
        </div>
      )}

      <Card title="Összefoglaló" icon={<Sparkles className="h-4 w-4" />}>
        <p className="text-sm leading-relaxed text-slate-700">{analysis.summary}</p>
        <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-500">
          <ShieldCheck className="h-4 w-4 text-emerald-600" />
          Minden tétel mögött szó szerinti idézet van a leiratból.
          {analysis.discardedUnverified > 0 && ` ${analysis.discardedUnverified} nem igazolható tételt a rendszer kiszűrt.`}
        </p>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title={`Ellentmondások a dokumentumokkal (${analysis.contradictions.length})`} icon={<AlertTriangle className="h-4 w-4 text-red-600" />}>
          {analysis.contradictions.length === 0 && <p className="text-sm text-slate-500">Nincs talált ellentmondás.</p>}
          <ul className="space-y-3">
            {analysis.contradictions.map((c, i) => (
              <li
                key={i}
                className={`rounded-lg border p-3 text-sm ${c.severity === 'HIGH' ? 'border-red-200 bg-red-50/60' : c.severity === 'MEDIUM' ? 'border-amber-200 bg-amber-50/60' : 'border-slate-200'}`}
              >
                <div className="flex items-center justify-between text-xs font-medium">
                  <span className="text-slate-500">{PILLAR_LABEL[c.pillar]}</span>
                  <span className={c.severity === 'HIGH' ? 'text-red-700' : c.severity === 'MEDIUM' ? 'text-amber-800' : 'text-slate-500'}>
                    {{ HIGH: 'Súlyos', MEDIUM: 'Közepes', LOW: 'Enyhe' }[c.severity]}
                  </span>
                </div>
                <p className="mt-1 text-slate-900">
                  <b>Elhangzott:</b> „{c.quote}” {c.startMs != null && <span className="font-mono text-xs text-slate-500">[{formatMs(c.startMs)}]</span>}
                </p>
                <p className="mt-1 text-slate-700">
                  <b>Dokumentum:</b> {factById.get(c.conflictingFactId)?.statement ?? c.conflictingFactId}
                </p>
                <p className="mt-0.5 text-xs text-slate-500">{c.conflictingSource}</p>
                <p className="mt-2 text-slate-700">{c.explanation}</p>
              </li>
            ))}
          </ul>
        </Card>

        <Card title={`Javasolt red flagek (${analysis.suggestedRedFlags.length})`} icon={<Bot className="h-4 w-4 text-brand-600" />}>
          {analysis.suggestedRedFlags.length === 0 && <p className="text-sm text-slate-500">Nincs javaslat.</p>}
          <ul className="space-y-3">
            {analysis.suggestedRedFlags.map((f, i) => {
              const key = `${f.templateCode ?? f.title}-${i}`;
              const done = accepted.has(key);
              return (
                <li key={key} className="rounded-lg border border-slate-200 p-3 text-sm">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="text-slate-500">
                      {f.templateCode ?? 'Új tétel'} · {PILLAR_LABEL[f.pillar]} · V{f.likelihood}×H{f.impact}
                    </span>
                    <span className="text-slate-500">biztosság {Math.round(f.confidence * 100)}%</span>
                  </div>
                  <p className="mt-1 font-medium text-slate-900">{f.title}</p>
                  <p className="mt-0.5 text-slate-600">{f.rationale}</p>
                  <p className="mt-1 text-xs italic text-slate-500">
                    „{f.quote}” {f.startMs != null && <span className="font-mono not-italic">[{formatMs(f.startMs)}]</span>}
                  </p>
                  <button
                    onClick={() => onAccept(f, key)}
                    disabled={done}
                    className={`mt-2 inline-flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-medium ${
                      done ? 'bg-emerald-50 text-emerald-700' : 'bg-brand-600 text-white hover:bg-brand-700'
                    }`}
                  >
                    {done ? (
                      <>
                        <Check className="h-3.5 w-3.5" /> Átvéve a Red Flag mátrixba
                      </>
                    ) : (
                      'Elfogadás → Red Flag mátrix'
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Kulcsállítások pillérenként" icon={<MessageSquareQuote className="h-4 w-4" />}>
          <ul className="space-y-2 text-sm">
            {analysis.statements.map((s, i) => (
              <li key={i}>
                <span className="text-xs text-slate-500">
                  {PILLAR_LABEL[s.pillar]} · {s.speaker} {s.startMs != null && `· ${formatMs(s.startMs)}`}
                </span>
                <p className="text-slate-800">{s.summary}</p>
              </li>
            ))}
          </ul>
        </Card>
        <Card title="Tisztázandó a következő körben" icon={<ListChecks className="h-4 w-4" />}>
          <ul className="list-inside list-disc space-y-1 text-sm text-slate-700">
            {analysis.followUpQuestions.map((q) => (
              <li key={q}>{q}</li>
            ))}
          </ul>
        </Card>
      </div>
    </section>
  );
}

// ── Apró elemek ───────────────────────────────────────────────────

function Card({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
        {icon}
        {title}
      </h2>
      {children}
    </div>
  );
}

function ServiceBadge({ ok, label }: { ok: boolean | undefined; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${
        ok ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/20' : 'bg-white text-slate-500 ring-slate-200'
      }`}
      title={ok ? 'Beállítva a szerveren' : 'Nincs beállítva – demó mód'}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${ok ? 'bg-emerald-500' : 'bg-slate-400'}`} />
      {label}
    </span>
  );
}
