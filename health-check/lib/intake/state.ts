import type { EngagementKind } from '@/lib/engagement/kinds';
import type { KnownFact } from '@/lib/interview/types';
import { evaluateChecklist, type ChecklistAnswers } from './checklist';
import { documentToIntake } from './documents/toIntake';
import type { DocumentRecord } from './documents/types';
import { buildRequestList, EMPTY_PROFILE, normalizeProfile, type CaseProfile, type DocRequest, type RequestStatus } from './requests';
import type { SynthesisResult } from './synthesis';
import type { TableAnalysis } from './tables/metrics';
import type { TableKind } from './tables/spec';
import type { IntakeResult } from './types';

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
  answers: ChecklistAnswers;
  tables: Partial<Record<TableKind, TableAnalysis>>;
  documents: DocumentRecord[];
  /** Elfogadott (a mátrixba / cégadatokba átvett) javaslatok kulcsai. */
  accepted: string[];
  /** Elvetett javaslatok kulcsai. */
  dismissed: string[];
}

export const EMPTY_INTAKE: IntakeState = { profile: EMPTY_PROFILE, requestStatus: {}, extraRequests: [], answers: {}, tables: {}, documents: [], accepted: [], dismissed: [] };

const key = (scenarioId: string) => `ict-hc:intake:v1:${scenarioId}`;

export function loadIntake(scenarioId: string): IntakeState {
  try {
    const raw = localStorage.getItem(key(scenarioId));
    if (!raw) return EMPTY_INTAKE;
    const saved = JSON.parse(raw) as Partial<IntakeState>;
    return { ...EMPTY_INTAKE, ...saved, profile: normalizeProfile(saved.profile ?? {}) };
  } catch {
    return EMPTY_INTAKE;
  }
}

export function saveIntake(scenarioId: string, state: IntakeState): void {
  try {
    localStorage.setItem(key(scenarioId), JSON.stringify(state));
  } catch {
    /* privát mód – a munkamenet végéig memóriában marad */
  }
}

export function clearIntake(scenarioId: string): void {
  try {
    localStorage.removeItem(key(scenarioId));
  } catch {
    /* ignore */
  }
}

export interface IntakeResults {
  checklist: IntakeResult;
  tables: IntakeResult;
  documents: IntakeResult;
}

export function intakeResults(state: IntakeState, kind: EngagementKind): IntakeResults {
  const merge = (rs: IntakeResult[]): IntakeResult => ({
    suggestions: rs.flatMap((r) => r.suggestions),
    companySuggestions: rs.flatMap((r) => r.companySuggestions),
    facts: rs.flatMap((r) => r.facts),
  });
  return {
    checklist: evaluateChecklist(state.answers, kind, state.profile.sectors),
    tables: merge(Object.values(state.tables).map((t) => t!.result)),
    documents: merge(state.documents.map(documentToIntake)),
  };
}

/** Az interjúk ellentmondás-kereséséhez: a mintaeset tényei + az adatgyűjtés tényei. */
export function intakeFacts(state: IntakeState, kind: EngagementKind): KnownFact[] {
  const r = intakeResults(state, kind);
  return [...r.documents.facts, ...r.tables.facts, ...r.checklist.facts];
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
