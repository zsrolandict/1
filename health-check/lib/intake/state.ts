import type { EngagementKind } from '@/lib/engagement/kinds';
import type { KnownFact } from '@/lib/interview/types';
import { z } from 'zod';
import { evaluateChecklist, sanitizeAnswers, type ChecklistAnswers } from './checklist';
import { documentToIntake } from './documents/toIntake';
import type { DocumentRecord } from './documents/types';
import { buildRequestList, EMPTY_PROFILE, normalizeProfile, type CaseProfile, type DocRequest, type RequestStatus } from './requests';
import type { SynthesisResult } from './synthesis';
import { registryFindings, type RegistryRecord } from './registry';
import type { TableAnalysis } from './tables/metrics';
import type { TableKind } from './tables/spec';
import type { IntakeResult } from './types';
import { markSaved, markSaveFailed } from '@/lib/localSave';
import { normalizeFinancials, type FinancialProfile } from './financials/model';
import { financialFindings } from './financials/rules';
import { DEFAULT_COMPANY, type CompanyProfile } from '@/lib/risk/valuation';

/**
 * Adatgyűjtés munkaállapota egy projekthez. Élesben a `checklist_responses`,
 * `documents.ai_extraction` és a 0005-ös migráció `intake_tables` táblája;
 * a prototípus a böngészőben tárolja. Nyers fájl és teljes dokumentumszöveg
 * nem kerül ide, csak a számolt / ellenőrzött eredmény.
 */
export interface IntakeState {
  /** Előzetes tényállás (ágazat, létszám, jellemzők, szöveg). */
  profile: CaseProfile;
  /** Iratonkénti állapot; hiányzik = bekérve. */
  requestStatus: Record<string, RequestStatus>;
  /** AI-javaslatból vagy kézzel felvett extra iratok. */
  extraRequests: DocRequest[];
  /** Az utolsó AI-szintézis eredménye. */
  synthesis?: SynthesisResult | null;
  /** Kiolvasott cégkivonat. */
  registry?: RegistryRecord | null;
  /** Pénzügyi alapadatok (beszámoló kulcsszámai, beírható tények), forrással. */
  financials?: FinancialProfile;
  answers: ChecklistAnswers;
  /**
   * A tárolóból betöltéskor sémán elbukott válaszok (pl. 250%, szöveg a szám
   * helyén) okkal: nem számítanak, a felület jelzi őket; helyes válasszal
   * vagy törléssel tűnnek el.
   */
  invalidAnswers?: Record<string, { value: unknown; reason: string }>;
  tables: Partial<Record<TableKind, TableAnalysis>>;
  documents: DocumentRecord[];
  /** Elfogadott (a mátrixba / cégadatokba átvett) javaslatok kulcsai. */
  accepted: string[];
  /** Elvetett javaslatok kulcsai. */
  dismissed: string[];
}

export const EMPTY_INTAKE: IntakeState = {
  profile: EMPTY_PROFILE,
  requestStatus: {},
  extraRequests: [],
  answers: {},
  tables: {},
  documents: [],
  accepted: [],
  dismissed: [],
};

/** Tárolási kulcs projektenként (a projektszintű műveletek – törlés, mentés fájlba – is ezt használják). */
export const intakeKey = (scenarioId: string) => `ict-hc:intake:v1:${scenarioId}`;

export function loadIntake(scenarioId: string): IntakeState {
  try {
    const raw = localStorage.getItem(intakeKey(scenarioId));
    if (!raw) return EMPTY_INTAKE;
    const saved = JSON.parse(raw) as Partial<IntakeState>;
    // Kérdőív és iratállapot sémával (audit K5): ezekből számol a szabálymotor és a lefedettség.
    const { answers, invalid } = sanitizeAnswers(saved.answers);
    const prevInvalid = saved.invalidAnswers && typeof saved.invalidAnswers === 'object' ? saved.invalidAnswers : {};
    const invalidAnswers = Object.fromEntries(Object.entries({ ...prevInvalid, ...invalid }).filter(([id]) => answers[id] === undefined));
    return {
      ...EMPTY_INTAKE,
      ...saved,
      profile: normalizeProfile(saved.profile ?? {}),
      financials: normalizeFinancials(saved.financials),
      answers,
      requestStatus: sanitizeRequestStatus(saved.requestStatus),
      ...(Object.keys(invalidAnswers).length ? { invalidAnswers } : { invalidAnswers: undefined }),
    };
  } catch {
    return EMPTY_INTAKE;
  }
}

