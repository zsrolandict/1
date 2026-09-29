import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isAiConfigured, parseStructured } from '@/lib/ai/client.server';
import { requireAi } from '@/lib/auth/guard.server';
import { runRegistryExtraction } from '@/lib/intake/registry';
import { errorResponse } from '../../_errors';

export const maxDuration = 120;

/** Cégkivonat szövege → ellenőrzött cégadatok (idézet-ellenőrzéssel). */
export async function POST(req: Request) {
  const access = await requireAi(req, 'ai');
  if (!access.ok) return access.response;
  if (!isAiConfigured()) {
    return NextResponse.json({ error: 'Az AI nincs beállítva (ANTHROPIC_API_KEY vagy GEMINI_API_KEY).' }, { status: 503 });
  }
  const parsed = z.object({ text: z.string().min(50).max(100_000) }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'A cégkivonat szövege hiányzik vagy túl rövid.' }, { status: 400 });
  try {
    return NextResponse.json({ data: await runRegistryExtraction(parseStructured, parsed.data.text) });
  } catch (err) {
    return errorResponse(err);
  }
}
