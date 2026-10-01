import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isAiConfigured, parseStructured } from '@/lib/ai/client.server';
import { requireAi } from '@/lib/auth/guard.server';
import { EngagementKindSchema } from '@/lib/engagement/kindSchema';
import { runOpinionReview } from '@/lib/risk/review';
import { errorResponse } from '../../_errors';

export const maxDuration = 120;

const S = (max: number) => z.string().max(max);
const RequestSchema = z.object({
  kind: EngagementKindSchema,
  item: z.object({
    code: S(40),
    title: S(300),
    pillar: z.enum(['FINANCE', 'LEGAL', 'OPERATIONS', 'HR']),
    description: S(2000),
    reasoning: S(6000),
    likelihood: z.number().int().min(1).max(5),
    impact: z.number().int().min(1).max(5),
    exposureHuf: z.number().finite().nonnegative(),
    exposureExplanation: S(1000),
    rag: S(20),
  }),
  derivation: z.array(z.object({ label: S(100), value: S(400) })).max(20),
  evidence: z.array(z.object({ id: S(80), kind: S(60), ref: S(2000), quote: S(4000).optional(), rationale: S(4000).optional() })).max(40),
  thread: z.array(z.object({ role: z.enum(['EXPERT', 'AI']), text: S(4000) })).max(12),
  opinion: z.string().min(3).max(4000),
});

/** Szakértői vélemény kritikus felülvizsgálata a tétel forrásai és levezetése alapján. */
export async function POST(req: Request) {
  const access = await requireAi(req, 'ai');
  if (!access.ok) return access.response;
  if (!isAiConfigured()) {
    return NextResponse.json({ error: 'Az AI nincs beállítva (ANTHROPIC_API_KEY vagy GEMINI_API_KEY).' }, { status: 503 });
  }
  const parsed = RequestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Hibás kérés.' }, { status: 400 });
  try {
    return NextResponse.json({ review: await runOpinionReview(parseStructured, parsed.data) });
  } catch (err) {
    return errorResponse(err);
  }
}
