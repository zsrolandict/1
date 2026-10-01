import type { EngagementKind } from '@/lib/engagement/kinds';
import type { Pillar, Scale5 } from '@/lib/risk/types';
import type { FactKey, FinField } from '../financials/model';
import type { DocType } from './docTypes';

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

/** Beszámolósor kiolvasva (forintra átváltva), az ellenőrzött idézettel. */
export interface ExtractedValue {
  field: FinField;
  year: number;
  valueHuf: number;
  /** A szám úgy, ahogy az iratban áll (pl. „2 104 350”). */
  stated: string;
  quote: string;
  pageIndex: number | null;
}

/** Tény kiolvasva (pl. könyvvizsgálói vélemény típusa), idézettel. */
export interface ExtractedFact {
  key: FactKey;
  value: string | number | boolean;
  quote: string;
  pageIndex: number | null;
}

export type FinUnit = 'HUF' | 'THOUSAND_HUF' | 'MILLION_HUF';

export interface FinancialExtraction {
  unit: FinUnit;
  values: ExtractedValue[];
  facts: ExtractedFact[];
}

export interface DocumentAnalysis {
  /** Pl. „Vevői keretszerződés”. */
  documentType: string;
  /** A tanácsadó által választott (vagy felismert) irattípus. */
  docType?: DocType;
  /** Pénzügyi iratnál a kiolvasott számok és tények (jóváhagyásra várnak). */
  financials?: FinancialExtraction;
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
