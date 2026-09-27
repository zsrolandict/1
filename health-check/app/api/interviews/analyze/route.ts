import { NextResponse } from 'next/server';
import { analyzeInterview, isAiConfigured } from '@/lib/interview/ai.server';
import { AnalyzeRequestSchema, MAX_TRANSCRIPT_CHARS } from '@/lib/interview/schemas';
import { errorResponse } from '../_errors';

export const maxDuration = 300;

export async function POST(req: Request) {
  if (!isAiConfigured()) {
    return NextResponse.json({ error: 'Az AI nincs beállítva (ANTHROPIC_API_KEY).' }, { status: 503 });
  }
  const parsed = AnalyzeRequestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Hibás kérés.' }, { status: 400 });

  const chars = parsed.data.transcript.segments.reduce((n, s) => n + s.text.length, 0);
  if (chars > MAX_TRANSCRIPT_CHARS) {
    return NextResponse.json({ error: 'A leirat túl hosszú egy elemzéshez. Bontsa részekre.' }, { status: 413 });
  }
  try {
    return NextResponse.json({ analysis: await analyzeInterview(parsed.data) });
  } catch (err) {
    return errorResponse(err);
  }
}
