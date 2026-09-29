import type { EngagementKind } from '@/lib/engagement/kinds';
import type { InterviewAnalysis, IntervieweeRole, Transcript } from './types';
import { markSaved } from '@/lib/localSave';

/**
 * Egy interjúalanyhoz tartozó interjú: az interjúterv egy sora ehhez kötődik.
 * Élesben ez az `interviews` / `interview_transcripts` / `interview_findings`
 * sorokból áll elő (0002-es migráció); a prototípus a böngészőben tárolja.
 */
export interface InterviewRecord {
  role: IntervieweeRole;
  /** Álnév a jegyzetekhez (GDPR): pl. „Ügyvezető”, „KP-1”. */
  alias: string;
  heldAt: string | null;
  notes: string;
  transcript: Transcript | null;
  speakerNames: Record<string, string>;
  analysis: InterviewAnalysis | null;
  analysisIsSample: boolean;
  /** Melyik átvilágítás-típusra (célra) készült az elemzés. Hiányzik: régi mentés, nem ismert. */
  analysisKind?: EngagementKind | null;
  /** Elfogadott javaslatok kulcsai (a mátrixba átvéve). */
  accepted: string[];
  /** Elhangzott kérdések azonosítói. */
  asked: string[];
}

export type InterviewStatus = 'PLANNED' | 'IN_PROGRESS' | 'TRANSCRIBED' | 'ANALYZED';

export const STATUS_LABEL: Record<InterviewStatus, string> = {
  PLANNED: 'Tervezett',
  IN_PROGRESS: 'Folyamatban',
  TRANSCRIBED: 'Leirat kész',
  ANALYZED: 'Elemezve',
};

export function emptyRecord(role: IntervieweeRole, alias = ''): InterviewRecord {
  return { role, alias, heldAt: null, notes: '', transcript: null, speakerNames: {}, analysis: null, analysisIsSample: false, accepted: [], asked: [] };
}

export function recordStatus(r: InterviewRecord | undefined): InterviewStatus {
  if (!r) return 'PLANNED';
  if (r.analysis) return 'ANALYZED';
  if (r.transcript) return 'TRANSCRIBED';
  if (r.asked.length > 0 || r.notes.trim()) return 'IN_PROGRESS';
  return 'PLANNED';
}

export type InterviewRecords = Partial<Record<IntervieweeRole, InterviewRecord>>;

/** Tárolási kulcs projektenként (a projektszintű műveletek – törlés, mentés fájlba – is ezt használják). */
export const interviewsKey = (scenarioId: string) => `ict-hc:interviews:v1:${scenarioId}`;

export function loadRecords(scenarioId: string): InterviewRecords {
  try {
    const raw = localStorage.getItem(interviewsKey(scenarioId));
    return raw ? (JSON.parse(raw) as InterviewRecords) : {};
  } catch {
    return {};
  }
}

export function saveRecords(scenarioId: string, records: InterviewRecords): void {
  try {
    localStorage.setItem(interviewsKey(scenarioId), JSON.stringify(records));
    markSaved();
  } catch {
    /* privát mód – a munkamenet végéig memóriában marad */
  }
}

export function clearRecords(scenarioId: string): void {
  try {
    localStorage.removeItem(interviewsKey(scenarioId));
  } catch {
    /* ignore */
  }
}

/**
 * Az elemzés más célra (átvilágítás-típusra) készült, mint a mostani:
 * az AI a súlyosságot a célhoz mérte, ezért újra kell futtatni.
 * A minta-elemzés előre elkészített, típusfüggetlen – azt nem jelöljük.
 */
export function isAnalysisStale(r: InterviewRecord | undefined, kind: EngagementKind): boolean {
  return Boolean(r?.analysis && !r.analysisIsSample && r.analysisKind && r.analysisKind !== kind);
}
