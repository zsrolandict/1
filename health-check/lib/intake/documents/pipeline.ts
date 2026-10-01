import type { StructuredCall } from '@/lib/ai/structured';
import type { EngagementKind } from '@/lib/engagement/kinds';
import { documentChars } from './extract';
import { runDocumentAnalysis } from './prompts';
import { redactPages } from './redact';
import type { ExtractedDocument } from './types';
import type { DocType } from './docTypes';
import { UserFacingError } from '@/lib/errors';

/**
 * Kinyert dokumentum → maszkolás → AI → ellenőrzött eredmény.
 * Ugyanez fut a szerveren és a böngészős előnézetben; csak a szövegkinyerés
 * és az AI-hívás (`call`) forrása más.
 */
export async function analyzeExtracted(
  call: StructuredCall,
  doc: ExtractedDocument,
  kind: EngagementKind,
  limits: { maxChars: number; maxPages: number },
  docType?: DocType,
) {
  if (doc.pages.length > limits.maxPages || documentChars(doc.pages) > limits.maxChars) {
    throw new UserFacingError('A dokumentum túl hosszú egy elemzéshez. Töltse fel részenként.');
  }
  const { pages, counts } = redactPages(doc.pages);
  const analysis = await runDocumentAnalysis(call, { fileName: doc.fileName, pages, kind, docType });
  return { analysis, format: doc.format, pageLabels: pages.map((p) => p.label), redactions: counts };
}
