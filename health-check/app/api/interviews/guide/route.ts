import { NextResponse } from 'next/server';
import { isAiConfigured, suggestExtraQuestions } from '@/lib/interview/ai.server';
import { buildInterviewGuide } from '@/lib/interview/guide';
import { GuideRequestSchema } from '@/lib/interview/schemas';
import { requireStaff } from '@/lib/auth/guard.server';
import { errorResponse } from '../../_errors';

/**
 * Interjúvezérfonal: a szabályalapú kérdéslista mindig elkészül,
 * AI-bővítés csak kérésre és beállított kulccsal.
 */
export async function POST(req: Request) {
  const access = await requireStaff();
  if (!access.ok) return access.response;
  const parsed = GuideRequestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Hibás kérés.' }, { status: 400 });

  const { context, withAi } = parsed.data;
  const questions = buildInterviewGuide(context);
  if (!withAi) return NextResponse.json({ questions, aiQuestions: [] });
  if (!isAiConfigured()) {
    return NextResponse.json({ error: 'Az AI nincs beállítva (ANTHROPIC_API_KEY).' }, { status: 503 });
  }
  try {
    const aiQuestions = await suggestExtraQuestions(context, questions);
    return NextResponse.json({ questions, aiQuestions });
  } catch (err) {
    return errorResponse(err);
  }
}
