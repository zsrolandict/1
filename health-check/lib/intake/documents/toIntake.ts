import type { KnownFact } from '@/lib/interview/types';
import type { IntakeResult, IntakeSuggestion } from '../types';
import type { DocumentRecord } from './types';

const where = (d: DocumentRecord, i: number | null) => (i != null && d.pageLabels[i] ? `, ${d.pageLabels[i]}` : '');

/** Dokumentum-elemzés → a közös javaslat- és tényformátum. */
export function documentToIntake(d: DocumentRecord): IntakeResult {
  const suggestions: IntakeSuggestion[] = d.analysis.findings.map((f, i) => ({
    key: `DOC:${d.id}:${i}:${f.templateCode ?? f.title}:${f.likelihood}${f.impact}`,
    origin: 'AI_DOCUMENT',
    code: f.templateCode,
    pillar: f.pillar,
    title: f.title,
    rationale: f.rationale,
    evidence: `„${f.quote}” – ${d.fileName}${where(d, f.pageIndex)}`,
    ref: `${d.fileName}${where(d, f.pageIndex)}`,
    quote: f.quote,
    link: { page: 'adatok', tab: 'documents', anchor: `doc-${d.id}` },
    likelihood: f.likelihood,
    impact: f.impact,
    exposureHufEstimate: f.exposureHufEstimate,
    confidence: f.confidence,
  }));
  const facts: KnownFact[] = d.analysis.facts.map((f, i) => ({
    id: `DOC-${d.id}-${i + 1}`,
    pillar: f.pillar,
    statement: f.statement,
    source: `${d.fileName}${where(d, f.pageIndex)}`,
  }));
  return { suggestions, companySuggestions: [], facts };
}
