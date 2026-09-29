import { normalize } from '@/lib/interview/transcript';
import type { DocumentAnalysis, DocumentPage, RawDocumentAnalysis } from './types';

/**
 * Megkeresi az idézetet a dokumentumban (oldalhatáron átnyúlva is), és
 * visszaadja az oldal sorszámát. Amit nem talál, az nem bizonyíték.
 */
export function findQuoteInPages(pages: DocumentPage[], quote: string): number | null {
  const needle = normalize(quote);
  if (needle.length < 12) return null;
  let full = '';
  const starts: number[] = [];
  for (const p of pages) {
    starts.push(full.length);
    full += normalize(p.text) + ' ';
  }
  const at = full.indexOf(needle);
  if (at < 0) return null;
  let idx = 0;
  for (let i = 0; i < starts.length; i++) if (starts[i] <= at) idx = i;
  return idx;
}

/** Az AI-eredmény ellenőrzése: csak a szó szerint megtalált idézetű tételek maradnak. */
export function verifyDocumentAnalysis(raw: RawDocumentAnalysis, pages: DocumentPage[]): DocumentAnalysis {
  let discarded = 0;
  const findings = raw.findings.flatMap((f) => {
    const pageIndex = findQuoteInPages(pages, f.quote);
    if (pageIndex == null) {
      discarded++;
      return [];
    }
    return [{ ...f, pageIndex, confidence: Math.min(1, Math.max(0, f.confidence)) }];
  });
  const facts = raw.facts.flatMap((f) => {
    const pageIndex = findQuoteInPages(pages, f.quote);
    if (pageIndex == null) {
      discarded++;
      return [];
    }
    return [{ ...f, pageIndex }];
  });
  return {
    documentType: raw.documentType,
    summary: raw.summary,
    findings: findings.sort((a, b) => b.confidence - a.confidence),
    facts,
    missingProvisions: raw.missingProvisions.slice(0, 8),
    discardedUnverified: discarded,
  };
}
