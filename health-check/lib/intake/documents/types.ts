import type { EngagementKind } from '@/lib/engagement/kinds';
import type { Pillar, Scale5 } from '@/lib/risk/types';

/**
 * Dokumentumelemzés. A fájlt a szerver csak memóriában dolgozza fel, nem tárolja;
 * a munkaállapotba az ellenőrzött eredmény kerül (idézet + oldal), a teljes szöveg nem.
 */

export type DocumentFormat = 'PDF' | 'DOCX' | 'TXT';

export interface DocumentPage {
  /** „3. oldal” (PDF) vagy „2. szakasz” (Word/szöveg, ahol nincs oldal). */
  label: string;
  text: string;
}

export interface ExtractedDocument {
  fileName: string;
  format: DocumentFormat;
  pages: DocumentPage[];
}

export interface DocumentFinding {
  templateCode: string | null;
  pillar: Pillar;
  title: string;
  rationale: string;
  quote: string;
  /** Az ellenőrzés során talált oldal (nem a modelltől vesszük). */
  pageIndex: number | null;
  likelihood: Scale5;
  impact: Scale5;
  exposureHufEstimate: number | null;
  confidence: number;
}

export interface DocumentFact {
  pillar: Pillar;
  statement: string;
  quote: string;
  pageIndex: number | null;
}

export interface DocumentAnalysis {
  /** Pl. „Vevői keretszerződés”. */
  documentType: string;
  summary: string;
  findings: DocumentFinding[];
  facts: DocumentFact[];
  /** Amit az ilyen típusú dokumentumban keresni kell, de nem találtunk (pl. felelősségkorlátozás). */
  missingProvisions: string[];
  /** Nem igazolható idézetű, ezért eldobott tételek száma. */
  discardedUnverified: number;
}

export type RawDocumentAnalysis = Omit<DocumentAnalysis, 'discardedUnverified'>;

export interface DocumentRecord {
  id: string;
  fileName: string;
  format: DocumentFormat;
  pageLabels: string[];
  /** Maszkolt személyes adatok száma típusonként. */
  redactions: Record<string, number>;
  analyzedAt: string;
  analysis: DocumentAnalysis;
  /** Előre elkészített minta-elemzés, nem élő AI-hívás. */
  isSample: boolean;
  /** Melyik átvilágítás-típusra (célra) készült az élő elemzés. */
  kind?: EngagementKind;
}
