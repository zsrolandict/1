import { z } from 'zod';
import { EngagementKindSchema } from '@/lib/engagement/kindSchema';

// Bemeneti validáció az API-végpontokhoz (a kliensről jövő adat nem megbízható).

const Pillar = z.enum(['FINANCE', 'LEGAL', 'OPERATIONS', 'HR']);
const Kind = EngagementKindSchema;
const Role = z.enum(['OWNER_CEO', 'CFO', 'HR_LEAD', 'OPS_LEAD', 'SALES_LEAD', 'IT_LEAD', 'KEY_PERSON']);
const Scale = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]);

export const KnownFactSchema = z.object({
  id: z.string().max(64),
  pillar: Pillar,
  statement: z.string().max(2000),
  source: z.string().max(500),
  askInInterview: z.boolean().optional(),
});

export const RiskItemSchema = z.object({
  id: z.string().max(100),
  code: z.string().max(40),
  pillar: Pillar,
  title: z.string().max(300),
  description: z.string().max(2000),
  identified: z.boolean(),
  likelihood: Scale,
  impact: Scale,
  exposureHuf: z.number().nonnegative(),
  remediationDays: z.number().nonnegative(),
  remediation: z.string().max(2000),
  division: z.enum(['LEGAL', 'TAX', 'ACCOUNTING', 'HR', 'ADVISORY']),
  serviceFeeHuf: z.number().nonnegative(),
  source: z.enum(['MANUAL', 'CHECKLIST', 'DATA_TABLE', 'CROSS_CHECK', 'AI_DOCUMENT', 'AI_INTERVIEW', 'AI_SYNTHESIS']).optional(),
  evidence: z.string().max(2000).optional(),
});

export const GuideContextSchema = z.object({
  kind: Kind,
  role: Role,
  risks: z.array(RiskItemSchema).max(200),
  missingDocuments: z.array(z.object({ title: z.string().max(300), pillar: Pillar })).max(100),
  facts: z.array(KnownFactSchema).max(200),
});

export const GuideRequestSchema = z.object({
  context: GuideContextSchema,
  withAi: z.boolean().default(false),
});

/** ~2 órás interjú bőven belefér; efölött darabolni kell. */
export const MAX_TRANSCRIPT_CHARS = 150_000;

export const TranscriptSchema = z.object({
  language: z.string().max(10),
  durationMs: z.number().nonnegative(),
  origin: z.enum(['AUDIO', 'NOTES']),
  timed: z.boolean(),
  segments: z
    .array(
      z.object({
        speaker: z.string().max(60),
        startMs: z.number().nonnegative(),
        endMs: z.number().nonnegative(),
        text: z.string().max(20_000),
      }),
    )
    .min(1)
    .max(5000),
});

export const AnalyzeRequestSchema = z.object({
  transcript: TranscriptSchema,
  role: Role,
  kind: Kind,
  facts: z.array(KnownFactSchema).max(200),
});

export const MAX_AUDIO_BYTES = 200 * 1024 * 1024;
