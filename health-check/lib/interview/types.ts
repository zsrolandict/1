import type { Pillar, RiskItem } from '@/lib/risk/types';
import type { EngagementKind } from '@/lib/engagement/kinds';

export type IntervieweeRole = 'OWNER_CEO' | 'CFO' | 'HR_LEAD' | 'OPS_LEAD' | 'SALES_LEAD' | 'IT_LEAD' | 'KEY_PERSON';

/** Miért került a kérdés a listára – ez jelenik meg a tanácsadónak. */
export type QuestionSource =
  | { type: 'BASE' }
  | { type: 'KIND'; kind: EngagementKind }
  | { type: 'RED_FLAG'; code: string; title: string }
  | { type: 'MISSING_DOCUMENT'; title: string }
  | { type: 'DOCUMENT_FINDING'; document: string; finding: string }
  | { type: 'AI' };

export interface InterviewQuestion {
  id: string;
  pillar: Pillar;
  text: string;
  /** Mire figyeljen a kérdező / mi a „jó” válasz. */
  listenFor?: string;
  followUps: string[];
  source: QuestionSource;
  /** 1 = kötelező, 2 = ha van idő, 3 = opcionális */
  priority: 1 | 2 | 3;
}

/** Dokumentumokból (AI előszűrés) vagy csekklistából már ismert tény. */
export interface KnownFact {
  id: string;
  pillar: Pillar;
  statement: string;
  /** pl. "Top 5 szerződés #2, 14. o. 8.2 pont" vagy "Csekklista 12. kérdés" */
  source: string;
  /** false: csak az ellentmondás-kereséshez kell, külön interjúkérdés nem lesz belőle. */
  askInInterview?: boolean;
}

export interface GuideContext {
  kind: EngagementKind;
  role: IntervieweeRole;
  /** Azonosított (bepipált) kockázatok a Red Flag mátrixból. */
  risks: RiskItem[];
  missingDocuments: { title: string; pillar: Pillar }[];
  facts: KnownFact[];
}

export interface TranscriptSegment {
  speaker: string;          // "A", "B" … vagy név/szerep, ha a tanácsadó átnevezte
  startMs: number;
  endMs: number;
  text: string;
}

export interface Transcript {
  language: string;         // "hu-HU"
  durationMs: number;
  segments: TranscriptSegment[];
  /** Honnan jött: hangfájl-leirat vagy kézzel beillesztett jegyzet. */
  origin: 'AUDIO' | 'NOTES';
  /** Valós időbélyegek vannak-e (hangfájl, vagy [hh:mm:ss] jelölt jegyzet). */
  timed: boolean;
}

export interface InterviewStatement {
  pillar: Pillar;
  summary: string;
  quote: string;
  speaker: string;
  startMs: number | null;
}

export interface SuggestedRedFlag {
  templateCode: string | null;
  pillar: Pillar;
  title: string;
  rationale: string;
  quote: string;
  startMs: number | null;
  likelihood: 1 | 2 | 3 | 4 | 5;
  impact: 1 | 2 | 3 | 4 | 5;
  exposureHufEstimate: number | null;
  confidence: number;       // 0–1
}

export interface Contradiction {
  pillar: Pillar;
  claim: string;            // amit az interjúalany mondott
  quote: string;
  startMs: number | null;
  conflictingFactId: string;
  conflictingSource: string;
  explanation: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface InterviewAnalysis {
  summary: string;
  statements: InterviewStatement[];
  suggestedRedFlags: SuggestedRedFlag[];
  contradictions: Contradiction[];
  followUpQuestions: string[];
  /** Azok a tételek, amelyeket az idézet-ellenőrzés kiszűrt (nincs benne a leiratban). */
  discardedUnverified: number;
}
