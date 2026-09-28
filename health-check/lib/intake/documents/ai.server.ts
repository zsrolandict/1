import { parseStructured } from '@/lib/ai/client.server';
import type { EngagementKind } from '@/lib/engagement/kinds';
import { runDocumentAnalysis } from './prompts';
import type { DocumentAnalysis, DocumentPage } from './types';

// Csak szerveroldalon importálható (API-kulcs).

export function analyzeDocument(input: { fileName: string; pages: DocumentPage[]; kind: EngagementKind }): Promise<DocumentAnalysis> {
  return runDocumentAnalysis(parseStructured, input);
}