const RequestStatusSchema = z.enum(['REQUESTED', 'RECEIVED', 'MISSING', 'NA']);

/** Iratállapot: csak ismert állapotérték marad (hiányzó = bekérve). */
export function sanitizeRequestStatus(raw: unknown): Record<string, RequestStatus> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  return Object.fromEntries(Object.entries(raw as Record<string, unknown>).filter(([, v]) => RequestStatusSchema.safeParse(v).success)) as Record<
    string,
    RequestStatus
  >;
}

export function saveIntake(scenarioId: string, state: IntakeState): void {
  try {
    localStorage.setItem(intakeKey(scenarioId), JSON.stringify(state));
    markSaved();
  } catch {
    markSaveFailed(); // betelt tárhely vagy privát mód: a felület jelzi
  }
}

export function clearIntake(scenarioId: string): void {
  try {
    localStorage.removeItem(intakeKey(scenarioId));
  } catch {
    /* ignore */
  }
}

export interface IntakeResults {
  checklist: IntakeResult;
  tables: IntakeResult;
  documents: IntakeResult;
  financials: IntakeResult;
}

/** A pénzügyi szabályok a cégadatokhoz és a küszöbhöz mérnek; hiányzik = alapértékek. */
export interface IntakeContext {
  company?: CompanyProfile;
  materialityHuf?: number;
}

export function intakeResults(state: IntakeState, kind: EngagementKind, ctx: IntakeContext = {}): IntakeResults {
  const merge = (rs: IntakeResult[]): IntakeResult => ({
    suggestions: rs.flatMap((r) => r.suggestions),
    companySuggestions: rs.flatMap((r) => r.companySuggestions),
    facts: rs.flatMap((r) => r.facts),
  });
  return {
    checklist: evaluateChecklist(state.answers, kind, state.profile.sectors),
    tables: merge(Object.values(state.tables).map((t) => t!.result)),
    documents: merge(state.documents.map(documentToIntake)),
    financials: financialFindings(normalizeFinancials(state.financials), {
      kind,
      company: ctx.company ?? DEFAULT_COMPANY,
      materialityHuf: ctx.materialityHuf ?? 50_000_000,
      tables: state.tables,
      headcount: state.profile.headcount,
      litigationFlag: state.profile.flags.includes('LITIGATION'),
    }),
  };
}

/** Az interjúk ellentmondás-kereséséhez: a mintaeset tényei + az adatgyűjtés tényei. */
export function intakeFacts(state: IntakeState, kind: EngagementKind): KnownFact[] {
  const r = intakeResults(state, kind);
  const reg = state.registry ? registryFindings(state.registry, state).facts : [];
  return [...r.documents.facts, ...r.tables.facts, ...r.checklist.facts, ...r.financials.facts, ...reg];
}

/** A teljes iratlista: szabály alapú lista + felvett extra iratok. */
export function requestList(state: IntakeState, kind: EngagementKind): DocRequest[] {
  const base = buildRequestList(state.profile, kind);
  const ids = new Set(base.map((d) => d.id));
  return [...base, ...state.extraRequests.filter((d) => !ids.has(d.id))];
}

/** A „Hiányzik” állapotú iratok – az interjún rákérdezünk. */
export function missingRequests(state: IntakeState, kind: EngagementKind): { title: string; pillar: DocRequest['pillar'] }[] {
  return requestList(state, kind)
    .filter((d) => state.requestStatus[d.id] === 'MISSING')
    .map((d) => ({ title: d.title, pillar: d.pillar }));
}
