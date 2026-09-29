import type { EngagementKind } from '@/lib/engagement/kinds';
import type { SuggestedRedFlag } from '@/lib/interview/types';
import type { PageId } from '@/lib/guide';
import { markSaved } from '@/lib/localSave';
import { readJson as read, readRaw, removeKey, writeJson as write } from '@/lib/storage';
import { BLANK, getScenario, GYARTO, isDemoScenario, type Scenario } from '@/lib/scenarios';
import { catalogDefault, PILLAR_LABEL } from './catalog';
import type { RiskItem, Scale5 } from './types';
import { DEFAULT_COMPANY, resolveExposure, type CompanyProfile } from './valuation';

/**
 * MVP munkaállapot (egy projekt) a böngészőben. Élesben ugyanez a forma
 * a Supabase `engagements` + `red_flags` sorokból áll elő; a komponensek
 * csak ezen a modulon keresztül olvasnak/írnak, így a csere egy helyen történik.
 *
 * Több projekt: minden projektnek saját azonosítója (`projectId`) van, ez a
 * tárolási kulcs minden modulban (adatgyűjtés, interjú, időkeret…). A
 * `scenarioId` csak azt mondja meg, melyik mintából indult (mintaadatok,
 * minta-gombok); saját projektnél ez az üres minta.
 */
export interface Workspace {
  projectId: string;
  /** Melyik mintaesetből indult (dokumentum-tények, interjú-minta); saját projektnél 'ures'. */
  scenarioId: string;
  companyName: string;
  company: CompanyProfile;
  kind: EngagementKind;
  materialityHuf: number;
  items: RiskItem[];
}

export interface ProjectMeta {
  id: string;
  companyName: string;
  kind: EngagementKind;
  scenarioId: string;
  /** Bemutató (kitalált mintacég) projekt. */
  isDemo: boolean;
  createdAt: string;
  updatedAt: string;
}

const INDEX_KEY = 'ict-hc:projects:v1';
const ACTIVE_KEY = 'ict-hc:active-project:v1';
const wsKey = (id: string) => `ict-hc:workspace:v3:${id}`;
/** A korábbi, egyprojektes tárolás (migráláshoz). */
export const STORAGE_KEY = 'ict-hc:workspace:v2';
const LEGACY_KEY = 'ict-hc:red-flag-matrix:v1';
export const PROJECT_EVENT = 'ict-hc:project';
/** Az aktív projekt adatai kívülről (pl. a kalauzból) változtak: a nyitott oldal töltse újra. */
export const RELOAD_EVENT = 'ict-hc:reload';

export function reloadProject(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(RELOAD_EVENT));
}

/** Mintaesetből induló, friss munkaállapot. */
export function workspaceFromScenario(s: Scenario, projectId: string = s.id): Workspace {
  return {
    projectId,
    scenarioId: s.id,
    companyName: s.companyName,
    company: s.company,
    kind: s.kind,
    materialityHuf: s.materialityHuf,
    items: s.items,
  };
}

export const DEFAULT_WORKSPACE: Workspace = workspaceFromScenario(GYARTO);

function normalize(saved: Partial<Workspace>, projectId: string): Workspace {
  const scenarioId = saved.scenarioId === BLANK.id ? BLANK.id : getScenario(saved.scenarioId ?? projectId).id;
  const base = getScenario(scenarioId);
  return {
    projectId,
    scenarioId,
    companyName: typeof saved.companyName === 'string' ? saved.companyName : base.companyName,
    company: { ...DEFAULT_COMPANY, ...(saved.company ?? {}) },
    kind: saved.kind ?? base.kind,
    materialityHuf: typeof saved.materialityHuf === 'number' ? saved.materialityHuf : base.materialityHuf,
    items: Array.isArray(saved.items) ? saved.items.map(hydrateItem) : base.items,
  };
}

function metaFor(ws: Workspace, prev: ProjectMeta | undefined, now: string): ProjectMeta {
  return {
    id: ws.projectId,
    companyName: ws.companyName,
    kind: ws.kind,
    scenarioId: ws.scenarioId,
    isDemo: prev?.isDemo ?? isDemoScenario(ws.projectId),
    createdAt: prev?.createdAt ?? now,
    updatedAt: now,
  };
}

/**
 * A projektlista. Első futáskor a korábbi (egyprojektes) mentésből
 * bemutató projekt lesz, ugyanazzal az azonosítóval, így a hozzá tartozó
 * adatgyűjtés, interjúk és időkeret is megmarad.
 */
// A lista minden renderelésnél és mentésnél kell: csak akkor dolgozzuk fel újra, ha a tárolt szöveg változott.
let indexCache: { raw: string; list: ProjectMeta[] } | null = null;
const NO_PROJECTS: ProjectMeta[] = [];

