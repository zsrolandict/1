import type { EngagementKind } from '@/lib/engagement/kinds';
import type { KnownFact } from '@/lib/interview/types';
import { evaluateChecklist, type ChecklistAnswers } from './checklist';
import { documentToIntake } from './documents/toIntake';
import type { DocumentRecord } from './documents/types';
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
  answers: ChecklistAnswers;
  tables: Partial<Record<TableKind, TableAnalysis>>;
  documents: DocumentRecord[];
  /** Elfogadott (a mátrixba / cégadatokba átvett) javaslatok kulcsai. */
  accepted: string[];
  /** Elvetett javaslatok kulcsai. */
  dismissed: string[];
}

export const EMPTY_INTAKE: IntakeState = { answers: {}, tables: {}, documents: [], accepted: [], dismissed: [] };

const key = (scenarioId: string) => `ict-hc:intake:v1:${scenarioId}`;

export function loadIntake(scenarioId: string): IntakeState {
  try {
    const raw = localStorage.getItem(key(scenarioId));
    return raw ? { ...EMPTY_INTAKE, ...(JSON.parse(raw) as Partial<IntakeState>) } : EMPTY_INTAKE;
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
    checklist: evaluateChecklist(state.answers, kind),
    tables: merge(Object.values(state.tables).map((t) => t!.result)),
    documents: merge(state.documents.map(documentToIntake)),
  };
}

/** Az interjúk ellentmondás-kereséséhez: a mintaeset tényei + az adatgyűjtés tényei. */
export function intakeFacts(state: IntakeState, kind: EngagementKind): KnownFact[] {
  const r = intakeResults(state, kind);
  return [...r.documents.facts, ...r.tables.facts, ...r.checklist.facts];
}

