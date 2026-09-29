import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isAiConfigured, parseStructured } from '@/lib/ai/client.server';
import { requireAi } from '@/lib/auth/guard.server';
import { runSynthesis } from '@/lib/intake/synthesis';
import { RiskItemSchema } from '@/lib/interview/schemas';
import { errorResponse } from '../../_errors';

export const maxDuration = 300;

const Kind = z.enum(['HEALTH_CHECK', 'VENDOR_DD', 'BUY_SIDE_DD', 'FINANCING_READINESS', 'SUCCESSION', 'COMPLIANCE_AUDIT', 'POST_MERGER']);
const RequestSchema = z.object({
  kind: Kind,
  companyName: z.string().max(200),
  sources: z.array(
    z.object({
      id: z.string().max(10),
      kind: z.enum(['TÉNYÁLLÁS', 'KÉRDŐÍV', 'ADATTÁBLA', 'DOKUMENTUM', 'INTERJÚ']),
      label: z.string().max(300),
      text: z.string().max(60_000),
    }),
  ).min(1).max(60),
  existing: z.array(RiskItemSchema).max(300),
  pending: z.array(z.string().max(300)).max(300),
});

/** Összkép: a források együttes olvasása, idézettel igazolt új kockázatok. */
export async function POST(req: Request) {
  const access = await requireAi(req, 'ai');
  if (!access.ok) return access.response;
  if (!isAiConfigured()) {
    return NextResponse.json({ error: 'Az AI nincs beállítva (ANTHROPIC_API_KEY vagy GEMINI_API_KEY).' }, { status: 503 });
  }
  const parsed = RequestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Hibás kérés.' }, { status: 400 });
  const chars = parsed.data.sources.reduce((n, s) => n + s.text.length, 0);
  if (chars > 200_000) return NextResponse.json({ error: 'Túl sok forrásanyag egy elemzéshez.' }, { status: 413 });
  try {
    return NextResponse.json({ result: await runSynthesis(parseStructured, parsed.data) });
  } catch (err) {
    return errorResponse(err);
  }
}
