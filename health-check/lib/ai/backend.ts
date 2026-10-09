import type { EngagementKind } from '@/lib/engagement/kinds';
import type { DocumentAnalysis, DocumentFormat } from '@/lib/intake/documents/types';
import type { DocType } from '@/lib/intake/documents/docTypes';
import type { DiscussionEntry, OpinionReview, ReviewRequest } from '@/lib/risk/review';
import { activeProjectId } from '@/lib/risk/store';
import { flushProject, isServerProject } from '@/lib/sync/serverSync';
import type { CaseSuggestion } from '@/lib/intake/casePrompts';
import type { SynthesisResult, SynthesisSource } from '@/lib/intake/synthesis';
import type { RegistryData } from '@/lib/intake/registry';
import type { RiskItem } from '@/lib/risk/types';
import type { CaseProfile, DocRequest } from '@/lib/intake/requests';
import type { GuideContext, InterviewAnalysis, InterviewQuestion, IntervieweeRole, KnownFact, Transcript } from '@/lib/interview/types';

/**
 * Honnan jön az AI a felületen. Az alkalmazásban a saját szerver API-ja
 * (kulcs a szerveren); a böngészős előnézetben a claude.ai beépített AI-ja.
 * A komponensek csak ezen a felületen át hívnak AI-t.
 */
export interface AiStatus {
  ai: boolean;
  documents: boolean;
  transcription: boolean;
  transcriptionAccept?: string;
  transcriptionProvider?: string | null;
  aiProvider?: string | null;
  /** Magyarázat, ha a leirat nem elérhető (a felület ezt írja ki). */
  transcriptionNote?: string;
}

export interface DocumentResult {
  analysis: DocumentAnalysis;
  format: DocumentFormat;
  pageLabels: string[];
  redactions: Record<string, number>;
}

export interface AiBackend {
  status(): Promise<AiStatus>;
  suggestQuestions(context: GuideContext): Promise<InterviewQuestion[]>;
  transcribe(file: File, opts: { consent: boolean; speakers: number }): Promise<Transcript>;
  analyzeInterview(req: { transcript: Transcript; role: IntervieweeRole; kind: EngagementKind; facts: KnownFact[] }): Promise<InterviewAnalysis>;
  analyzeDocument(file: File, kind: EngagementKind, docType?: DocType): Promise<DocumentResult>;
  suggestCase(req: CaseRequest): Promise<CaseSuggestion>;
  synthesize(req: SynthesisRequest): Promise<SynthesisResult>;
  extractRegistry(text: string): Promise<RegistryData>;
  /**
   * Szakértői vélemény kritikus felülvizsgálata (nem változtat semmit, csak javasol).
   * Szerveres projektnél a szerver az adatbázisból olvas és rögzít; a rögzített
   * bejegyzéseket (`entries`) adja vissza, a felület ezeket veszi át.
   */
  reviewOpinion(req: ReviewRequest, itemKey?: string): Promise<OpinionReview & { entries?: DiscussionEntry[] }>;
}

export interface SynthesisRequest {
  kind: EngagementKind;
  companyName: string;
  sources: SynthesisSource[];
  existing: RiskItem[];
  pending: string[];
}

export interface CaseRequest {
  profile: CaseProfile;
  kind: EngagementKind;
  companyName: string;
  current: DocRequest[];
}

async function callApi<T>(url: string, init: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? `Hiba (${res.status})`);
  return body as T;
}

const json = (body: unknown): RequestInit => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

/** Alapértelmezés: a Next.js alkalmazás saját API-végpontjai. */
export const serverBackend: AiBackend = {
  async status() {
    try {
      return await callApi<AiStatus>('/api/interviews/status', { method: 'GET' });
    } catch {
      return { ai: false, documents: false, transcription: false };
    }
  },
  async suggestQuestions(context) {
    return (await callApi<{ aiQuestions: InterviewQuestion[] }>('/api/interviews/guide', json({ context, withAi: true }))).aiQuestions;
  },
  async transcribe(file, { consent, speakers }) {
    const form = new FormData();
    form.append('audio', file);
    form.append('consent', String(consent));
    form.append('speakers', String(speakers));
    return (await callApi<{ transcript: Transcript }>('/api/interviews/transcribe', { method: 'POST', body: form })).transcript;
  },
  async analyzeInterview(req) {
    return (await callApi<{ analysis: InterviewAnalysis }>('/api/interviews/analyze', json(req))).analysis;
  },
  async analyzeDocument(file, kind, docType) {
    const form = new FormData();
    form.append('file', file);
    form.append('kind', kind);
    if (docType) form.append('docType', docType);
    return callApi<DocumentResult>('/api/documents/analyze', { method: 'POST', body: form });
  },
  async suggestCase(req) {
    return (await callApi<{ suggestion: CaseSuggestion }>('/api/intake/case', json(req))).suggestion;
  },
  async synthesize(req) {
    return (await callApi<{ result: SynthesisResult }>('/api/intake/synthesis', json(req))).result;
  },
  async extractRegistry(text) {
    return (await callApi<{ data: RegistryData }>('/api/intake/registry', json({ text }))).data;
  },
  async reviewOpinion(req, itemKey) {
    const projectId = activeProjectId();
    if (itemKey && isServerProject(projectId)) {
      // A szerver a mentett állapotból dolgozik: előbb a helyi módosítások fel.
      await flushProject(projectId);
      const res = await callApi<{ review: OpinionReview; entries: DiscussionEntry[] }>(
        '/api/risk/review',
        json({ engagementId: projectId, itemKey, opinion: req.opinion }),
      );
      return { ...res.review, entries: res.entries };
    }
    return (await callApi<{ review: OpinionReview }>('/api/risk/review', json(req))).review;
  },
};