export function listProjects(): ProjectMeta[] {
  const raw = readRaw(INDEX_KEY);
  if (raw && indexCache?.raw === raw) return indexCache.list;
  const list = read<ProjectMeta[]>(INDEX_KEY);
  if (raw && Array.isArray(list)) {
    indexCache = { raw, list };
    return list;
  }
  const legacy = read<Partial<Workspace>>(STORAGE_KEY) ?? read<Partial<Workspace>>(LEGACY_KEY);
  if (!legacy) return NO_PROJECTS; // állandó tömb: a változásfigyelés azonosság alapján hasonlít
  const id = getScenario(legacy.scenarioId).id;
  const ws = normalize({ ...legacy, scenarioId: id }, id);
  const meta = metaFor(ws, undefined, new Date().toISOString());
  write(wsKey(id), ws);
  write(INDEX_KEY, [meta]);
  write(ACTIVE_KEY, id);
  return [meta];
}

/**
 * Az aktív projekt BÖNGÉSZŐLAPONKÉNT: így két lapon két különböző projekt
 * lehet nyitva egyszerre, és az egyik lap váltása nem viszi el a másikat.
 * Új lap a legutóbb használt projekttel indul.
 */
const TAB_KEY = 'ict-hc:tab-project';

function tabGet(): string | null {
  try {
    return typeof sessionStorage === 'undefined' ? null : sessionStorage.getItem(TAB_KEY);
  } catch {
    return null;
  }
}

function tabSet(id: string): void {
  try {
    if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(TAB_KEY, id);
  } catch {
    /* ignore */
  }
}

export function activeProjectId(): string {
  const list = listProjects(); // egyben migráció, ha kell
  const exists = (id: string) => isDemoScenario(id) || list.some((p) => p.id === id);
  const tab = tabGet();
  if (tab && exists(tab)) return tab;
  const id = read<string>(ACTIVE_KEY);
  return typeof id === 'string' && id && exists(id) ? id : DEFAULT_WORKSPACE.projectId;
}

export function setActiveProject(id: string): void {
  tabSet(id);
  write(ACTIVE_KEY, id); // a legutóbb használt: új lap ezzel indul
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(PROJECT_EVENT));
}

// ── Hol tartottál: projektenként az utoljára nyitott oldal ─────────
const LAST_PAGE_KEY = 'ict-hc:last-page:v1';
export type ProjectPage = PageId;

export function rememberPage(projectId: string, page: ProjectPage): void {
  const map = read<Record<string, ProjectPage>>(LAST_PAGE_KEY) ?? {};
  if (map[projectId] === page) return;
  write(LAST_PAGE_KEY, { ...map, [projectId]: page });
}

/** Az utoljára nyitott oldal; saját projektnél alapból az Adatgyűjtés, bemutatónál a mátrix. */
export function lastPageOf(projectId: string): ProjectPage {
  const page = (read<Record<string, ProjectPage>>(LAST_PAGE_KEY) ?? {})[projectId];
  return page ?? (isDemoScenario(projectId) ? 'matrix' : 'adatok');
}

export function loadProject(id: string): Workspace {
  const saved = read<Partial<Workspace>>(wsKey(id));
  if (saved) return normalize(saved, id);
  // Még nem mentett bemutató projekt: a minta kiinduló állapota.
  return workspaceFromScenario(getScenario(isDemoScenario(id) ? id : GYARTO.id), id);
}

/** Az aktív projekt munkaállapota. */
export function loadWorkspace(): Workspace {
  try {
    return loadProject(activeProjectId());
  } catch {
    return DEFAULT_WORKSPACE;
  }
}

/**
 * Korábbi verzióban mentett tétel kiegészítése a katalógus újabb mezőivel
 * (indoklás, képlet). A felhasználó által már kitöltött értéket nem írjuk felül.
 */
export function hydrateItem(item: RiskItem): RiskItem {
  const def = catalogDefault(item.code);
  if (!def) return item;
  let valuation = item.valuation ?? def.valuation;
  // Ha a korábbi verzióban kézzel átírták az összeget, az szakértői felülírás marad.
  if (!item.valuation && valuation && item.exposureHuf !== def.exposureHuf) {
    valuation = { ...valuation, overrideHuf: item.exposureHuf };
  }
  return { ...item, reasoning: item.reasoning ?? def.reasoning, valuation };
}

/** A „módosítva” időpontot legfeljebb percenként írjuk a listába (gépelésnél ne írjuk újra minden billentyűre). */
const UPDATED_AT_RESOLUTION_MS = 60_000;

