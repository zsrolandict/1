import { AiRefusalError, isAiConfigured, parseStructured } from '@/lib/ai/client.server';
import type { EngagementKind } from '@/lib/engagement/kinds';
import { runInterviewAnalysis, runQuestionSuggestions } from './prompts';
import type { GuideContext, InterviewAnalysis, InterviewQuestion, IntervieweeRole, KnownFact, Transcript } from './types';

// Csak szerveroldalon (route handler) importálható: az API-kulcs nem kerülhet a kliensre.

export { AiRefusalError, isAiConfigured };

export function analyzeInterview(input: {
  transcript: Transcript;
  role: IntervieweeRole;
  kind: EngagementKind;
  facts: KnownFact[];
}): Promise<InterviewAnalysis> {
  return runInterviewAnalysis(parseStructured, input);
}

export function suggestExtraQuestions(ctx: GuideContext, existing: InterviewQuestion[]): Promise<InterviewQuestion[]> {
  return runQuestionSuggestions(parseStructured, ctx, existing);
}
