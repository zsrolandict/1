'use client';

import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Banknote,
  BriefcaseBusiness,
  CalendarClock,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  Pencil,
  Calculator,
  Download,
  FileSpreadsheet,
  MoreHorizontal,
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
  ArrowRight,
  ClipboardList,
  AlertTriangle,
  Rows3,
  Rows4,
  Lightbulb,
  Sparkles,
} from 'lucide-react';
import { assess, scoreRisk, AUDIT_FEE_HUF, DIVISIONS, formatHuf, formatHufShort, PILLARS, ragFromScore, WINDOWS } from '@/lib/risk/engine';
import { catalogDefault, DEFAULT_CATALOG, DIVISION_LABEL, PILLAR_LABEL, RAG_LABEL, WINDOW_LABEL } from '@/lib/risk/catalog';
import type { Division, Pillar, Rag, RiskItem, RiskSource, Scale5, ScoredRisk } from '@/lib/risk/types';
import { DEFAULT_WORKSPACE, loadWorkspace, saveWorkspace, workspaceFromScenario } from '@/lib/risk/store';
import { useConfirm } from '../ConfirmDialog';
import { hasRevenue } from '@/lib/risk/valuation';
import { useNav } from '../Nav';
import InfoTip from '../InfoTip';
import type { GlossaryKey } from '@/lib/glossary';
import { templateFor } from '@/lib/intake/apply';
import { getScenario, isDemoScenario } from '@/lib/scenarios';
import { loadIntake } from '@/lib/intake/state';
import { SECTOR_LABEL } from '@/lib/intake/requests';
import { missingSectorRisks } from '@/lib/risk/sectorRisks';
import { EXPERT_PARAMETERS } from '@/lib/risk/parameters';
import { computeFormula, resolveExposure, type CompanyProfile, type Formula } from '@/lib/risk/valuation';
import { Badge, BTN_PRIMARY, BTN_SECONDARY, BTN_TOOL, Card, IconBox, KpiTile, type Tone } from '../ui/primitives';
import ProjectStagesCard from '../ui/ProjectStagesCard';
import WhatIfPanel from './WhatIfPanel';
import FollowUpPanel from './FollowUpPanel';
import { useModules } from '../useModules';
import BuyerQuestionsPanel from './BuyerQuestionsPanel';
import ExportPdfButton, { browserDownload, slug, type SaveFile } from '@/components/report/ExportPdfButton';
import { ENGAGEMENT_KIND_LIST, ENGAGEMENT_KINDS, hourSplit, PM_HOURS, type EngagementKind } from '@/lib/engagement/kinds';
import { KIND_RISKS } from '@/lib/engagement/kindRisks';
import { adjustmentsFor, describeAdjustment, formatAdjustment, KIND_ADJUSTMENTS_STATUS, type KindAdjustment } from '@/lib/engagement/adjustments';
import { addEntry, missingReasons, recordChange, sourceCount } from '@/lib/risk/trail';
import { EvidencePanel, HealthExplain } from './EvidencePanel';
import { deriveHealth } from '@/lib/risk/derivation';
import { useIdentity } from '../Identity';
import { useFocusAnchor } from '../useFocusAnchor';
import { buildScope } from '@/lib/report/scope';
import { loadRecords } from '@/lib/interview/records';

const SOURCE_LABEL: Partial<Record<RiskSource, string>> = {
  CHECKLIST: 'Kérdőív',
  DATA_TABLE: 'Adattábla',
  CROSS_CHECK: 'Keresztellenőrzés',
  AI_SYNTHESIS: 'AI · összkép',
  AI_DOCUMENT: 'AI · dokumentum',
  AI_INTERVIEW: 'AI · interjú',
  FINANCIALS: 'Pénzügyi adat',
};
const SCALE: Scale5[] = [1, 2, 3, 4, 5];
const DENSE_KEY = 'ict-hc:matrix-dense';

const RAG_TONE: Record<Rag, Tone> = { GREEN: 'green', AMBER: 'amber', RED: 'red' };
const AI_SOURCES = new Set<RiskSource>(['AI_SYNTHESIS', 'AI_DOCUMENT', 'AI_INTERVIEW']);

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
  /** PDF átadása (alapból böngészős letöltés). */
  savePdf?: SaveFile;
  /** Betűkészletek mappája a PDF-hez. */
  fontBase?: string;
  /** Nyomtatás gomb (ahol a böngésző nyomtatása nem elérhető, rejtsük el). */
  showPrint?: boolean;
}