export function saveWorkspace(ws: Workspace, now = Date.now()): void {
  if (!write(wsKey(ws.projectId), ws)) return; // privát mód – a munkamenet végéig memóriában marad
  const list = listProjects();
  const prev = list.find((p) => p.id === ws.projectId);
  const unchanged =
    prev &&
    prev.companyName === ws.companyName &&
    prev.kind === ws.kind &&
    prev.scenarioId === ws.scenarioId &&
    now - Date.parse(prev.updatedAt) < UPDATED_AT_RESOLUTION_MS;
  if (!unchanged) {
    const meta = metaFor(ws, prev, new Date(now).toISOString());
    write(INDEX_KEY, prev ? list.map((p) => (p.id === ws.projectId ? meta : p)) : [meta, ...list]);
  }
  markSaved();
}

export function newProjectId(now = Date.now()): string {
  return `p-${now.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/** Új, saját projekt az üres mintából; ez lesz az aktív. */
export function createProject(input: { companyName: string; kind: EngagementKind; materialityHuf?: number }, now = Date.now()): Workspace {
  const id = newProjectId(now);
  const ws: Workspace = {
    ...workspaceFromScenario(BLANK, id),
    companyName: input.companyName.trim(),
    kind: input.kind,
    materialityHuf: input.materialityHuf ?? BLANK.materialityHuf,
  };
  saveWorkspace(ws);
  setActiveProject(id);
  return ws;
}

/** Bemutató projekt megnyitása: ha már dolgoztál rajta, a mentett állapot jön vissza. */
export function openDemo(scenarioId: string): void {
  if (!read(wsKey(scenarioId))) saveWorkspace(workspaceFromScenario(getScenario(scenarioId)));
  setActiveProject(scenarioId);
}

/** A projekt munkaállapotának és listabejegyzésének törlése (a modulok adatait a projects.ts törli). */
export function removeProjectWorkspace(id: string): void {
  removeKey(wsKey(id));
  write(
    INDEX_KEY,
    listProjects().filter((p) => p.id !== id),
  );
}

/** Legutóbb módosított elöl (projektválasztó, kalauz, törlés utáni következő projekt). */
export function byRecent(a: ProjectMeta, b: ProjectMeta): number {
  return b.updatedAt.localeCompare(a.updatedAt);
}

const clamp5 = (n: number): Scale5 => Math.min(5, Math.max(1, Math.round(n))) as Scale5;

/**
 * Elfogadott AI-javaslat beolvasztása a kockázati listába.
 * Katalógustételnél: azonosítottá tesszük, a súlyosságot sosem csökkentjük.
 * Egyéb esetben új, egyedi tétel jön létre.
 */
export function applySuggestion(items: RiskItem[], s: SuggestedRedFlag, evidence: string, company: CompanyProfile = DEFAULT_COMPANY): RiskItem[] {
  const existing = s.templateCode ? items.find((r) => r.code === s.templateCode) : undefined;
  if (existing) {
    return items.map((r) =>
      r.id !== existing.id
        ? r
        : {
            ...r,
            identified: true,
            likelihood: clamp5(Math.max(r.likelihood, s.likelihood)),
            impact: clamp5(Math.max(r.impact, s.impact)),
            ...raiseExposure(r, s.exposureHufEstimate, company),
            source: 'AI_INTERVIEW',
            evidence,
          },
    );
  }
  const n = items.filter((r) => r.id.startsWith('CUS-')).length + 1;
  const code = `CUS-${String(n).padStart(2, '0')}`;
  return [
    {
      id: `${code}-${Date.now().toString(36)}`,
      code,
      pillar: s.pillar,
      title: s.title,
      description: `${PILLAR_LABEL[s.pillar]} · interjúból`,
      reasoning: s.rationale,
      identified: true,
      likelihood: clamp5(s.likelihood),
      impact: clamp5(s.impact),
      exposureHuf: s.exposureHufEstimate ?? 0,
      remediationDays: 5,
      remediation: '',
      division: 'ADVISORY',
      serviceFeeHuf: 0,
      source: 'AI_INTERVIEW',
      evidence,
    },
    ...items,
  ];
}

/** Az interjúban elhangzott összeg csak emelheti a kitettséget, csökkenteni nem. */
function raiseExposure(r: RiskItem, estimate: number | null, company: CompanyProfile): Partial<RiskItem> {
  if (estimate == null) return {};
  const current = resolveExposure(r, company).valueHuf;
  if (estimate <= current) return {};
  if (r.valuation && r.valuation.formula.type !== 'MANUAL') {
    return { valuation: { ...r.valuation, overrideHuf: estimate } };
  }
  return { exposureHuf: estimate };
}