export default function RedFlagMatrix({
  initialItems = DEFAULT_CATALOG,
  companyName: initialName = DEFAULT_WORKSPACE.companyName,
  onChange,
  savePdf,
  fontBase,
  showPrint = true,
}: Props) {
  const [items, setItems] = useState<RiskItem[]>(initialItems);
  const [scenarioId, setScenarioId] = useState(DEFAULT_WORKSPACE.scenarioId);
  const [projectId, setProjectId] = useState(DEFAULT_WORKSPACE.projectId);
  const [editingName, setEditingName] = useState(false);
  // A beállítások doboza: alapból csukva, amíg nincs teendő (hiányzó árbevétel).
  const [settingsPref, setSettingsPref] = useState<boolean | null>(null);
  const [confirmDialog, ask] = useConfirm();
  const nav = useNav();
  const [companyName, setCompanyName] = useState(initialName);
  const [company, setCompany] = useState<CompanyProfile>(DEFAULT_WORKSPACE.company);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [materialityHuf, setMaterialityHuf] = useState(DEFAULT_WORKSPACE.materialityHuf);
  const [kind, setKind] = useState<EngagementKind>(DEFAULT_WORKSPACE.kind);
  const [pillarFilter, setPillarFilter] = useState<Pillar | 'ALL'>('ALL');
  const [onlyIdentified, setOnlyIdentified] = useState(false);
  const [query, setQuery] = useState('');
  const [cell, setCell] = useState<{ l: Scale5; i: Scale5 } | null>(null);
  const [hydrated, setHydrated] = useState(false);
  // Tömör táblázat: nézőnkénti kényelmi beállítás.
  const [dense, setDenseState] = useState(false);
  const setDense = (v: boolean) => {
    setDenseState(v);
    try {
      localStorage.setItem(DENSE_KEY, v ? '1' : '0');
    } catch {
      /* csak erre a megnyitásra */
    }
  };
  const modules = useModules();
  const me = useIdentity();
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Munkapéldány visszatöltése (csak kényelmi funkció – a forrás az adatbázis).
  useEffect(() => {
    const ws = loadWorkspace();
    setItems(ws.items);
    setMaterialityHuf(ws.materialityHuf);
    setKind(ws.kind);
    setCompanyName(ws.companyName);
    setCompany(ws.company);
    setScenarioId(ws.scenarioId);
    setProjectId(ws.projectId);
    try {
      setDenseState(localStorage.getItem(DENSE_KEY) === '1');
    } catch {
      /* alapértelmezés: részletes */
    }
    setHydrated(true);
  }, []);

  // Az első futás a betöltés utáni állapot: azt nem írjuk vissza változatlanul.
  const skipFirstSave = useRef(true);
  useEffect(() => {
    if (!hydrated) return;
    if (skipFirstSave.current) skipFirstSave.current = false;
    else saveWorkspace({ projectId, scenarioId, companyName, company, kind, materialityHuf, items });
    onChangeRef.current?.(items);
  }, [items, materialityHuf, kind, companyName, company, scenarioId, projectId, hydrated]);

  /** A mátrix visszaállítása a kiinduló mintára (saját projektnél: üres katalógus). */
  const applyWorkspace = (id: string) => {
    const ws = workspaceFromScenario(getScenario(id), projectId);
    setScenarioId(ws.scenarioId);
    setItems(ws.items);
    setCompanyName(ws.companyName);
    setCompany(ws.company);
    setKind(ws.kind);
    setMaterialityHuf(ws.materialityHuf);
    setCell(null);
    setExpanded(new Set());
  };

  const profile = ENGAGEMENT_KINDS[kind];
  const focusCodes = useMemo(() => new Set(profile.focusRiskCodes), [profile]);
  const adjustments = adjustmentsFor(kind);
  const engineOpts = useMemo(() => ({ materialityHuf, company, pillarWeights: profile.weights, adjustments }), [materialityHuf, company, profile, adjustments]);
  const result = useMemo(() => assess(items, engineOpts), [items, engineOpts]);
  // Minden sorra (a nem bejelöltekre is) a korrigált értékelés – így látszik, mit kapna.
  const effById = useMemo(() => new Map(items.map((r) => [r.id, scoreRisk(r, engineOpts)])), [items, engineOpts]);
  const adjustedCount = items.filter((r) => r.identified && effById.get(r.id)?.adjustment).length;
  const kindExtras = KIND_RISKS[kind].filter((k) => !items.some((r) => r.code === k.code));
  // Ágazat: a tényállásban választott ágazat(ok) + a mintacég ágazata.
  const sectors = useMemo(
    () => (hydrated ? [...new Set([...loadIntake(projectId).profile.sectors, ...(getScenario(scenarioId).sectors ?? [])])] : []),
    [hydrated, projectId, scenarioId],
  );
  const sectorExtras = missingSectorRisks(sectors, items);
  const suggested = (r: RiskItem, why: string): RiskItem => addEntry(r, { kind: 'SUGGESTED', actor: 'RULE', ref: why, acceptedBy: me.name });
  const addKindRisk = (code: string) => {
    const item = KIND_RISKS[kind].find((k) => k.code === code);
    if (item) setItems((xs) => [suggested({ ...item, source: 'MANUAL' }, `Az átvilágítás típusa (${profile.label}) miatt javasolt tétel`), ...xs]);
  };
  const addSectorRisks = (list: RiskItem[]) =>
    setItems((xs) => [...xs, ...list.map((k) => suggested(k, `Az ágazatban (${sectors.map((x) => SECTOR_LABEL[x]).join(', ')}) gyakori kockázat`))]);
  const scoredById = useMemo(() => new Map(result.risks.map((r) => [r.id, r])), [result]);

  const visible = items
    .filter((r) => {
      if (pillarFilter !== 'ALL' && r.pillar !== pillarFilter) return false;
      if (onlyIdentified && !r.identified) return false;
      const eff = effById.get(r.id);
      if (cell && (eff?.likelihood !== cell.l || eff?.impact !== cell.i || !r.identified)) return false;
      if (query) {
        const q = query.toLowerCase();
        if (!`${r.code} ${r.title} ${r.description}`.toLowerCase().includes(q)) return false;
      }
      return true;
    })
    // A típus fókusztételei elöl (stabil rendezés, egyébként a lista sorrendje marad).
    .map((r, i) => ({ r, i, f: focusCodes.has(r.code) ? 0 : 1 }))
    .sort((a, b) => a.f - b.f || a.i - b.i)
    .map((x) => x.r);

  // Minden szakértői módosítás a tétel változásnaplójába kerül (csökkentésnél indoklás kell).
  const update = (id: string, patch: Partial<RiskItem>) =>
    setItems((xs) => xs.map((r) => (r.id === id ? recordChange(r, { ...r, ...patch }, me.name, (x) => resolveExposure(x, company).valueHuf) : r)));

  // Ugrás egy sorra más oldalról (forrásnézet): szűrők törlése, sor lenyitása.
  useFocusAnchor(hydrated, (anchor) => {
    if (!anchor.startsWith('risk-')) return;
    const id = anchor.slice(5);
    setPillarFilter('ALL');
    setOnlyIdentified(false);
    setQuery('');
    setCell(null);
    setExpanded((s) => new Set(s).add(id));
  });

  const addCustom = () => {
    const pillar: Pillar = pillarFilter === 'ALL' ? 'FINANCE' : pillarFilter;
    const n = items.filter((r) => r.id.startsWith('CUS-')).length + 1;
    const id = `CUS-${String(n).padStart(2, '0')}-${Date.now().toString(36)}`;
    setItems((xs) => [
      {
        id,
        code: `CUS-${String(n).padStart(2, '0')}`,
        pillar,
        title: 'Egyedi kockázat',
        description: '',
        identified: true,
        likelihood: 3,
        impact: 3,
        exposureHuf: 0,
        remediationDays: 5,
        remediation: '',
        division: 'ADVISORY',
        serviceFeeHuf: 0,
        reasoning: '',
      },
      ...xs,
    ]);
  };

  /** A kiinduló állapot – csak megerősítés után (a mátrix módosításai elvesznek). */
  const reset = async () => {
    const ok = await ask({
      title: 'Visszaállítod a mátrixot?',
      confirmLabel: 'Igen, visszaállítom',
      danger: true,
      body: `Biztosan? A mátrixban végzett módosítások (pipálások, pontszámok, egyedi tételek, cégadatok) elvesznek.${
        isDemoScenario(scenarioId) ? ' A bemutató minta kiinduló állapota tér vissza.' : ' A projekt üres katalógussal indul újra.'
      } Az adatgyűjtés, az interjúk és az időkeret megmarad.`,
    });
    if (ok) applyWorkspace(scenarioId);
  };

  // A riport „Vizsgálati terjedelem” fejezete: mit láttunk és mit nem (iratok, táblák, interjúk).
  const scope = useMemo(() => (hydrated ? buildScope(loadIntake(projectId), kind, loadRecords(projectId)) : undefined), [hydrated, projectId, kind]);
  const saveFile = savePdf ?? browserDownload;
  const fileBase = `${slug(companyName)}-${new Date().toISOString().slice(0, 10)}`;
  const [fileNote, setFileNote] = useState<string | null>(null);
  const save = async (make: () => Promise<Blob>, name: string) => {
    setFileNote(null);
    try {
      await saveFile(await make(), name);
    } catch (e) {
      setFileNote(e instanceof Error ? e.message : 'A mentés nem sikerült.');
    }
  };

  /** Olvasható Excel a tanácsadóknak. A modul csak kattintáskor töltődik be. */
  const exportExcel = async () => {
    if (!(await confirmEmptyExport())) return;
    await save(async () => {
      const { exportExcel: build } = await import('@/lib/report/excelExport');
      const { XLSX_MIME } = await import('@/lib/report/xlsx');
      const bytes = build({ companyName, kind, company, materialityHuf, assessment: result, scope });
      return new Blob([bytes.slice().buffer], { type: XLSX_MIME });
    }, `red-flag-${fileBase}.xlsx`);
  };

  /** Üres értékelésből (Zöld / 100) félrevezető riport lenne: előbb rákérdezünk. */
  const confirmEmptyExport = async () => {
    if (result.totals.identified > 0) return true;
    return ask({
      title: 'Még nincs értékelés',
      body: 'Egyetlen kockázat sincs bepipálva, ezért a riport „Zöld, Health Score 100” eredményt mutatna. Ez nem vizsgálati eredmény. Biztosan elkészíted?',
      confirmLabel: 'Mégis elkészítem',
    });
  };

  /** Gépi adatmentés (JSON) – fejlesztőknek, archiváláshoz; embernek az Excel vagy a PDF való. */
  const exportJson = () =>
    save(
      async () =>
        new Blob([JSON.stringify({ companyName, kind, company, generatedAt: new Date().toISOString(), materialityHuf, ...result }, null, 2)], {
          type: 'application/json',
        }),
      `red-flag-adatmentes-${fileBase}.json`,
    );

  const { totals, pillars, actionPlan, pipeline } = result;
  const missingRevenue = !hasRevenue(company);
  const noAssessment = totals.identified === 0;
  const settingsOpen = settingsPref ?? missingRevenue;

  return (
    <div className="mx-auto max-w-[1400px] space-y-5 px-6 py-7 lg:px-8">
      {/* ── Fejléc ─────────────────────────────────────────────── */}
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="flex items-center gap-2">
            <Badge tone="brand">{ENGAGEMENT_KINDS[kind].label}</Badge>
            <span className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
              Red Flag mátrix <InfoTip term="redFlag" label="Red Flag mátrix" />
            </span>
          </p>
          {editingName ? (
            <input
              autoFocus
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              onBlur={() => setEditingName(false)}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === 'Escape') && setEditingName(false)}
              aria-label="Cégnév"
              className="mt-2 w-full min-w-[280px] rounded-lg bg-white px-1 text-[28px] font-bold tracking-tight text-slate-900 outline-none ring-2 ring-brand-200"
            />
          ) : (
            <h1 className="mt-2 flex items-center gap-2 text-[28px] font-bold leading-tight tracking-tight text-slate-900">
              {companyName || 'Névtelen projekt'}
              <button
                onClick={() => setEditingName(true)}
                aria-label="Cégnév szerkesztése"
                title="Cégnév szerkesztése"
                className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-800 print:hidden"
              >
                <Pencil className="h-4 w-4" />
              </button>
            </h1>
          )}
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            {isDemoScenario(scenarioId) ? `${getScenario(scenarioId).sector} · ${getScenario(scenarioId).situation}` : 'Saját projekt'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <ToolbarButton onClick={reset} icon={<RotateCcw className="h-3.5 w-3.5" />}>
            Alaphelyzet
          </ToolbarButton>
          <ToolbarButton onClick={exportExcel} icon={<FileSpreadsheet className="h-3.5 w-3.5" />}>
            Excel
          </ToolbarButton>
          {showPrint && (
            <ToolbarButton onClick={async () => (await confirmEmptyExport()) && window.print()} icon={<Printer className="h-3.5 w-3.5" />}>
              Nyomtatás
            </ToolbarButton>
          )}
          <ExportPdfButton
            input={{ companyName, kind, company, materialityHuf, assessment: result, scope }}
            beforeExport={confirmEmptyExport}
            saveFile={savePdf}
            fontBase={fontBase}
          />
          <details className="relative">
            <summary
              aria-label="További műveletek"
              className="flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 shadow-xs hover:bg-slate-50 [&::-webkit-details-marker]:hidden"
            >
              <MoreHorizontal className="h-4 w-4" />
            </summary>
            <div className="absolute right-0 z-20 mt-1 w-64 rounded-xl border border-slate-200 bg-white p-1 text-sm shadow-lg">
              <button
                onClick={(e) => {
                  (e.currentTarget.closest('details') as HTMLDetailsElement | null)?.removeAttribute('open');
                  exportJson();
                }}
                className="flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-slate-50"
              >
                <Download className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
                <span>
                  <span className="block text-slate-800">Adatmentés (fejlesztőknek)</span>
                  <span className="block text-xs text-slate-500">
                    Gépi formátum (JSON) archiváláshoz, más rendszerbe töltéshez. Olvasásra az Excel vagy a PDF való.
                  </span>
                </span>
              </button>
            </div>
          </details>
          {fileNote && <p className="w-full text-right text-xs text-red-700">{fileNote}</p>}
        </div>
      </header>

      {/* ── A projekt szakaszai ─────────────────────────────────── */}
      {hydrated && <ProjectStagesCard projectId={projectId} identified={totals.identified} current="matrix" />}

      <SectionNav
        sections={[
          { id: 'osszkep', label: 'Összkép' },
          { id: 'kockazati-tetelek', label: 'Kockázati tételek' },
          { id: 'akcioterv', label: 'Akcióterv' },
          ...(modules.isOn('WHATIF') ? [{ id: 'mi-lenne-ha', label: 'Mi lenne, ha…' }] : []),
          ...(modules.isOn('BUYER_QUESTIONS') ? [{ id: 'vevoi-kerdesek', label: 'Vevői kérdések' }] : []),
          ...(modules.isOn('FOLLOWUP') ? [{ id: 'utokovetes', label: 'Utókövetés' }] : []),
          { id: 'pipeline', label: 'Pipeline' },
        ]}
      />

      {confirmDialog}

      {/* ── Még nincs értékelés ─────────────────────────────────── */}
      <div id="osszkep" className="scroll-mt-28 space-y-5">
        {noAssessment ? (
          <Card className="border-2 border-dashed border-slate-300 p-8 text-center">
            <span className="inline-flex">
              <IconBox tone="brand">
                <ClipboardList className="h-5 w-5" />
              </IconBox>
            </span>
            <h2 className="mt-3 text-lg font-bold text-slate-900">Még nincs értékelés</h2>
            <p className="mx-auto mt-1 max-w-xl text-sm text-slate-600">
              Egyetlen kockázat sincs bepipálva, ezért itt még nincs eredmény (se státusz, se Health Score). Kezdd az adatgyűjtéssel: a kérdőív, a táblázatok és
              a dokumentumok javaslatokat adnak, amiket elfogadva a tételek ide kerülnek. Vagy pipáld be lent közvetlenül a talált kockázatokat.
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              {nav && (
                <button onClick={() => nav.go('adatok')} className={BTN_PRIMARY}>
                  Adatgyűjtés indítása <ArrowRight className="h-4 w-4" />
                </button>
              )}
              <button onClick={() => document.getElementById('kockazati-tetelek')?.scrollIntoView({ behavior: 'smooth' })} className={BTN_SECONDARY}>
                Tételek kézi bepipálása
              </button>
            </div>
          </Card>
        ) : (
          <>
            {/* ── KPI sáv ─────────────────────────────────────────────── */}
            <section className="grid grid-cols-2 gap-4 lg:grid-cols-5">
              <KpiTile
                tone={RAG_TONE[totals.rag]}
                icon={<ShieldAlert className="h-5 w-5" />}
                label="Összesített státusz"
                extra={<InfoTip term="status" label="Összesített státusz" />}
              >
                <span className="flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${RAG_STYLE[totals.rag].dot}`} aria-hidden />
                  {RAG_LABEL[totals.rag]}
                </span>
              </KpiTile>
              <KpiTile tone="brand" icon={<Gauge className="h-5 w-5" />} label="Health Score" extra={<InfoTip term="healthScore" label="Health Score" />}>
                {totals.healthScore}
                <span className="text-sm font-semibold text-slate-400"> / 100</span>
              </KpiTile>
              <KpiTile
                tone="amber"
                icon={<Banknote className="h-5 w-5" />}
                label="Bruttó kitettség"
                hint={formatHuf(totals.grossExposureHuf)}
                extra={<InfoTip term="grossExposure" label="Bruttó kitettség" />}
              >
                {formatHufShort(totals.grossExposureHuf)}
              </KpiTile>
              <KpiTile
                tone="red"
                icon={<TrendingDown className="h-5 w-5" />}
                label="Várható veszteség"
                extra={<InfoTip term="expectedLoss" label="Várható veszteség" />}
              >
                {formatHufShort(totals.expectedLossHuf)}
              </KpiTile>
              <KpiTile
                tone="slate"
                icon={<Filter className="h-5 w-5" />}
                className="col-span-2 lg:col-span-1"
                label={
                  <span>
                    Azonosított · <span className="text-red-700">{totals.red} piros</span> · <span className="text-amber-700">{totals.amber} sárga</span> ·{' '}
                    <span className="text-emerald-700">{totals.green} zöld</span>
                  </span>
                }
              >
                {totals.identified}
              </KpiTile>
            </section>

            {/* ── Pillérek + hőtérkép ─────────────────────────────────── */}
            <section className="grid gap-4 lg:grid-cols-[1fr_380px]">
              <div className="grid grid-cols-2 content-start gap-4">
                {PILLARS.map((p) => {
                  const s = pillars[p];
                  const active = pillarFilter === p;
                  return (
                    <button
                      key={p}
                      onClick={() => setPillarFilter(active ? 'ALL' : p)}
                      aria-pressed={active}
                      className={`rounded-xl border bg-white p-4 text-left shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition hover:border-brand-300 ${
                        active ? 'border-brand-500 ring-1 ring-brand-500' : 'border-slate-200/80'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">{PILLAR_LABEL[p]}</span>
                        <Badge tone={RAG_TONE[s.rag]}>{RAG_LABEL[s.rag]}</Badge>
                      </div>
                      <div className="mt-3 flex items-baseline gap-1.5">
                        <span className="text-3xl font-bold tracking-tight tabular-nums text-slate-900">{s.healthScore}</span>
                        <span className="text-xs font-medium text-slate-400">súly {Math.round(profile.weights[p] * 100)}%</span>
                      </div>
                      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                        <div className={`h-full rounded-full ${RAG_STYLE[s.rag].dot}`} style={{ width: `${s.healthScore}%` }} />
                      </div>
                      <dl className="mt-3 space-y-1 text-xs text-slate-500">
                        <div className="flex justify-between">
                          <dt>Tételek</dt>
                          <dd className="font-semibold tabular-nums text-slate-800">{s.identified}</dd>
                        </div>
                        <div className="flex justify-between">
                          <dt>Kitettség</dt>
                          <dd className="font-semibold tabular-nums text-slate-800">{formatHufShort(s.grossExposureHuf)}</dd>
                        </div>
                        <div className="flex justify-between">
                          <dt>Várható</dt>
                          <dd className="font-semibold tabular-nums text-slate-800">{formatHufShort(s.expectedLossHuf)}</dd>
                        </div>
                      </dl>
                    </button>
                  );
                })}
              </div>

              <HeatMap risks={result.risks} selected={cell} onSelect={setCell} />
            </section>

            <HealthExplain pillars={deriveHealth(pillars, profile.weights, totals.healthScore).pillars} total={totals.healthScore} labels={PILLAR_LABEL} />
          </>
        )}
      </div>

      {/* ── Javasolt további tételek (típus, ágazat) ───────────── */}
      {(kindExtras.length > 0 || sectorExtras.length > 0) && (
        <Card aria-label="Javasolt további tételek" role="region" className="flex gap-3 p-4 print:hidden">
          <IconBox tone="violet" size="sm">
            <Lightbulb className="h-4 w-4" />
          </IconBox>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-slate-900">Javasolt további tételek</p>
            <p className="mb-3 text-xs text-slate-500">Egy kattintással a listába kerülnek (pipálatlanul); utána döntöd el, fennáll-e.</p>
            {kindExtras.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 text-xs [&+&]:mt-3 [&+&]:border-t [&+&]:border-slate-100 [&+&]:pt-3">
                <span className="font-medium text-slate-700">Ehhez az átvilágítás-típushoz érdemes megvizsgálni:</span>
                {kindExtras.map((k) => (
                  <SuggestChip key={k.code} title={k.description} onClick={() => addKindRisk(k.code)}>
                    {k.title}
                  </SuggestChip>
                ))}
              </div>
            )}
            {sectorExtras.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 text-xs [&+&]:mt-3 [&+&]:border-t [&+&]:border-slate-100 [&+&]:pt-3">
                <span className="font-medium text-slate-700">Az ágazatban ({sectors.map((x) => SECTOR_LABEL[x]).join(', ')}) gyakori kockázatok:</span>
                <button
                  onClick={() => addSectorRisks(sectorExtras)}
                  className="rounded-full bg-brand-600 px-3 py-1 font-semibold text-white shadow-sm hover:bg-brand-700"
                >
                  Mind a {sectorExtras.length} felvétele
                </button>
                {sectorExtras.map((k) => (
                  <SuggestChip key={k.code} title={k.description} onClick={() => addSectorRisks([k])}>
                    {k.title}
                  </SuggestChip>
                ))}
              </div>
            )}
          </div>
        </Card>
      )}

      {/* ── Beállítások: cégadatok + átvilágítás-típus (összecsukható) ── */}
      <details
        open={settingsOpen}
        onToggle={(e) => setSettingsPref((e.currentTarget as HTMLDetailsElement).open)}
        className={`rounded-xl border shadow-[0_1px_2px_rgba(15,23,42,0.04)] print:hidden ${missingRevenue ? 'border-amber-300 bg-amber-50' : 'border-slate-200/80 bg-white'}`}
      >
        <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-sm [&::-webkit-details-marker]:hidden">
          <span className="flex items-center gap-2.5 font-semibold text-slate-900">
            <IconBox tone={missingRevenue ? 'amber' : 'slate'} size="sm">
              {missingRevenue ? <AlertTriangle className="h-4 w-4" /> : <Calculator className="h-4 w-4" />}
            </IconBox>
            Cégadatok és átvilágítás-típus
          </span>
          {missingRevenue ? (
            <span role="status" className="font-medium text-amber-900">
              Add meg az éves árbevételt: enélkül a kockázatok forintösszege nem számolható.
            </span>
          ) : (
            <span className="text-xs text-slate-500">
              Árbevétel {formatHufShort(company.revenueHuf)} · fedezet {Math.round(company.grossMarginPct * 100)}% · küszöb {formatHufShort(materialityHuf)} ·{' '}
              {profile.label}, {profile.hourBudget} óra
            </span>
          )}
          <ChevronDown className={`ml-auto h-4 w-4 text-slate-500 transition ${settingsOpen ? 'rotate-180' : ''}`} aria-hidden />
        </summary>
        <div className="space-y-4 border-t border-slate-200/70 px-4 pb-4 pt-4">
          <div className="flex flex-wrap items-end gap-x-5 gap-y-3">
            <Field label="Éves árbevétel (Ft)" term="revenue">
              <HufInput
                value={company.revenueHuf}
                placeholder="pl. 800 000 000"
                emptyWhenZero
                onChange={(v) => setCompany((c) => ({ ...c, revenueHuf: v }))}
                className="w-40 rounded-lg border border-slate-200 px-2.5 py-1.5 text-right tabular-nums"
              />
            </Field>
            <Field label="Fedezeti hányad (%)" term="grossMargin">
              <PercentInput value={company.grossMarginPct} onChange={(v) => setCompany((c) => ({ ...c, grossMarginPct: v }))} />
            </Field>
            <Field label="Fizetési idő: tényleges / iparági (nap)" term="dso">
              <span className="flex items-center gap-1">
                <NumberInput value={company.actualDsoDays} onChange={(v) => setCompany((c) => ({ ...c, actualDsoDays: v }))} />
                <span className="text-slate-500">/</span>
                <NumberInput value={company.industryDsoDays} onChange={(v) => setCompany((c) => ({ ...c, industryDsoDays: v }))} />
              </span>
            </Field>
            <Field label="Lényegességi küszöb (Ft)" term="materiality">
              <HufInput
                value={materialityHuf}
                onChange={setMaterialityHuf}
                className="w-36 rounded-lg border border-slate-200 px-2.5 py-1.5 text-right tabular-nums"
              />
            </Field>
            <p className="ml-auto max-w-xs self-center text-xs text-slate-500">A képletek kiinduló becslést adnak; tételenként felülírhatók.</p>
          </div>
          <div className="rounded-lg border border-slate-200/70 bg-white/80 p-3 text-sm">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <label className="flex items-center gap-2 font-semibold text-slate-900">
                Átvilágítás típusa
                <select
                  value={kind}
                  onChange={(e) => setKind(e.target.value as EngagementKind)}
                  aria-label="Átvilágítás típusa"
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm font-medium text-slate-700 shadow-xs"
                >
                  {ENGAGEMENT_KIND_LIST.map((k) => (
                    <option key={k.kind} value={k.kind}>
                      {k.label}
                    </option>
                  ))}
                </select>
              </label>
              <span className="text-slate-500">Címzett: {profile.audience}</span>
              <span className="text-slate-500">{profile.purpose}</span>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              <span className="text-slate-500">
                Keret: <b className="text-slate-800">{profile.hourBudget} óra</b>
              </span>
              {hourSplit(kind).map((h) => (
                <span key={h.pillar} className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-slate-700">
                  {PILLAR_LABEL[h.pillar]} {h.hours} óra · súly {Math.round(profile.weights[h.pillar] * 100)}%
                </span>
              ))}
              <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-slate-700">Projektvezetés {PM_HOURS} óra</span>
              <InfoTip term="weight" label="súly" />
            </div>
            <p className="mt-2 text-xs text-slate-600">
              <span className="font-medium text-slate-700">Kiemelt tételek</span> <InfoTip term="focus" label="kiemelt tételek" />:{' '}
              {profile.focusRiskCodes.map((c) => templateFor(c)?.title ?? c).join(' · ')}
            </p>
            <p className="mt-1 text-xs text-violet-800">
              {adjustedCount > 0
                ? `Az átvilágítás célja miatt ${adjustedCount} bepipált tétel súlyosabbnak vagy enyhébbnek számít`
                : 'Az átvilágítás célja most egyik bepipált tétel súlyát sem módosítja'}
              {!KIND_ADJUSTMENTS_STATUS.approved && ' (kezdő javaslat, szakértői jóváhagyásra vár)'}.{' '}
              <InfoTip term="kindAdjustment" label="típusfüggő korrekció" />
            </p>
          </div>
        </div>
      </details>

      {/* ── Kockázati tételek ───────────────────────────────────── */}
      <Card id="kockazati-tetelek" className="scroll-mt-28 overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-200/80 px-4 py-3 print:hidden">
          <h2 className="mr-1 flex items-center gap-2 text-base font-bold text-slate-900">
            Kockázati tételek
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold tabular-nums text-slate-600">{visible.length}</span>
          </h2>
          <div className="flex rounded-lg bg-slate-100 p-1 text-sm">
            {(['ALL', ...PILLARS] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPillarFilter(p)}
                aria-pressed={pillarFilter === p}
                className={`rounded-md px-3 py-1 ${
                  pillarFilter === p ? 'bg-white font-semibold text-slate-900 shadow-sm' : 'font-medium text-slate-600 hover:text-slate-900'
                }`}
              >
                {p === 'ALL' ? 'Mind' : PILLAR_LABEL[p]}
              </button>
            ))}
          </div>
          <label className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Keresés…"
              aria-label="Keresés a tételek között"
              className="w-52 rounded-lg border border-slate-200 bg-white py-2 pl-8 pr-2 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
            />
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={onlyIdentified} onChange={(e) => setOnlyIdentified(e.target.checked)} className="h-4 w-4 accent-brand-600" />
            Csak azonosítottak
          </label>
          {cell && (
            <button onClick={() => setCell(null)} className="rounded-full bg-brand-600 px-3 py-1 text-xs font-semibold text-white hover:bg-brand-700">
              Mátrix szűrő: V{cell.l} × H{cell.i} ✕
            </button>
          )}
          <div className="ml-auto flex rounded-lg bg-slate-100 p-1 text-xs" role="group" aria-label="Táblázat nézete">
            {([false, true] as const).map((d) => (
              <button
                key={String(d)}
                onClick={() => setDense(d)}
                aria-pressed={dense === d}
                className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 ${
                  dense === d ? 'bg-white font-semibold text-slate-900 shadow-sm' : 'font-medium text-slate-600 hover:text-slate-900'
                }`}
              >
                {d ? <Rows4 className="h-3.5 w-3.5" /> : <Rows3 className="h-3.5 w-3.5" />}
                {d ? 'Tömör' : 'Részletes'}
              </button>
            ))}
          </div>
          <button onClick={addCustom} className={BTN_SECONDARY}>
            <Plus className="h-4 w-4" /> Egyedi kockázat
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className={`w-full text-sm ${dense ? 'min-w-[860px]' : 'min-w-[1100px]'}`}>
            <thead className="border-b border-slate-200/80 bg-slate-50/80 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
              <tr>
                <th className="w-16 px-3 py-2.5" />
                <th className="px-3 py-2.5">Kockázat</th>
                <th className="px-2 py-2.5 text-center" title="Valószínűség 1–5">
                  Valósz.
                </th>
                <th className="px-2 py-2.5 text-center" title="Hatás 1–5">
                  Hatás
                </th>
                <th className="px-2 py-2.5 text-center">
                  Pont <InfoTip term="score" label="pontszám" />
                </th>
                <th className="px-2 py-2.5 text-right">
                  Kitettség (Ft) <InfoTip term="grossExposure" label="kitettség" />
                </th>
                <th className="px-2 py-2.5 text-right">
                  Várható <InfoTip term="expectedLoss" label="várható veszteség" />
                </th>
                {!dense && <th className="px-2 py-2.5 text-center">Munkanap</th>}
                {!dense && <th className="px-2 py-2.5">Divízió / díj</th>}
                <th className="w-10 px-2 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visible.map((r) => (
                <RiskRow
                  key={r.id}
                  risk={r}
                  focus={focusCodes.has(r.code)}
                  materialityHuf={materialityHuf}
                  company={company}
                  expanded={expanded.has(r.id)}
                  onToggleExpand={() =>
                    setExpanded((s) => {
                      const n = new Set(s);
                      if (n.has(r.id)) n.delete(r.id);
                      else n.add(r.id);
                      return n;
                    })
                  }
                  scored={scoredById.get(r.id)}
                  eff={effById.get(r.id)!}
                  kindAdjustment={adjustments?.[r.code]}
                  onChange={(patch) => update(r.id, patch)}
                  onDelete={r.id.startsWith('CUS-') ? () => setItems((xs) => xs.filter((x) => x.id !== r.id)) : undefined}
                  dense={dense}
                />
              ))}
              {visible.length === 0 && (
                <tr>
                  <td colSpan={dense ? 8 : 10} className="px-3 py-10 text-center text-slate-500">
                    Nincs a szűrésnek megfelelő tétel.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ── 90 napos akcióterv ──────────────────────────────────── */}
      <section id="akcioterv" className="scroll-mt-28 pt-2">
        <SectionTitle icon={<CalendarClock className="h-4 w-4" />} title="90 napos prioritási akcióterv" />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {WINDOWS.map((w) => (
            <Card key={w} className={`p-3 ${w === 'BACKLOG' ? 'bg-slate-50/80' : ''}`}>
              <div className="mb-3 flex items-center justify-between px-1">
                <h3 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-600">{WINDOW_LABEL[w]}</h3>
                <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-bold tabular-nums text-brand-700">{actionPlan[w].length}</span>
              </div>
              <ol className="space-y-2">
                {actionPlan[w].map((r, idx) => (
                  <li key={r.id} className="rounded-lg border border-slate-200/80 bg-white p-3 shadow-xs">
                    <div className="flex items-start gap-2">
                      <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${RAG_STYLE[r.rag].dot}`} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold leading-snug text-slate-900">
                          {idx + 1}. {r.title}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-500">{r.remediation || 'Javaslat kitöltendő.'}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                          {r.quickWin && (
                            <Badge tone="brand" icon={<Zap className="h-3 w-3" />}>
                              Quick win
                            </Badge>
                          )}
                          <span>{PILLAR_LABEL[r.pillar]}</span>
                          <span aria-hidden>·</span>
                          <span>{r.remediationDays} nap</span>
                          <span aria-hidden>·</span>
                          <span>{formatHufShort(r.expectedLossHuf)} várható</span>
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
                {actionPlan[w].length === 0 && <li className="py-4 text-center text-xs text-slate-400">Nincs tétel</li>}
              </ol>
            </Card>
          ))}
        </div>
      </section>

      {/* ── Mi lenne, ha…? ──────────────────────────────────────── */}
      {modules.isOn('WHATIF') && (
        <div id="mi-lenne-ha" className="scroll-mt-28">
          <WhatIfPanel key={projectId} items={items} opts={engineOpts} result={result} />
        </div>
      )}

      {/* ── Várható vevői kérdések ───────────────────────────────── */}
      {modules.isOn('BUYER_QUESTIONS') && (
        <div id="vevoi-kerdesek" className="scroll-mt-28">
          <BuyerQuestionsPanel companyName={companyName} result={result} highlighted={kind === 'VENDOR_DD' || kind === 'BUY_SIDE_DD'} />
        </div>
      )}

      {/* ── Utókövetés ─────────────────────────────────────────── */}
      {modules.isOn('FOLLOWUP') && (
        <div id="utokovetes" className="scroll-mt-28">
          <FollowUpPanel
            scenarioId={projectId}
            kind={kind}
            items={items}
            opts={engineOpts}
            result={result}
            onStatus={(id, status) => update(id, { remediationStatus: status })}
          />
        </div>
      )}

      {/* ── Keresztértékesítés + kredit ─────────────────────────── */}
      <section id="pipeline" className="grid scroll-mt-28 gap-4 lg:grid-cols-[1fr_360px]">
        <Card className="p-5">
          <SectionTitle icon={<BriefcaseBusiness className="h-4 w-4" />} title="Remediation pipeline divíziónként" compact />
          <div className="space-y-3">
            {DIVISIONS.map((d) => {
              const v = pipeline.byDivision[d];
              const pct = pipeline.totalFeeHuf ? (v.feeHuf / pipeline.totalFeeHuf) * 100 : 0;
              return (
                <div key={d} className="grid grid-cols-[120px_1fr_110px] items-center gap-3 text-sm">
                  <span className="font-medium text-slate-600">{DIVISION_LABEL[d]}</span>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-brand-600" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-right font-semibold tabular-nums text-slate-900">
                    {formatHufShort(v.feeHuf)} <span className="text-xs font-normal text-slate-500">({v.count})</span>
                  </span>
                </div>
              );
            })}
          </div>
        </Card>
        <div className="rounded-xl bg-navy-900 p-5 text-white shadow-sm">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Beszámítási egyenleg</h3>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-400">Javasolt remediáció</dt>
              <dd className="tabular-nums">{formatHuf(pipeline.totalFeeHuf)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-400">Audit díj kredit (100%)</dt>
              <dd className="tabular-nums text-emerald-400">− {formatHuf(pipeline.creditHuf)}</dd>
            </div>
            <div className="flex justify-between border-t border-white/10 pt-2 text-base font-bold">
              <dt>Nettó ügyfélnek</dt>
              <dd className="tabular-nums">{formatHuf(pipeline.netAfterCreditHuf)}</dd>
            </div>
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
  focus,
  materialityHuf,
  company,
  expanded,
  onToggleExpand,
  scored,
  eff,
  kindAdjustment,
  onChange,
  onDelete,
  dense,
}: {
  risk: RiskItem;
  focus: boolean;
  materialityHuf: number;
  company: CompanyProfile;
  expanded: boolean;
  onToggleExpand: () => void;
  scored?: ScoredRisk;
  eff: Omit<ScoredRisk, 'priority'>;
  kindAdjustment?: KindAdjustment;
  onChange: (patch: Partial<RiskItem>) => void;
  onDelete?: () => void;
  /** Tömör nézet: leírás, munkanap és divízió csak a lenyitott sorban. */
  dense: boolean;
}) {
  const score = eff.score;
  const exposure = resolveExposure(r, company);
  const hasFormula = Boolean(r.valuation && r.valuation.formula.type !== 'MANUAL');
  const setExposure = (v: number) => (hasFormula ? onChange({ valuation: { ...r.valuation!, overrideHuf: v } }) : onChange({ exposureHuf: v }));
  // A nem azonosított sorokon is mutatjuk, milyen besorolást kapna – halványan.
  const rag: Rag = eff.rag;
  const isCustom = r.id.startsWith('CUS-');
  const sources = sourceCount(r);
  const unexplained = missingReasons(r).length;

  return (
    <Fragment>
      <tr id={`risk-${r.id}`} className={`scroll-mt-32 transition-colors hover:bg-slate-50/60 ${r.identified ? '' : 'text-slate-500'}`}>
        <td className="px-3 py-2 align-top">
          <div className="flex items-center gap-1">
            <button
              onClick={onToggleExpand}
              aria-label={expanded ? 'Részletek bezárása' : 'Miért? Források, levezetés, képlet'}
              aria-expanded={expanded}
              className="mt-0.5 text-slate-500 hover:text-slate-900"
            >
              {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>
            <button
              onClick={() => onChange({ identified: !r.identified })}
              aria-label={r.identified ? 'Kockázat kivétele' : 'Kockázat azonosítva'}
              className="mt-0.5 text-slate-700 hover:text-slate-900"
            >
              {r.identified ? <CheckSquare className="h-5 w-5 text-brand-600" /> : <Square className="h-5 w-5 text-slate-300" />}
            </button>
          </div>
        </td>
        <td className="max-w-[420px] px-3 py-2 align-top">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-slate-500">{r.code}</span>
            {isCustom ? (
              <select
                value={r.pillar}
                onChange={(e) => onChange({ pillar: e.target.value as Pillar })}
                className="rounded border border-slate-200 bg-transparent text-xs"
              >
                {PILLARS.map((p) => (
                  <option key={p} value={p}>
                    {PILLAR_LABEL[p]}
                  </option>
                ))}
              </select>
            ) : (
              <span className="text-xs text-slate-500">{PILLAR_LABEL[r.pillar]}</span>
            )}
            {focus && (
              <Badge tone="dark" title="Ennél az átvilágítás-típusnál mindig érdemes megvizsgálni">
                Kiemelt
              </Badge>
            )}
            {r.source && SOURCE_LABEL[r.source] && (
              <Badge
                tone={AI_SOURCES.has(r.source) ? 'violet' : 'brand'}
                icon={AI_SOURCES.has(r.source) ? <Sparkles className="h-3 w-3" /> : undefined}
                title={r.evidence}
              >
                {SOURCE_LABEL[r.source]}
              </Badge>
            )}
            {sources > 1 && (
              <button
                onClick={onToggleExpand}
                className="text-[11px] font-semibold text-brand-700 hover:underline"
                title="Független források – a lenyitott sorban"
              >
                {sources} forrás
              </button>
            )}
            {unexplained > 0 && (
              <button onClick={onToggleExpand} title="A súlyosság csökkentéséhez indoklás kell – a lenyitott sorban írható">
                <Badge tone="amber" icon={<AlertTriangle className="h-3 w-3" />}>
                  Indoklás hiányzik
                </Badge>
              </button>
            )}
          </div>
          {isCustom ? (
            <>
              <input
                value={r.title}
                onChange={(e) => onChange({ title: e.target.value })}
                className="mt-0.5 w-full rounded border border-slate-200 px-1.5 py-0.5 font-medium text-slate-900"
              />
              <input
                value={r.remediation}
                onChange={(e) => onChange({ remediation: e.target.value })}
                placeholder="Javasolt intézkedés…"
                className="mt-1 w-full rounded border border-slate-200 px-1.5 py-0.5 text-xs"
              />
              {r.evidence && <p className="mt-1 text-xs italic text-slate-500">{r.evidence}</p>}
            </>
          ) : (
            <>
              <p className={`mt-0.5 font-semibold ${r.identified ? 'text-slate-900' : ''}`}>{r.title}</p>
              {!dense && <p className="text-xs text-slate-500">{r.description}</p>}
              {!dense && r.evidence && <p className="mt-1 text-xs italic text-brand-700">{r.evidence}</p>}
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
            className={`inline-flex min-w-[72px] items-center justify-center gap-1 rounded-md px-2 py-1 text-xs font-bold ring-1 ring-inset ${
              r.identified ? RAG_STYLE[rag].badge : 'bg-slate-50 text-slate-500 ring-slate-200'
            }`}
            title={eff.materialityOverride ? 'A várható veszteség eléri a lényegességi küszöböt' : undefined}
          >
            {score} · {RAG_LABEL[rag]}
          </span>
          {eff.adjustment && (
            <button
              onClick={onToggleExpand}
              title={`Típus-korrekció: ${eff.adjustment.reason}`}
              className="mt-1 block w-full text-xs font-medium text-violet-700 hover:underline"
            >
              a cél miatt {describeAdjustment(eff.adjustment)} → {eff.likelihood} × {eff.impact}
            </button>
          )}
        </td>
        <td className="px-2 py-2 text-right align-top">
          <HufInput value={exposure.valueHuf} onChange={setExposure} className="w-36 rounded border border-slate-200 px-2 py-1 text-right tabular-nums" />
          <div className="mt-0.5 flex justify-end gap-1 text-xs" title={exposure.explanation}>
            {exposure.source === 'FORMULA' && (
              <button onClick={onToggleExpand} className="inline-flex items-center gap-0.5 text-brand-700 hover:underline">
                <Calculator className="h-3 w-3" /> képlet{exposure.unapprovedParameter && ' · jóváhagyandó'}
              </button>
            )}
            {exposure.source === 'OVERRIDE' && (
              <button
                onClick={() => onChange({ valuation: { ...r.valuation!, overrideHuf: null } })}
                className="inline-flex items-center gap-0.5 text-amber-700 hover:underline"
                title={`${exposure.explanation} – kattintásra vissza a képletre`}
              >
                <Pencil className="h-3 w-3" /> felülírva · visszaállít
              </button>
            )}
          </div>
        </td>
        <td className="whitespace-nowrap px-2 py-2 text-right align-top font-semibold tabular-nums text-slate-900">
          {scored ? formatHufShort(scored.expectedLossHuf) : '—'}
        </td>
        {!dense && (
          <>
            <td className="px-2 py-2 text-center align-top">
              <input
                type="number"
                min={0}
                value={r.remediationDays}
                onChange={(e) => onChange({ remediationDays: Math.max(0, Number(e.target.value) || 0) })}
                className="w-16 rounded border border-slate-200 px-1.5 py-1 text-center tabular-nums"
              />
              {scored?.quickWin && <Zap className="mx-auto mt-1 h-3.5 w-3.5 text-brand-600" aria-label="Quick win" />}
            </td>
            <td className="px-2 py-2 align-top">
              <select
                value={r.division}
                onChange={(e) => onChange({ division: e.target.value as Division })}
                className="w-full rounded border border-slate-200 bg-white px-1.5 py-1 text-xs"
              >
                {DIVISIONS.map((d) => (
                  <option key={d} value={d}>
                    {DIVISION_LABEL[d]}
                  </option>
                ))}
              </select>
              <HufInput
                value={r.serviceFeeHuf}
                onChange={(v) => onChange({ serviceFeeHuf: v })}
                className="mt-1 w-full rounded border border-slate-200 px-1.5 py-0.5 text-right text-xs tabular-nums"
              />
            </td>
          </>
        )}
        <td className="px-2 py-2 align-top">
          {onDelete && (
            <button onClick={onDelete} aria-label="Törlés" className="text-slate-300 hover:text-red-600">
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </td>
      </tr>
      {expanded && (
        <tr className="bg-canvas">
          <td />
          <td colSpan={dense ? 7 : 9} className="px-3 pb-4 pt-1">
            {dense && (
              <div className="mb-3 flex flex-wrap items-end gap-4 text-xs">
                {r.description && <p className="w-full text-slate-500">{r.description}</p>}
                <Field label="Munkanap">
                  <input
                    type="number"
                    min={0}
                    value={r.remediationDays}
                    onChange={(e) => onChange({ remediationDays: Math.max(0, Number(e.target.value) || 0) })}
                    className="w-20 rounded-lg border border-slate-200 bg-white px-2 py-1 text-center text-sm tabular-nums"
                  />
                </Field>
                <Field label="Divízió">
                  <select
                    value={r.division}
                    onChange={(e) => onChange({ division: e.target.value as Division })}
                    className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm"
                  >
                    {DIVISIONS.map((d) => (
                      <option key={d} value={d}>
                        {DIVISION_LABEL[d]}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Díj (Ft)">
                  <HufInput
                    value={r.serviceFeeHuf}
                    onChange={(v) => onChange({ serviceFeeHuf: v })}
                    className="w-32 rounded-lg border border-slate-200 px-2 py-1 text-right text-sm tabular-nums"
                  />
                </Field>
              </div>
            )}
            {kindAdjustment && (
              <label className="mb-3 flex items-start gap-2 rounded-lg border border-violet-100 bg-violet-50 p-2.5 text-xs text-violet-900">
                <input
                  type="checkbox"
                  checked={!r.ignoreKindAdjustment}
                  onChange={(e) => onChange({ ignoreKindAdjustment: !e.target.checked })}
                  className="mt-0.5 accent-violet-700"
                />
                <span>
                  <b>Típus-korrekció ({formatAdjustment(kindAdjustment)}):</b> {kindAdjustment.reason}{' '}
                  <span className="text-violet-700">
                    A megadott értékek: V{r.likelihood} × H{r.impact}.
                  </span>
                </span>
              </label>
            )}
            <div className="mb-4">
              <EvidencePanel risk={r} eff={eff} materialityHuf={materialityHuf} onChange={onChange} />
            </div>
            <RiskDetails risk={r} company={company} onChange={onChange} />
          </td>
        </tr>
      )}
    </Fragment>
  );
}

/** Lenyitott sor: indoklás (előtöltve), forintosító képlet paraméterei, javaslat. */
function RiskDetails({ risk: r, company, onChange }: { risk: RiskItem; company: CompanyProfile; onChange: (patch: Partial<RiskItem>) => void }) {
  const def = catalogDefault(r.code);
  const formula = r.valuation?.formula;
  const setFormula = (f: Formula) => onChange({ valuation: { formula: f, overrideHuf: r.valuation?.overrideHuf ?? null } });
  const computed = formula ? computeFormula(formula, company) : null;

  return (
    <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
      <div className="space-y-3">
        <label className="block">
          <span className="flex items-center justify-between text-xs font-medium text-slate-600">
            Szakmai indoklás (a riportba kerül)
            {def?.reasoning && r.reasoning !== def.reasoning && (
              <button onClick={() => onChange({ reasoning: def.reasoning })} className="font-normal text-brand-700 hover:underline">
                alapszöveg visszaállítása
              </button>
            )}
          </span>
          <textarea
            value={r.reasoning ?? ''}
            onChange={(e) => onChange({ reasoning: e.target.value })}
            rows={4}
            placeholder="Miért kockázat ez az adott cégnél? 1–3 mondat."
            className="mt-1 w-full rounded-md border border-slate-200 bg-white p-2 text-sm leading-relaxed text-slate-800 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-slate-600">Javasolt intézkedés (akcióterv)</span>
          <textarea
            value={r.remediation}
            onChange={(e) => onChange({ remediation: e.target.value })}
            rows={2}
            className="mt-1 w-full rounded-md border border-slate-200 bg-white p-2 text-sm text-slate-800 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
          />
        </label>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
        <div className="mb-2 flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
            <Calculator className="h-3.5 w-3.5" /> Forintosítás
          </span>
          <select
            value={formula?.type ?? 'MANUAL'}
            onChange={(e) => setFormula(defaultFormula(e.target.value as Formula['type'], def?.valuation?.formula))}
            className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-xs"
          >
            <option value="MANUAL">Kézi becslés</option>
            <option value="REVENUE_SHARE">Árbevétel-arány</option>
            <option value="PER_ITEM">Darabszám × tételösszeg</option>
            <option value="DSO_GAP">DSO-különbség (forgótőke)</option>
          </select>
        </div>

        {formula?.type === 'REVENUE_SHARE' && (
          <div className="space-y-2">
            <Field label={`Arány: ${formula.label}`}>
              <PercentInput value={formula.share} onChange={(v) => setFormula({ ...formula, share: v })} />
            </Field>
            <label className="flex items-center gap-2 text-xs text-slate-600">
              <input
                type="checkbox"
                checked={formula.marginBased}
                onChange={(e) => setFormula({ ...formula, marginBased: e.target.checked })}
                className="accent-brand-600"
              />
              Veszteség = elmaradó fedezet (nem a teljes árbevétel)
            </label>
          </div>
        )}
        {formula?.type === 'PER_ITEM' && (
          <div className="flex flex-wrap gap-3">
            <Field label={`Darab (${formula.label})`}>
              <NumberInput value={formula.count} onChange={(v) => setFormula({ ...formula, count: v })} />
            </Field>
            <Field label="Tételösszeg (Ft)">
              <HufInput
                value={formula.unitAmountHuf}
                onChange={(v) => setFormula({ ...formula, unitAmountHuf: v })}
                className="w-32 rounded border border-slate-200 px-2 py-1 text-right tabular-nums"
              />
            </Field>
          </div>
        )}
        {formula?.type === 'DSO_GAP' && <p className="text-xs text-slate-500">A cégadatok DSO-értékeiből számol (fent).</p>}
        {(!formula || formula.type === 'MANUAL') && <p className="text-xs text-slate-500">A kitettség a táblázatban kézzel adható meg.</p>}

        {computed && computed.valueHuf != null && (
          <div className="mt-3 rounded bg-slate-50 p-2 text-xs text-slate-600">
            <div className="font-medium text-slate-900">≈ {formatHuf(computed.valueHuf)}</div>
            <div className="mt-0.5">{computed.explanation}</div>
            {computed.unapprovedParameter && formula?.type === 'PER_ITEM' && formula.paramKey && (
              <div className="mt-1 text-amber-700">
                ⚠ Nem jóváhagyott paraméter ({EXPERT_PARAMETERS[formula.paramKey].owner}): {EXPERT_PARAMETERS[formula.paramKey].note}
              </div>
            )}
            {r.valuation?.overrideHuf != null && <div className="mt-1 text-amber-700">Felülírva: {formatHuf(r.valuation.overrideHuf)}</div>}
          </div>
        )}
      </div>
    </div>
  );
}

function defaultFormula(type: Formula['type'], catalogFormula?: Formula): Formula {
  if (catalogFormula?.type === type) return catalogFormula;
  switch (type) {
    case 'REVENUE_SHARE':
      return { type, share: 0.1, marginBased: true, label: 'érintett árbevétel' };
    case 'PER_ITEM':
      return { type, count: 1, unitAmountHuf: 1_000_000, label: 'tétel' };
    case 'DSO_GAP':
      return { type, label: 'lekötött forgótőke' };
    default:
      return { type: 'MANUAL' };
  }
}

function Field({ label, children, term }: { label: string; children: ReactNode; term?: GlossaryKey }) {
  return (
    <label className="flex flex-col gap-1 text-xs text-slate-600">
      <span className="flex items-center gap-1">
        {label}
        {term && <InfoTip term={term} label={label} />}
      </span>
      {children}
    </label>
  );
}

function NumberInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <input
      type="number"
      min={0}
      value={value}
      onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
      className="w-20 rounded border border-slate-200 bg-white px-2 py-1 text-right text-sm tabular-nums text-slate-900"
    />
  );
}

/** Százalék mező: a felületen 38, a modellben 0,38. */
function PercentInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <span className="flex items-center gap-1">
      <input
        type="number"
        min={0}
        max={100}
        step={1}
        value={Math.round(value * 1000) / 10}
        onChange={(e) => onChange(Math.min(100, Math.max(0, Number(e.target.value) || 0)) / 100)}
        className="w-20 rounded border border-slate-200 bg-white px-2 py-1 text-right text-sm tabular-nums text-slate-900"
      />
      <span className="text-slate-500">%</span>
    </span>
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
    <Card className="p-4">
      <h3 className="text-sm font-bold text-slate-900">Kockázati mátrix</h3>
      <p className="mb-3 text-xs text-slate-500">Valószínűség × hatás; cellára kattintva szűr.</p>
      <div className="flex gap-1.5">
        <span className="rotate-180 self-center text-xs text-slate-500 [writing-mode:vertical-rl]">Valószínűség →</span>
        <div className="grid grid-rows-5 gap-1 pb-9 text-xs text-slate-500">
          {[...SCALE].reverse().map((l) => (
            <span key={l} className="flex items-center">
              {l}
            </span>
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
                    aria-label={`Valószínűség ${l}, hatás ${i}: ${list.length} tétel, ${RAG_LABEL[rag].toLowerCase()} zóna`}
                    className={`relative flex aspect-square items-center justify-center rounded-md text-xs font-bold transition ${RAG_STYLE[rag].cell} ${
                      isSel ? 'ring-2 ring-brand-600 ring-offset-1' : ''
                    } ${list.length ? 'cursor-pointer text-slate-900 hover:brightness-95' : 'cursor-default text-transparent'}`}
                  >
                    {list.length || '·'}
                  </button>
                );
              }),
            )}
          </div>
          <div className="mt-1 grid grid-cols-5 text-center text-xs text-slate-500">
            {SCALE.map((i) => (
              <span key={i}>{i}</span>
            ))}
          </div>
          <p className="text-center text-xs text-slate-500">Hatás →</p>
        </div>
      </div>
    </Card>
  );
}

function ScaleSelect({ value, onChange }: { value: Scale5; onChange: (v: Scale5) => void }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(Number(e.target.value) as Scale5)}
      className="rounded border border-slate-200 bg-white px-1.5 py-1 tabular-nums"
    >
      {SCALE.map((n) => (
        <option key={n} value={n}>
          {n}
        </option>
      ))}
    </select>
  );
}

/** Forint mező: fókuszban nyers szám, egyébként ezres tagolással. */
function HufInput({
  value,
  onChange,
  className = '',
  placeholder,
  emptyWhenZero,
}: {
  value: number;
  onChange: (v: number) => void;
  className?: string;
  placeholder?: string;
  /** A 0 „nincs megadva”: üres mező a helyőrzővel (pl. árbevétel). */
  emptyWhenZero?: boolean;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <input
      inputMode="numeric"
      value={draft ?? (emptyWhenZero && !value ? '' : value.toLocaleString('hu-HU'))}
      placeholder={placeholder}
      onFocus={() => setDraft(emptyWhenZero && !value ? '' : String(value))}
      onChange={(e) => {
        const digits = e.target.value.replace(/[^\d]/g, '');
        setDraft(digits);
        onChange(digits ? Number(digits) : 0);
      }}
      onBlur={() => setDraft(null)}
      className={`bg-white outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 ${className}`}
    />
  );
}

/** Tapadó belső menü: ugrás a hosszú oldal szakaszaira; a látható szakasz kiemelve. */
function SectionNav({ sections }: { sections: { id: string; label: string }[] }) {
  const [active, setActive] = useState(sections[0]?.id);
  const ids = sections.map((x) => x.id).join(',');
  useEffect(() => {
    const els = ids
      .split(',')
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => Boolean(el));
    if (!els.length || typeof IntersectionObserver === 'undefined') return;
    const obs = new IntersectionObserver(
      (entries) => {
        const top = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (top) setActive(top.target.id);
      },
      { rootMargin: '-120px 0px -60% 0px' },
    );
    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, [ids]);
  return (
    <nav
      aria-label="Ugrás az oldalon"
      className="sticky top-14 z-20 -mx-1 flex gap-1 overflow-x-auto rounded-xl border border-slate-200/80 bg-white/95 p-1 shadow-[0_1px_2px_rgba(15,23,42,0.04)] backdrop-blur print:hidden"
    >
      {sections.map((x) => (
        <button
          key={x.id}
          onClick={() => {
            setActive(x.id);
            document.getElementById(x.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }}
          aria-current={active === x.id ? 'location' : undefined}
          className={`shrink-0 rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
            active === x.id ? 'bg-brand-50 text-brand-700' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
          }`}
        >
          {x.label}
        </button>
      ))}
    </nav>
  );
}

function ToolbarButton({ onClick, icon, children }: { onClick: () => void; icon: ReactNode; children: ReactNode }) {
  return (
    <button onClick={onClick} className={BTN_TOOL}>
      {icon}
      {children}
    </button>
  );
}

function SectionTitle({ icon, title, compact }: { icon: ReactNode; title: string; compact?: boolean }) {
  return (
    <h2 className={`mb-4 flex items-center gap-2.5 font-bold tracking-tight text-slate-900 ${compact ? 'text-sm' : 'text-lg'}`}>
      <IconBox tone="brand" size="sm">
        {icon}
      </IconBox>
      {title}
    </h2>
  );
}

/** Javasolt tétel felvétele: körvonalas „+” címke. */
function SuggestChip({ title, onClick, children }: { title?: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="inline-flex items-center gap-1 rounded-full border border-brand-200 bg-white px-2.5 py-1 font-medium text-brand-700 hover:border-brand-300 hover:bg-brand-50"
    >
      <Plus className="h-3 w-3" /> {children}
    </button>
  );
}
